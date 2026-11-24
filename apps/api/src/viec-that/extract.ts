import type {
  ExtractedField,
  ExtractRequest,
  ExtractResponse,
} from '../../../../shared/contract.js';
import type { AiExtractor } from './ai.js';
import { type DemoData, findCaseByJobUrl } from './demo-data.js';
import { findRequirements } from './requirements.js';

export { findRequirements };

function textField(
  value: string | null | undefined,
  text: string,
): ExtractedField {
  if (!value) return { value: null, quote: null, origin: 'not_found' };
  if (text.includes(value))
    return { value, quote: value, origin: 'invitation_text' };
  return { value, quote: null, origin: 'simulated_source' };
}

export function extractSimulated(
  req: ExtractRequest,
  data: DemoData,
): ExtractResponse {
  const text = req.invitationText.normalize('NFC');
  const jobUrl = req.jobUrl?.trim() || null;
  const meetingAddress = req.meetingAddress?.trim() || null;
  const demo = findCaseByJobUrl(data, jobUrl);
  const notices: string[] = [
    'Dữ liệu mô phỏng: kết quả trích dùng luật cố định, chưa gọi AI.',
  ];

  if (!demo) {
    notices.push(
      'Link tin không thuộc ca mô phỏng nào nên chưa điền sẵn công ty và vị trí. Hãy nhập tay ở bước xác nhận.',
    );
  }

  const job = demo?.fixtures.job;
  return {
    mode: 'simulated',
    simulated: true,
    fields: {
      company: textField(job?.company, text),
      role: textField(job?.role, text),
      meetingAddress: meetingAddress
        ? {
            value: meetingAddress,
            quote: text.includes(meetingAddress) ? meetingAddress : null,
            origin: 'user_input',
          }
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
 * Chỉ văn bản lời mời được gửi tới AI. Không gửi dữ liệu mô phỏng.
 */
export async function extractLive(
  req: ExtractRequest,
  ai?: AiExtractor,
): Promise<ExtractResponse> {
  const text = req.invitationText.normalize('NFC');
  const jobUrl = req.jobUrl?.trim() || null;
  const meetingAddress = req.meetingAddress?.trim() || null;
  const notices: string[] = [];
  const rules = findRequirements(text);
  const missing = (): ExtractedField => ({
    value: null,
    quote: null,
    origin: 'not_found',
  });

  let company = missing();
  let role = missing();
  let aiAddress: string | null = null;
  let requirements = rules;

  if (ai) {
    try {
      const out = await ai(text);
      if (out.company)
        company = { value: out.company, quote: out.company, origin: 'ai' };
      if (out.role) role = { value: out.role, quote: out.role, origin: 'ai' };
      aiAddress = out.meetingAddress;
      const ruleKinds = new Set(rules.map((r) => r.kind));
      requirements = [
        ...rules,
        ...out.requirements.filter((r) => !ruleKinds.has(r.kind)),
      ].slice(0, 10);
      notices.push(
        'AI đã đọc lời mời. Hãy kiểm tra lại các dữ kiện trước khi đối chiếu.',
      );
      if (out.dropped > 0) {
        notices.push(
          `Đã bỏ ${out.dropped} mục AI trả về vì căn cứ thiếu hoặc nội dung không khớp với yêu cầu.`,
        );
      }
    } catch {
      notices.push(
        'Dịch vụ AI tạm lỗi nên chỉ dùng luật cố định. Hãy nhập tay công ty và vị trí.',
      );
    }
  } else {
    notices.push(
      'AI chưa được cấu hình nên chỉ dùng luật cố định. Hãy nhập tay công ty và vị trí.',
    );
  }

  return {
    mode: 'live',
    simulated: false,
    fields: {
      company,
      role,
      meetingAddress: meetingAddress
        ? {
            value: meetingAddress,
            quote: text.includes(meetingAddress) ? meetingAddress : null,
            origin: 'user_input',
          }
        : aiAddress
          ? { value: aiAddress, quote: aiAddress, origin: 'ai' }
          : missing(),
      jobUrl: jobUrl
        ? { value: jobUrl, quote: null, origin: 'user_input' }
        : missing(),
    },
    requirements,
    notices,
  };
}