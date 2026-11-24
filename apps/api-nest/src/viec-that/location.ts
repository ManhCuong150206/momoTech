import {
  companyNameMatches,
  foldVietnamese,
} from '../geocoding/company-name.js';
import {
  GeocodingError,
  type GeocodingService,
} from '../geocoding/geocoding.service.js';
import type { LocationResult } from './contract.js';

const SOURCE = { label: 'Vietmap', url: null, simulated: false };

function mapAddress(address: string): string {
  return address
    .replace(/(?:^|[\s,])(?:tầng|lầu|phòng)\s+\d+[\p{L}\d-]*/giu, ' ')
    .replace(/[,\s]+$/, '')
    .trim();
}

function addressMatches(
  input: string,
  full: string,
  street: string | null,
): boolean {
  const clean = (value: string) =>
    foldVietnamese(value)
      .replace(/[^a-z0-9/]+/g, ' ')
      .trim();
  const expected = clean(input).replace(/^so +/, '');
  const found = clean(full);
  if (!expected || !found) return false;
  if (expected === found) return true;

  // Require the mapped street address when only one side includes ward or city.
  const streetAddress = street && clean(street);
  if (!streetAddress || !/^\d/.test(streetAddress)) return false;
  return (
    expected === streetAddress ||
    (found.startsWith(`${expected} `) &&
      expected.startsWith(`${streetAddress} `))
  );
}

export function mapUrlFor(address: string | null): string | null {
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}

export async function evaluateLocationLive(
  address: string | undefined,
  company: string | undefined,
  geocoding: GeocodingService,
  today: string,
): Promise<{ location: LocationResult; notice?: string }> {
  const location: LocationResult = {
    status: 'not_checked',
    basis: address
      ? 'Chưa đối chiếu tự động. Mở bản đồ để tự kiểm tra địa chỉ.'
      : 'Chưa có địa chỉ hẹn để tra cứu.',
    source: { label: null, url: null, simulated: false },
    checkedOn: null,
    place: { displayName: null, address: null },
    mapUrl: mapUrlFor(address || null),
  };
  if (!address) return { location };
  if (!geocoding.configured) {
    return {
      location,
      notice:
        'Vietmap chưa được cấu hình nên địa điểm chưa được đối chiếu tự động.',
    };
  }

  const query = mapAddress(address) || address;
  location.source = SOURCE;
  location.checkedOn = today;
  try {
    const business = company ? await geocoding.findPlace(query, company) : null;
    const place = business ?? (await geocoding.findPlace(query));
    const matched = !!(
      company &&
      business &&
      companyNameMatches(company, business.name) &&
      addressMatches(query, business.address, business.streetAddress)
    );
    location.status = matched ? 'matched' : 'company_unconfirmed';
    if (place) {
      location.place = { displayName: place.name, address: place.address };
      const label = place.name
        ? `${place.name} tại ${place.address}`
        : place.address;
      location.basis = matched
        ? `Vietmap ghi ${label}, khớp tên công ty và địa chỉ hẹn.`
        : `Vietmap tìm thấy ${label}. Chưa xác nhận công ty tại địa chỉ hẹn.`;
    } else {
      location.basis =
        'Vietmap chưa tìm thấy địa điểm khớp. Hãy kiểm tra lại địa chỉ hẹn.';
    }
    return { location };
  } catch (error) {
    if (!(error instanceof GeocodingError)) throw error;
    location.status = 'unavailable';
    location.basis = `${error.message} Mở bản đồ để tự kiểm tra địa chỉ.`;
    return {
      location,
      notice: `${error.message} Các phần khác vẫn có kết quả.`,
    };
  }
}
