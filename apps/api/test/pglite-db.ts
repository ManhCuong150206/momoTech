import { PGlite, type Transaction } from '@electric-sql/pglite';
import { type Db, type DbSession, migrate } from '../src/viec-that/db.js';

function sessionFor(client: PGlite | Transaction): DbSession {
  return {
    async query<T extends object>(text: string, params?: unknown[]) {
      const r = await client.query<T>(text, params);
      return { rows: r.rows, count: r.affectedRows ?? 0 };
    },
    async exec(text) {
      await client.exec(text);
    },
  };
}

/** Postgres thật chạy trong tiến trình (WASM) cho kiểm thử. Cùng SQL và migration với bản chạy thật. */
export async function createTestDb(): Promise<Db & { raw: PGlite }> {
  const raw = new PGlite();
  const db: Db & { raw: PGlite } = {
    raw,
    ...sessionFor(raw),
    transaction: (run) => raw.transaction((tx) => run(sessionFor(tx))),
    close: () => raw.close(),
  };
  await migrate(db);
  return db;
}
