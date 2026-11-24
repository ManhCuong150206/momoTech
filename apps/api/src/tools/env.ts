import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Công cụ dòng lệnh chạy ngoài NestJS nên tự nạp .env ở thư mục gốc.
// Biến môi trường đã đặt sẵn được ưu tiên.
try {
  process.loadEnvFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env'),
  );
} catch {
  // không có .env thì dùng biến môi trường hiện có
}
