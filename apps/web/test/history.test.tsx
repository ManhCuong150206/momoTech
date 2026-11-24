// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { buildApp } from '../../api/test/harness';
import { createTestDb } from '../../api/test/pglite-db';

let db: Awaited<ReturnType<typeof createTestDb>>;
let api: ReturnType<typeof buildApp>;
let cookie = '';

beforeAll(async () => {
  db = await createTestDb();
  api = buildApp({ db, historyTtlDays: 30 });
  await api.ready();
});
afterAll(async () => {
  await api.close();
  await db.close();
});

beforeEach(async () => {
  cookie = '';
  await db.query('delete from checks');
  // fetch nối vào API thật và giữ cookie như trình duyệt.
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const res = await api.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST' | 'DELETE',
      url,
      payload: init?.body as string | undefined,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
    });
    const set = res.headers['set-cookie'];
    if (set) cookie = String(set).split(';')[0]!;
    return new Response(res.statusCode === 204 ? null : res.body, {
      status: res.statusCode,
      headers: { 'content-type': 'application/json' },
    });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function runCase(user: ReturnType<typeof userEvent.setup>, id: string, opts?: { save?: boolean }) {
  await user.click(await screen.findByRole('button', { name: 'Thử với dữ liệu mẫu' }));
  await user.click(await screen.findByRole('button', { name: new RegExp(id) }));
  await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
  const form = await screen.findByRole('form', { name: 'Xác nhận dữ kiện' });
  const saveBox = within(form).getByRole('checkbox', { name: /Lưu vào lịch sử/ }) as HTMLInputElement;
  // Mặc định không lưu. Người dùng tự bật.
  expect(saveBox.checked).toBe(false);
  expect(saveBox.getAttribute('aria-describedby')).toBe('save-hint');
  expect(within(form).getByText(/Có lưu nội dung lời mời trong 30 ngày/)).toBeTruthy();
  if (opts?.save !== false) await user.click(saveBox);
  await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));
  await screen.findByRole('article', { name: 'Tin đăng' });
}

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Lịch sử' }));
  await screen.findByRole('region', { name: 'Lịch sử tra cứu' });
}

describe('lịch sử tra cứu trên web', () => {
  it('lưu, xem lại danh sách và mở lại kết quả đã lưu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await runCase(user, 'VT-DEMO-01');
    expect(screen.getByText('Đã lưu vào lịch sử.')).toBeTruthy();

    await openHistory(user);
    const item = await screen.findByRole('button', { name: /Công ty Mô phỏng Sao Giấy/ });
    expect(within(item).getByText('Cần thận trọng')).toBeTruthy();
    await user.click(item);

    expect(await screen.findByText('Lời mời đã nhập')).toBeTruthy();
    const job = screen.getByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Hết hạn')).toBeTruthy();
    expect(screen.getByTestId('suggested-question').textContent).toContain('SG-101');
    await user.click(screen.getByRole('button', { name: /Về danh sách/ }));
    expect(await screen.findByRole('region', { name: 'Lịch sử tra cứu' })).toBeTruthy();
  });

  it('bỏ chọn lưu thì không có gì trong lịch sử', async () => {
    const user = userEvent.setup();
    render(<App />);
    await runCase(user, 'VT-DEMO-01', { save: false });
    expect(screen.queryByText('Đã lưu vào lịch sử.')).toBeNull();
    await openHistory(user);
    expect(await screen.findByText('Chưa có lần tra cứu nào được lưu.')).toBeTruthy();
  });

  it('chọn một số mục để xóa, có bước xác nhận, mục không chọn vẫn còn', async () => {
    const user = userEvent.setup();
    render(<App />);
    await runCase(user, 'VT-DEMO-01');
    await user.click(screen.getByRole('button', { name: 'Kiểm tra lời mời khác' }));
    await runCase(user, 'VT-DEMO-02');
    await openHistory(user);

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    const del = screen.getByRole('button', { name: /Xóa đã chọn/ }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: /Chọn Công ty Mô phỏng Sao Giấy/ }));
    await user.click(screen.getByRole('button', { name: 'Xóa đã chọn (1)' }));
    const dialog = screen.getByRole('alertdialog');
    // Hủy thì không xóa.
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Xóa đã chọn (1)' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.queryByText(/Sao Giấy/)).toBeNull();
    expect(screen.getByText(/Vườn Chữ/)).toBeTruthy();
    const rows = await db.query('select title from checks');
    expect(rows.rows).toHaveLength(1);
  });

  it('chọn tất cả rồi xóa thì danh sách trống', async () => {
    const user = userEvent.setup();
    render(<App />);
    await runCase(user, 'VT-DEMO-04');
    await openHistory(user);
    await user.click(await screen.findByRole('checkbox', { name: 'Chọn tất cả' }));
    await user.click(screen.getByRole('button', { name: /Xóa đã chọn \(1\)/ }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa' }));
    expect(await screen.findByText('Chưa có lần tra cứu nào được lưu.')).toBeTruthy();
  });
});
