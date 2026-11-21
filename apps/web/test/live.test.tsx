// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { buildApp } from '../../api/src/app';
import type { AiExtractor } from '../../api/src/ai';

const TEXT =
  'Chào em, Công ty TNHH Ánh Dương mời em phỏng vấn vị trí Nhân viên Kinh doanh tại 25 Nguyễn Huệ, Quận 1. Em gửi trước ảnh CCCD và đóng phí hồ sơ 300.000đ.';

const ai: AiExtractor = async () => ({
  company: 'Công ty TNHH Ánh Dương',
  role: 'Nhân viên Kinh doanh',
  meetingAddress: '25 Nguyễn Huệ, Quận 1',
  requirements: [],
  dropped: 0,
});

function stubApi(api: ReturnType<typeof buildApp>) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const res = await api.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST',
      url,
      payload: init?.body as string | undefined,
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    });
    return new Response(res.body, { status: res.statusCode, headers: { 'content-type': 'application/json' } });
  });
}

beforeEach(() => stubApi(buildApp({ ai })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('lời mời mới ở chế độ thật', () => {
  it('nhập tay, AI điền sẵn, nhập hạn nộp, thấy tin hết hạn và không có nhãn mô phỏng', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/gửi tới dịch vụ AI/)).toBeTruthy();

    await user.type(screen.getByLabelText('Nội dung lời mời'), TEXT);
    await user.type(screen.getByLabelText('Link tin tuyển dụng (nếu có)'), 'https://www.topcv.vn/job/1');
    fireEvent.change(screen.getByLabelText('Hạn nộp hồ sơ'), { target: { value: '2026-09-30' } });
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));

    const form = await screen.findByRole('form', { name: 'Xác nhận dữ kiện' });
    expect((within(form).getByLabelText('Công ty') as HTMLInputElement).value).toBe('Công ty TNHH Ánh Dương');
    expect((within(form).getByLabelText('Địa chỉ hẹn') as HTMLInputElement).value).toBe('25 Nguyễn Huệ, Quận 1');
    expect(within(form).getByText('Yêu cầu đóng phí')).toBeTruthy();
    expect(within(form).getByText('Yêu cầu gửi giấy tờ cá nhân')).toBeTruthy();
    expect(within(form).queryByText('Dữ liệu mô phỏng')).toBeNull();
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));

    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Hết hạn')).toBeTruthy();
    expect(within(job).getByText(/2026-09-30/)).toBeTruthy();
    const loc = screen.getByRole('article', { name: 'Địa điểm' });
    expect(within(loc).getByText('Chưa đối chiếu tự động')).toBeTruthy();
    expect(within(loc).getByRole('link', { name: 'Mở bản đồ' })).toBeTruthy();
    expect(screen.queryByText('Dữ liệu mô phỏng')).toBeNull();
    expect(screen.getByTestId('suggested-question').textContent).toContain('hết hạn');
  });

  it('chỉ có link sàn việc làm thì báo chưa kiểm tra được, không kết luận hết hạn', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Nội dung lời mời'), TEXT);
    await user.type(screen.getByLabelText('Link tin tuyển dụng (nếu có)'), 'https://www.linkedin.com/jobs/view/1');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    await user.click(await screen.findByRole('button', { name: 'Đối chiếu' }));
    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Chưa kiểm tra được')).toBeTruthy();
    expect(within(job).getByText(/không tự đọc trang của sàn/)).toBeTruthy();
    expect(within(job).queryByText('Hết hạn')).toBeNull();
  });
});
