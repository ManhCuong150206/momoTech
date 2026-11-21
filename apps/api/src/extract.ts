import type {
  ExtractedField,
  ExtractRequest,
  ExtractResponse,
  Requirement,
  RequirementKind,
} from '../../../shared/contract.js';
import type { AiExtractor } from './ai.js';
import { type DemoData, findCaseByJobUrl } from './demo-data.js';

// Bộ trích mô phỏng (giai đoạn 1): luật + dữ kiện ca demo. Chưa gọi AI.
// VT07 sẽ thay phần này bằng Bedrock nhưng giữ nguyên hình dạng ExtractResponse.

const REQUIREMENT_PATTERNS: Array<{ kind: RequirementKind; re: RegExp }> = [
  {
    kind: 'fee_request',
    re: /(?:đóng|nộp|chuyển)\s+(?:phí|tiền|khoản)[^.,;\n]*?(?=\s+trước|[.,;\n]|$)|phí giữ chỗ|đặt cọc/iu,
  },
  {
    kind: 'document_request',
    re: /(?:gửi|cung cấp|chụp|nộp)[^.,;\n]*?(?:CCCD|CMND|căn cước|hộ chiếu|giấy tờ)[^.,;\n]*/iu,
  },
  { kind: 'attendance_confirmation', re: /xác nhận[^.,;\n]*tham dự[^.,;\n]*/iu },
  { kind: 'shared_office_meeting', re: /văn phòng dùng chung[^.,;\n]*/iu },
  { kind: 'address_pending', re: /địa chỉ sẽ gửi sau/iu },
];

export function findRequirements(text: string): Requirement[] {
  const found: Requirement[] = [];
  for (const { kind, re } of REQUIREMENT_PATTERNS) {
    const m = re.exec(text);
    if (m) found.push({ kind, quote: m[0].trim() });
  }
  return found;
}

function textField(value: string | null | undefined, text: string): ExtractedField {
  if (!value) return { value: null, quote: null, origin: 'not_found' };
  if (text.includes(value)) return { value, quote: value, origin: 'invitation_text' };
  return { value, quote: null, origin: 'simulated_source' };
}

export function extractSimulated(req: ExtractRequest, data: DemoData): ExtractResponse {
  const text = req.invitationText.normalize('NFC');
  const jobUrl = req.jobUrl?.trim() || null;
  const meetingAddress = req.meetingAddress?.trim() || null;
  const demo = findCaseByJobUrl(data, jobUrl);
  const notices: string[] = ['Dữ liệu mô phỏng: kết quả trích dùng luật cố định, chưa gọi AI.'];

  if (!demo) {
    notices.push('Link tin không thuộc ca mô phỏng nào nên chưa điền sẵn công ty và vị trí. Hãy nhập tay ở bước xác nhận.');
  }

  const job = demo?.fixtures.job;
  return {
    mode: 'simulated',
    simulated: true,
    fields: {
      company: textField(job?.company, text),
      role: textField(job?.role, text),
      meetingAddress: meetingAddress
        ? { value: meetingAddress, quote: text.includes(meetingAddress) ? meetingAddress : null, origin: 'user_input' }
        : { value: null, quote: null, origin: 'not_found' },
      jobUrl: jobUrl
        ? { value: jobUrl, quote: null, origin: 'user_input' }
        : { value: null, quote: null, origin: 'not_found' },
    },
    requirements: findRequirements(text),
    notices,
  };
}

/**
 * Chế độ live: AI (nếu có) đọc lời mời, luật cố định luôn chạy thêm để không bỏ sót yêu cầu đòi phí.
 * Chỉ văn bản lời mời và các trường người dùng nhập được gửi đi. Không gửi dữ liệu mô phỏng.
 */
export async function extractLive(req: ExtractRequest, ai: AiExtractor | undefined): Promise<ExtractResponse> {
  const text = req.invitationText.normalize('NFC');
  const jobUrl = req.jobUrl?.trim() || null;
  const meetingAddress = req.meetingAddress?.trim() || null;
  const notices: string[] = [];
  const rules = findRequirements(text);

  let company: ExtractedField = { value: null, quote: null, origin: 'not_found' };
  let role: ExtractedField = { value: null, quote: null, origin: 'not_found' };
  let aiAddress: string | null = null;
  let requirements = rules;

  if (ai) {
    try {
      const out = await ai(text);
      if (out.company) company = { value: out.company, quote: out.company, origin: 'ai' };
      if (out.role) role = { value: out.role, quote: out.role, origin: 'ai' };
      aiAddress = out.meetingAddress;
      const kinds = new Set(out.requirements.map((r) => r.kind));
      requirements = [...out.requirements, ...rules.filter((r) => !kinds.has(r.kind))];
      notices.push('AI đã đọc lời mời. Hãy kiểm tra lại các dữ kiện trước khi đối chiếu.');
      if (out.dropped > 0) {
        notices.push(`Đã bỏ ${out.dropped} mục AI trả về vì đoạn trích không có trong lời mời.`);
      }
    } catch {
      notices.push('Dịch vụ AI tạm lỗi nên chỉ dùng luật cố định. Hãy nhập tay công ty và vị trí.');
    }
  } else {
    notices.push('AI chưa được cấu hình nên chỉ dùng luật cố định. Hãy nhập tay công ty và vị trí.');
  }

  return {
    mode: 'live',
    simulated: false,
    fields: {
      company,
      role,
      meetingAddress: meetingAddress
        ? { value: meetingAddress, quote: text.includes(meetingAddress) ? meetingAddress : null, origin: 'user_input' }
        : aiAddress
          ? { value: aiAddress, quote: aiAddress, origin: 'ai' }
          : { value: null, quote: null, origin: 'not_found' },
      jobUrl: jobUrl
        ? { value: jobUrl, quote: null, origin: 'user_input' }
        : { value: null, quote: null, origin: 'not_found' },
    },
    requirements,
    notices,
  };
}