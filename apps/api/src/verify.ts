import type {
  ContactResult,
  InvitationResult,
  InvitationStatus,
  JobResult,
  JobStatus,
  LocationResult,
  LocationStatus,
  Requirement,
  VerifyRequest,
  VerifyResponse,
} from '../../../shared/contract.js';
import { type DemoCase, type DemoData, findCaseByJobUrl, normalize } from './demo-data.js';
import { evaluatePlaces, type PlacesClient } from './places.js';
import { quoteInText } from './text.js';

// Đối chiếu mô phỏng (giai đoạn 1). Trạng thái được suy ra từ `fixtures` bằng luật,
// không sao chép từ `expected`. VT08/VT09 thay phần đọc nguồn bằng nguồn thật.

const SIM_JOB_SOURCE = 'Nguồn tin mô phỏng';
const SIM_PLACE_SOURCE = 'Bản đồ mô phỏng';

export function mapUrlFor(address: string | null): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function evaluateJob(demo: DemoCase | undefined, req: VerifyRequest, asOf: string): JobResult {
  const jobUrl = req.jobUrl?.trim() || null;
  const empty = { company: null, role: null, jobCode: null, postedOn: null, closesOn: null, reason: null };
  const job = demo?.fixtures.job;

  if (!jobUrl || !demo || !job) {
    return {
      status: 'not_checked',
      basis: jobUrl
        ? 'Link này không có trong dữ liệu mô phỏng nên chưa đối chiếu được.'
        : 'Chưa có link tin tuyển dụng để đối chiếu.',
      source: { label: null, url: jobUrl, simulated: true },
      checkedOn: null,
      details: empty,
    };
  }

  const source = { label: job.source ?? SIM_JOB_SOURCE, url: jobUrl, simulated: true };
  const details = {
    company: job.company ?? null,
    role: job.role ?? null,
    jobCode: job.jobCode ?? null,
    postedOn: job.postedOn ?? null,
    closesOn: job.closesOn ?? null,
    reason: job.reason ?? null,
  };

  if (job.status === 'unavailable') {
    const why = job.reason === 'login_required' ? 'trang yêu cầu đăng nhập' : 'nguồn không truy cập được';
    return {
      status: 'unavailable',
      basis: `Chưa kiểm tra được tin: ${why}.`,
      source,
      checkedOn: asOf,
      details,
    };
  }

  // Chỉ ghi "hết hạn" khi hạn đã qua hoặc nguồn ghi rõ đã đóng.
  let status: JobStatus = 'not_checked';
  let basis = 'Nguồn không ghi hạn nộp hoặc trạng thái tuyển.';
  if (details.closesOn && details.closesOn < asOf) {
    status = 'expired';
    basis = `Hạn nhận hồ sơ ${details.closesOn} đã qua so với ngày kiểm tra ${asOf}.`;
  } else if (job.status === 'expired' || job.status === 'closed') {
    status = 'expired';
    basis = 'Nguồn ghi rõ tin đã đóng tuyển.';
  } else if (details.closesOn && details.closesOn >= asOf) {
    status = 'open';
    basis = `Hạn nhận hồ sơ ${details.closesOn} chưa qua so với ngày kiểm tra ${asOf}.`;
  } else if (job.status === 'open') {
    status = 'open';
    basis = 'Nguồn ghi tin đang tuyển, không nêu hạn nộp.';
  }
  return { status, basis, source, checkedOn: asOf, details };
}

