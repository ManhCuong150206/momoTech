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
  other_request: 'Yêu cầu khác cần lưu ý',
};

export type Tone = 'bad' | 'warn' | 'ok' | 'neutral';

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
