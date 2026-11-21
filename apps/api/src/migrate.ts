import './env.js';
import { createPgDb, migrate } from './db.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Thiếu biến môi trường DATABASE_URL, ví dụ postgres://user:pass@127.0.0.1:5432/viecthat');
  process.exit(1);
}

const db = createPgDb(url);
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Đã áp dụng: ${applied.join(', ')}` : 'Cơ sở dữ liệu đã ở phiên bản mới nhất.');
} catch (err) {
  console.error('Migration lỗi:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
