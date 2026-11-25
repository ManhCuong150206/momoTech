// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { VerifyResponse } from '../../../shared/contract';
import ResultView from '../src/ResultView';

afterEach(cleanup);

// Hợp đồng v1 cho phép API thêm giá trị enum mới. Bản web cũ phải hiện "Chưa rõ" thay vì lỗi.
describe('ổn định hợp đồng', () => {
  it('trạng thái và loại yêu cầu lạ hiện "Chưa rõ", không làm hỏng trang', () => {
    const src = { label: null, url: null, simulated: false };
    const result = {
      mode: 'live',
      simulated: false,
      checkedOn: '2026-11-25',
      job: { status: 'archived', basis: 'b', source: src, checkedOn: null, details: { company: null, role: null, jobCode: null, postedOn: null, closesOn: null, reason: null } },
      location: { status: 'moved', basis: 'b', source: src, checkedOn: null, place: { displayName: null, address: null }, mapUrl: null },
      contact: { status: 'pending_review', basis: 'b' },
      invitation: { status: 'blocked', basis: 'b', requirements: [{ kind: 'gift_card_request', quote: 'mua thẻ cào' }] },
      guidance: { nextStep: 'Bước tiếp', suggestedQuestion: 'Câu hỏi?' },
      notices: [],
      historyId: null,
    } as unknown as VerifyResponse;
    render(<ResultView result={result} />);
    for (const name of ['Tin đăng', 'Địa điểm', 'Người liên hệ']) {
      expect(within(screen.getByRole('article', { name })).getByText('Chưa rõ')).toBeTruthy();
    }
    expect(within(screen.getByRole('article', { name: 'Lời mời' })).getAllByText('Chưa rõ')).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Việc nên làm ngay' }).className).toContain('action-neutral');
  });
});
