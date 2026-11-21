import type { LocationStatus } from '../../../shared/contract.js';

// VT08: đối chiếu địa điểm bằng Google Places (New) Text Search.
// Nhà cung cấp nằm sau interface PlacesClient để kiểm thử và để tắt khi thiếu API key.

export interface PlaceHit {
  name: string | null;
  address: string | null;
  types: string[];
  mapsUri: string | null;
}

export interface PlacesClient {
  search(query: string): Promise<PlaceHit[]>;
}

export class PlacesError extends Error {}

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.displayName,places.formattedAddress,places.types,places.googleMapsUri';

export function createGooglePlacesClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): PlacesClient {
  return {
    async search(query) {
      let res: Response;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify({ textQuery: query, languageCode: 'vi', regionCode: 'VN', maxResultCount: 5 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new PlacesError('Không gọi được dịch vụ bản đồ.');
      }
      if (!res.ok) throw new PlacesError(`Dịch vụ bản đồ trả lỗi ${res.status}.`);
      const body = (await res.json().catch(() => ({}))) as {
        places?: Array<{
          displayName?: { text?: string };
          formattedAddress?: string;
          types?: string[];
          googleMapsUri?: string;
        }>;
      };
      return (body.places ?? []).map((p) => ({
        name: p.displayName?.text ?? null,
        address: p.formattedAddress ?? null,
        types: p.types ?? [],
        mapsUri: p.googleMapsUri ?? null,
      }));
    },
  };
}

/** Bỏ dấu, hạ chữ thường, chỉ giữ chữ và số. */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COMPANY_NOISE = new Set(['cong', 'ty', 'tnhh', 'cp', 'co', 'phan', 'trach', 'nhiem', 'huu', 'han', 'mtv', 'jsc', 'ltd', 'company', 'corp', 'corporation', 'the']);

function companyTokens(name: string | null | undefined): string[] {
  return fold(name)
    .split(' ')
    .filter((t) => t && !COMPANY_NOISE.has(t));
}

/** Khớp khi ít nhất 75% từ đặc trưng của tên công ty có trong tên địa điểm. */
export function companyNameMatches(company: string, placeName: string | null): boolean {
  const a = companyTokens(company);
  const b = new Set(companyTokens(placeName));
  if (a.length === 0 || b.size === 0) return false;
  const hit = a.filter((t) => b.has(t)).length;
  return hit / a.length >= 0.75;
}

/** Địa chỉ trả về chứa phần lớn từ và số của địa chỉ hẹn (bỏ tầng, phòng). */
export function addressOverlaps(meeting: string, found: string | null): boolean {
  const want = fold(meeting.replace(/\b(tầng|lầu|phòng|tang|lau|phong)\s*\w+/giu, ' '))
    .split(' ')
    .filter((t) => t.length > 1 || /\d/.test(t));
  if (want.length === 0 || !found) return false;
  const have = new Set(fold(found).split(' '));
  const hit = want.filter((t) => have.has(t)).length;
  return hit / want.length >= 0.6;
}

const BUILDING_TYPES = new Set(['premise', 'subpremise', 'street_address', 'route', 'point_of_interest', 'establishment']);

export interface PlaceEvaluation {
  status: LocationStatus;
  basis: string;
  displayName: string | null;
  address: string | null;
  mapsUri: string | null;
}

export function evaluatePlaces(company: string | null, meetingAddress: string, hits: PlaceHit[]): PlaceEvaluation {
  const label = 'Google Maps';
  if (hits.length === 0) {
    return {
      status: 'company_unconfirmed',
      basis: `${label} không tìm thấy kết quả cho địa chỉ này. Chưa xác nhận công ty tại địa chỉ này.`,
      displayName: null,
      address: null,
      mapsUri: null,
    };
  }
  if (company) {
    const named = hits.filter((h) => companyNameMatches(company, h.name));
    const here = named.find((h) => addressOverlaps(meetingAddress, h.address));
    if (here) {
      return {
        status: 'matched',
        basis: `${label} có ${here.name} tại ${here.address}, khớp tên công ty và địa chỉ hẹn.`,
        displayName: here.name,
        address: here.address,
        mapsUri: here.mapsUri,
      };
    }
    const elsewhere = named[0];
    if (elsewhere) {
      return {
        status: 'company_unconfirmed',
        basis: `${label} có ${elsewhere.name} ở ${elsewhere.address}, khác địa chỉ hẹn. Có thể là trụ sở hoặc chi nhánh khác. Chưa xác nhận công ty tại địa chỉ này.`,
        displayName: elsewhere.name,
        address: elsewhere.address,
        mapsUri: elsewhere.mapsUri,
      };
    }
  }
  const atAddress = hits.find((h) => addressOverlaps(meetingAddress, h.address) && h.types.some((t) => BUILDING_TYPES.has(t)));
  const best = atAddress ?? hits[0]!;
  return {
    status: 'company_unconfirmed',
    basis: `${label} chỉ cho thấy ${best.name ?? 'một địa điểm'}${best.address ? ` tại ${best.address}` : ''}. Chưa xác nhận công ty tại địa chỉ này.`,
    displayName: best.name,
    address: best.address,
    mapsUri: best.mapsUri,
  };
}
