// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { buildApp } from '../../api/test/harness';
import type { AiExtractor } from '../../api/src/viec-that/ai';
import { GeocodingError } from '../../api/src/geocoding/geocoding.service';

const TEXT =
  'Chào em, Công ty TNHH Ánh Dương mời em phỏng vấn vị trí Nhân viên Kinh doanh tại 25 Nguyễn Huệ, Quận 1. Em gửi trước ảnh CCCD và đóng phí hồ sơ 300.000đ.';

const ai: AiExtractor = async () => ({
  company: 'Công ty TNHH Ánh Dương',
  role: 'Nhân viên Kinh doanh',
  meetingAddress: '25 Nguyễn Huệ, Quận 1',
  requirements: [],
  dropped: 0,
});

const apps: Array<ReturnType<typeof buildApp>> = [];

/** Nối fetch vào API NestJS thật. Đợi API khởi động xong trước khi render để lần tải đầu không bị chậm. */
async function stubApi(api: ReturnType<typeof buildApp>) {
  apps.push(api);
  await api.ready();
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
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await Promise.all(apps.splice(0).map((a) => a.close()));
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
    expect(within(job).getByRole('link', { name: 'Mở tin tham chiếu' }).getAttribute('href')).toBe('https://www.topcv.vn/job/1');
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

  it('không mở liên kết có giao thức ngoài HTTP và HTTPS', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Nội dung lời mời'), TEXT);
    await user.type(screen.getByLabelText('Link tin tuyển dụng (nếu có)'), 'mailto:hr@example.com');
    await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
    await user.click(await screen.findByRole('button', { name: 'Đối chiếu' }));
    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).queryByRole('link', { name: 'Mở tin tham chiếu' })).toBeNull();
  });
});

// Đề xuất bổ sung sau VT03: thiếu hạn nộp, Places lỗi, AI lỗi.
const ATTEND_TEXT =
  'Công ty TNHH Ánh Dương mời em phỏng vấn vị trí Nhân viên Kinh doanh tại 25 Nguyễn Huệ, Quận 1. Em vui lòng xác nhận có tham dự được không.';
const FEE_TEXT =
  'Công ty TNHH Ánh Dương mời em phỏng vấn vị trí Nhân viên Kinh doanh tại 25 Nguyễn Huệ, Quận 1. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.';

async function fillAndExtract(user: ReturnType<typeof userEvent.setup>, text: string, extra: () => Promise<void> = async () => {}) {
  render(<App />);
  await user.type(screen.getByLabelText('Nội dung lời mời'), text);
  await extra();
  await user.click(screen.getByRole('button', { name: 'Phân tích lời mời' }));
  return screen.findByRole('form', { name: 'Xác nhận dữ kiện' });
}

