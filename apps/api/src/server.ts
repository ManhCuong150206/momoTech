import './env.js';
import { buildApp } from './app.js';
import { createBedrockExtractor } from './ai.js';
import { createPgDb, migrate } from './db.js';
import { purgeExpired } from './history.js';
import { createGooglePlacesClient } from './places.js';

const port = Number(process.env.PORT ?? 3000);
// Fastify nghe nội bộ. Caddy (sau này) mới mở 443 ra ngoài.
const host = process.env.HOST ?? '127.0.0.1';
const ttlDays = Number(process.env.HISTORY_TTL_DAYS ?? 30);

// Không có DATABASE_URL thì chạy không lịch sử (API xử lý từng yêu cầu như trước).
const db = process.env.DATABASE_URL ? createPgDb(process.env.DATABASE_URL) : undefined;

// Dịch vụ ngoài chỉ bật khi đã cấu hình. Thiếu thì chế độ live tự hạ cấp và nói rõ trong kết quả.
// AWS dùng chuỗi thông tin xác thực mặc định (IAM role trên EC2, hoặc đăng nhập SSO khi chạy trên máy).
const ai = process.env.BEDROCK_MODEL_ID
  ? createBedrockExtractor({ modelId: process.env.BEDROCK_MODEL_ID, region: process.env.AWS_REGION })
  : undefined;
const places = process.env.GOOGLE_MAPS_API_KEY ? createGooglePlacesClient(process.env.GOOGLE_MAPS_API_KEY) : undefined;

const app = buildApp({
  ai,
  places,
  historyMaxPerDevice: Number(process.env.HISTORY_MAX_PER_DEVICE ?? 100),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 30),
  trustProxy: process.env.TRUST_PROXY === 'true',
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  db,
  historyTtlDays: ttlDays,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
});

async function main() {
  if (db) {
    const applied = await migrate(db);
    if (applied.length) app.log.info({ applied }, 'migrations applied');
    const purge = () =>
      purgeExpired(db)
        .then((n) => n && app.log.info({ purged: n }, 'expired history purged'))
        .catch(() => app.log.error('purge failed'));
    await purge();
    setInterval(purge, 60 * 60 * 1000).unref();
  } else {
    app.log.warn('DATABASE_URL not set: history disabled');
  }
  if (!ai) app.log.warn('BEDROCK_MODEL_ID not set: live mode uses rules only');
  if (!places) app.log.warn('GOOGLE_MAPS_API_KEY not set: place check disabled');
  await app.listen({ port, host });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});