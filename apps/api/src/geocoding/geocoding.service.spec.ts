import { ConfigService } from '@nestjs/config';
import { GeocodingService } from './geocoding.service.js';

const hanoi = { lat: 21.0278, lon: 105.8342 };
const hcm = { lat: 10.8231, lon: 106.6297 };
const suggestion = {
  ref_id: 'auto:place-id',
  name: 'Hà Nội',
  display: 'Hà Nội, Việt Nam',
};

function configure(
  threshold = '5',
  overrides: Record<string, string> = {},
): GeocodingService {
  return new GeocodingService(
    new ConfigService({
      VIETMAP_API_KEY: 'test-key',
      GEOCODING_SUSPICIOUS_DISTANCE_KM: threshold,
      ...overrides,
    }),
  );
}

describe('GeocodingService', () => {
  const fetchMock = vi.fn<typeof fetch>();

  function mockPlace({ lat, lon }: typeof hanoi) {
    fetchMock.mockResolvedValueOnce(Response.json([suggestion]));
    fetchMock.mockResolvedValueOnce(
      Response.json({ lat, lng: lon, display: suggestion.display }),
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gửi đúng query và dùng chung lượt tra cứu cho các địa chỉ trùng nhau', async () => {
    const service = configure();
    mockPlace(hanoi);

    await expect(
      Promise.all([service.geocode('  Hà Nội '), service.geocode('hà nội')]),
    ).resolves.toEqual([hanoi, hanoi]);
    await expect(service.geocode('HÀ NỘI')).resolves.toEqual(hanoi);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0];
    if (!(url instanceof URL)) throw new Error('fetch phải nhận URL.');
    expect(url.origin + url.pathname).toBe(
      'https://maps.vietmap.vn/api/autocomplete/v4',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      text: 'Hà Nội',
      display_type: '3',
      apikey: 'test-key',
    });
    expect(options?.method).toBe('GET');
    const [placeUrl] = fetchMock.mock.calls[1];
    if (!(placeUrl instanceof URL)) throw new Error('fetch phải nhận URL.');
    expect(placeUrl.pathname).toBe('/api/place/v4');
    expect(Object.fromEntries(placeUrl.searchParams)).toEqual({
      refid: suggestion.ref_id,
      apikey: 'test-key',
    });
  });

  it('cache kết quả không tìm thấy và tra lại sau 24 giờ', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const service = configure();
    fetchMock.mockResolvedValueOnce(Response.json([]));
    mockPlace(hanoi);

    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.geocode(' hà nội ')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now.mockReturnValue(24 * 60 * 60 * 1000);
    await expect(service.geocode('Hà Nội')).resolves.toEqual(hanoi);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('phân biệt khóa sai, giới hạn và lỗi mạng, rồi tra lại được', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const service = configure();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(null, { status: 423, headers: { 'Retry-After': '120' } }),
      )
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    mockPlace(hanoi);

    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'INVALID_KEY',
    });
    await expect(service.geocode('Khánh Hòa')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now.mockReturnValue(300_000);
    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    now.mockReturnValue(360_000);
    await expect(service.geocode('Khánh Hòa')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    now.mockReturnValue(420_000);
    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(service.geocode('Hà Nội')).resolves.toEqual(hanoi);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('tính cả Autocomplete và Place vào giới hạn một phút, vẫn dùng cache khi hết lượt', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const service = configure('5', { VIETMAP_MAX_REQUESTS_PER_MINUTE: '2' });
    mockPlace(hanoi);
    mockPlace(hcm);

    await expect(service.geocode('Hà Nội')).resolves.toEqual(hanoi);
    await expect(service.geocode('Hà  Nội'.normalize('NFD'))).resolves.toEqual(
      hanoi,
    );
    now.mockReturnValue(59_999);
    await expect(
      service.geocode('Thành phố Hồ Chí Minh'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    now.mockReturnValue(60_000);
    await expect(service.geocode('Thành phố Hồ Chí Minh')).resolves.toEqual(
      hcm,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('mở lại lượt gọi khi sang ngày mới theo giờ Việt Nam', async () => {
    const midnightVn = Date.parse('2026-11-23T17:00:00Z');
    const now = vi.spyOn(Date, 'now').mockReturnValue(midnightVn - 1);
    const service = configure('5', { VIETMAP_MAX_REQUESTS_PER_DAY: '2' });
    mockPlace(hanoi);
    mockPlace(hcm);

    await expect(service.geocode('Hà Nội')).resolves.toEqual(hanoi);
    await expect(
      service.geocode('Thành phố Hồ Chí Minh'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    now.mockReturnValue(midnightVn);
    await expect(service.geocode('Thành phố Hồ Chí Minh')).resolves.toEqual(
      hcm,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('giữ giới hạn đồng thời đến khi đọc xong phản hồi và giải phóng lượt khi lỗi', async () => {
    const service = configure('5', { VIETMAP_MAX_CONCURRENT_REQUESTS: '1' });
    let stopReading: (() => void) | undefined;
    const pendingBody = new ReadableStream({
      start(controller) {
        stopReading = () =>
          controller.error(new TypeError('connection closed'));
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(pendingBody));
    mockPlace(hcm);

    const pending = expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(
      service.geocode('Thành phố Hồ Chí Minh'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stopReading?.();
    await pending;

    await expect(service.geocode('Thành phố Hồ Chí Minh')).resolves.toEqual(
      hcm,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('phân biệt kết nối đứt khi đọc phản hồi và JSON không hợp lệ', async () => {
    const service = configure();
    const interruptedBody = new ReadableStream({
      start(controller) {
        controller.error(new TypeError('connection closed'));
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(interruptedBody))
      .mockResolvedValueOnce(new Response('{'));

    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it.each([
    ['1000', true],
    ['2000', false],
  ])(
    'tính khoảng cách và áp dụng ngưỡng %s km',
    async (threshold, suspicious) => {
      const service = configure(threshold);
      mockPlace(hanoi);
      mockPlace(hcm);

      const comparison = await service.compareAddresses(
        'Hà Nội',
        'TP. Hồ Chí Minh',
      );

      expect(comparison.distanceKm).toBeCloseTo(1137.88, 2);
      expect(comparison.suspicious).toBe(suspicious);
      await expect(
        service.compareAddresses('Hà Nội', 'hà nội'),
      ).resolves.toEqual({
        distanceKm: 0,
        suspicious: false,
      });
    },
  );

  it('báo thiếu key trước khi gọi Vietmap', async () => {
    const service = new GeocodingService(
      new ConfigService({ VIETMAP_API_KEY: '' }),
    );
    await expect(service.geocode('Hà Nội')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
