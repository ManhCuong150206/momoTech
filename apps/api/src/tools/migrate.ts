// Chạy migration lịch sử tra cứu: npm run migrate -w apps/api
// API cũng tự chạy migration khi khởi động nếu có DATABASE_URL.
import './env.js';
import { createPgDb, migrate } from '../viec-that/db.js';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('Chưa đặt DATABASE_URL.');
  process.exit(1);
}
const db = createPgDb(url);
try {
  await migrate(db);
  console.log('Migration đã xong.');
} finally {
  await db.close();
}