function evaluateLocation(
  demo: DemoCase | undefined,
  req: VerifyRequest,
  asOf: string,
  notices: string[],
): LocationResult {
  const address = req.confirmed.meetingAddress?.trim() || null;
  const none = { displayName: null, address: null };

  if (!address) {
    return {
      status: 'not_checked',
      basis: 'Chưa có địa chỉ hẹn để tra cứu.',
      source: { label: null, url: null, simulated: true },
      checkedOn: null,
      place: none,
      mapUrl: null,
    };
  }

  const mapUrl = mapUrlFor(address);
  const place = demo?.fixtures.place;
  const sameAddress = demo ? normalize(demo.input.meetingAddress) === normalize(address) : false;

  if (!demo || !place || place.status === 'not_checked' || !sameAddress) {
    if (demo && !sameAddress) {
      notices.push('Địa chỉ đã sửa khác địa chỉ trong ca mô phỏng nên bản đồ mô phỏng không áp dụng.');
    }
    return {
      status: 'not_checked',
      basis: 'Chưa đối chiếu tự động. Mở bản đồ để tự kiểm tra địa chỉ.',
      source: { label: null, url: null, simulated: true },
      checkedOn: null,
      place: none,
      mapUrl,
    };
  }

  const source = { label: place.source ?? SIM_PLACE_SOURCE, url: null, simulated: true };
  const placeInfo = { displayName: place.displayName ?? null, address: place.address ?? null };
  const sameCompany =
    !!req.confirmed.company &&
    !!place.companyAtAddress &&
    normalize(place.companyAtAddress) === normalize(req.confirmed.company);

  let status: LocationStatus = 'company_unconfirmed';
  let basis = 'Chưa xác nhận công ty tại địa chỉ này.';
  if (place.status === 'company_found' && sameCompany) {
    status = 'matched';
    basis = `${source.label} ghi ${place.companyAtAddress} tại địa chỉ này.`;
  } else if (place.status === 'shared_office_only') {
    const reg = demo.fixtures.registry?.registeredOffice;
    basis =
      `Địa chỉ là ${place.displayName ?? 'không gian làm việc dùng chung'}, chưa xác nhận công ty tại địa chỉ này.` +
      (reg ? ` Trụ sở đăng ký ghi ở ${reg}.` : '');
  } else if (place.status === 'building_only') {
    basis = `Chỉ tìm thấy ${place.displayName ?? 'một tòa nhà'}. Chưa xác nhận công ty tại địa chỉ này.`;
  } else if (place.status === 'company_found') {
    basis = `Bản đồ tìm thấy ${place.companyAtAddress ?? 'một đơn vị'} tại địa chỉ, khác với công ty đã xác nhận. Chưa xác nhận công ty tại địa chỉ này.`;
  }
  return { status, basis, source, checkedOn: asOf, place: placeInfo, mapUrl };
}

function evaluateContact(): ContactResult {
  return {
    status: 'unverified',
    basis: 'Chưa có căn cứ về người liên hệ. Xác minh qua kênh tuyển dụng chính thức của công ty.',
  };
}

function evaluateInvitation(
  job: JobResult,
  location: LocationResult,
  requirements: Requirement[],
  hasAddress: boolean,
): InvitationResult {
  const fee = requirements.find((r) => r.kind === 'fee_request');
  let status: InvitationStatus;
  let basis: string;
  if (fee) {
    status = 'caution';
    basis = 'Lời mời yêu cầu một khoản phí. Cần xác minh trước khi chuyển tiền.';
  } else if ((job.status === 'unavailable' || job.status === 'not_checked') && !hasAddress) {
    status = 'insufficient_information';
    basis = 'Thiếu tin đăng đọc được và địa chỉ hẹn nên chưa đủ dữ kiện để đánh giá.';
  } else if (location.status === 'company_unconfirmed') {
    status = 'needs_verification';
    basis = 'Địa điểm hẹn chưa xác nhận được công ty. Cần hỏi lại qua kênh chính thức.';
  } else if (requirements.some((r) => r.kind === 'document_request')) {
    status = 'needs_verification';
    basis = 'Lời mời yêu cầu gửi giấy tờ cá nhân. Chỉ gửi sau khi xác minh được công ty và người liên hệ.';
  } else {
    status = 'no_signal_observed';
    basis = 'Chưa thấy dấu hiệu cần cảnh báo trong dữ kiện đã đối chiếu. Đây chưa phải xác nhận lời mời là thật.';
  }
  return { status, basis, requirements };
}

function joinVi(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;
}

