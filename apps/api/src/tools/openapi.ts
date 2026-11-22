import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApiText } from '../openapi.js';

// Ghi docs/openapi.json (UTF-8 không BOM).
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../docs/openapi.json');
writeFileSync(out, openApiText(), 'utf8');
console.log(`Đã ghi ${out}`);
