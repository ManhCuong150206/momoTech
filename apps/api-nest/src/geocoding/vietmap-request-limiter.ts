import type { ConfigService } from '@nestjs/config';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const VN_OFFSET_MS = 7 * 60 * MINUTE_MS;

function readLimit(
  config: ConfigService,
  name: string,
  fallback: number,
): number {
  const limit = Number(config.get<string>(name)?.trim() || fallback);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`${name} phải là số nguyên dương.`);
  }
  return limit;
}

export class VietmapRequestLimiter {
  private readonly perMinute: number;
  private readonly perDay: number;
  private readonly maxConcurrent: number;
  private recentStarts: number[] = [];
  private day = -1;
  private dailyStarts = 0;
  private active = 0;
  private pausedUntil = 0;

  constructor(config: ConfigService) {
    this.perMinute = readLimit(config, 'VIETMAP_MAX_REQUESTS_PER_MINUTE', 24);
    this.perDay = readLimit(config, 'VIETMAP_MAX_REQUESTS_PER_DAY', 300);
    this.maxConcurrent = readLimit(
      config,
      'VIETMAP_MAX_CONCURRENT_REQUESTS',
      3,
    );
  }

  tryStart(): string | null {
    const now = Date.now();
    if (now < this.pausedUntil) {
      return 'Máy chủ đang tạm dừng tra cứu Vietmap. Vui lòng thử lại sau.';
    }

    const day = Math.floor((now + VN_OFFSET_MS) / DAY_MS);
    if (day !== this.day) {
      this.day = day;
      this.dailyStarts = 0;
    }
    if (this.dailyStarts >= this.perDay) {
      return 'Máy chủ đã dùng hết lượt tra Vietmap hôm nay. Vui lòng thử lại vào ngày mai.';
    }

    this.recentStarts = this.recentStarts.filter((t) => now - t < MINUTE_MS);
    if (
      this.recentStarts.length >= this.perMinute ||
      this.active >= this.maxConcurrent
    ) {
      return 'Đang có nhiều lượt tra cứu Vietmap. Vui lòng thử lại sau.';
    }

    this.recentStarts.push(now);
    this.dailyStarts++;
    this.active++;
    return null;
  }

  finish(): void {
    this.active--;
  }

  pause(delayMs: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + delayMs);
  }
}
