import { useState, type ReactNode } from 'react';
import type { VerifyResponse } from '../../../shared/contract';
import {
  CONTACT_LABEL,
  INVITATION_LABEL,
  INVITATION_TONE,
  JOB_LABEL,
  JOB_TONE,
  LOCATION_LABEL,
  LOCATION_TONE,
  REQUIREMENT_LABEL,
  type Tone,
} from './labels';

export function SimBadge() {
  return <span className="badge badge-sim">Dữ liệu mô phỏng</span>;
}

function StatusPill({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function jobReferenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari cũ hoặc trang không an toàn: dùng cách dự phòng.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export default function ResultView({ result, children }: { result: VerifyResponse; children?: ReactNode }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const referenceUrl = result.simulated ? null : jobReferenceUrl(result.job.source.url);

  async function onCopy() {
    setCopied((await copyText(result.guidance.suggestedQuestion)) ? 'ok' : 'fail');
  }

  return (
    <section aria-label="Kết quả đối chiếu">
      {result.simulated && <SimBadge />}

      <article
        className={`card action action-${INVITATION_TONE[result.invitation.status]}`}
        aria-label="Việc nên làm ngay"
      >
        <h3>Việc nên làm ngay</h3>
        <p className="action-step">{result.guidance.nextStep}</p>
        <p className="meta">Câu hỏi gợi ý để gửi cho nhà tuyển dụng:</p>
        <blockquote data-testid="suggested-question">{result.guidance.suggestedQuestion}</blockquote>
        <button type="button" className="primary block" onClick={onCopy}>
          Sao chép câu hỏi
        </button>
        <span role="status" className="copied">
          {copied === 'ok' && 'Đã sao chép'}
          {copied === 'fail' && 'Không sao chép được. Hãy chọn và sao chép thủ công.'}
        </span>
      </article>

      {children}
      {result.notices.map((n) => (
        <p key={n} className="note">
          {n}
        </p>
      ))}

      <h3 className="section-title">Căn cứ từng phần</h3>
      <div className="result-grid">
        <article className="card" aria-label="Tin đăng">
          <h3>Tin đăng</h3>
          <StatusPill tone={JOB_TONE[result.job.status]}>{JOB_LABEL[result.job.status]}</StatusPill>
          <p>{result.job.basis}</p>
          <p className="meta">
            Nguồn: {result.job.source.label ?? 'chưa có'}
            {result.job.checkedOn && ` · kiểm tra ngày ${result.job.checkedOn}`}
          </p>
          {referenceUrl && (
            <a href={referenceUrl} target="_blank" rel="noopener noreferrer" className="btn">
              Mở tin tham chiếu
            </a>
          )}
        </article>

        <article className="card" aria-label="Địa điểm">
          <h3>Địa điểm</h3>
          <StatusPill tone={LOCATION_TONE[result.location.status]}>{LOCATION_LABEL[result.location.status]}</StatusPill>
          <p>{result.location.basis}</p>
          <p className="meta">
            Nguồn: {result.location.source.label ?? 'chưa có'}
            {result.location.checkedOn && ` · kiểm tra ngày ${result.location.checkedOn}`}
          </p>
          {result.location.mapUrl && (
            <a href={result.location.mapUrl} target="_blank" rel="noopener noreferrer" className="btn">
              Mở bản đồ
            </a>
          )}
        </article>

        <article className="card" aria-label="Lời mời">
          <h3>Lời mời</h3>
          <StatusPill tone={INVITATION_TONE[result.invitation.status]}>
            {INVITATION_LABEL[result.invitation.status]}
          </StatusPill>
          <p>{result.invitation.basis}</p>
          <ul className="quotes">
            {result.invitation.requirements.map((r) => (
              <li key={`${r.kind}-${r.quote}`}>
                <strong>{REQUIREMENT_LABEL[r.kind]}</strong>
                <q>{r.quote}</q>
              </li>
            ))}
          </ul>
        </article>

        <article className="card" aria-label="Người liên hệ">
          <h3>Người liên hệ</h3>
          <StatusPill tone="neutral">{CONTACT_LABEL[result.contact.status]}</StatusPill>
          <p>{result.contact.basis}</p>
        </article>
      </div>
    </section>
  );
}
