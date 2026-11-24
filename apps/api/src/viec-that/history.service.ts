import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPgDb, migrate, type Db } from './db.js';
import { purgeExpired } from './history.js';

@Injectable()
export class HistoryService implements OnModuleInit, OnModuleDestroy {
  readonly ttlDays: number;
  readonly cookieSecure: boolean;
  /** Số bản ghi tối đa mỗi thiết bị. Bản cũ nhất bị xóa khi vượt. */
  readonly maxPerDevice: number;
  db?: Db;
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(HistoryService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.ttlDays = Number(config.get<string>('HISTORY_TTL_DAYS')?.trim() || 30);
    if (
      !Number.isSafeInteger(this.ttlDays) ||
      this.ttlDays < 1 ||
      this.ttlDays > 2_147_483_647
    ) {
      throw new Error('HISTORY_TTL_DAYS phải là số ngày nguyên dương.');
    }
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    this.maxPerDevice = Number(
      config.get<string>('HISTORY_MAX_PER_DEVICE')?.trim() || 100,
    );
    if (!Number.isSafeInteger(this.maxPerDevice) || this.maxPerDevice < 1) {
      throw new Error('HISTORY_MAX_PER_DEVICE phải là số nguyên dương.');
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('DATABASE_URL')?.trim();
    if (!url) return;
    const db = createPgDb(url);
    try {
      await migrate(db);
    } catch {
      await db.close();
      throw new Error('Không thể khởi tạo cơ sở dữ liệu lịch sử.');
    }
    this.db = db;
    const purge = async () => {
      try {
        await purgeExpired(db);
      } catch {
        this.logger.warn('Không thể xóa các mục lịch sử hết hạn.');
      }
    };
    await purge();
    this.timer = setInterval(() => void purge(), 60 * 60 * 1000).unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.db?.close();
  }
}
