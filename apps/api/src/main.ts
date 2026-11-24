import 'reflect-metadata';
import type { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

// Nhật ký chỉ ghi khởi động, cảnh báo và tên lỗi. Không ghi nội dung lời mời.
const LEVELS: Record<string, LogLevel[]> = {
  error: ['fatal', 'error'],
  warn: ['fatal', 'error', 'warn'],
  info: ['fatal', 'error', 'warn', 'log'],
  debug: ['fatal', 'error', 'warn', 'log', 'debug'],
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? LEVELS.info,
  });
  app.disable('x-powered-by');
  // Sau Caddy: lấy IP người dùng từ X-Forwarded-For để giới hạn tần suất đúng người.
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 'loopback');
  app.enableShutdownHooks();
  // Chỉ nghe nội bộ. Caddy mới mở 443 ra ngoài.
  await app.listen(
    Number(process.env.PORT ?? 3000),
    process.env.HOST ?? '127.0.0.1',
  );
}
await bootstrap();