describe('đề xuất bổ sung: nhánh dự phòng trên giao diện', () => {
  it('giữ cảnh báo mã OTP khi thiếu link, địa chỉ và dịch vụ AI', async () => {
    await stubApi(buildApp());
    const user = userEvent.setup();
    const form = await fillAndExtract(user, 'Để xác nhận lịch, em gửi mã OTP vừa nhận nhé.');
    expect(within(form).getByText('Yêu cầu cung cấp mã xác thực hoặc mật khẩu')).toBeTruthy();
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));
    const invitation = await screen.findByRole('article', { name: 'Lời mời' });
    expect(within(invitation).getByText('Cần thận trọng')).toBeTruthy();
    expect(within(invitation).getByText('gửi mã OTP vừa nhận nhé')).toBeTruthy();
    expect(screen.getByText('Giữ riêng mã xác thực và mật khẩu. Đối chiếu lịch với kênh tuyển dụng chính thức nếu chưa biết người liên hệ.')).toBeTruthy();
  });

  it('thiếu hạn nộp: có link và mã tin nhưng hạn trống thì tin "Chưa kiểm tra được" kèm lý do', async () => {
    const user = userEvent.setup();
    const form = await fillAndExtract(user, ATTEND_TEXT, async () => {
      await user.type(screen.getByLabelText('Link tin tuyển dụng (nếu có)'), 'https://www.topcv.vn/job/2');
      await user.type(screen.getByLabelText('Mã tin hoặc mã vị trí'), 'KD-09');
    });
    expect(within(form).getByText('xác nhận có tham dự được không')).toBeTruthy();
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));

    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Chưa kiểm tra được')).toBeTruthy();
    expect(within(job).getByText(/chưa có hạn nộp hoặc trạng thái tuyển/)).toBeTruthy();
    expect(within(job).queryByText('Hết hạn')).toBeNull();
  });

  it('thiếu hạn nộp nhưng người dùng xác nhận đã đóng tuyển thì tin "Hết hạn"', async () => {
    const user = userEvent.setup();
    const form = await fillAndExtract(user, ATTEND_TEXT, async () => {
      await user.type(screen.getByLabelText('Link tin tuyển dụng (nếu có)'), 'https://www.topcv.vn/job/2');
      await user.click(screen.getByLabelText('Tin ghi rõ đã đóng tuyển'));
    });
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));

    const job = await screen.findByRole('article', { name: 'Tin đăng' });
    expect(within(job).getByText('Hết hạn')).toBeTruthy();
    expect(within(job).getByText(/đã đóng tuyển/)).toBeTruthy();
  });

  it('Vietmap lỗi: địa điểm "Chưa kiểm tra được", vẫn có nút bản đồ, thông báo chung và các thẻ khác', async () => {
    const vietmapDown = {
      configured: true,
      findPlace: async () => {
        throw new GeocodingError('NETWORK_ERROR', 'Không kết nối được Vietmap.');
      },
    };
    await stubApi(buildApp({ ai, places: vietmapDown }));
    const user = userEvent.setup();
    const form = await fillAndExtract(user, FEE_TEXT);
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));

    const loc = await screen.findByRole('article', { name: 'Địa điểm' });
    expect(within(loc).getByText('Chưa kiểm tra được')).toBeTruthy();
    expect(within(loc).getByText(/Không kết nối được Vietmap\. Mở bản đồ/)).toBeTruthy();
    expect(within(loc).getByRole('link', { name: 'Mở bản đồ' })).toBeTruthy();
    expect(screen.getByText('Không kết nối được Vietmap. Các phần khác vẫn có kết quả.')).toBeTruthy();

    const inv = screen.getByRole('article', { name: 'Lời mời' });
    expect(within(inv).getByText('Cần thận trọng')).toBeTruthy();
    expect(within(inv).getByText('đóng phí giữ suất phỏng vấn')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Người liên hệ' })).getByText('Chưa xác minh')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Tin đăng' })).toBeTruthy();
  });

  it('AI lỗi: báo "Dịch vụ AI tạm lỗi", luật vẫn bắt yêu cầu phí, người dùng nhập tay rồi đối chiếu tiếp', async () => {
    const brokenAi: AiExtractor = async () => {
      throw new Error('bedrock down');
    };
    await stubApi(buildApp({ ai: brokenAi }));
    const user = userEvent.setup();
    const form = await fillAndExtract(user, FEE_TEXT);

    expect(within(form).getByText(/Dịch vụ AI tạm lỗi/)).toBeTruthy();
    expect(within(form).getByText('Yêu cầu đóng phí')).toBeTruthy();
    expect(within(form).getByText('đóng phí giữ suất phỏng vấn')).toBeTruthy();
    const company = within(form).getByLabelText('Công ty') as HTMLInputElement;
    const role = within(form).getByLabelText('Vị trí') as HTMLInputElement;
    expect(company.value).toBe('');
    await user.type(company, 'Công ty TNHH Ánh Dương');
    await user.type(role, 'Nhân viên Kinh doanh');
    await user.type(within(form).getByLabelText('Địa chỉ hẹn'), '25 Nguyễn Huệ, Quận 1');
    await user.click(within(form).getByRole('button', { name: 'Đối chiếu' }));

    const inv = await screen.findByRole('article', { name: 'Lời mời' });
    expect(within(inv).getByText('Cần thận trọng')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Việc nên làm ngay' }).textContent).toContain('Tạm dừng đóng phí');
  });
});
