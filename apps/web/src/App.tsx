import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { REQUIREMENT_LABEL, SAMPLE_LABEL } from './labels';
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

const EMPTY_TEXT_ERROR = 'Hãy dán nội dung lời mời trước khi phân tích.';

const sampleName = (c: DemoCaseSummary) => SAMPLE_LABEL[c.id] ?? c.title;

export default function App() {
  const [view, setView] = useState<View>('check');
  const [step, setStep] = useState<Step>('input');
  const [health, setHealth] = useState<HealthResponse['history'] | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [mode, setMode] = useState<'simulated' | 'live'>('live');
  const [cases, setCases] = useState<DemoCaseSummary[]>([]);
  const [showSamples, setShowSamples] = useState(false);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  /** Nội dung người dùng đã gõ trước khi thử mẫu, để khôi phục lại. */
  const [draft, setDraft] = useState<InputState | null>(null);
  const [input, setInput] = useState<InputState>(EMPTY_INPUT);
  const [textError, setTextError] = useState<string | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // Mặc định không lưu: lịch sử chứa nguyên văn lời mời nên người dùng phải tự chọn.
  const [save, setSave] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepHeading = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const firstRender = useRef(true);

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

  // Khi chuyển bước, đưa điểm tập trung đến tiêu đề bước mới để bàn phím và trình đọc màn hình theo kịp.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeading.current?.focus();
  }, [step]);

  const historyOn = !!health?.enabled;
  const active = cases.find((c) => c.id === activeCase);

  function pickCase(c: DemoCaseSummary) {
    // Giữ bản nháp người dùng tự gõ để khôi phục sau khi thử mẫu.
    if (!activeCase && input.invitationText.trim()) setDraft(input);
    setActiveCase(c.id);
    setInput({
      ...EMPTY_INPUT,
      invitationText: c.input.invitationText,
      jobUrl: c.input.jobUrl ?? '',
      meetingAddress: c.input.meetingAddress ?? '',
    });
    setShowSamples(false);
    setTextError(null);
    setError(null);
  }

  function restoreDraft() {
    if (!draft) return;
    setInput(draft);
    setDraft(null);
    setActiveCase(null);
    textRef.current?.focus();
  }

  function updateInput(patch: Partial<InputState>) {
    setInput((s) => ({ ...s, ...patch }));
    if (patch.invitationText !== undefined) setTextError(null);
    // Người dùng sửa tay thì không còn là ca mẫu nguyên bản.
    setActiveCase(null);
  }

  async function onExtract(e: FormEvent) {
    e.preventDefault();
    if (!input.invitationText.trim()) {
      setTextError(EMPTY_TEXT_ERROR);
      textRef.current?.focus();
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

  /** Lượt kiểm tra mới: xóa toàn bộ dữ liệu của lượt trước. */
  function restart() {
    setInput(EMPTY_INPUT);
    setDraft(null);
    setActiveCase(null);
    setShowSamples(false);
    setExtract(null);
    setConfirm(null);
    setResult(null);
    setSave(false);
    setTextError(null);
    setError(null);
    setStep('input');
  }

  function go(v: View) {
    setView(v);
    setError(null);
  }

  return (
    <main className="app">
      <header className="narrow">
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

      {view === 'history' && historyOn && health && (
        <div className="wide">
          <History ttlDays={health.ttlDays} />
        </div>
      )}

      {view === 'check' && error && (
        <div className="alert narrow" role="alert">
          {error}
        </div>
      )}

      {view === 'check' && step === 'input' && (
        <form onSubmit={onExtract} className="card narrow" aria-label="Nhập lời mời" noValidate>
          <h2 ref={stepHeading} tabIndex={-1}>
            1. Nhập lời mời
          </h2>

          {active && (
            <div className="sample-active" role="status">
              <SimBadge /> Đang dùng mẫu: <strong>{sampleName(active)}</strong>
              {draft && (
                <button type="button" className="link" onClick={restoreDraft}>
                  Khôi phục nội dung bạn đã nhập
                </button>
              )}
            </div>
          )}

          <label htmlFor="invitation-text">Nội dung lời mời</label>
          <textarea
            id="invitation-text"
            ref={textRef}
            rows={6}
            value={input.invitationText}
            onChange={(e) => updateInput({ invitationText: e.target.value })}
            placeholder="Dán tin nhắn hoặc email mời phỏng vấn"
            aria-invalid={!!textError}
            aria-describedby={textError ? 'invitation-text-error' : undefined}
          />
          {textError && (
            <p id="invitation-text-error" className="field-error" role="alert">
              {textError}
            </p>
          )}

          <button type="submit" className="primary block" disabled={busy}>
            {busy ? 'Đang phân tích…' : 'Phân tích lời mời'}
          </button>
          {!activeCase && aiOn && (
            <p className="note">Nội dung lời mời sẽ được gửi tới dịch vụ AI (AWS Bedrock) để phân tích.</p>
          )}

          <div className="subsection">
            <h3>Thêm thông tin (nếu có)</h3>
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
              <details className="disclosure">
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
          </div>

          {cases.length > 0 && (
            <div className="subsection">
              <button
                type="button"
                className="secondary block"
                aria-expanded={showSamples}
                aria-controls="sample-list"
                onClick={() => setShowSamples((v) => !v)}
              >
                {showSamples ? 'Ẩn dữ liệu mẫu' : 'Thử với dữ liệu mẫu'}
              </button>
              {showSamples && (
                <div id="sample-list" className="samples">
                  <p className="note">
                    <SimBadge /> Công ty, địa chỉ và tin đăng trong mẫu đều là giả lập.
                    {input.invitationText.trim() && !activeCase && ' Nội dung bạn đã nhập được giữ lại để khôi phục.'}
                  </p>
                  {cases.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`sample ${activeCase === c.id ? 'sample-on' : ''}`}
                      aria-pressed={activeCase === c.id}
                      onClick={() => pickCase(c)}
                    >
                      <strong>{sampleName(c)}</strong>
                      <span className="meta">{c.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {view === 'check' && step === 'confirm' && confirm && extract && (
        <form onSubmit={onVerify} className="card narrow" aria-label="Xác nhận dữ kiện">
          <h2 ref={stepHeading} tabIndex={-1}>
            2. Xem lại và sửa dữ kiện
          </h2>
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
          <fieldset className="subsection">
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
            <div className="subsection">
              <label className="check">
                <input
                  type="checkbox"
                  checked={save}
                  onChange={(e) => setSave(e.target.checked)}
                  aria-describedby="save-hint"
                />
                <span>Lưu vào lịch sử trên trình duyệt này</span>
              </label>
              <p id="save-hint" className="note save-hint">
                Có lưu nội dung lời mời trong {health?.ttlDays} ngày. Bạn xóa được bất kỳ lúc nào trong tab Lịch sử.
              </p>
            </div>
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
        <div className="wide">
          <h2 ref={stepHeading} tabIndex={-1}>
            3. Kết quả
          </h2>
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
        </div>
      )}
    </main>
  );
}
