// Chỉ dùng cho VT14 (k6). Dữ liệu demo có phản hồi nguồn cố định, không gọi dịch vụ ngoài,
// không lưu lịch sử và tắt giới hạn tần suất. Đặt biến trước khi nạp AppModule để .env không ghi đè.
process.env.DATABASE_URL = '';
process.env.VIETMAP_API_KEY = '';
process.env.BEDROCK_MODEL_ID = '';
process.env.RATE_LIMIT_PER_MINUTE = '0';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../app.module.js');

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
await app.listen(3900, '127.0.0.1');
console.log('VT14 load target: http://127.0.0.1:3900');
