import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Bật hoặc tắt ca mẫu (dữ liệu mô phỏng). Mặc định bật để giám khảo thử nhanh.
 * Bản chạy thực tế đặt DEMO_CASES_ENABLED=false: ẩn nút ca mẫu và chỉ nhận chế độ live.
 */
@Injectable()
export class DemoService {
  readonly enabled: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const raw = config.get<string>('DEMO_CASES_ENABLED')?.trim().toLowerCase();
    if (raw && raw !== 'true' && raw !== 'false') {
      throw new Error('DEMO_CASES_ENABLED phải là true hoặc false.');
    }
    this.enabled = raw !== 'false';
  }
}
