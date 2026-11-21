import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type {
  DemoCaseSummary,
  ErrorCode,
  DeleteHistoryRequest,
  ErrorResponse,
  ExtractRequest,
  HealthResponse,
  VerifyRequest,
} from '../../../shared/contract.js';
import {
  deleteHistoryRequestSchema,
  deleteHistoryResponseSchema,
  demoCasesResponseSchema,
  extractRequestSchema,
  extractResponseSchema,
  healthResponseSchema,
  historyDetailResponseSchema,
  historyIdParamsSchema,
  historyListResponseSchema,
  verifyRequestSchema,
  verifyResponseSchema,
} from '../../../shared/schemas.js';
import { type DemoData, loadDemoData } from './demo-data.js';
import type { Db } from './db.js';
import {
  cookieHeader,
  deleteChecks,
  getCheck,
  hashToken,
  insertCheck,
  listChecks,
  newDeviceToken,
  readDeviceToken,
} from './history.js';
import type { AiExtractor } from './ai.js';
import { extractLive, extractSimulated } from './extract.js';
import type { PlacesClient } from './places.js';
import { QuoteNotInSourceError, verifyLive, verifySimulated } from './verify.js';

export const API_VERSION = '0.1.0';

function errorBody(code: ErrorCode, message: string, details?: unknown): ErrorResponse {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export interface BuildOptions {
  data?: DemoData;
  logger?: boolean | { level: string };
  /** Có db thì bật lịch sử tra cứu. Không có thì các endpoint lịch sử trả 503. */
  db?: Db;
  historyTtlDays?: number;
  cookieSecure?: boolean;
  /** Bộ trích AI (Bedrock). Thiếu thì chế độ live chỉ dùng luật cố định. */
  ai?: AiExtractor;
  /** Tra cứu địa điểm (Google Places). Thiếu thì địa điểm là 'Chưa đối chiếu tự động'. */
  places?: PlacesClient;
  /** Số bản ghi lịch sử tối đa mỗi thiết bị. Bản cũ nhất bị xóa khi vượt. */
  historyMaxPerDevice?: number;
  /** Giới hạn số yêu cầu mỗi phút mỗi IP cho các endpoint gọi dịch vụ. 0 là tắt. */
  rateLimitPerMinute?: number;
  /** true khi chạy sau Caddy: lấy IP người dùng từ X-Forwarded-For để giới hạn tần suất đúng. */
  trustProxy?: boolean;
}

export function buildApp(opts: BuildOptions = {}): FastifyInstance {
  const data = opts.data ?? loadDemoData();
  const db = opts.db;
  const ttlDays = opts.historyTtlDays ?? 30;
  const cookieSecure = opts.cookieSecure ?? false;
  const maxPerDevice = opts.historyMaxPerDevice ?? 100;
  // Nhật ký chỉ ghi phương thức, đường dẫn và mã trạng thái. Không ghi nội dung lời mời.
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: opts.trustProxy ?? false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: true } },
  });

  app.setErrorHandler((err, _req, reply) => {
    const e = err as { validation?: unknown; statusCode?: number; message: string };
    if (e.validation) {
      return reply
        .status(400)
        .send(errorBody('VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.', e.validation));
    }
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(e.statusCode).send(errorBody('VALIDATION_ERROR', 'Yêu cầu không hợp lệ.'));
    }
    app.log.error({ err: { name: (err as Error).name } }, 'unhandled error');
    return reply.status(500).send(errorBody('INTERNAL_ERROR', 'Máy chủ gặp lỗi. Thử lại sau.'));
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send(errorBody('NOT_FOUND', 'Không tìm thấy đường dẫn.')),
  );

  // Giới hạn tần suất theo IP cho hai endpoint gọi dịch vụ tốn phí (Bedrock, Places). Trong bộ nhớ, một tiến trình.
  const rpm = opts.rateLimitPerMinute ?? 0;
  const hits = new Map<string, number[]>();
  app.addHook('onRequest', async (req, reply) => {
    if (rpm <= 0 || req.method !== 'POST' || !req.url.startsWith('/api/v1/invitations/')) return;
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= rpm) {
      hits.set(req.ip, recent);
      return reply.status(429).header('Retry-After', '60').send(errorBody('RATE_LIMITED', 'Bạn gửi quá nhiều yêu cầu. Thử lại sau ít phút.'));
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 10_000) for (const [ip, ts] of hits) if (!ts.some((t) => now - t < 60_000)) hits.delete(ip);
  });

  app.get<{ Reply: HealthResponse }>(
    '/healthz',
    { schema: { response: { 200: healthResponseSchema } } },
    async () => ({
      status: 'ok',
      service: 'viec-that-api',
      version: API_VERSION,
      time: new Date().toISOString(),
      modes: ['simulated', 'live'],
      history: { enabled: !!db, ttlDays },
      capabilities: { ai: !!opts.ai, places: !!opts.places },
    }),
  );

  app.get(
    '/api/v1/demo/cases',
    { schema: { response: { 200: demoCasesResponseSchema } } },
    async () => ({
      cases: data.cases.map(
        (c): DemoCaseSummary => ({ id: c.id, title: c.title, kind: c.kind, input: c.input }),
      ),
    }),
  );

  const historyDisabled = (reply: FastifyReply) =>
    reply.status(503).send(errorBody('HISTORY_DISABLED', 'Lịch sử tra cứu chưa được bật trên máy chủ này.'));

  // Lịch sử gắn với thiết bị qua cookie HttpOnly. Không có cookie hợp lệ thì coi như chưa có lịch sử.
  const deviceHashOf = (req: FastifyRequest): string | null => {
    const t = readDeviceToken(req.headers.cookie);
    return t ? hashToken(t) : null;
  };

  app.get<{ Querystring: { limit?: number } }>(
    '/api/v1/history',
    {
      schema: {
        querystring: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
        response: { 200: historyListResponseSchema },
      },
    },
    async (req, reply) => {
      if (!db) return historyDisabled(reply);
      const dev = deviceHashOf(req);
      return { items: dev ? await listChecks(db, dev, req.query.limit ?? 50) : [] };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/history/:id',
    { schema: { params: historyIdParamsSchema, response: { 200: historyDetailResponseSchema } } },
    async (req, reply) => {
      if (!db) return historyDisabled(reply);
      const dev = deviceHashOf(req);
      const found = dev ? await getCheck(db, dev, req.params.id) : null;
      if (!found) return reply.status(404).send(errorBody('NOT_FOUND', 'Không tìm thấy mục lịch sử này.'));
      return found;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/history/:id',
    { schema: { params: historyIdParamsSchema } },
    async (req, reply) => {
      if (!db) return historyDisabled(reply);
      const dev = deviceHashOf(req);
      const n = dev ? await deleteChecks(db, dev, [req.params.id]) : 0;
      if (n === 0) return reply.status(404).send(errorBody('NOT_FOUND', 'Không tìm thấy mục lịch sử này.'));
      return reply.status(204).send();
    },
  );

  // Xóa nhiều mục đã chọn. Dùng POST vì một số proxy bỏ thân của DELETE.
  app.post<{ Body: DeleteHistoryRequest }>(
    '/api/v1/history/delete',
    { schema: { body: deleteHistoryRequestSchema, response: { 200: deleteHistoryResponseSchema } } },
    async (req, reply) => {
      if (!db) return historyDisabled(reply);
      const dev = deviceHashOf(req);
      return { deleted: dev ? await deleteChecks(db, dev, req.body.ids) : 0 };
    },
  );

  app.post<{ Body: ExtractRequest }>(
    '/api/v1/invitations/extract',
    { schema: { body: extractRequestSchema, response: { 200: extractResponseSchema } } },
    async (req) => (req.body.mode === 'simulated' ? extractSimulated(req.body, data) : extractLive(req.body, opts.ai)),
  );

  app.post<{ Body: VerifyRequest }>(
    '/api/v1/invitations/verify',
    { schema: { body: verifyRequestSchema, response: { 200: verifyResponseSchema } } },
    async (req, reply) => {
      if (req.body.save && !db) return historyDisabled(reply);
      try {
        const result =
          req.body.mode === 'simulated'
            ? verifySimulated(req.body, data)
            : await verifyLive(req.body, { places: opts.places });
        if (req.body.save && db) {
          let token = readDeviceToken(req.headers.cookie);
          if (!token) {
            token = newDeviceToken();
            reply.header('Set-Cookie', cookieHeader(token, cookieSecure));
          }
          result.historyId = await insertCheck(db, {
            deviceHash: hashToken(token),
            mode: req.body.mode,
            invitationText: req.body.invitationText,
            jobUrl: req.body.jobUrl?.trim() || null,
            confirmed: req.body.confirmed,
            result,
            ttlDays,
            maxPerDevice,
          });
        }
        return result;
      } catch (err) {
        if (err instanceof QuoteNotInSourceError) {
          return reply
            .status(422)
            .send(errorBody('QUOTE_NOT_IN_SOURCE', err.message, { quotes: err.quotes }));
        }
        throw err;
      }
    },
  );

  return app;
}