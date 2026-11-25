import { afterAll, describe, expect, it } from 'vitest';
import type { VerifyRequest, VerifyResponse } from '../../../shared/contract.js';
import { errorResponseSchema } from '../../../shared/schemas.js';
import { evaluateContact, normalizePhone } from '../src/viec-that/contact.js';
import { demoData, findCaseByJobUrl, normalizeJobUrl } from '../src/viec-that/demo-data.js';
import { buildApp } from './harness.js';

// Các quyết định của nhóm ở mục 7 trong docs/API-CONTRACT.md.

const app = buildApp();
afterAll(() => app.close());

const live = (patch: Partial<VerifyRequest> = {}): VerifyRequest => ({
  mode: 'live',
  invitationText: 'Chị Lan bên Công ty Ánh Dương mời em phỏng vấn. Liên hệ lan.nguyen@anhduong.vn hoặc 0901 234 567.',
  jobUrl: 'https://www.topcv.vn/job/9',
  confirmed: { company: 'Công ty Ánh Dương', role: null, meetingAddress: '25 Nguyễn Huệ, Quận 1', requirements: [] },
  ...patch,
});
const verify = async (body: VerifyRequest) =>
  (await app.inject({ method: 'POST', url: '/api/v1/invitations/verify', payload: body })).json<VerifyResponse>();

describe('1. câu hỏi gợi ý xin kênh tuyển dụng chính thức', () => {
  it('expected của VT-DEMO-01 và API cùng một câu', async () => {
    const c = demoData.cases.find((x) => x.id === 'VT-DEMO-01')!;
    const ex = (await app.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'simulated', ...c.input } })).json();
    const body = await verify({
      mode: 'simulated',
      invitationText: c.input.invitationText,
      jobUrl: c.input.jobUrl,
      confirmed: { company: ex.fields.company.value, role: ex.fields.role.value, meetingAddress: ex.fields.meetingAddress.value, requirements: ex.requirements },
    });
    expect(body.guidance.suggestedQuestion).toBe((c.expected as { suggestedQuestion: string }).suggestedQuestion);
    expect(body.guidance.suggestedQuestion).toContain('kênh tuyển dụng chính thức');
  });
});

describe('2. tin hết hạn đưa lời mời vào mục cảnh báo', () => {
  it('tin hết hạn, không yêu cầu phí: lời mời là caution', async () => {
    const body = await verify(live({ jobPosting: { closesOn: '2026-01-31' } }));
    expect(body.job.status).toBe('expired');
    expect(body.invitation.status).toBe('caution');
    expect(body.invitation.basis).toContain('đã hết hạn');
  });
  it('tin ghi rõ đã đóng tuyển cũng là caution', async () => {
    expect((await verify(live({ jobPosting: { closed: true } }))).invitation.status).toBe('caution');
  });
});

describe('3. người liên hệ verified khi trùng email hoặc số điện thoại trên trang chính thức', () => {
  const TEXT = 'Liên hệ lan.nguyen@anhduong.vn hoặc 0901 234 567.';
  it('trùng email (không phân biệt hoa thường)', () => {
    const r = evaluateContact(TEXT, { official: ['Email tuyển dụng: Lan.Nguyen@AnhDuong.vn'] });
    expect(r.status).toBe('verified');
    expect(r.basis).toContain('lan.nguyen@anhduong.vn');
  });
  it('trùng số điện thoại dù viết khác dạng (+84, dấu chấm)', () => {
    expect(evaluateContact(TEXT, { official: ['Hotline: +84 901.234.567'] }).status).toBe('verified');
    expect(normalizePhone('+84 901.234.567')).toBe('0901234567');
  });
  it('người gửi nhập riêng khi lời mời không ghi liên hệ', () => {
    expect(evaluateContact('Mời em phỏng vấn.', { sender: ['0901234567'], official: ['0901 234 567'] }).status).toBe('verified');
  });
  it('không trùng thì vẫn unverified', () => {
    const r = evaluateContact(TEXT, { official: ['hr@congtykhac.vn', '0283 999 888'] });
    expect(r.status).toBe('unverified');
    expect(r.basis).toContain('không trùng');
  });
  it('thiếu thông tin trang chính thức thì unverified', () => {
    expect(evaluateContact(TEXT, null).status).toBe('unverified');
    expect(evaluateContact('Mời em phỏng vấn.', { official: ['hr@anhduong.vn'] }).basis).toContain('Chưa có email hoặc số điện thoại của người gửi');
  });
  it('qua API: verified không làm lời mời đòi phí hết cảnh báo', async () => {
    const body = await verify(
      live({
        invitationText: `${TEXT} Em đóng phí hồ sơ 200.000đ trước buổi hẹn.`,
        contact: { official: ['lan.nguyen@anhduong.vn'] },
        confirmed: { company: 'Công ty Ánh Dương', role: null, meetingAddress: null, requirements: [{ kind: 'fee_request', quote: 'đóng phí hồ sơ 200.000đ' }] },
      }),
    );
    expect(body.contact.status).toBe('verified');
    expect(body.invitation.status).toBe('caution');
  });
});

