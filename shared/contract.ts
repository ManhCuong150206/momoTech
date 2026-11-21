// Hợp đồng API Việc Thật v1 (VT04). Nguồn sự thật cho kiểu dữ liệu.
// JSON Schema tương ứng nằm trong schemas.ts. Test API kiểm tra hai bên khớp nhau.

export type SourceMode = 'simulated' | 'live';

export type JobStatus = 'open' | 'expired' | 'unavailable' | 'not_checked';
export type LocationStatus = 'matched' | 'company_unconfirmed' | 'unavailable' | 'not_checked';
export type ContactStatus = 'unverified' | 'verified';
export type InvitationStatus =
  | 'caution'
  | 'needs_verification'
  | 'no_signal_observed'
  | 'insufficient_information';

export type RequirementKind =
  | 'fee_request'
  | 'attendance_confirmation'
  | 'shared_office_meeting'
  | 'address_pending'
  | 'document_request'
  | 'other_request';

export type FieldOrigin = 'invitation_text' | 'user_input' | 'simulated_source' | 'ai' | 'not_found';

export interface Requirement {
  kind: RequirementKind;
  /** Đoạn trích nguyên văn, phải có trong invitationText. */
  quote: string;
}

export interface ExtractedField {
  value: string | null;
  /** Đoạn trích nguyên văn trong lời mời nếu giá trị lấy từ văn bản. */
  quote: string | null;
  origin: FieldOrigin;
}

export interface ExtractRequest {
  mode: SourceMode;
  invitationText: string;
  jobUrl?: string | null;
  meetingAddress?: string | null;
}

export interface ExtractResponse {
  mode: SourceMode;
  simulated: boolean;
  fields: {
    company: ExtractedField;
    role: ExtractedField;
    meetingAddress: ExtractedField;
    jobUrl: ExtractedField;
  };
  requirements: Requirement[];
  notices: string[];
}

export interface ConfirmedFields {
  company: string | null;
  role: string | null;
  meetingAddress: string | null;
  requirements: Requirement[];
}

/** Thông tin người dùng đọc được trên tin tuyển dụng và tự nhập. Dùng ở chế độ live. */
export interface JobPostingInput {
  jobCode?: string | null;
  postedOn?: string | null;
  closesOn?: string | null;
  /** Tin ghi rõ đã đóng tuyển. */
  closed?: boolean;
}

export interface VerifyRequest {
  mode: SourceMode;
  invitationText: string;
  jobUrl?: string | null;
  confirmed: ConfirmedFields;
  jobPosting?: JobPostingInput | null;
  /** true: lưu bản ghi vào lịch sử của thiết bị này. Mặc định false. */
  save?: boolean;
}

export interface SourceRef {
  label: string | null;
  url: string | null;
  simulated: boolean;
}

export interface JobResult {
  status: JobStatus;
  basis: string;
  source: SourceRef;
  checkedOn: string | null;
  details: {
    company: string | null;
    role: string | null;
    jobCode: string | null;
    postedOn: string | null;
    closesOn: string | null;
    reason: string | null;
  };
}

export interface LocationResult {
  status: LocationStatus;
  basis: string;
  source: SourceRef;
  checkedOn: string | null;
  place: { displayName: string | null; address: string | null };
  mapUrl: string | null;
}

export interface ContactResult {
  status: ContactStatus;
  basis: string;
}

export interface InvitationResult {
  status: InvitationStatus;
  basis: string;
  requirements: Requirement[];
}

export interface VerifyResponse {
  mode: SourceMode;
  simulated: boolean;
  checkedOn: string;
  job: JobResult;
  location: LocationResult;
  contact: ContactResult;
  invitation: InvitationResult;
  guidance: { nextStep: string; suggestedQuestion: string };
  notices: string[];
  /** Id bản ghi lịch sử nếu yêu cầu có save: true, ngược lại null. */
  historyId: string | null;
}

export interface HealthResponse {
  status: 'ok';
  service: 'viec-that-api';
  version: string;
  time: string;
  modes: SourceMode[];
  history: { enabled: boolean; ttlDays: number };
  /** Dịch vụ ngoài đã cấu hình. Thiếu thì chế độ live tự hạ cấp và ghi rõ trong 
otices. */
  capabilities: { ai: boolean; places: boolean };
}

export interface DemoCaseSummary {
  id: string;
  title: string;
  kind: 'simulated';
  input: { invitationText: string; jobUrl: string | null; meetingAddress: string | null };
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'QUOTE_NOT_IN_SOURCE'
  | 'SOURCE_MODE_UNSUPPORTED'
  | 'NOT_FOUND'
  | 'HISTORY_DISABLED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export interface HistoryItemSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  mode: SourceMode;
  simulated: boolean;
  title: string;
  jobStatus: JobStatus;
  locationStatus: LocationStatus;
  invitationStatus: InvitationStatus;
}

export interface HistoryListResponse {
  items: HistoryItemSummary[];
}

export interface HistoryDetailResponse {
  id: string;
  createdAt: string;
  expiresAt: string;
  title: string;
  input: { invitationText: string; jobUrl: string | null };
  confirmed: ConfirmedFields;
  result: VerifyResponse;
}

export interface DeleteHistoryRequest {
  ids: string[];
}

export interface DeleteHistoryResponse {
  deleted: number;
}