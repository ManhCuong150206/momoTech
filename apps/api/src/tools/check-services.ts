// VT02 và VT03: kiểm tra dịch vụ ngoài bằng một lần gọi thật. Chạy: npm run check:services -w apps/api
// Không in khóa hay thông tin xác thực. Kết quả dán vào mục 7 của README.md.
import '../env.js';
import { createBedrockExtractor } from '../ai.js';
import { createGooglePlacesClient } from '../places.js';

interface Row {
  check: string;
  status: 'OK' | 'LOI' | 'CHUA_CAU_HINH';
  detail: string;
}
const rows: Row[] = [];
const SAMPLE =
  'Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn vị trí Thực tập sinh Phân tích dữ liệu tại Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.';
const PUBLIC_ADDRESS = 'Dinh Độc Lập, 135 Nam Kỳ Khởi Nghĩa, Quận 3, Hồ Chí Minh';

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t };
}

rows.push({ check: 'Node.js', status: 'OK', detail: `${process.version} trên ${process.platform}` });

const model = process.env.BEDROCK_MODEL_ID;
if (!model) {
  rows.push({ check: 'AWS Bedrock (VT02)', status: 'CHUA_CAU_HINH', detail: 'Chưa đặt BEDROCK_MODEL_ID (và AWS_REGION, thông tin xác thực AWS).' });
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
    rows.push({ check: 'AWS Bedrock (VT02)', status: 'LOI', detail: `${(err as Error).message}. Kiểm tra đăng nhập AWS, vùng, quyền bedrock:InvokeModel và model access.` });
  }
}

const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) {
  rows.push({ check: 'Google Places (VT03)', status: 'CHUA_CAU_HINH', detail: 'Chưa đặt GOOGLE_MAPS_API_KEY. Web vẫn mở bản đồ và hiện "Chưa đối chiếu tự động".' });
} else {
  try {
    const { value, ms } = await timed(() => createGooglePlacesClient(key).search(PUBLIC_ADDRESS));
    rows.push({
      check: 'Google Places (VT03)',
      status: value.length ? 'OK' : 'LOI',
      detail: `${ms}ms, ${value.length} kết quả, đầu tiên: ${value[0]?.name ?? '(không có)'} | ${value[0]?.address ?? ''}`,
    });
  } catch (err) {
    rows.push({ check: 'Google Places (VT03)', status: 'LOI', detail: `${(err as Error).message} Kiểm tra bật Places API (New), thanh toán và giới hạn khóa.` });
  }
}

console.table(rows);
process.exitCode = rows.some((r) => r.status === 'LOI') ? 1 : 0;