describe('4. bỏ SOURCE_MODE_UNSUPPORTED', () => {
  it('không còn trong enum mã lỗi', () => {
    expect(errorResponseSchema.properties.error.properties.code.enum).not.toContain('SOURCE_MODE_UNSUPPORTED');
  });
});

describe('5. chuẩn hóa URL trước khi so ca mẫu', () => {
  it.each([
    'https://saogiay.example/jobs/SG-101/',
    'http://saogiay.example/jobs/SG-101',
    'https://www.SaoGiay.example/jobs/SG-101?utm_source=zalo#apply',
    'saogiay.example/jobs/SG-101',
    '  https://saogiay.example/jobs/SG-101  ',
  ])('%s khớp VT-DEMO-01', (url) => {
    expect(findCaseByJobUrl(demoData, url)?.id).toBe('VT-DEMO-01');
  });
  it('đường dẫn khác hoặc tham số nội dung khác thì không khớp', () => {
    expect(findCaseByJobUrl(demoData, 'https://saogiay.example/jobs/SG-102')).toBeUndefined();
    expect(normalizeJobUrl('https://a.vn/j?id=1&b=2')).toBe(normalizeJobUrl('https://a.vn/j?b=2&id=1'));
    expect(normalizeJobUrl('https://a.vn/j?id=1')).not.toBe(normalizeJobUrl('https://a.vn/j?id=2'));
  });
});

describe('6. sai phương thức trả 405, thân quá lớn trả 413', () => {
  it('GET vào endpoint chỉ nhận POST: 405 kèm Allow', async () => {
    const res = await app.inject({ url: '/api/v1/invitations/extract' });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('POST');
    expect(res.json().error.code).toBe('METHOD_NOT_ALLOWED');
  });
  it('PUT vào lịch sử một mục: 405 liệt kê GET, HEAD, DELETE', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/v1/history/00000000-0000-4000-8000-000000000000' });
    expect(res.statusCode).toBe(405);
    expect(String(res.headers.allow).split(', ').sort()).toEqual(['DELETE', 'GET', 'HEAD']);
  });
  it('đường dẫn không tồn tại vẫn là 404', async () => {
    const res = await app.inject({ url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
  it('thân quá lớn: 413 với thông báo riêng', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/extract',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ mode: 'live', invitationText: 'x'.repeat(200_000) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toEqual({ code: 'VALIDATION_ERROR', message: 'Nội dung gửi lên quá lớn.' });
  });
});

describe('DEMO_CASES_ENABLED=false: bản chạy thực tế không có ca mẫu', () => {
  const prod = buildApp({ demoCasesEnabled: false });
  afterAll(() => prod.close());

  it('healthz chỉ báo chế độ live, danh sách ca mẫu rỗng', async () => {
    expect((await prod.inject({ url: '/healthz' })).json().modes).toEqual(['live']);
    expect((await prod.inject({ url: '/api/v1/demo/cases' })).json()).toEqual({ cases: [] });
  });

  it('yêu cầu simulated bị từ chối bằng 400, live vẫn chạy', async () => {
    const c = demoData.cases[0]!;
    for (const url of ['/api/v1/invitations/extract', '/api/v1/invitations/verify']) {
      const payload =
        url.endsWith('extract')
          ? { mode: 'simulated', ...c.input }
          : { mode: 'simulated', invitationText: c.input.invitationText, confirmed: { company: null, role: null, meetingAddress: null, requirements: [] } };
      const res = await prod.inject({ method: 'POST', url, payload });
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('Chế độ mô phỏng đã tắt') });
    }
    const live = await prod.inject({ method: 'POST', url: '/api/v1/invitations/extract', payload: { mode: 'live', invitationText: c.input.invitationText } });
    expect(live.statusCode).toBe(200);
  });

  it('mặc định (không đặt biến) vẫn bật ca mẫu', async () => {
    expect((await app.inject({ url: '/healthz' })).json().modes).toEqual(['simulated', 'live']);
    expect((await app.inject({ url: '/api/v1/demo/cases' })).json().cases).toHaveLength(4);
  });
});
