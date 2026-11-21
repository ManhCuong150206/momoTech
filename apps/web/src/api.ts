import type {
  DeleteHistoryResponse,
  DemoCaseSummary,
  ErrorResponse,
  ExtractRequest,
  ExtractResponse,
  HealthResponse,
  HistoryDetailResponse,
  HistoryListResponse,
  VerifyRequest,
  VerifyResponse,
} from '../../../shared/contract';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ErrorResponse | null)?.error;
    throw new ApiError(err?.code ?? 'INTERNAL_ERROR', err?.message ?? 'Máy chủ gặp lỗi. Thử lại sau.');
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<HealthResponse>('/healthz'),
  historyList: () => request<HistoryListResponse>('/api/v1/history'),
  historyGet: (id: string) => request<HistoryDetailResponse>(`/api/v1/history/${id}`),
  historyDelete: (ids: string[]) => request<DeleteHistoryResponse>('/api/v1/history/delete', post({ ids })),
  demoCases: () => request<{ cases: DemoCaseSummary[] }>('/api/v1/demo/cases'),
  extract: (b: ExtractRequest) => request<ExtractResponse>('/api/v1/invitations/extract', post(b)),
  verify: (b: VerifyRequest) => request<VerifyResponse>('/api/v1/invitations/verify', post(b)),
};
