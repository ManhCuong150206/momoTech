import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildOpenApi, openApiText } from '../src/openapi.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/openapi.json');

describe('OpenAPI', () => {
  it('docs/openapi.json khớp schema hiện tại (chạy `npm run openapi -w apps/api` nếu lệch)', () => {
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(openApiText());
  });

  it('mọi đường dẫn trong OpenAPI đều có trên API thật', async () => {
    const app = buildApp();
    await app.ready();
    for (const [p, ops] of Object.entries(buildOpenApi().paths)) {
      const url = p.replace('{id}', ':id');
      for (const method of Object.keys(ops)) {
        expect(app.hasRoute({ method: method.toUpperCase() as 'GET', url }), `${method} ${p}`).toBe(true);
      }
    }
  });
});
