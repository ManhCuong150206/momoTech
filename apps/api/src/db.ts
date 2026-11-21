import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Giao diện tối thiểu để dùng chung cho `pg` (chạy thật) và PGlite (kiểm thử). */
export interface Db {
  query<T extends object = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; count: number }>;
  /** Chạy nhiều câu lệnh, không tham số. */
  exec(text: string): Promise<void>;
  close(): Promise<void>;
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5 });
  return {
    async query<T extends object>(text: string, params?: unknown[]) {
      const r = await pool.query(text, params);
      return { rows: r.rows as T[], count: r.rowCount ?? 0 };
    },
    async exec(text) {
      await pool.query(text);
    },
    close: () => pool.end(),
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, '../migrations');

/** Áp dụng các tệp `migrations/*.sql` chưa chạy, theo thứ tự tên tệp. Trả về tên các tệp vừa chạy. */
export async function migrate(db: Db, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(
    'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())',
  );
  const done = new Set((await db.query<{ version: string }>('select version from schema_migrations')).rows.map((r) => r.version));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), 'utf8');
    // Một chuỗi duy nhất chạy trong một giao dịch: lỗi thì không áp dụng nửa chừng.
    await db.exec(`begin;\n${sql}\ninsert into schema_migrations (version) values ('${file.replace(/'/g, "''")}');\ncommit;`);
    applied.push(file);
  }
  return applied;
}
