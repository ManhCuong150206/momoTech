import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from './harness.js';
import { buildOpenApi, openApiText } from '../src/openapi.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/openapi.json');

describe('OpenAPI', () => {
  it('docs/openapi.json khớp schema hiện tại (chạy `npm run openapi -w apps/api` nếu lệch)', () => {
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(openApiText());
  });

  it('mọi đường dẫn trong OpenAPI đều có trên API thật', async () => {
    const app = buildApp();
    const id = '00000000-0000-4000-8000-000000000000';
    try {
      for (const [p, ops] of Object.entries(buildOpenApi().paths)) {
        for (const method of Object.keys(ops)) {
          const res = await app.inject({ method: method.toUpperCase(), url: p.replace('{id}', id) });
          // Đường dẫn không tồn tại trả 404 "Không tìm thấy đường dẫn." (lịch sử tắt thì trả 503).
          expect(res.json().error?.message, `${method} ${p}`).not.toBe('Không tìm thấy đường dẫn.');
        }
      }
    } finally {
      await app.close();
    }
  });
});
