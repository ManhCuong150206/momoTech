// VT02 và VT03: kiểm tra dịch vụ ngoài bằng một lần gọi thật. Chạy: npm run check:services -w apps/api
// Không in khóa hay thông tin xác thực. Kết quả dán vào mục 7 của README.md.
import './env.js';
import { ConfigService } from '@nestjs/config';
import { GeocodingService } from '../geocoding/geocoding.service.js';
import { createBedrockExtractor } from '../viec-that/ai.js';

interface Row {
  check: string;
  status: 'OK' | 'LOI' | 'CHUA_CAU_HINH';
  detail: string;
}
const rows: Row[] = [];
const SAMPLE =
  'Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn vị trí Thực tập sinh Phân tích dữ liệu tại Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.';
const PUBLIC_ADDRESS = '135 Nam Kỳ Khởi Nghĩa, Quận 1, Hồ Chí Minh';

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t };
}

rows.push({ check: 'Node.js', status: 'OK', detail: `${process.version} trên ${process.platform}` });

const model = process.env.BEDROCK_MODEL_ID?.trim();
if (!model) {
  rows.push({
    check: 'AWS Bedrock (VT02)',
    status: 'CHUA_CAU_HINH',
    detail: 'Chưa đặt BEDROCK_MODEL_ID (và AWS_REGION, thông tin xác thực AWS).',
  });
} else {
  try {
    const ai = createBedrockExtractor({ modelId: model, region: process.env.AWS_REGION });
    const { value, ms } = await timed(() => ai(SAMPLE));
    rows.push({
      check: 'AWS Bedrock (VT02)',
      status: value.company || value.requirements.length ? 'OK' : 'LOI',
      detail: `model=${model} region=${process.env.AWS_REGION ?? '(mặc định)'} ${ms}ms, trích được công ty=${value.company ?? 'null'}, yêu cầu=${value.requirements.map((r) => r.kind).join(',') || 'không'}, bỏ=${value.dropped}`,
    });
  } catch (err) {
    rows.push({
      check: 'AWS Bedrock (VT02)',
      status: 'LOI',
      detail: `${(err as Error).message}. Kiểm tra đăng nhập AWS, vùng, quyền bedrock:InvokeModel và model access.`,
    });
  }
}

const geocoding = new GeocodingService(new ConfigService());
if (!geocoding.configured) {
  rows.push({
    check: 'Vietmap (VT03)',
    status: 'CHUA_CAU_HINH',
    detail: 'Chưa đặt VIETMAP_API_KEY. Web vẫn mở bản đồ và hiện "Chưa đối chiếu tự động".',
  });
} else {
  try {
    const { value, ms } = await timed(() => geocoding.findPlace(PUBLIC_ADDRESS));
    rows.push({
      check: 'Vietmap (VT03)',
      status: value ? 'OK' : 'LOI',
      detail: `${ms}ms, ${value ? `${value.name ?? '(không tên)'} | ${value.address}` : 'không có kết quả'}`,
    });
  } catch (err) {
    rows.push({
      check: 'Vietmap (VT03)',
      status: 'LOI',
      detail: `${(err as Error).message} Kiểm tra khóa Vietmap và hạn mức.`,
    });
  }
}

console.table(rows);
process.exitCode = rows.some((r) => r.status === 'LOI') ? 1 : 0;
