import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ApiError } from './api-errors.js';

const WINDOW_MS = 60_000;
const BURST_WINDOW_MS = 10_000;
const BURST_LIMIT = 5;
const MAX_TRACKED_IPS = 10_000;

@Injectable()
export class InvitationRateGuard implements CanActivate {
  private nextSweep = 0;
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.limit = Number(
      config.get<string>('RATE_LIMIT_PER_MINUTE')?.trim() || 30,
    );
    if (!Number.isSafeInteger(this.limit) || this.limit < 0) {
      throw new Error('RATE_LIMIT_PER_MINUTE phải là số nguyên không âm.');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.limit === 0) return true;
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const now = Date.now();
    if (now >= this.nextSweep) {
      for (const [key, timestamps] of this.hits) {
        if (now - (timestamps.at(-1) ?? 0) >= WINDOW_MS)
          this.hits.delete(key);
      }
      this.nextSweep = now + WINDOW_MS;
    }

    const hits = this.hits.get(ip);
    const response = http.getResponse<Response>();
    if (!hits && this.hits.size >= MAX_TRACKED_IPS) {
      this.reject(response, this.nextSweep - now);
    }

    const timestamps = (hits ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );
    const burstStart = timestamps.at(-BURST_LIMIT);
    const burstWait =
      burstStart === undefined ? 0 : burstStart + BURST_WINDOW_MS - now;
    const minuteWait =
      timestamps.length >= this.limit
        ? (timestamps[0] ?? now) + WINDOW_MS - now
        : 0;
    const wait = Math.max(burstWait, minuteWait);
    if (wait > 0) {
      this.reject(response, wait);
    }
    timestamps.push(now);
    this.hits.set(ip, timestamps);
    return true;
  }

  private reject(response: Response, waitMs: number): never {
    response.setHeader('Retry-After', String(Math.ceil(waitMs / 1000)));
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
    );
  }
}
