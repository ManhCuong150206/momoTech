import type { Requirement, RequirementKind } from '../../../../shared/contract.js';
import { squash } from './text.js';

// Chỉ thay ký tự khi độ dài UTF-16 giữ nguyên, để vị trí khớp vẫn trỏ về đoạn gốc.
function foldForRules(text: string): string {
  return text.replace(/\p{L}/gu, (char) => {
    const plain = char.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    return plain.length === char.length ? plain : char;
  });
}

const AMOUNT = String.raw`\d+(?:[.,]\d{3})*(?:[ \t]*(?:vnd|dong|trieu|nghin|ngan|k|d))`;
const PAYMENT = String.raw`(?:dong|nop|chuyen(?:\s+khoan)?|ck|thanh\s+toan)\s+(?:${AMOUNT}|(?:le\s+)?phi|tien|khoan\s+(?:phi|coc))|(?:chuyen\s+khoan|ck)\s+(?:vao\s+(?:stk|tai\s+khoan)|cho\s+(?:minh|anh|chi))|dat\s+coc|phi\s+giu\s+cho`;
const CONDITION = /\bthi\s+(?:se\s+)?(?:mat\s+(?:suat|lich|co\s+hoi)|(?:bi\s+)?huy\s+(?:suat|lich|hen)|khong\s+duoc\s+(?:phong\s+van|giu\s+(?:suat|lich)))\b/iu;
const COERCIVE_FEE = new RegExp(String.raw`\bkhong\s+(?:${PAYMENT})\b`, 'giu');
const END_OF_CLAUSE = /[;!?\r\n]|[.,](?!\d)|\s+(?:nhung|however)\b/iu;
const FEE_END = /\s+truoc\b/iu;
const NEGATION = /\b(?:(?:khong|chua)(?:\s+(?:bao\s+gio\s+)?(?:can(?:\s+phai)?|phai|nen|duoc(?:\s+phep)?|thu|mat|yeu\s+cau(?:\s+(?:em|ban|ung\s+vien))?))?|dung|do\s+not|don['’]t|never)\s*$/iu;
const EMPLOYER_ACTOR = /\b(?:ben\s+minh|cong\s+ty|chung\s+toi|chung\s+minh)\s+(?:se\s+|co\s+the\s+)?$/iu;
const REIMBURSEMENT = /\b(?:hoan\s+(?:lai|tra)|tra\s+lai|ho\s+tro\s+chi\s+phi)\b/iu;
const RISK_KINDS = new Set<RequirementKind>(['fee_request', 'document_request', 'credential_request']);

const PATTERNS: Array<{ kind: RequirementKind; cue: RegExp }> = [
  { kind: 'fee_request', cue: new RegExp(String.raw`\b(?:${PAYMENT})\b`, 'giu') },
  {
    kind: 'document_request',
    cue: /\b(?:gui|cung\s+cap|chup|nop|tai\s+len|send|provide|upload)(?:\s+(?:truoc|anh|hinh|ban|sao|scan|file|2|hai|mot|mat|the|so|giup|cho|minh|chi|em|cua|a|copy|photo|of|me|your)){0,10}\s+(?:cccd|cmnd|can\s+cuoc|ho\s+chieu|giay\s+to|passport|national\s+id)\b/giu,
  },
  {
    kind: 'credential_request',
    cue: /\b(?:gui|cung\s+cap|doc|nhap|chia\s+se|cho\s+xin|send|share|enter|provide)(?:\s+(?:ma|cho|giup|minh|anh|chi|em|ben|me|us|your|the|a)){0,8}\s+(?:otp|ma\s+xac\s+thuc|mat\s+khau|password|verification\s+code)\b/giu,
  },
  { kind: 'attendance_confirmation', cue: /\bxac\s+nhan\b[^.,;!?\r\n]{0,65}?\btham\s+du\b/giu },
  { kind: 'shared_office_meeting', cue: /\bvan\s+phong\s+dung\s+chung\b/giu },
  { kind: 'address_pending', cue: /\bdia\s+chi\s+se\s+gui\s+sau\b/giu },
];

function clauseRest(folded: string, start: number): string {
  return folded.slice(start).split(END_OF_CLAUSE, 1)[0] ?? '';
}

function excluded(kind: RequirementKind, folded: string, start: number): boolean {
  const left = folded.slice(Math.max(0, start - 100), start);
  const right = clauseRest(folded, start);
  return NEGATION.test(left) || (kind === 'fee_request' && EMPLOYER_ACTOR.test(left) && REIMBURSEMENT.test(right));
}

/** Loại trích đoạn AI mang nghĩa phủ định đã biết, kể cả khi AI chỉ chép cụm động từ. */
export function riskQuoteIsExcluded(kind: RequirementKind, quote: string, text: string): boolean {
  if (!RISK_KINDS.has(kind)) return false;
  const origin = foldForRules(squash(text)).toLowerCase();
  const fragment = foldForRules(squash(quote)).toLowerCase();
  if (!fragment) return false;
  const cue = PATTERNS.find((pattern) => pattern.kind === kind)?.cue;
  const matches = cue ? [...fragment.matchAll(cue)] : [];
  if (matches.length === 0) return false;
  let start = origin.indexOf(fragment);
  if (start < 0) return false;
  while (start >= 0) {
    for (const match of matches) {
      const cueStart = start + match.index;
      const coerced = kind === 'fee_request' && CONDITION.test(clauseRest(origin, cueStart));
      if (coerced || !excluded(kind, origin, cueStart)) return false;
    }
    start = origin.indexOf(fragment, start + fragment.length);
  }
  return true;
}

function quoteThroughClause(text: string, folded: string, start: number, headLength: number, stopBeforeTime = false): string {
  const tail = clauseRest(folded, start + headLength);
  const plainTail = stopBeforeTime ? (tail.split(FEE_END, 1)[0] ?? '') : tail;
  return text.slice(start, start + Math.min(300, headLength + plainTail.length)).trim();
}

export function findRequirements(text: string): Requirement[] {
  const folded = foldForRules(text);
  const found: Requirement[] = [];
  for (const { kind, cue } of PATTERNS) {
    if (kind === 'fee_request') {
      const coerced = [...folded.matchAll(COERCIVE_FEE)].find((m) => CONDITION.test(clauseRest(folded, m.index)));
      if (coerced) {
        found.push({ kind, quote: quoteThroughClause(text, folded, coerced.index, coerced[0].length) });
        continue;
      }
    }
    const match = [...folded.matchAll(cue)].find((m) => !RISK_KINDS.has(kind) || !excluded(kind, folded, m.index));
    if (match) found.push({ kind, quote: quoteThroughClause(text, folded, match.index, match[0].length, kind === 'fee_request') });
  }
  return found;
}
