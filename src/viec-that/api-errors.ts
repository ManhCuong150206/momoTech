import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorCode, ErrorResponse } from './contract.js';

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    const response: ErrorResponse = { error: { code, message } };
    if (details !== undefined) response.error.details = details;
    super(response, status);
  }
}

export function historyDisabled(): ApiError {
  return new ApiError(
    503,
    'HISTORY_DISABLED',
    'Lịch sử tra cứu chưa được bật trên máy chủ này.',
  );
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ApiError) {
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }

    const upstreamStatus = (error as { status?: unknown } | null)?.status;
    const status =
      error instanceof HttpException ? error.getStatus() : upstreamStatus;
    if (status === 404) {
      res
        .status(404)
        .json({
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn.' },
        });
      return;
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res
        .status(status)
        .json({
          error: { code: 'VALIDATION_ERROR', message: 'Yêu cầu không hợp lệ.' },
        });
      return;
    }

    this.logger.error(error instanceof Error ? error.name : 'Unknown error');
    res
      .status(500)
      .json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Máy chủ gặp lỗi. Thử lại sau.',
        },
      });
  }
}
