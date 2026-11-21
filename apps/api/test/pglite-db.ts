import { PGlite } from '@electric-sql/pglite';
import { type Db, migrate } from '../src/db.js';

/** Postgres thật chạy trong tiến trình (WASM) cho kiểm thử. Cùng SQL và migration với bản chạy thật. */
export async function createTestDb(): Promise<Db & { raw: PGlite }> {
  const raw = new PGlite();
  const db: Db & { raw: PGlite } = {
    raw,
    async query<T extends object>(text: string, params?: unknown[]) {
      const r = await raw.query<T>(text, params);
      return { rows: r.rows, count: r.affectedRows ?? 0 };
    },
    async exec(text) {
      await raw.exec(text);
    },
    close: () => raw.close(),
  };
  await migrate(db);
  return db;
}
