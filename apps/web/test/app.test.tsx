// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { buildApp } from '../../api/test/harness';

// fetch của trình duyệt được nối vào API thật (Fastify inject), dùng dữ liệu cases.json.
const api = buildApp();

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const res = await api.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST',
      url,
      payload: init?.body as string | undefined,
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    });
    return new Response(res.body, { status: res.statusCode, headers: { 'content-type': 'application/json' } });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function pickSample(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(id) }));
}

describe('luồng VT-DEMO-01', () => {
  it('nhập, sửa dữ kiện, xem ba kết quả và sao chép câu hỏi', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<App />);
    await pickSample(user, 'VT-DEMO-01');
    expect(screen.getAllByText('Dữ liệu mô phỏng').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));

    // Bước xác nhận: dữ kiện điền sẵn và sửa được.
    const confirmForm = await screen.findByRole('form', { name: 'Xác nhận dữ kiện' });
    const company = within(confirmForm).getByLabelText('Công ty') as HTMLInputElement;
    expect(company.value).toBe('Công ty Mô phỏng Sao Giấy');
    await user.clear(company);
    await user.type(company, 'Công ty Mô phỏng Sao Giấy');
    expect(within(confirmForm).getByText('đóng phí giữ suất phỏng vấn')).toBeTruthy();
    await user.click(within(confirmForm).getByRole('button', { name: 'Đối chiếu' }));

    // Kết quả: ba mục riêng.
    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Hết hạn')).toBeTruthy();
    const loc = screen.getByRole('article', { name: 'Địa điểm' });
    expect(within(loc).getByText('Chưa xác nhận công ty tại địa chỉ này')).toBeTruthy();
    expect(within(loc).getByRole('link', { name: 'Mở bản đồ' }).getAttribute('href')).toContain('google.com/maps');
    const inv = screen.getByRole('article', { name: 'Lời mời' });
    expect(within(inv).getByText('Yêu cầu đóng phí')).toBeTruthy();
    expect(within(inv).getByText('đóng phí giữ suất phỏng vấn')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Người liên hệ' })).getByText('Chưa xác minh')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Sao chép câu hỏi' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain('SG-101');
    expect(await screen.findByText('Đã sao chép')).toBeTruthy();
  });

  it('bỏ chọn yêu cầu đóng phí thì kết quả lời mời đổi theo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await pickSample(user, 'VT-DEMO-01');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    const form = await screen.findByRole('form', { name: 'Xác nhận dữ kiện' });
    await user.click(within(form).getByRole('checkbox'));
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));
    const inv = await screen.findByRole('article', { name: 'Lời mời' });
    expect(within(inv).queryByText('Yêu cầu đóng phí')).toBeNull();
  });
});

describe('ca khác và lỗi', () => {
  it('VT-DEMO-02 hiện địa điểm khớp', async () => {
    const user = userEvent.setup();
    render(<App />);
    await pickSample(user, 'VT-DEMO-02');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    await user.click(await screen.findByRole('button', { name: 'Đối chiếu' }));
    const loc = await screen.findByRole('article', { name: 'Địa điểm' });
    expect(within(loc).getByText('Công ty khớp địa chỉ')).toBeTruthy();
  });

  it('VT-DEMO-04 hiện nguồn chưa kiểm tra được', async () => {
    const user = userEvent.setup();
    render(<App />);
    await pickSample(user, 'VT-DEMO-04');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    await user.click(await screen.findByRole('button', { name: 'Đối chiếu' }));
    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Chưa kiểm tra được')).toBeTruthy();
    expect(within(job).getByText(/đăng nhập/)).toBeTruthy();
  });

  it('gửi rỗng thì báo lỗi và không gọi API', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    expect((await screen.findByRole('alert')).textContent).toContain('dán nội dung lời mời');
    // Chỉ có lần gọi tải ca mẫu và healthz lúc mở trang, không có lần gọi extract.
    expect(spy.mock.calls.every((c) => /\/demo\/cases|\/healthz/.test(String(c[0])))).toBe(true);
  });

  it('báo lỗi mạng bằng tiếng Việt', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url).includes('/demo/cases')) return new Response(JSON.stringify({ cases: [] }), { status: 200 });
      throw new TypeError('network');
    });
    render(<App />);
    await user.type(screen.getByLabelText('Nội dung lời mời'), 'Mời em phỏng vấn');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Không kết nối được máy chủ');
  });
});
