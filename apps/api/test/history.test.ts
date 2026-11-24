import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Ajv } from 'ajv';
import { buildApp } from './harness.js';
import { migrate } from '../src/viec-that/db.js';
import { DEFAULT_CASES_PATH, type DemoCase } from '../src/viec-that/demo-data.js';
import { hashToken, purgeExpired } from '../src/viec-that/history.js';
import { historyDetailResponseSchema, historyListResponseSchema } from '../../../shared/schemas.js';
import type { HistoryDetailResponse, HistoryListResponse, VerifyResponse } from '../../../shared/contract.js';
import { createTestDb } from './pglite-db.js';

const cases = (JSON.parse(readFileSync(DEFAULT_CASES_PATH, 'utf8')) as { cases: DemoCase[] }).cases;
const ajv = new Ajv({ strict: false, allErrors: true });
const validList = ajv.compile(historyListResponseSchema);
const validDetail = ajv.compile(historyDetailResponseSchema);

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  db = await createTestDb();
  app = buildApp({ db, historyTtlDays: 30 });
});
afterAll(async () => {
  await db.close();
});

/** Mô phỏng một trình duyệt: giữ cookie giữa các lần gọi. */
function browser() {
  let cookie = '';
  return {
    get cookie() {
      return cookie;
    },
    async call(method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) {
      const res = await app.inject({ method, url, payload: payload as object | undefined, headers: cookie ? { cookie } : undefined });
      const set = res.headers['set-cookie'];
      if (set) cookie = String(set).split(';')[0]!;
      return res;
    },
    async saveCase(c: DemoCase, save = true) {
      const ex = (await this.call('POST', '/api/v1/invitations/extract', { mode: 'simulated', ...c.input })).json();
      return this.call('POST', '/api/v1/invitations/verify', {
        mode: 'simulated',
        invitationText: c.input.invitationText,
        jobUrl: c.input.jobUrl,
        save,
        confirmed: {
          company: ex.fields.company.value,
          role: ex.fields.role.value,
          meetingAddress: ex.fields.meetingAddress.value,
          requirements: ex.requirements,
        },
      });
    },
  };
}

describe('migration', () => {
  it('chạy lại không áp dụng thêm', async () => {
    const before = await db.query<{ n: number }>('select count(*)::int as n from schema_migrations');
    await migrate(db);
    const after = await db.query<{ n: number }>('select count(*)::int as n from schema_migrations');
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    expect(before.rows[0]!.n).toBeGreaterThan(0);
  });
});

describe('lưu và xem lịch sử', () => {
  it('không lưu khi save không bật, cũng không đặt cookie', async () => {
    const b = browser();
    const res = await b.saveCase(cases[0]!, false);
    expect(res.statusCode).toBe(200);
    expect(res.json<VerifyResponse>().historyId).toBeNull();
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await b.call('GET', '/api/v1/history')).json<HistoryListResponse>().items).toEqual([]);
  });

  it('lưu bản ghi, đặt cookie HttpOnly và chỉ lưu băm của mã thiết bị', async () => {
    const b = browser();
    const res = await b.saveCase(cases[0]!);
    expect(res.statusCode).toBe(200);
    const id = res.json<VerifyResponse>().historyId!;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const set = String(res.headers['set-cookie']);
    expect(set).toContain('HttpOnly');
    expect(set).toContain('SameSite=Lax');

    const token = b.cookie.split('=')[1]!;
    const row = (await db.query<{ device_hash: string }>('select device_hash from checks where id = $1', [id])).rows[0]!;
    expect(row.device_hash).toBe(hashToken(token));
    expect(row.device_hash).not.toContain(token);
  });

  it('danh sách mới nhất trước, chi tiết có đủ dữ kiện và kết quả đã lưu', async () => {
    const b = browser();
    await b.saveCase(cases[0]!);
    await b.saveCase(cases[1]!);
    const list = await b.call('GET', '/api/v1/history');
    const body = list.json<HistoryListResponse>();
    expect(validList(body), JSON.stringify(validList.errors)).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]!.title).toContain('Vườn Chữ');
    expect(body.items[1]!.jobStatus).toBe('expired');
    expect(body.items[1]!.invitationStatus).toBe('caution');
    expect(body.items[0]!.simulated).toBe(true);

    const detail = await b.call('GET', `/api/v1/history/${body.items[1]!.id}`);
    expect(detail.statusCode).toBe(200);
    const d = detail.json<HistoryDetailResponse>();
    expect(validDetail(d), JSON.stringify(validDetail.errors)).toBe(true);
    expect(d.input.invitationText).toBe(cases[0]!.input.invitationText);
    expect(d.result.historyId).toBe(d.id);
    expect(d.result.invitation.requirements[0]!.quote).toBe('đóng phí giữ suất phỏng vấn');
    expect(d.result.guidance.suggestedQuestion).toContain('SG-101');
  });

  it('thiết bị khác không thấy và không xem được bản ghi', async () => {
    const a = browser();
    const id = (await a.saveCase(cases[0]!)).json<VerifyResponse>().historyId!;
    const other = browser();
    await other.saveCase(cases[1]!);
    const list = (await other.call('GET', '/api/v1/history')).json<HistoryListResponse>();
    expect(list.items.map((i) => i.id)).not.toContain(id);
    expect((await other.call('GET', `/api/v1/history/${id}`)).statusCode).toBe(404);
    expect((await other.call('DELETE', `/api/v1/history/${id}`)).statusCode).toBe(404);
    expect((await other.call('POST', '/api/v1/history/delete', { ids: [id] })).json().deleted).toBe(0);
    // bản ghi vẫn còn với chủ sở hữu
    expect((await a.call('GET', `/api/v1/history/${id}`)).statusCode).toBe(200);
  });

  it('không có cookie thì danh sách rỗng, không lỗi', async () => {
    const res = await browser().call('GET', '/api/v1/history');
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it('cookie giả hoặc sai định dạng bị bỏ qua', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/history', headers: { cookie: 'vt_device=abc' } });
    expect(res.json().items).toEqual([]);
  });
});

