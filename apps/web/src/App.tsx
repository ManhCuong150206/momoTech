import { useEffect, useState, type FormEvent } from 'react';
import type {
  DemoCaseSummary,
  ExtractResponse,
  HealthResponse,
  JobPostingInput,
  Requirement,
  VerifyResponse,
} from '../../../shared/contract';
import { api, ApiError } from './api';
import History from './History';
import { REQUIREMENT_LABEL } from './labels';
import ResultView, { SimBadge } from './ResultView';

type Step = 'input' | 'confirm' | 'result';
type View = 'check' | 'history';

interface InputState {
  invitationText: string;
  jobUrl: string;
  meetingAddress: string;
  /** Thông tin người dùng đọc được trên tin tuyển dụng (chỉ dùng ở chế độ thật). */
  jobCode: string;
  postedOn: string;
  closesOn: string;
  closed: boolean;
}

const EMPTY_INPUT: InputState = {
  invitationText: '',
  jobUrl: '',
  meetingAddress: '',
  jobCode: '',
  postedOn: '',
  closesOn: '',
  closed: false,
};

interface ConfirmState {
  company: string;
  role: string;
  meetingAddress: string;
  requirements: Array<Requirement & { keep: boolean }>;
}

export default function App() {
  const [view, setView] = useState<View>('check');
  const [step, setStep] = useState<Step>('input');
  const [health, setHealth] = useState<HealthResponse['history'] | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [mode, setMode] = useState<'simulated' | 'live'>('live');
  const [cases, setCases] = useState<DemoCaseSummary[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [input, setInput] = useState<InputState>(EMPTY_INPUT);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [save, setSave] = useState(true);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .demoCases()
      .then((r) => setCases(r.cases))
      .catch(() => setCases([]));
    api
      .health()
      .then((h) => {
        setHealth(h.history);
        setAiOn(h.capabilities.ai);
      })
      .catch(() => setHealth(null));
  }, []);

  const historyOn = !!health?.enabled;

  function pickCase(c: DemoCaseSummary) {
    setActiveCase(c.id);
    setInput({
      ...EMPTY_INPUT,
      invitationText: c.input.invitationText,
      jobUrl: c.input.jobUrl ?? '',
      meetingAddress: c.input.meetingAddress ?? '',
    });
    setError(null);
  }

  function updateInput(patch: Partial<InputState>) {
    setInput((s) => ({ ...s, ...patch }));
    // Người dùng sửa tay thì không còn là ca mẫu nguyên bản.
    setActiveCase(null);
  }

  async function onExtract(e: FormEvent) {
    e.preventDefault();
    if (!input.invitationText.trim()) {
      setError('Hãy dán nội dung lời mời trước khi phân tích.');
      return;
    }
    // Ca mẫu nguyên bản chạy bằng dữ liệu mô phỏng. Nội dung người dùng tự nhập chạy chế độ thật.
    const runMode = activeCase ? 'simulated' : 'live';
    setMode(runMode);
    setBusy(true);
    setError(null);
    try {
      const res = await api.extract({
        mode: runMode,
        invitationText: input.invitationText,
        jobUrl: input.jobUrl.trim() || null,
        meetingAddress: input.meetingAddress.trim() || null,
      });
      setExtract(res);
      setConfirm({
        company: res.fields.company.value ?? '',
        role: res.fields.role.value ?? '',
        meetingAddress: res.fields.meetingAddress.value ?? '',
        requirements: res.requirements.map((r) => ({ ...r, keep: true })),
      });
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      const jobPosting: JobPostingInput | null =
        mode === 'live' && (input.closesOn || input.postedOn || input.jobCode.trim() || input.closed)
          ? {
              jobCode: input.jobCode.trim() || null,
              postedOn: input.postedOn || null,
              closesOn: input.closesOn || null,
              closed: input.closed,
            }
          : null;
      const res = await api.verify({
        mode,
        invitationText: input.invitationText,
        jobUrl: input.jobUrl.trim() || null,
        jobPosting,
        save: historyOn && save,
        confirmed: {
          company: confirm.company.trim() || null,
          role: confirm.role.trim() || null,
          meetingAddress: confirm.meetingAddress.trim() || null,
          requirements: confirm.requirements.filter((r) => r.keep).map(({ kind, quote }) => ({ kind, quote })),
        },
      });
      setResult(res);
      setStep('result');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi không xác định.');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep('input');
    setError(null);
  }

  function go(v: View) {
    setView(v);
    setError(null);
  }

  return (
    <main className="app">
      <header>
        <h1>Việc Thật</h1>
        <p className="lead">Đối chiếu lời mời việc làm trước khi đi phỏng vấn, gửi giấy tờ hoặc chuyển tiền.</p>
        {historyOn && (
          <nav className="tabs" aria-label="Điều hướng">
            <button type="button" aria-pressed={view === 'check'} onClick={() => go('check')}>
              Kiểm tra
            </button>
            <button type="button" aria-pressed={view === 'history'} onClick={() => go('history')}>
              Lịch sử
            </button>
          </nav>
        )}
      </header>

      {view === 'history' && historyOn && health && <History ttlDays={health.ttlDays} />}

      {view === 'check' && error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      {view === 'check' && step === 'input' && (
        <form onSubmit={onExtract} className="card" aria-label="Nhập lời mời">
          <h2>1. Nhập lời mời</h2>
          {cases.length > 0 && (
            <fieldset className="samples">
              <legend>
                Thử bằng ca mẫu <SimBadge />
              </legend>
              {cases.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`sample ${activeCase === c.id ? 'sample-on' : ''}`}
                  onClick={() => pickCase(c)}
                >
                  <strong>{c.id}</strong> {c.title}
                </button>
              ))}
            </fieldset>
          )}
          <label>
            Nội dung lời mời
            <textarea
              rows={6}
              value={input.invitationText}
              onChange={(e) => updateInput({ invitationText: e.target.value })}
              placeholder="Dán tin nhắn hoặc email mời phỏng vấn"
            />
          </label>
          <label>
            Link tin tuyển dụng (nếu có)
            <input
              type="url"
              inputMode="url"
              value={input.jobUrl}
              onChange={(e) => updateInput({ jobUrl: e.target.value })}
            />
          </label>
          <label>
            Địa chỉ hẹn (nếu có)
            <input value={input.meetingAddress} onChange={(e) => updateInput({ meetingAddress: e.target.value })} />
          </label>
          {!activeCase && (
            <details className="card">
              <summary>Thông tin bạn đọc được trên tin tuyển dụng (nếu có)</summary>
              <p className="note">
                Việc Thật không tự đọc trang của sàn việc làm. Mở link, rồi nhập hạn nộp bạn thấy để kiểm tra tin còn hạn hay không.
              </p>
              <label>
                Hạn nộp hồ sơ
                <input type="date" value={input.closesOn} onChange={(e) => updateInput({ closesOn: e.target.value })} />
              </label>
              <label>
                Ngày đăng
                <input type="date" value={input.postedOn} onChange={(e) => updateInput({ postedOn: e.target.value })} />
              </label>
              <label>
                Mã tin hoặc mã vị trí
                <input value={input.jobCode} onChange={(e) => updateInput({ jobCode: e.target.value })} />
              </label>
              <label className="check">
                <input type="checkbox" checked={input.closed} onChange={(e) => updateInput({ closed: e.target.checked })} />
                <span>Tin ghi rõ đã đóng tuyển</span>
              </label>
            </details>
          )}
          {!activeCase && aiOn && (
            <p className="note">Nội dung lời mời sẽ được gửi tới dịch vụ AI (AWS Bedrock) để phân tích.</p>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Đang phân tích…' : 'Phân tích lời mời'}
          </button>
        </form>
      )}

      {view === 'check' && step === 'confirm' && confirm && extract && (
        <form onSubmit={onVerify} className="card" aria-label="Xác nhận dữ kiện">
          <h2>2. Xem lại và sửa dữ kiện</h2>
          {extract.simulated && <SimBadge />}
          {extract.notices.map((n) => (
            <p key={n} className="note">
              {n}
            </p>
          ))}
          <label>
            Công ty
            <input value={confirm.company} onChange={(e) => setConfirm({ ...confirm, company: e.target.value })} />
          </label>
          <label>
            Vị trí
            <input value={confirm.role} onChange={(e) => setConfirm({ ...confirm, role: e.target.value })} />
          </label>
          <label>
            Địa chỉ hẹn
            <input
              value={confirm.meetingAddress}
              onChange={(e) => setConfirm({ ...confirm, meetingAddress: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Yêu cầu cần xác minh</legend>
            {confirm.requirements.length === 0 && <p className="note">Không tìm thấy yêu cầu nào trong lời mời.</p>}
            {confirm.requirements.map((r, i) => (
              <label key={`${r.kind}-${i}`} className="check">
                <input
                  type="checkbox"
                  checked={r.keep}
                  onChange={(e) =>
                    setConfirm({
                      ...confirm,
                      requirements: confirm.requirements.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)),
                    })
                  }
                />
                <span>
                  <strong>{REQUIREMENT_LABEL[r.kind]}</strong>
                  <q>{r.quote}</q>
                </span>
              </label>
            ))}
          </fieldset>
          {historyOn && (
            <label className="check">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
              <span>
                Lưu vào lịch sử trên trình duyệt này
                <span className="meta">Gồm cả nội dung lời mời. Tự xóa sau {health?.ttlDays} ngày, bạn xóa được bất kỳ lúc nào.</span>
              </span>
            </label>
          )}
          <div className="row">
            <button type="button" onClick={() => setStep('input')} disabled={busy}>
              Quay lại
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Đang đối chiếu…' : 'Đối chiếu'}
            </button>
          </div>
        </form>
      )}

      {view === 'check' && step === 'result' && result && (
        <>
          <h2>3. Kết quả</h2>
          <ResultView result={result}>
            {result.historyId && (
              <p className="note" role="status">
                Đã lưu vào lịch sử.
              </p>
            )}
          </ResultView>
          <div className="row">
            <button type="button" onClick={() => setStep('confirm')}>
              Sửa dữ kiện
            </button>
            <button type="button" onClick={restart}>
              Kiểm tra lời mời khác
            </button>
          </div>
        </>
      )}
    </main>
  );
}
