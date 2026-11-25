import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dữ liệu mô phỏng. `expected` chỉ dùng trong kiểm thử, không đi vào code xử lý hay gửi cho AI.

export interface DemoFixtures {
  job?: {
    source?: string | null;
    company?: string;
    role?: string;
    jobCode?: string;
    postedOn?: string | null;
    closesOn?: string | null;
    status?: string;
    reason?: string;
  };
  place?: {
    source?: string | null;
    status?: string;
    displayName?: string;
    address?: string | null;
    companyAtAddress?: string | null;
  };
  registry?: { source?: string; registeredOffice?: string };
}

export interface DemoCase {
  id: string;
  title: string;
  kind: 'simulated';
  input: {
    invitationText: string;
    jobUrl: string | null;
    meetingAddress: string | null;
  };
  fixtures: DemoFixtures;
  expected: Record<string, unknown>;
}

export interface DemoData {
  demoAsOf: string;
  cases: DemoCase[];
}

/** Bộ ca mẫu dùng chung với web và kiểm thử: data/demo/cases.json ở thư mục gốc. */
export const DEFAULT_CASES_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../data/demo/cases.json',
);

export function loadDemoData(file: string = DEFAULT_CASES_PATH): DemoData {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as DemoData;
  return { demoAsOf: raw.demoAsOf, cases: raw.cases };
}

export const demoData = loadDemoData();

export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[,.;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tham số chỉ để đo lượt truy cập, không đổi nội dung trang. */
const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|ref|source)$/i;

/**
 * Chuẩn hóa link tin để so ca mẫu: bỏ http/https và `www.`, chữ thường ở tên miền,
 * bỏ dấu `/` cuối, bỏ phần `#...` và tham số theo dõi, sắp xếp các tham số còn lại.
 * Chuỗi không phải URL thì chỉ cắt khoảng trắng.
 */
export function normalizeJobUrl(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return raw;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return raw;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const port = url.port ? `:${url.port}` : '';
  const pathname = url.pathname.replace(/\/+$/, '');
  const params = [...url.searchParams]
    .filter(([k]) => !TRACKING_PARAM.test(k))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  return `${host}${port}${pathname}${query}`;
}

/** Tìm ca mô phỏng theo link tin đăng, so sau khi chuẩn hóa. Không có link hoặc không khớp thì trả undefined. */
export function findCaseByJobUrl(
  data: DemoData,
  jobUrl: string | null | undefined,
): DemoCase | undefined {
  const url = normalizeJobUrl(jobUrl);
  if (!url) return undefined;
  return data.cases.find((c) => normalizeJobUrl(c.input.jobUrl) === url);
}
