import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineKm, type Coordinates } from './haversine.js';
import { companyNameMatches } from './company-name.js';
import { VietmapRequestLimiter } from './vietmap-request-limiter.js';

const VIETMAP_API = 'https://maps.vietmap.vn/api';
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 10_000;
const DEFAULT_SUSPICIOUS_DISTANCE_KM = 5;

type GeocodingErrorCode =
  | 'INVALID_ADDRESS'
  | 'NOT_CONFIGURED'
  | 'INVALID_KEY'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR';

interface VietmapPlace extends Coordinates {
  name: string | null;
  address: string;
  streetAddress: string | null;
}

export class GeocodingError extends Error {
  constructor(
    readonly code: GeocodingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

@Injectable()
export class GeocodingService {
  private readonly cache = new Map<
    string,
    { place: VietmapPlace | null; expiresAt: number }
  >();
  private readonly inFlight = new Map<string, Promise<VietmapPlace | null>>();
  private readonly suspiciousDistanceKm: number;
  private readonly limiter: VietmapRequestLimiter;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.limiter = new VietmapRequestLimiter(config);
    const rawThreshold = config.get<string>('GEOCODING_SUSPICIOUS_DISTANCE_KM');
    this.suspiciousDistanceKm = rawThreshold?.trim()
      ? Number(rawThreshold)
      : DEFAULT_SUSPICIOUS_DISTANCE_KM;
    if (
      !Number.isFinite(this.suspiciousDistanceKm) ||
      this.suspiciousDistanceKm < 0
    ) {
      throw new Error(
        'GEOCODING_SUSPICIOUS_DISTANCE_KM phải là số hữu hạn, từ 0 trở lên.',
      );
    }
  }

  get configured(): boolean {
    return !!this.apiKey;
  }

  private get apiKey(): string | undefined {
    return this.config.get<string>('VIETMAP_API_KEY')?.trim();
  }

  async geocode(address: string): Promise<Coordinates> {
    const place = await this.findPlace(address);
    if (!place) {
      throw new GeocodingError('NOT_FOUND', 'Vietmap không tìm thấy địa chỉ.');
    }
    return { lat: place.lat, lon: place.lon };
  }

  async findPlace(
    address: string,
    company?: string,
  ): Promise<VietmapPlace | null> {
    const text = cleanLookupText(address);
    if (!text) {
      throw new GeocodingError(
        'INVALID_ADDRESS',
        'Địa chỉ không được để trống.',
      );
    }

    const companyName = company ? cleanLookupText(company) : '';
    const key = JSON.stringify([text.toLowerCase(), companyName.toLowerCase()]);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now())
      return cached.place && { ...cached.place };

    this.cache.delete(key);
    let lookup = this.inFlight.get(key);
    if (!lookup) {
      lookup = this.lookupAndCache(key, text, companyName);
      this.inFlight.set(key, lookup);
    }
    const place = await lookup;
    return place && { ...place };
  }

  async compareAddresses(firstAddress: string, secondAddress: string) {
    const first = await this.geocode(firstAddress);
    const second = await this.geocode(secondAddress);
    const distanceKm = haversineKm(first, second);

    return {
      distanceKm,
      suspicious: distanceKm > this.suspiciousDistanceKm,
    };
  }

  private async lookupAndCache(
    key: string,
    address: string,
    company?: string,
  ): Promise<VietmapPlace | null> {
    try {
      const suggestion = await this.suggest(address, company);
      const place = suggestion
        ? await this.fetchPlace(suggestion.ref_id, suggestion.display)
        : null;
      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) this.cache.delete(oldestKey);
      }
      this.cache.set(key, {
        place,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return place;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async suggest(address: string, company?: string) {
    const text = company ? `${company} ${address}` : address;
    if (text.length < 2) return undefined;
    const body = await this.getJson('/autocomplete/v4', {
      text,
      display_type: '3',
      ...(company ? { layers: 'POI' } : {}),
    });
    if (!Array.isArray(body) || !body.every(isSuggestion)) {
      throw new GeocodingError(
        'PROVIDER_ERROR',
        'Vietmap trả về dữ liệu không hợp lệ.',
      );
    }
    return company
      ? body.find((item) => companyNameMatches(company, item.name))
      : body[0];
  }

  private async fetchPlace(
    refid: string,
    fallbackAddress: string,
  ): Promise<VietmapPlace> {
    const body = (await this.getJson('/place/v4', { refid })) as {
      lat?: unknown;
      lng?: unknown;
      name?: unknown;
      display?: unknown;
      address?: unknown;
      ward?: unknown;
      district?: unknown;
      city?: unknown;
    } | null;
    const { lat, lng } = body ?? {};
    if (
      typeof lat !== 'number' ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      typeof lng !== 'number' ||
      !Number.isFinite(lng) ||
      Math.abs(lng) > 180
    ) {
      throw new GeocodingError(
        'PROVIDER_ERROR',
        'Vietmap trả về tọa độ không hợp lệ.',
      );
    }
    const streetAddress = optionalText(body?.address);
    const address = streetAddress
      ? [streetAddress, body?.ward, body?.district, body?.city]
          .map(optionalText)
          .filter(Boolean)
          .join(', ')
      : (optionalText(body?.display) ?? fallbackAddress);
    return {
      lat,
      lon: lng,
      name: optionalText(body?.name),
      address,
      streetAddress,
    };
  }

  private async getJson(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new GeocodingError(
        'NOT_CONFIGURED',
        'Máy chủ chưa cấu hình Vietmap.',
      );
    }

    const url = new URL(`${VIETMAP_API}${path}`);
    url.search = new URLSearchParams({ apikey: apiKey, ...params }).toString();

    const limited = this.limiter.tryStart();
    if (limited) throw new GeocodingError('RATE_LIMITED', limited);
    try {
      return await this.requestJson(url);
    } finally {
      this.limiter.finish();
    }
  }

  private async requestJson(url: URL): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new GeocodingError(
        'NETWORK_ERROR',
        'Không kết nối được với Vietmap hoặc yêu cầu đã hết thời gian chờ.',
      );
    }

    if (response.status === 401) {
      this.limiter.pause(5 * 60_000);
      await response.body?.cancel().catch(() => undefined);
      throw new GeocodingError(
        'INVALID_KEY',
        'Vietmap từ chối khóa API của máy chủ.',
      );
    }
    if (response.status === 423 || response.status === 429) {
      this.limiter.pause(
        Math.max(60_000, retryAfterMs(response.headers.get('Retry-After'))),
      );
      await response.body?.cancel().catch(() => undefined);
      throw new GeocodingError(
        'RATE_LIMITED',
        'Vietmap đã giới hạn tra cứu hoặc API chưa được bật cho khóa này.',
      );
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new GeocodingError(
        'PROVIDER_ERROR',
        'Vietmap trả về lỗi khi tra cứu địa chỉ.',
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new GeocodingError(
          'PROVIDER_ERROR',
          'Vietmap trả về dữ liệu không hợp lệ.',
        );
      }
      throw new GeocodingError(
        'NETWORK_ERROR',
        'Kết nối bị gián đoạn khi đọc phản hồi Vietmap.',
      );
    }
  }
}

function cleanLookupText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const delay = /^\d+$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? delay : 0;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function isSuggestion(
  value: unknown,
): value is { ref_id: string; name: string; display: string } {
  const item = value as {
    ref_id?: unknown;
    name?: unknown;
    display?: unknown;
  } | null;
  return (
    !!item &&
    typeof item.ref_id === 'string' &&
    !!item.ref_id &&
    typeof item.name === 'string' &&
    typeof item.display === 'string'
  );
}
