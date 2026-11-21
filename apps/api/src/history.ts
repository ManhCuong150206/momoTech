import { createHash, randomBytes } from 'node:crypto';
import type {
  ConfirmedFields,
  HistoryDetailResponse,
  HistoryItemSummary,
  SourceMode,
  VerifyResponse,
} from '../../../shared/contract.js';
import type { Db } from './db.js';

export const COOKIE_NAME = 'vt_device';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Chỉ băm được lưu. Lộ DB không làm lộ cookie của người dùng. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readDeviceToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) {
      const v = rest.join('=');
      return TOKEN_RE.test(v) ? v : null;
    }
  }
  return null;
}

export function cookieHeader(token: string, secure: boolean): string {
  const maxAge = 60 * 60 * 24 * 365;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function makeTitle(confirmed: ConfirmedFields, invitationText: string): string {
  const parts = [confirmed.company, confirmed.role].filter((x): x is string => !!x?.trim());
  const t = parts.length ? parts.join(' · ') : invitationText.replace(/\s+/g, ' ').trim();
  return t.length > 80 ? `${t.slice(0, 77)}...` : t;
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

export interface NewCheck {
  deviceHash: string;
  mode: SourceMode;
  invitationText: string;
  jobUrl: string | null;
  confirmed: ConfirmedFields;
  result: VerifyResponse;
  ttlDays: number;
  /** Giữ tối đa chừng này bản ghi mới nhất cho thiết bị. */
  maxPerDevice?: number;
}

export async function insertCheck(db: Db, c: NewCheck): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into checks
       (device_hash, mode, title, invitation_text, job_url, confirmed, result,
        job_status, location_status, invitation_status, expires_at)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10, now() + ($11::int * interval '1 day'))
     returning id`,
    [
      c.deviceHash,
      c.mode,
      makeTitle(c.confirmed, c.invitationText),
      c.invitationText,
      c.jobUrl,
      JSON.stringify(c.confirmed),
      JSON.stringify(c.result),
      c.result.job.status,
      c.result.location.status,
      c.result.invitation.status,
      c.ttlDays,
    ],
  );
  const id = r.rows[0]!.id;
  if (c.maxPerDevice && c.maxPerDevice > 0) {
    await db.query(
      `delete from checks where device_hash = $1 and id not in
         (select id from checks where device_hash = $1 order by seq desc limit $2)`,
      [c.deviceHash, c.maxPerDevice],
    );
  }
  return id;
}

interface SummaryRow {
  id: string;
  created_at: unknown;
  expires_at: unknown;
  mode: SourceMode;
  title: string;
  job_status: HistoryItemSummary['jobStatus'];
  location_status: HistoryItemSummary['locationStatus'];
  invitation_status: HistoryItemSummary['invitationStatus'];
}

export async function listChecks(db: Db, deviceHash: string, limit: number): Promise<HistoryItemSummary[]> {
  const r = await db.query<SummaryRow>(
    `select id, created_at, expires_at, mode, title, job_status, location_status, invitation_status
       from checks
      where device_hash = $1 and expires_at > now()
      order by seq desc
      limit $2`,
    [deviceHash, limit],
  );
  return r.rows.map((x) => ({
    id: x.id,
    createdAt: iso(x.created_at),
    expiresAt: iso(x.expires_at),
    mode: x.mode,
    simulated: x.mode === 'simulated',
    title: x.title,
    jobStatus: x.job_status,
    locationStatus: x.location_status,
    invitationStatus: x.invitation_status,
  }));
}

export async function getCheck(db: Db, deviceHash: string, id: string): Promise<HistoryDetailResponse | null> {
  const r = await db.query<
    SummaryRow & { invitation_text: string; job_url: string | null; confirmed: ConfirmedFields; result: VerifyResponse }
  >(
    `select id, created_at, expires_at, mode, title, job_status, location_status, invitation_status,
            invitation_text, job_url, confirmed, result
       from checks
      where device_hash = $1 and id = $2 and expires_at > now()`,
    [deviceHash, id],
  );
  const x = r.rows[0];
  if (!x) return null;
  return {
    id: x.id,
    createdAt: iso(x.created_at),
    expiresAt: iso(x.expires_at),
    title: x.title,
    input: { invitationText: x.invitation_text, jobUrl: x.job_url },
    confirmed: x.confirmed,
    result: { ...x.result, historyId: x.id },
  };
}

/** Xóa vĩnh viễn. Id của thiết bị khác hoặc không tồn tại bị bỏ qua, không báo lỗi. */
export async function deleteChecks(db: Db, deviceHash: string, ids: string[]): Promise<number> {
  const r = await db.query(`delete from checks where device_hash = $1 and id = any($2::uuid[])`, [deviceHash, ids]);
  return r.count;
}

export async function purgeExpired(db: Db): Promise<number> {
  const r = await db.query('delete from checks where expires_at <= now()');
  return r.count;
}
