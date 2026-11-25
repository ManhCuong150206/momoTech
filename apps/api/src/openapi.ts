import {
  deleteHistoryRequestSchema,
  deleteHistoryResponseSchema,
  demoCasesResponseSchema,
  errorResponseSchema,
  extractRequestSchema,
  extractResponseSchema,
  healthResponseSchema,
  historyDetailResponseSchema,
  historyListResponseSchema,
  verifyRequestSchema,
  verifyResponseSchema,
} from '../../../shared/schemas.js';
import { API_VERSION } from './version.js';

// OpenAPI 3.1 dựng từ chính JSON Schema mà Fastify dùng, nên tài liệu không lệch với mã.
// Tạo lại docs/openapi.json bằng `npm run openapi -w apps/api`. Test kiểm tra tệp đã khớp.

const json = (schema: unknown) => ({ 'application/json': { schema } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const error = (description: string) => ({ description, content: json(ref('ErrorResponse')) });

const commonErrors = {
  400: error('VALIDATION_ERROR: dữ liệu gửi lên không hợp lệ.'),
  429: error('RATE_LIMITED: vượt giới hạn yêu cầu mỗi phút. Có header Retry-After.'),
  500: error('INTERNAL_ERROR: lỗi không lường trước.'),
};

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export function buildOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Việc Thật API',
      version: API_VERSION,
      description:
        'Đối chiếu lời mời việc làm: tin đăng, địa điểm, người liên hệ và yêu cầu trong lời mời. Ví dụ và quy tắc trạng thái: docs/API-CONTRACT.md. Ổn định hợp đồng: trong /api/v1 chỉ thêm trường tùy chọn hoặc giá trị enum mới, không đổi tên hay xóa. Client phải chấp nhận giá trị enum lạ. Thay đổi phá vỡ chuyển sang /api/v2 và tăng version.',
    },
    servers: [{ url: '/' }],
    // Không đăng nhập. Lịch sử gắn với thiết bị qua cookie HttpOnly vt_device do máy chủ tự đặt.
    security: [],
    paths: {
      '/healthz': {
        get: {
          operationId: 'getHealth',
          summary: 'Kiểm tra API, chế độ chạy, dịch vụ đã cấu hình và trạng thái lịch sử',
          responses: { 200: { description: 'API đang chạy', content: json(ref('HealthResponse')) } },
        },
      },
      '/api/v1/demo/cases': {
        get: {
          operationId: 'listDemoCases',
          summary: 'Danh sách ca mẫu (dữ liệu mô phỏng), không gồm fixtures và expected',
          responses: { 200: { description: 'Danh sách ca', content: json(ref('DemoCasesResponse')) } },
        },
      },
      '/api/v1/invitations/extract': {
        post: {
          operationId: 'extractInvitation',
          summary: 'Trích dữ kiện và yêu cầu từ lời mời để người dùng xác nhận',
          requestBody: { required: true, content: json(ref('ExtractRequest')) },
          responses: {
            200: { description: 'Dữ kiện đã trích', content: json(ref('ExtractResponse')) },
            ...commonErrors,
          },
        },
      },
      '/api/v1/invitations/verify': {
        post: {
          operationId: 'verifyInvitation',
          summary: 'Đối chiếu dữ kiện đã xác nhận, trả bốn phần kết quả và hướng dẫn',
          requestBody: { required: true, content: json(ref('VerifyRequest')) },
          responses: {
            200: { description: 'Kết quả đối chiếu', content: json(ref('VerifyResponse')) },
            ...commonErrors,
            422: error('QUOTE_NOT_IN_SOURCE: có đoạn trích không nằm trong lời mời. details.quotes liệt kê đoạn sai.'),
            503: error('HISTORY_DISABLED: gửi save: true khi máy chủ chưa bật lịch sử.'),
          },
        },
      },
      '/api/v1/history': {
        get: {
          operationId: 'listHistory',
          summary: 'Lịch sử của thiết bị này (cookie vt_device), mới nhất trước',
          parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } }],
          responses: {
            200: { description: 'Danh sách', content: json(ref('HistoryListResponse')) },
            400: commonErrors[400],
            503: error('HISTORY_DISABLED'),
          },
        },
      },
      '/api/v1/history/{id}': {
        get: {
          operationId: 'getHistoryItem',
          summary: 'Xem lại một mục lịch sử',
          parameters: [idParam],
          responses: {
            200: { description: 'Chi tiết', content: json(ref('HistoryDetailResponse')) },
            400: commonErrors[400],
            404: error('NOT_FOUND: không thuộc thiết bị này hoặc đã hết hạn.'),
            503: error('HISTORY_DISABLED'),
          },
        },
        delete: {
          operationId: 'deleteHistoryItem',
          summary: 'Xóa vĩnh viễn một mục lịch sử',
          parameters: [idParam],
          responses: {
            204: { description: 'Đã xóa' },
            400: commonErrors[400],
            404: error('NOT_FOUND'),
            503: error('HISTORY_DISABLED'),
          },
        },
      },
      '/api/v1/history/delete': {
        post: {
          operationId: 'deleteHistoryItems',
          summary: 'Xóa nhiều mục lịch sử đã chọn. Id không thuộc thiết bị này bị bỏ qua.',
          requestBody: { required: true, content: json(ref('DeleteHistoryRequest')) },
          responses: {
            200: { description: 'Số mục đã xóa', content: json(ref('DeleteHistoryResponse')) },
            400: commonErrors[400],
            503: error('HISTORY_DISABLED'),
          },
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: healthResponseSchema,
        DemoCasesResponse: demoCasesResponseSchema,
        ExtractRequest: extractRequestSchema,
        ExtractResponse: extractResponseSchema,
        VerifyRequest: verifyRequestSchema,
        VerifyResponse: verifyResponseSchema,
        HistoryListResponse: historyListResponseSchema,
        HistoryDetailResponse: historyDetailResponseSchema,
        DeleteHistoryRequest: deleteHistoryRequestSchema,
        DeleteHistoryResponse: deleteHistoryResponseSchema,
        ErrorResponse: errorResponseSchema,
      },
    },
  };
}

export const openApiText = (): string => {
  const doc = buildOpenApi();
  // Mọi đường dẫn đều trả 405 METHOD_NOT_ALLOWED (kèm header Allow) khi gọi sai phương thức.
  for (const ops of Object.values(doc.paths)) {
    for (const op of Object.values(ops) as Array<{ responses: Record<string, unknown> }>) {
      op.responses['405'] = error('METHOD_NOT_ALLOWED: đường dẫn có thật nhưng không nhận phương thức đã gửi. Header Allow liệt kê phương thức được phép.');
    }
  }
  return `${JSON.stringify(doc, null, 2)}\n`;
};
