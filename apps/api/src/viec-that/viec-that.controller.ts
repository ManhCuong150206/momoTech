import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Ajv, type ValidateFunction } from 'ajv';
import type { Request, Response } from 'express';
import type {
  DeleteHistoryRequest,
  DeleteHistoryResponse,
  DemoCaseSummary,
  ExtractRequest,
  ExtractResponse,
  HealthResponse,
  HistoryDetailResponse,
  HistoryListResponse,
  VerifyRequest,
  VerifyResponse,
} from '../../../../shared/contract.js';
import {
  deleteHistoryRequestSchema,
  extractRequestSchema,
  historyIdParamsSchema,
  verifyRequestSchema,
} from '../../../../shared/schemas.js';
import { GeocodingService } from '../geocoding/geocoding.service.js';
import { API_VERSION } from '../version.js';
import { AiService } from './ai.service.js';
import { ApiError, historyDisabled } from './api-errors.js';
import { DemoService } from './demo.service.js';
import { demoData } from './demo-data.js';
import { extractLive, extractSimulated } from './extract.js';
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
import { HistoryService } from './history.service.js';
import { InvitationRateGuard } from './invitation-rate.guard.js';
import {
  QuoteNotInSourceError,
  verifyLive,
  verifySimulated,
} from './verify.js';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateExtract = ajv.compile<ExtractRequest>(extractRequestSchema);
const validateVerify = ajv.compile<VerifyRequest>(verifyRequestSchema);
const validateHistoryId = ajv.compile<{ id: string }>(historyIdParamsSchema);
const validateDeleteHistory = ajv.compile<DeleteHistoryRequest>(
  deleteHistoryRequestSchema,
);

function validated<T>(validate: ValidateFunction<T>, value: unknown): T {
  if (validate(value)) return value;
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    'Dữ liệu gửi lên không hợp lệ.',
    validate.errors,
  );
}

/** `?limit=` của danh sách lịch sử: số nguyên 1 đến 100, mặc định 50. */
function parseLimit(raw: unknown): number {
  if (raw === undefined) return 50;
  const n =
    typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (n >= 1 && n <= 100) return n;
  throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.', [
    {
      instancePath: '/limit',
      keyword: 'range',
      message: 'limit phải là số nguyên từ 1 đến 100',
    },
  ]);
}

function deviceHash(req: Request): string | null {
  const token = readDeviceToken(req.headers.cookie);
  return token ? hashToken(token) : null;
}

@Controller()
export class ViecThatController {
  constructor(
    @Inject(GeocodingService) private readonly geocoding: GeocodingService,
    @Inject(HistoryService) private readonly history: HistoryService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(DemoService) private readonly demo: DemoService,
  ) {}

  /** Chế độ mô phỏng đã tắt thì từ chối yêu cầu simulated bằng 400, cùng dạng lỗi kiểm tra đầu vào. */
  private assertModeAllowed(mode: string): void {
    if (mode === 'simulated' && !this.demo.enabled) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Chế độ mô phỏng đã tắt trên máy chủ này. Dùng mode "live".', [
        { instancePath: '/mode', keyword: 'enum', params: { allowedValues: ['live'] }, message: 'must be equal to one of the allowed values' },
      ]);
    }
  }

  @Get('healthz')
  @Header('Cache-Control', 'no-store')
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'viec-that-api',
      version: API_VERSION,
      time: new Date().toISOString(),
      modes: this.demo.enabled ? ['simulated', 'live'] : ['live'],
      history: { enabled: !!this.history.db, ttlDays: this.history.ttlDays },
      capabilities: {
        ai: !!this.ai.extractor,
        places: this.geocoding.configured,
      },
    };
  }

  @Get('api/v1/demo/cases')
  cases(): { cases: DemoCaseSummary[] } {
    if (!this.demo.enabled) return { cases: [] };
    return {
      cases: demoData.cases.map(({ id, title, kind, input }) => ({
        id,
        title,
        kind,
        input,
      })),
    };
  }

  @Post('api/v1/invitations/extract')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(InvitationRateGuard)
  async extract(@Body() body: unknown): Promise<ExtractResponse> {
    const input = validated(validateExtract, body);
    this.assertModeAllowed(input.mode);
    return input.mode === 'simulated'
      ? extractSimulated(input, demoData)
      : extractLive(input, this.ai.extractor);
  }

  @Post('api/v1/invitations/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(InvitationRateGuard)
  async verify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyResponse> {
    const input = validated(validateVerify, body);
    this.assertModeAllowed(input.mode);
    const db = this.history.db;
    if (input.save && !db) throw historyDisabled();

    let result: VerifyResponse;
    try {
      result =
        input.mode === 'simulated'
          ? verifySimulated(input, demoData)
          : await verifyLive(input, this.geocoding);
    } catch (error) {
      if (error instanceof QuoteNotInSourceError) {
        throw new ApiError(422, 'QUOTE_NOT_IN_SOURCE', error.message, {
          quotes: error.quotes,
        });
      }
      throw error;
    }

    if (input.save && db) {
      const existing = readDeviceToken(req.headers.cookie);
      const token = existing ?? newDeviceToken();
      result.historyId = await insertCheck(db, {
        deviceHash: hashToken(token),
        mode: input.mode,
        invitationText: input.invitationText,
        jobUrl: input.jobUrl?.trim() || null,
        confirmed: input.confirmed,
        result,
        ttlDays: this.history.ttlDays,
        maxPerDevice: this.history.maxPerDevice,
      });
      if (!existing)
        res.setHeader(
          'Set-Cookie',
          cookieHeader(token, this.history.cookieSecure),
        );
    }
    return result;
  }

  @Get('api/v1/history')
  @Header('Cache-Control', 'no-store')
  async listHistory(
    @Req() req: Request,
    @Query('limit') rawLimit: unknown,
  ): Promise<HistoryListResponse> {
    const db = this.history.db;
    if (!db) throw historyDisabled();
    const limit = parseLimit(rawLimit);
    const device = deviceHash(req);
    return { items: device ? await listChecks(db, device, limit) : [] };
  }

  @Get('api/v1/history/:id')
  @Header('Cache-Control', 'no-store')
  async historyDetail(
    @Param() params: unknown,
    @Req() req: Request,
  ): Promise<HistoryDetailResponse> {
    const { id } = validated(validateHistoryId, params);
    const db = this.history.db;
    if (!db) throw historyDisabled();
    const device = deviceHash(req);
    const detail = device ? await getCheck(db, device, id) : null;
    if (!detail)
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy mục lịch sử này.');
    return detail;
  }

  @Delete('api/v1/history/:id')
  @HttpCode(204)
  async deleteHistoryItem(
    @Param() params: unknown,
    @Req() req: Request,
  ): Promise<void> {
    const { id } = validated(validateHistoryId, params);
    const db = this.history.db;
    if (!db) throw historyDisabled();
    const device = deviceHash(req);
    const deleted = device ? await deleteChecks(db, device, [id]) : 0;
    if (deleted === 0)
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy mục lịch sử này.');
  }

  // Xóa nhiều mục đã chọn. Dùng POST vì một số proxy bỏ thân của DELETE.
  @Post('api/v1/history/delete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async deleteHistory(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<DeleteHistoryResponse> {
    const { ids } = validated(validateDeleteHistory, body);
    const db = this.history.db;
    if (!db) throw historyDisabled();
    const device = deviceHash(req);
    return { deleted: device ? await deleteChecks(db, device, ids) : 0 };
  }
}
