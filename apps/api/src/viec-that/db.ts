import { Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export interface DbSession {
  query<T extends object = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; count: number }>;
  /** Chạy nhiều câu lệnh, không tham số. */
  exec(text: string): Promise<void>;
}

export interface Db extends DbSession {
  transaction<T>(run: (session: DbSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function sessionFor(client: pg.Pool | pg.PoolClient): DbSession {
  return {
    async query<T extends object>(text: string, params?: unknown[]) {
      const r = await client.query(text, params);
      return { rows: r.rows as T[], count: r.rowCount ?? 0 };
    },
    async exec(text) {
      await client.query(text);
    },
  };
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
  const logger = new Logger('PostgreSQL');
  pool.on('error', () =>
    logger.warn('Mất kết nối PostgreSQL khi đang chờ yêu cầu.'),
  );
  return {
    ...sessionFor(pool),
    async transaction<T>(run: (session: DbSession) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await run(sessionFor(client));
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../migrations');

/** Áp dụng các tệp `migrations/*.sql` chưa chạy, theo thứ tự tên tệp. Trả về tên các tệp vừa chạy. */
export async function migrate(
  db: Db,
  dir: string = MIGRATIONS_DIR,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec(
      "select pg_advisory_xact_lock(hashtextextended('viec-that-migrations', 0))",
    );
    await tx.exec(
      'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())',
    );
    const done = new Set(
      (
        await tx.query<{ version: string }>(
          'select version from schema_migrations',
        )
      ).rows.map((r) => r.version),
    );
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (done.has(file)) continue;
      await tx.exec(readFileSync(path.join(dir, file), 'utf8'));
      await tx.query('insert into schema_migrations (version) values ($1)', [
        file,
      ]);
    }
  });
}
