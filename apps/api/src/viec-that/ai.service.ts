import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createBedrockExtractor, type AiExtractor } from './ai.js';

/**
 * Bộ trích AI (VT07). Chỉ bật khi có BEDROCK_MODEL_ID. Thông tin xác thực AWS lấy từ
 * chuỗi mặc định của SDK (IAM role trên EC2, SSO trên máy cá nhân), không đọc khóa từ .env.
 */
@Injectable()
export class AiService {
  readonly extractor?: AiExtractor;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const modelId = config.get<string>('BEDROCK_MODEL_ID')?.trim();
    if (!modelId) {
      new Logger(AiService.name).warn(
        'BEDROCK_MODEL_ID chưa đặt: chế độ live chỉ dùng luật cố định.',
      );
      return;
    }
    this.extractor = createBedrockExtractor({
      modelId,
      region: config.get<string>('AWS_REGION')?.trim() || undefined,
    });
  }
}
