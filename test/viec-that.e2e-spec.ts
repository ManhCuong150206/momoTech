import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Ajv } from 'ajv';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type {
  DemoCaseSummary,
  ExtractResponse,
  VerifyRequest,
} from '../src/viec-that/contract.js';
import {
  demoCasesResponseSchema,
  extractResponseSchema,
  healthResponseSchema,
  verifyResponseSchema,
} from '../src/viec-that/schemas.js';

const ajv = new Ajv({ allowUnionTypes: true });
const live: VerifyRequest = {
  mode: 'live',
  invitationText: 'Mời em đến phỏng vấn, cần đóng phí giữ suất trước buổi hẹn.',
  jobUrl: 'https://example.com/job/123',
  confirmed: {
    company: 'Công ty Sao Biển',
    role: 'Phân tích dữ liệu',
    meetingAddress: '197 Đường Trần Phú',
    requirements: [{ kind: 'fee_request', quote: 'đóng phí giữ suất' }],
  },
  jobPosting: { closed: true },
  save: false,
};

describe('Hợp đồng HTTP Việc Thật', () => {
  let app: INestApplication<App>;

  async function connect(key = '') {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('VIETMAP_API_KEY', key);
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '30');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await app?.close();
  });

  it('trả đúng hợp đồng health, danh sách ca mẫu, extract và verify', async () => {
    const api = await connect();
    const health = await api.get('/healthz').expect(200);
    expect(ajv.validate(healthResponseSchema, health.body)).toBe(true);
    expect(health.body).toMatchObject({
      capabilities: { ai: false, places: false },
      history: { enabled: false },
    });

    const response = await api.get('/api/v1/demo/cases').expect(200);
    expect(ajv.validate(demoCasesResponseSchema, response.body)).toBe(true);
    const { cases } = response.body as { cases: DemoCaseSummary[] };
    const { input } = cases[0];
    const extracted = await api
      .post('/api/v1/invitations/extract')
      .send({ mode: 'simulated', ...input })
      .expect(200);
    expect(ajv.validate(extractResponseSchema, extracted.body)).toBe(true);

    const { fields, requirements } = extracted.body as ExtractResponse;
    const verified = await api
      .post('/api/v1/invitations/verify')
      .send({
        mode: 'simulated',
        invitationText: input.invitationText,
        jobUrl: input.jobUrl,
        confirmed: {
          company: fields.company.value,
          role: fields.role.value,
          meetingAddress: fields.meetingAddress.value,
          requirements,
        },
        jobPosting: null,
        save: false,
      })
      .expect(200);
    expect(ajv.validate(verifyResponseSchema, verified.body)).toBe(true);
    expect(verified.body).toMatchObject({
      simulated: true,
      job: { status: 'expired' },
      location: { status: 'company_unconfirmed' },
      invitation: { status: 'caution' },
      historyId: null,
    });
  });

  it('chạy live khi để trống key và báo lỗi đúng định dạng cho JSON hỏng hoặc trích dẫn sai', async () => {
    const api = await connect();
    const verified = await api
      .post('/api/v1/invitations/verify')
      .send(live)
      .expect(200);
    expect(verified.body).toMatchObject({
      job: { status: 'expired' },
      location: { status: 'not_checked' },
    });

    const malformed = await api
      .post('/api/v1/invitations/extract')
      .type('json')
      .send('{')
      .expect(400);
    expect(malformed.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    const invalid = await api
      .post('/api/v1/invitations/verify')
      .send({ ...live, save: 'false' })
      .expect(400);
    expect(invalid.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    const forged = await api
      .post('/api/v1/invitations/verify')
      .send({
        ...live,
        confirmed: {
          ...live.confirmed,
          requirements: [
            { kind: 'fee_request', quote: 'chuyển khoản 500.000 đồng' },
          ],
        },
      })
      .expect(422);
    expect(forged.body).toMatchObject({
      error: { code: 'QUOTE_NOT_IN_SOURCE' },
    });
  });

  it('đối chiếu POI theo tên và địa chỉ, giữ kết quả khác khi Vietmap lỗi', async () => {
    const api = await connect('test-key');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      Response.json([
        {
          ref_id: 'auto:company',
          name: 'Sao Biển',
          display: 'Sao Biển, 197 Đường Trần Phú',
        },
      ]),
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({
        name: 'Sao Biển',
        address: '197 Đường Trần Phú',
        display: '197 Đường Trần Phú, Phường Chợ Quán, Thành phố Hồ Chí Minh',
        lat: 10.7592,
        lng: 106.6759,
      }),
    );

    const matched = await api
      .post('/api/v1/invitations/verify')
      .send(live)
      .expect(200);
    expect(matched.body).toMatchObject({
      location: { status: 'matched', source: { label: 'Vietmap' } },
      contact: { status: 'unverified' },
    });
    const [url] = fetchMock.mock.calls[0];
    if (!(url instanceof URL)) throw new Error('fetch phải nhận URL.');
    expect(url.searchParams.get('layers')).toBe('POI');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 423 }));
    const unavailable = await api
      .post('/api/v1/invitations/verify')
      .send({
        ...live,
        confirmed: { ...live.confirmed, meetingAddress: 'Địa chỉ khác' },
      })
      .expect(200);
    expect(unavailable.body).toMatchObject({
      job: { status: 'expired' },
      location: { status: 'unavailable' },
    });
    expect(unavailable.text).not.toContain('test-key');

    const paused = await api
      .post('/api/v1/invitations/verify')
      .send({
        ...live,
        confirmed: { ...live.confirmed, meetingAddress: 'Địa chỉ mới' },
      })
      .expect(200);
    expect(paused.body).toMatchObject({
      job: { status: 'expired' },
      location: { status: 'unavailable' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await api.post('/api/v1/invitations/verify').send(live).expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('chặn gửi dồn dập theo IP qua cả extract và verify', async () => {
    const api = await connect();
    const now = vi.spyOn(Date, 'now');
    const start = Date.now();
    now.mockReturnValue(start);
    const extract = () =>
      api.post('/api/v1/invitations/extract').send({
        mode: live.mode,
        invitationText: live.invitationText,
      });
    try {
      for (let i = 0; i < 4; i++) await extract().expect(200);
      await api.post('/api/v1/invitations/verify').send(live).expect(200);
      const blocked = await extract().expect(429).expect('Retry-After', '10');
      expect(blocked.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });

      now.mockReturnValue(start + 10_000);
      await extract().expect(200);
    } finally {
      now.mockRestore();
    }
  });

  it('trả HISTORY_DISABLED cho các yêu cầu lịch sử khi thiếu DATABASE_URL', async () => {
    const api = await connect();
    const id = '23eeed5c-28cc-4df4-b33a-578cf46bc401';
    const responses = await Promise.all([
      api.get('/api/v1/history').expect(503),
      api.get(`/api/v1/history/${id}`).expect(503),
      api
        .post('/api/v1/history/delete')
        .send({ ids: [id] })
        .expect(503),
      api
        .post('/api/v1/invitations/verify')
        .send({ ...live, save: true })
        .expect(503),
    ]);
    for (const response of responses)
      expect(response.body).toMatchObject({
        error: { code: 'HISTORY_DISABLED' },
      });
  });
});
