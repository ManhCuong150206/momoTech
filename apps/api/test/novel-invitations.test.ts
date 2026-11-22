import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { ExtractResponse, VerifyResponse } from '../../../shared/contract.js';
import { buildApp } from '../src/app.js';

interface EvaluationCase {
  id: string;
  text: string;
  address?: string;
  openJob?: boolean;
  status: string;
  signals: Record<string, string>;
}

const cases = JSON.parse(readFileSync(new URL('../../../data/evaluation/novel-invitations.json', import.meta.url), 'utf8')) as EvaluationCase[];
const app = buildApp();
afterAll(() => app.close());

describe('lời mời mới ngoài bốn ca demo, chạy qua API không có AI và Maps', () => {
  it.each(cases)('$id', async ({ text, address, openJob, status, signals }) => {
    const extracted = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/extract',
      payload: { mode: 'live', invitationText: text, meetingAddress: address },
    });
    expect(extracted.statusCode).toBe(200);
    const extraction = extracted.json<ExtractResponse>();
    const verified = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/verify',
      payload: {
        mode: 'live',
        invitationText: text,
        jobPosting: openJob ? { closesOn: '2099-12-31' } : undefined,
        confirmed: { company: null, role: null, meetingAddress: extraction.fields.meetingAddress.value, requirements: extraction.requirements },
      },
    });

    expect(verified.statusCode).toBe(200);
    const result = verified.json<VerifyResponse>();
    expect(result.invitation.status).toBe(status);
    expect(extraction.requirements.map(({ kind }) => kind).sort()).toEqual(Object.keys(signals).sort());
    expect(result.invitation.requirements).toEqual(extraction.requirements);
    for (const { kind, quote } of result.invitation.requirements) {
      expect(text).toContain(quote);
      expect(quote).toContain(signals[kind]);
    }
    if ('credential_request' in signals) expect(result.guidance.nextStep).toContain('mã xác thực');
    if (address) expect(result.location.mapUrl).toContain('google.com/maps');
    if (status === 'insufficient_information') {
      expect(result.guidance.suggestedQuestion).toContain('kênh tuyển dụng chính thức');
      if (address) expect(result.guidance.nextStep).toContain('địa chỉ đã nhập');
    }
  });
});
