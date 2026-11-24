import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ViecThatModule } from './viec-that/viec-that.module.js';

// .env ở thư mục gốc của repo (dùng chung với web), rồi .env cạnh apps/api nếu có.
// Biến môi trường đã đặt sẵn (systemd EnvironmentFile) luôn được ưu tiên.
const here = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = [
  path.resolve(here, '../../../.env'),
  path.resolve(here, '../.env'),
];

@Module({
  imports: [ConfigModule.forRoot({ envFilePath }), ViecThatModule],
})
export class AppModule {}
