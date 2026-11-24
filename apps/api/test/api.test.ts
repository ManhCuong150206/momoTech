import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ajv } from 'ajv';
import { buildApp } from './harness.js';
import { DEFAULT_CASES_PATH, type DemoCase } from '../src/viec-that/demo-data.js';
import {
  extractResponseSchema,
  healthResponseSchema,
  verifyResponseSchema,
} from '../../../shared/schemas.js';
import type { ExtractResponse, VerifyResponse } from '../../../shared/contract.js';

// `expected` chỉ được đọc ở đây (phía kiểm thử), không đi vào code xử lý.
const raw = JSON.parse(readFileSync(DEFAULT_CASES_PATH, 'utf8')) as { cases: DemoCase[] };
const app = buildApp();
const ajv = new Ajv({ allErrors: true, strict: false });
const validateExtract = ajv.compile(extractResponseSchema);
const validateVerify = ajv.compile(verifyResponseSchema);
const validateHealth = ajv.compile(healthResponseSchema);

async function runCase(c: DemoCase, edit?: (e: ExtractResponse) => { company?: string | null; meetingAddress?: string | null }) {
  const ex = await app.inject({
    method: 'POST',
    url: '/api/v1/invitations/extract',
    payload: { mode: 'simulated', ...c.input },
  });
  expect(ex.statusCode).toBe(200);
  const extract = ex.json<ExtractResponse>();
  expect(validateExtract(extract), JSON.stringify(validateExtract.errors)).toBe(true);
  const over = edit?.(extract) ?? {};
  const vr = await app.inject({
    method: 'POST',
    url: '/api/v1/invitations/verify',
    payload: {
      mode: 'simulated',
      invitationText: c.input.invitationText,
      jobUrl: c.input.jobUrl,
      confirmed: {
        company: 'company' in over ? over.company : extract.fields.company.value,
        role: extract.fields.role.value,
        meetingAddress: 'meetingAddress' in over ? over.meetingAddress : extract.fields.meetingAddress.value,
        requirements: extract.requirements,
      },
    },
  });
  return { extract, vr };
}

describe('GET /healthz', () => {
  it('trả trạng thái ok đúng schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(validateHealth(res.json()), JSON.stringify(validateHealth.errors)).toBe(true);
    expect(res.json().status).toBe('ok');
  });
});

describe('bốn ca mô phỏng: kết quả khớp expected', () => {
  for (const c of raw.cases) {
    it(c.id, async () => {
      const { vr } = await runCase(c);
      expect(vr.statusCode).toBe(200);
      const body = vr.json<VerifyResponse>();
      expect(validateVerify(body), JSON.stringify(validateVerify.errors)).toBe(true);
      const exp = c.expected as {
        jobStatus: string;
        locationStatus: string;
        contactStatus: string;
        invitationStatus: string;
        evidenceQuotes: string[];
      };
      expect(body.simulated).toBe(true);
      expect(body.job.status).toBe(exp.jobStatus);
      expect(body.location.status).toBe(exp.locationStatus);
      expect(body.contact.status).toBe(exp.contactStatus);
      expect(body.invitation.status).toBe(exp.invitationStatus);
      const quotes = body.invitation.requirements.map((r) => r.quote);
      for (const q of exp.evidenceQuotes) expect(quotes).toContain(q);
      for (const q of quotes) expect(c.input.invitationText).toContain(q);
      expect(body.guidance.nextStep.length).toBeGreaterThan(0);
      expect(body.guidance.suggestedQuestion).toMatch(/^.*Anh\/chị cho em xin .+ được không ạ\?$/);
    });
  }
});

describe('VT-DEMO-01 chi tiết nghiệm thu', () => {
  const c = raw.cases.find((x) => x.id === 'VT-DEMO-01')!;

  it('tin hết hạn, chưa xác nhận công ty, có yêu cầu phí và câu hỏi nêu mã tin', async () => {
    const { extract, vr } = await runCase(c);
    expect(extract.fields.company.value).toBe('Công ty Mô phỏng Sao Giấy');
    expect(extract.fields.company.origin).toBe('invitation_text');
    const body = vr.json<VerifyResponse>();
    expect(body.job.status).toBe('expired');
    expect(body.job.basis).toContain('2026-11-10');
    expect(body.location.status).toBe('company_unconfirmed');
    expect(body.location.basis).toContain('Chưa xác nhận công ty tại địa chỉ này');
    expect(body.location.mapUrl).toContain('google.com/maps/search');
    expect(body.invitation.requirements[0]).toEqual({ kind: 'fee_request', quote: 'đóng phí giữ suất phỏng vấn' });
    expect(body.guidance.nextStep).toContain('Tạm dừng đóng phí');
    expect(body.guidance.suggestedQuestion).toContain('SG-101');
    expect(body.guidance.suggestedQuestion).toContain('mã tuyển dụng hiện tại');
  });

  it('sửa địa chỉ ra ngoài ca mô phỏng thì không áp dụng bản đồ mô phỏng', async () => {
    const { vr } = await runCase(c, () => ({ meetingAddress: 'Số 1 Đường Khác' }));
    const body = vr.json<VerifyResponse>();
    expect(body.location.status).toBe('not_checked');
    expect(body.notices.join(' ')).toContain('Địa chỉ đã sửa');
  });
});