export function buildGuidance(
  job: JobResult,
  location: LocationResult,
  invitation: InvitationResult,
  hasAddress: boolean,
  knownCompany = false,
): { nextStep: string; suggestedQuestion: string } {
  const hasKind = (k: Requirement['kind']) => invitation.requirements.some((r) => r.kind === k);
  const asks: string[] = [];
  const steps: string[] = [];
  let prefix = '';

  if (job.status === 'expired') {
    steps.push('mã tin hiện tại');
    asks.push('mã tuyển dụng hiện tại');
    prefix = job.details.jobCode ? `Em thấy tin ${job.details.jobCode} đã hết hạn. ` : 'Em thấy tin tuyển dụng đã hết hạn. ';
  }
  if (job.status === 'unavailable' || job.status === 'not_checked') {
    if (!knownCompany) asks.push('tên công ty');
    asks.push('mã vị trí');
  }
  if (!hasAddress) {
    asks.push('địa chỉ phỏng vấn');
  } else if (location.status === 'company_unconfirmed') {
    steps.push('địa điểm phỏng vấn');
    asks.push(hasKind('shared_office_meeting') ? 'tên đơn vị đặt phòng, số tầng' : 'tên tòa nhà, số tầng');
  }
  asks.push('kênh tuyển dụng chính thức');
  const needsMoreInfo = invitation.status === 'insufficient_information';

  let nextStep: string;
  if (needsMoreInfo) {
    nextStep = 'Bổ sung tên công ty, vị trí, nội dung tin có thể xem và địa chỉ hẹn khi nhận được.';
  } else {
    const parts: string[] = [];
    if (hasKind('fee_request')) parts.push('Tạm dừng đóng phí.');
    if (hasKind('document_request')) parts.push('Chưa gửi giấy tờ cá nhân.');
    if (steps.length) parts.push(`Xác minh ${joinVi(steps)} qua kênh chính thức của công ty trước khi đi gặp.`);
    else parts.push('Đối chiếu lịch với kênh tuyển dụng chính thức nếu chưa biết người liên hệ.');
    nextStep = parts.join(' ');
  }

  const suggestedQuestion = `${prefix}Anh/chị cho em xin ${joinVi(asks)} để em xác nhận lịch được không ạ?`;
  return { nextStep, suggestedQuestion };
}

export class QuoteNotInSourceError extends Error {
  constructor(public readonly quotes: string[]) {
    super('Có đoạn trích không nằm trong nội dung lời mời.');
  }
}

export function assertQuotes(req: VerifyRequest): void {
  const bad = req.confirmed.requirements.map((r) => r.quote).filter((q) => !quoteInText(q, req.invitationText));
  if (bad.length) throw new QuoteNotInSourceError(bad);
}

export function verifySimulated(req: VerifyRequest, data: DemoData): VerifyResponse {
  assertQuotes(req);

  const asOf = data.demoAsOf;
  const demo: DemoCase | undefined = findCaseByJobUrl(data, req.jobUrl);
  const notices: string[] = ['Dữ liệu mô phỏng: nguồn tin và bản đồ là giả lập, không phản ánh công ty thật.'];

  const job = evaluateJob(demo, req, asOf);
  if (demo?.fixtures.job?.company && req.confirmed.company && normalize(demo.fixtures.job.company) !== normalize(req.confirmed.company)) {
    notices.push('Công ty đã xác nhận khác công ty ghi trên tin đăng. Hãy kiểm tra lại.');
  }
  const location = evaluateLocation(demo, req, asOf, notices);
  const contact = evaluateContact();
  const hasAddress = !!req.confirmed.meetingAddress?.trim();
  const invitation = evaluateInvitation(job, location, req.confirmed.requirements, hasAddress);
  const guidance = buildGuidance(job, location, invitation, hasAddress, !!req.confirmed.company?.trim());

  return {
    mode: 'simulated',
    simulated: true,
    checkedOn: asOf,
    job,
    location,
    contact,
    invitation,
    guidance,
    notices,
    historyId: null,
  };
}

