import type {
  ExtractedField,
  ExtractRequest,
  ExtractResponse,
} from './contract.js';
import { type DemoData, findCaseByJobUrl } from './demo-data.js';
import { findRequirements } from './requirements.js';

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

export function extractLive(req: ExtractRequest): ExtractResponse {
  const text = req.invitationText.normalize('NFC');
  const jobUrl = req.jobUrl?.trim() || null;
  const meetingAddress = req.meetingAddress?.trim() || null;
  const missing: ExtractedField = {
    value: null,
    quote: null,
    origin: 'not_found',
  };

  return {
    mode: 'live',
    simulated: false,
    fields: {
      company: missing,
      role: missing,
      meetingAddress: meetingAddress
        ? {
            value: meetingAddress,
            quote: text.includes(meetingAddress) ? meetingAddress : null,
            origin: 'user_input',
          }
        : missing,
      jobUrl: jobUrl
        ? { value: jobUrl, quote: null, origin: 'user_input' }
        : missing,
    },
    requirements: findRequirements(text),
    notices: [
      'AI chưa được cấu hình nên chỉ dùng luật cố định. Hãy nhập tay công ty và vị trí.',
    ],
  };
}
