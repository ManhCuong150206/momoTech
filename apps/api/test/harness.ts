import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module.js';
import { GeocodingService } from '../src/geocoding/geocoding.service.js';
import type { AiExtractor } from '../src/viec-that/ai.js';
import { AiService } from '../src/viec-that/ai.service.js';
import { DemoService } from '../src/viec-that/demo.service.js';
import type { Db } from '../src/viec-that/db.js';
import { HistoryService } from '../src/viec-that/history.service.js';
import { InvitationRateGuard } from '../src/viec-that/invitation-rate.guard.js';
import type { PlaceFinder } from '../src/viec-that/location.js';

// Dựng API NestJS thật cho kiểm thử (API và web). Dịch vụ ngoài và cơ sở dữ liệu được thay
// bằng bản giả lập truyền vào, không đọc .env của máy phát triển. Gọi qua HTTP thật trên 127.0.0.1.

// Giữ fetch gốc: test web thay global fetch bằng hàm gọi vào đây.
const nativeFetch = globalThis.fetch;

export interface HarnessOptions {
  /** Có db thì bật lịch sử. Không có thì các endpoint lịch sử trả 503. */
  db?: Db;
  historyTtlDays?: number;
  historyMaxPerDevice?: number;
  cookieSecure?: boolean;
  /** Bộ trích AI giả lập. Thiếu thì chế độ live chỉ dùng luật cố định. */
  ai?: AiExtractor;
  /** Vietmap giả lập. Thiếu thì địa điểm là "Chưa đối chiếu tự động". */
  places?: PlaceFinder;
  /** Giới hạn yêu cầu mỗi phút mỗi IP. Mặc định 0 (tắt) để test không bị 429. */
  rateLimitPerMinute?: number;
  /** false: tắt ca mẫu như bản chạy thực tế (DEMO_CASES_ENABLED=false). Mặc định bật. */
  demoCasesEnabled?: boolean;
}

export interface InjectOptions {
  method?: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
}

export interface InjectResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<T = any>(): T;
}

export interface TestApp {
  inject(opts: InjectOptions): Promise<InjectResponse>;
  ready(): Promise<void>;
  close(): Promise<void>;
}

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

export function buildApp(opts: HarnessOptions = {}): TestApp {
  let started: Promise<{ app: INestApplication; base: string }> | undefined;

  const start = () =>
    (started ??= (async () => {
      const guard = new InvitationRateGuard(
        fakeConfig({
          RATE_LIMIT_PER_MINUTE: String(opts.rateLimitPerMinute ?? 0),
        }),
      );
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(HistoryService)
        .useValue({
          db: opts.db,
          ttlDays: opts.historyTtlDays ?? 30,
          maxPerDevice: opts.historyMaxPerDevice ?? 100,
          cookieSecure: opts.cookieSecure ?? false,
        })
        .overrideProvider(AiService)
        .useValue({ extractor: opts.ai })
        .overrideProvider(DemoService)
        .useValue({ enabled: opts.demoCasesEnabled ?? true })
        .overrideProvider(GeocodingService)
        .useValue(
          opts.places ?? { configured: false, findPlace: async () => null },
        )
        .overrideProvider(InvitationRateGuard)
        .useValue(guard)
        .overrideGuard(InvitationRateGuard)
        .useValue(guard)
        .compile();
      const app = moduleRef.createNestApplication({ logger: false });
      await app.listen(0, '127.0.0.1');
      const { port } = app.getHttpServer().address() as AddressInfo;
      return { app, base: `http://127.0.0.1:${port}` };
    })());

  return {
    async inject({ method = 'GET', url, payload, headers = {} }) {
      const { base } = await start();
      const h: Record<string, string> = { ...headers };
      let body: string | undefined;
      if (typeof payload === 'string') body = payload;
      else if (payload !== undefined) {
        body = JSON.stringify(payload);
        h['content-type'] ??= 'application/json';
      }
      const res = await nativeFetch(base + url, {
        method,
        headers: h,
        body,
        redirect: 'manual',
      });
      const text = await res.text();
      const out: Record<string, string | string[]> = {};
      res.headers.forEach((value, key) => {
        if (key !== 'set-cookie') out[key] = value;
      });
      const cookies = res.headers.getSetCookie();
      if (cookies.length) out['set-cookie'] = cookies.length === 1 ? cookies[0]! : cookies;
      return {
        statusCode: res.status,
        body: text,
        headers: out,
        json: () => JSON.parse(text),
      };
    },
    async ready() {
      await start();
    },
    async close() {
      if (started) await (await started).app.close();
    },
  };
}
