import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorCode, ErrorResponse } from '../../../../shared/contract.js';
import { buildOpenApi } from '../openapi.js';

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

/** Đường dẫn có thật và phương thức được phép, lấy từ OpenAPI (test bảo đảm OpenAPI khớp với route). */
const ROUTES = Object.entries(buildOpenApi().paths).map(([p, ops]) => {
  const methods = Object.keys(ops).map((m) => m.toUpperCase());
  if (methods.includes('GET')) methods.push('HEAD');
  const pattern = p
    .split(/\{[^}]+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return { re: new RegExp(`^${pattern}/?$`), methods };
});

/** Đường dẫn có thật nhưng sai phương thức thì trả các phương thức được phép, ngược lại null. */
export function allowedMethods(method: string, path: string): string[] | null {
  const methods = ROUTES.filter((r) => r.re.test(path)).flatMap((r) => r.methods);
  if (!methods.length || methods.includes(method.toUpperCase())) return null;
  return [...new Set(methods)];
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    if (error instanceof ApiError) {
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }

    const upstreamStatus = (error as { status?: unknown } | null)?.status;
    const status =
      error instanceof HttpException ? error.getStatus() : upstreamStatus;
    if (status === 404) {
      const allow = allowedMethods(req.method, req.path);
      if (allow) {
        res
          .status(405)
          .setHeader('Allow', allow.join(', '))
          .json({
            error: {
              code: 'METHOD_NOT_ALLOWED',
              message: 'Đường dẫn này không nhận phương thức đã gửi.',
            },
          });
        return;
      }
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn.' },
      });
      return;
    }
    if (status === 413) {
      res.status(413).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nội dung gửi lên quá lớn.',
        },
      });
      return;
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({
        error: { code: 'VALIDATION_ERROR', message: 'Yêu cầu không hợp lệ.' },
      });
      return;
    }

    this.logger.error(error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Máy chủ gặp lỗi. Thử lại sau.',
      },
    });
  }
}
