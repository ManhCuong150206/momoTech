import type {
  ContactStatus,
  InvitationStatus,
  JobStatus,
  LocationStatus,
  RequirementKind,
} from '../../../shared/contract';

export const JOB_LABEL: Record<JobStatus, string> = {
  open: 'Còn hạn',
  expired: 'Hết hạn',
  unavailable: 'Chưa kiểm tra được',
  not_checked: 'Chưa kiểm tra',
};

export const LOCATION_LABEL: Record<LocationStatus, string> = {
  matched: 'Công ty khớp địa chỉ',
  company_unconfirmed: 'Chưa xác nhận công ty tại địa chỉ này',
  unavailable: 'Chưa kiểm tra được',
  not_checked: 'Chưa đối chiếu tự động',
};

export const CONTACT_LABEL: Record<ContactStatus, string> = {
  unverified: 'Chưa xác minh',
  verified: 'Đã xác minh',
};

export const INVITATION_LABEL: Record<InvitationStatus, string> = {
  caution: 'Cần thận trọng',
  needs_verification: 'Cần xác minh thêm',
  no_signal_observed: 'Chưa thấy dấu hiệu cần cảnh báo',
  insufficient_information: 'Chưa đủ thông tin',
};

export const REQUIREMENT_LABEL: Record<RequirementKind, string> = {
  fee_request: 'Yêu cầu đóng phí',
  attendance_confirmation: 'Yêu cầu xác nhận tham dự',
  shared_office_meeting: 'Hẹn tại văn phòng dùng chung',
  address_pending: 'Địa chỉ chưa được cung cấp',
  document_request: 'Yêu cầu gửi giấy tờ cá nhân',
  credential_request: 'Yêu cầu cung cấp mã xác thực hoặc mật khẩu',
  other_request: 'Yêu cầu khác cần lưu ý',
};

export type Tone = 'bad' | 'warn' | 'ok' | 'neutral';

/** Tên dễ hiểu cho nút thử dữ liệu mẫu. Thiếu thì dùng `title` trong cases.json. */
export const SAMPLE_LABEL: Record<string, string> = {
  'VT-DEMO-01': 'Lời mời yêu cầu đóng phí',
  'VT-DEMO-02': 'Lời mời có tin còn mở và địa chỉ khớp',
  'VT-DEMO-03': 'Hẹn phỏng vấn ở văn phòng dùng chung',
  'VT-DEMO-04': 'Link cần đăng nhập, chưa có địa chỉ',
};

export const JOB_TONE: Record<JobStatus, Tone> = {
  open: 'ok',
  expired: 'bad',
  unavailable: 'neutral',
  not_checked: 'neutral',
};
export const LOCATION_TONE: Record<LocationStatus, Tone> = {
  matched: 'ok',
  company_unconfirmed: 'warn',
  unavailable: 'neutral',
  not_checked: 'neutral',
};
export const INVITATION_TONE: Record<InvitationStatus, Tone> = {
  caution: 'bad',
  needs_verification: 'warn',
  no_signal_observed: 'neutral',
  insufficient_information: 'neutral',
};
