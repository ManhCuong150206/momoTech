import { useCallback, useEffect, useState } from 'react';
import type { HistoryDetailResponse, HistoryItemSummary } from '../../../shared/contract';
import { api, ApiError } from './api';
import { INVITATION_LABEL, INVITATION_TONE, JOB_LABEL, LOCATION_LABEL } from './labels';
import ResultView, { SimBadge } from './ResultView';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function History({ ttlDays }: { ttlDays: number }) {
  const [items, setItems] = useState<HistoryItemSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await api.historyList()).items);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : 'Có lỗi không xác định.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setConfirming(false);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function open(id: string) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await api.historyGet(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi không xác định.');
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    setBusy(true);
    setError(null);
    try {
      await api.historyDelete([...selected]);
      setSelected(new Set());
      setConfirming(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  }

  if (detail) {
    return (
      <div>
        <button type="button" onClick={() => setDetail(null)}>
          ← Về danh sách
        </button>
        <h2>{detail.title}</h2>
        <p className="meta">Đã lưu lúc {fmt(detail.createdAt)}. Tự xóa sau {fmt(detail.expiresAt)}.</p>
        <details className="card">
          <summary>Lời mời đã nhập</summary>
          <p>{detail.input.invitationText}</p>
          {detail.input.jobUrl && <p className="meta">Link tin: {detail.input.jobUrl}</p>}
        </details>
        <ResultView result={detail.result} />
      </div>
    );
  }

  const all = items ?? [];
  const allSelected = all.length > 0 && selected.size === all.length;

  return (
    <section aria-label="Lịch sử tra cứu">
      <h2>Lịch sử tra cứu</h2>
      <p className="note">
        Lưu trên máy chủ, gắn với trình duyệt này và tự xóa sau {ttlDays} ngày. Xóa cookie của trình duyệt thì không xem lại được.
      </p>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {items === null && <p>Đang tải…</p>}
      {items !== null && all.length === 0 && !error && <p>Chưa có lần tra cứu nào được lưu.</p>}

      {all.length > 0 && (
        <>
          <div className="row">
            <label className="check inline">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  setConfirming(false);
                  setSelected(allSelected ? new Set() : new Set(all.map((i) => i.id)));
                }}
              />
              <span>Chọn tất cả</span>
            </label>
          </div>
          <ul className="history-list">
            {all.map((it) => (
              <li key={it.id} className="card history-item">
                <label className="check" aria-label={`Chọn ${it.title}`}>
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                </label>
                <button type="button" className="history-open" onClick={() => open(it.id)} disabled={busy}>
                  <strong>{it.title}</strong>
                  {it.simulated && <SimBadge />}
                  <span className="meta">{fmt(it.createdAt)}</span>
                  <span className={`pill pill-${INVITATION_TONE[it.invitationStatus]}`}>
                    {INVITATION_LABEL[it.invitationStatus]}
                  </span>
                  <span className="meta">
                    Tin: {JOB_LABEL[it.jobStatus]} · Địa điểm: {LOCATION_LABEL[it.locationStatus]}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {!confirming ? (
            <button type="button" disabled={selected.size === 0 || busy} onClick={() => setConfirming(true)}>
              Xóa đã chọn ({selected.size})
            </button>
          ) : (
            <div className="alert" role="alertdialog" aria-label="Xác nhận xóa">
              <p>Xóa vĩnh viễn {selected.size} mục đã chọn? Không khôi phục được.</p>
              <div className="row">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                  Hủy
                </button>
                <button type="button" className="danger" onClick={removeSelected} disabled={busy}>
                  {busy ? 'Đang xóa…' : 'Xóa'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
