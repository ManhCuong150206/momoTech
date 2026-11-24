import cases from './cases.json' with { type: 'json' };

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

export const demoData = cases as DemoData;

export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[,.;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tìm ca mô phỏng theo link tin đăng. Không có link hoặc không khớp thì trả undefined. */
export function findCaseByJobUrl(
  data: DemoData,
  jobUrl: string | null | undefined,
): DemoCase | undefined {
  const url = (jobUrl ?? '').trim();
  if (!url) return undefined;
  return data.cases.find((c) => c.input.jobUrl === url);
}
