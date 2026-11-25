import type {
  ContactCheckInput,
  ContactResult,
} from '../../../../shared/contract.js';

// Xác minh người liên hệ: email hoặc số điện thoại của người gửi lời mời phải trùng với
// thông tin liên hệ ghi trên trang tuyển dụng chính thức (LinkedIn, TopCV, trang của công ty).
// Việc Thật không tự đọc các trang đó: người dùng chép thông tin liên hệ họ thấy.

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu;
// Số Việt Nam: 0 hoặc +84/84, rồi 8 đến 10 chữ số, cho phép dấu cách, chấm, gạch nối.
const PHONE = /(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;

export function normalizeEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(v) ? v : null;
}

/** Đưa số về dạng 0xxxxxxxxx. Trả null nếu không giống số điện thoại Việt Nam. */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) digits = `0${digits.slice(2)}`;
  return /^0\d{8,10}$/.test(digits) ? digits : null;
}

interface Contacts {
  emails: Set<string>;
  phones: Set<string>;
}

function collect(values: string[]): Contacts {
  const out: Contacts = { emails: new Set(), phones: new Set() };
  for (const value of values) {
    for (const m of value.match(EMAIL) ?? []) {
      const e = normalizeEmail(m);
      if (e) out.emails.add(e);
    }
    // Bỏ email ra trước để chữ số trong email không bị đọc nhầm thành số điện thoại.
    for (const m of value.replace(EMAIL, ' ').match(PHONE) ?? []) {
      const p = normalizePhone(m);
      if (p) out.phones.add(p);
    }
  }
  return out;
}

export function evaluateContact(
  invitationText: string,
  input: ContactCheckInput | null | undefined,
): ContactResult {
  const official = collect(input?.official ?? []);
  if (!official.emails.size && !official.phones.size) {
    return {
      status: 'unverified',
      basis:
        'Chưa có căn cứ về người liên hệ. Nhập email hoặc số điện thoại ghi trên trang tuyển dụng chính thức để đối chiếu.',
    };
  }

  const sender = collect([invitationText, ...(input?.sender ?? [])]);
  if (!sender.emails.size && !sender.phones.size) {
    return {
      status: 'unverified',
      basis:
        'Chưa có email hoặc số điện thoại của người gửi lời mời để đối chiếu với trang tuyển dụng chính thức.',
    };
  }

  const email = [...sender.emails].find((e) => official.emails.has(e));
  const phone = [...sender.phones].find((p) => official.phones.has(p));
  const matched = email ?? phone;
  if (!matched) {
    return {
      status: 'unverified',
      basis:
        'Email và số điện thoại của người gửi không trùng với thông tin liên hệ trên trang tuyển dụng chính thức. Chưa xác minh được người liên hệ.',
    };
  }
  return {
    status: 'verified',
    basis: `${email ? 'Email' : 'Số điện thoại'} ${matched} của người gửi trùng với thông tin liên hệ trên trang tuyển dụng chính thức (theo thông tin bạn nhập). Hãy chắc lời mời thật sự được gửi từ ${email ? 'địa chỉ' : 'số'} này.`,
  };
}
