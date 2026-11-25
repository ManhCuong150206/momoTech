import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
    // Không để .env của máy phát triển (DATABASE_URL, khóa dịch vụ) lọt vào kiểm thử.
    env: {
      DATABASE_URL: '',
      VIETMAP_API_KEY: '',
      BEDROCK_MODEL_ID: '',
      DEMO_CASES_ENABLED: '',
    },
  },
});