// ---------------------------------------------------------------------------
// Chế độ live (VT08, VT09): địa điểm qua Places, tin đăng từ dữ kiện người dùng nhập.
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validCalendarDate(value: string | null | undefined): string | null {
  if (!value || !ISO_DATE.test(value) || value.startsWith('0000-')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVn(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function evaluateJobLive(req: VerifyRequest, today: string): JobResult {
  const jobUrl = req.jobUrl?.trim() || null;
  const p = req.jobPosting ?? {};
  const details = {
    company: req.confirmed.company,
    role: req.confirmed.role,
    jobCode: p.jobCode?.trim() || null,
    postedOn: validCalendarDate(p.postedOn),
    closesOn: validCalendarDate(p.closesOn),
    reason: null as string | null,
  };
  const source = { label: 'Thông tin do bạn nhập từ tin tuyển dụng', url: jobUrl, simulated: false };
  const hasData = !!(details.closesOn || p.closed);

  if (!hasData) {
    if (!jobUrl && !details.jobCode) {
      return {
        status: 'not_checked',
        basis: 'Chưa có link hoặc thông tin từ tin tuyển dụng để đối chiếu.',
        source: { label: null, url: null, simulated: false },
        checkedOn: null,
        details,
      };
    }
    details.reason = 'no_deadline';
    return {
      status: 'unavailable',
      basis:
        'Chưa kiểm tra được: chưa có hạn nộp hoặc trạng thái tuyển. Link chỉ được lưu để tham chiếu, Việc Thật không tự đọc trang của sàn việc làm. Mở link và nhập hạn nộp bạn thấy trên tin.',
      source,
      checkedOn: today,
      details,
    };
  }

  // Chỉ ghi "hết hạn" khi hạn đã qua hoặc tin ghi rõ đã đóng tuyển.
  if (details.closesOn && details.closesOn < today) {
    return { status: 'expired', basis: `Hạn nhận hồ sơ ${details.closesOn} đã qua so với ngày kiểm tra ${today}.`, source, checkedOn: today, details };
  }
  if (p.closed) {
    return { status: 'expired', basis: 'Tin ghi rõ đã đóng tuyển (theo thông tin bạn nhập).', source, checkedOn: today, details };
  }
  return {
    status: 'open',
    basis: `Hạn nhận hồ sơ ${details.closesOn} chưa qua so với ngày kiểm tra ${today}.`,
    source,
    checkedOn: today,
    details,
  };
}

export async function evaluateLocationLive(
  req: VerifyRequest,
  places: PlacesClient | undefined,
  today: string,
): Promise<LocationResult> {
  const address = req.confirmed.meetingAddress?.trim() || null;
  const none = { displayName: null, address: null };
  if (!address) {
    return {
      status: 'not_checked',
      basis: 'Chưa có địa chỉ hẹn để tra cứu.',
      source: { label: null, url: null, simulated: false },
      checkedOn: null,
      place: none,
      mapUrl: null,
    };
  }
  const mapUrl = mapUrlFor(address);
  if (!places) {
    return {
      status: 'not_checked',
      basis: 'Chưa đối chiếu tự động. Mở bản đồ để tự kiểm tra địa chỉ.',
      source: { label: null, url: null, simulated: false },
      checkedOn: null,
      place: none,
      mapUrl,
    };
  }
  const company = req.confirmed.company?.trim() || null;
  try {
    const hits = await places.search(company ? `${company} ${address}` : address);
    const ev = evaluatePlaces(company, address, hits);
    return {
      status: ev.status,
      basis: ev.basis,
      source: { label: 'Google Maps', url: ev.mapsUri, simulated: false },
      checkedOn: today,
      place: { displayName: ev.displayName, address: ev.address },
      mapUrl,
    };
  } catch {
    return {
      status: 'unavailable',
      basis: 'Chưa kiểm tra được: dịch vụ bản đồ tạm lỗi. Mở bản đồ để tự kiểm tra địa chỉ.',
      source: { label: 'Google Maps', url: null, simulated: false },
      checkedOn: today,
      place: none,
      mapUrl,
    };
  }
}

export async function verifyLive(
  req: VerifyRequest,
  deps: { places?: PlacesClient; today?: string },
): Promise<VerifyResponse> {
  assertQuotes(req);
  const today = deps.today ?? todayVn();
  const notices: string[] = [];
  if (!deps.places) notices.push('Google Maps chưa được cấu hình nên địa điểm chưa được đối chiếu tự động.');

  const job = evaluateJobLive(req, today);
  const location = await evaluateLocationLive(req, deps.places, today);
  const contact = evaluateContact();
  const hasAddress = !!req.confirmed.meetingAddress?.trim();
  const invitation = evaluateInvitation(job, location, req.confirmed.requirements, hasAddress);
  const guidance = buildGuidance(job, location, invitation, hasAddress, !!req.confirmed.company?.trim());
  return { mode: 'live', simulated: false, checkedOn: today, job, location, contact, invitation, guidance, notices, historyId: null };
}