describe('xóa lịch sử', () => {
  it('xóa một mục', async () => {
    const b = browser();
    const id = (await b.saveCase(cases[0]!)).json<VerifyResponse>().historyId!;
    expect((await b.call('DELETE', `/api/v1/history/${id}`)).statusCode).toBe(204);
    expect((await b.call('GET', `/api/v1/history/${id}`)).statusCode).toBe(404);
    const left = await db.query('select 1 from checks where id = $1', [id]);
    expect(left.rows).toHaveLength(0);
  });

  it('xóa nhiều mục đã chọn, giữ lại mục không chọn', async () => {
    const b = browser();
    const ids: string[] = [];
    for (const c of cases.slice(0, 3)) ids.push((await b.saveCase(c)).json<VerifyResponse>().historyId!);
    const res = await b.call('POST', '/api/v1/history/delete', { ids: [ids[0]!, ids[2]!] });
    expect(res.json().deleted).toBe(2);
    const left = (await b.call('GET', '/api/v1/history')).json<HistoryListResponse>().items.map((i) => i.id);
    expect(left).toEqual([ids[1]]);
  });

  it('400 với id sai định dạng hoặc danh sách rỗng', async () => {
    const b = browser();
    await b.saveCase(cases[0]!);
    expect((await b.call('POST', '/api/v1/history/delete', { ids: ['abc'] })).statusCode).toBe(400);
    expect((await b.call('POST', '/api/v1/history/delete', { ids: [] })).statusCode).toBe(400);
    expect((await b.call('GET', '/api/v1/history/not-a-uuid')).statusCode).toBe(400);
  });
});

describe('hết hạn', () => {
  it('bản ghi quá hạn không hiện và bị dọn', async () => {
    const b = browser();
    const id = (await b.saveCase(cases[0]!)).json<VerifyResponse>().historyId!;
    await db.query(`update checks set expires_at = now() - interval '1 minute' where id = $1`, [id]);
    expect((await b.call('GET', '/api/v1/history')).json().items).toEqual([]);
    expect((await b.call('GET', `/api/v1/history/${id}`)).statusCode).toBe(404);
    expect(await purgeExpired(db)).toBeGreaterThanOrEqual(1);
    expect((await db.query('select 1 from checks where id = $1', [id])).rows).toHaveLength(0);
  });

  it('expires_at theo số ngày cấu hình', async () => {
    const b = browser();
    const id = (await b.saveCase(cases[0]!)).json<VerifyResponse>().historyId!;
    const r = await db.query<{ days: number }>(
      `select round(extract(epoch from (expires_at - created_at)) / 86400)::int as days from checks where id = $1`,
      [id],
    );
    expect(r.rows[0]!.days).toBe(30);
  });
});

describe('khi chưa bật cơ sở dữ liệu', () => {
  const bare = buildApp();
  it('healthz báo history.enabled = false', async () => {
    expect((await bare.inject({ url: '/healthz' })).json().history).toEqual({ enabled: false, ttlDays: 30 });
  });
  it('save:true trả 503 HISTORY_DISABLED thay vì lặng lẽ bỏ qua', async () => {
    const res = await bare.inject({
      method: 'POST',
      url: '/api/v1/invitations/verify',
      payload: { mode: 'simulated', invitationText: 'x', save: true, confirmed: { company: null, role: null, meetingAddress: null, requirements: [] } },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('HISTORY_DISABLED');
  });
  it('các endpoint lịch sử trả 503', async () => {
    expect((await bare.inject({ url: '/api/v1/history' })).statusCode).toBe(503);
  });
  it('verify không save vẫn chạy bình thường', async () => {
    const res = await bare.inject({
      method: 'POST',
      url: '/api/v1/invitations/verify',
      payload: { mode: 'simulated', invitationText: 'x', confirmed: { company: null, role: null, meetingAddress: null, requirements: [] } },
    });
    expect(res.statusCode).toBe(200);
  });
});