describe('ca địa điểm khớp (VT-DEMO-02)', () => {
  const c = raw.cases.find((x) => x.id === 'VT-DEMO-02')!;
  it('khớp khi công ty xác nhận trùng công ty tại địa chỉ, người liên hệ vẫn chưa xác minh', async () => {
    const body = (await runCase(c)).vr.json<VerifyResponse>();
    expect(body.location.status).toBe('matched');
    expect(body.job.status).toBe('open');
    expect(body.contact.status).toBe('unverified');
  });
  it('đổi sang công ty khác thì không còn khớp', async () => {
    const body = (await runCase(c, () => ({ company: 'Công ty Khác' }))).vr.json<VerifyResponse>();
    expect(body.location.status).toBe('company_unconfirmed');
  });
});

describe('ca nguồn không truy cập được (VT-DEMO-04)', () => {
  const c = raw.cases.find((x) => x.id === 'VT-DEMO-04')!;
  it('báo chưa kiểm tra được và nêu cách bổ sung', async () => {
    const { extract, vr } = await runCase(c);
    expect(extract.fields.company.origin).toBe('not_found');
    const body = vr.json<VerifyResponse>();
    expect(body.job.status).toBe('unavailable');
    expect(body.job.basis).toContain('đăng nhập');
    expect(body.location.status).toBe('not_checked');
    expect(body.location.mapUrl).toBeNull();
    expect(body.guidance.nextStep).toContain('Bổ sung');
  });
});

describe('lỗi', () => {
  it('400 VALIDATION_ERROR khi thiếu invitationText', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'simulated' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('400 VALIDATION_ERROR khi invitationText chỉ có khoảng trắng (R1), ở cả extract và verify', async () => {
    const blank = ' \n\t ';
    const ex = await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'live', invitationText: blank } });
    expect(ex.statusCode).toBe(400);
    expect(ex.json().error.details[0].keyword).toBe('pattern');
    const ve = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/verify',
      payload: { mode: 'live', invitationText: blank, confirmed: { company: null, role: null, meetingAddress: null, requirements: [] } },
    });
    expect(ve.statusCode).toBe(400);
    expect(ve.json().error.code).toBe('VALIDATION_ERROR');
  });
  it('400 khi lời mời rỗng hoặc có trường lạ', async () => {
    const a = await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'simulated', invitationText: '' } });
    expect(a.statusCode).toBe(400);
    const b = await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'simulated', invitationText: 'x', expected: {} } });
    expect(b.statusCode).toBe(400);
  });
  it('422 QUOTE_NOT_IN_SOURCE khi đoạn trích không có trong lời mời', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/verify',
      payload: {
        mode: 'simulated',
        invitationText: 'Mời em phỏng vấn.',
        confirmed: { company: null, role: null, meetingAddress: null, requirements: [{ kind: 'fee_request', quote: 'đóng phí' }] },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('QUOTE_NOT_IN_SOURCE');
  });
  it('mode live chạy được khi chưa cấu hình dịch vụ ngoài và nói rõ phần nào bị hạ cấp', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'live', invitationText: 'Mời em đóng phí giữ chỗ trước buổi hẹn.' } });
    expect(res.statusCode).toBe(200);
    const body = res.json<ExtractResponse>();
    expect(body.simulated).toBe(false);
    expect(body.notices.join(' ')).toContain('AI chưa được cấu hình');
    expect(body.requirements.map((r) => r.kind)).toContain('fee_request');
  });
  it('404 NOT_FOUND với đường dẫn lạ', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
  it('API demo cases không lộ fixtures hay expected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/demo/cases' });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('expected');
    expect(res.body).not.toContain('fixtures');
    expect(res.json().cases).toHaveLength(4);
  });
});
