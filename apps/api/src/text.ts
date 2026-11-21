/** Gom khoảng trắng và chuẩn hóa Unicode để so khớp đoạn trích. */
export const squash = (s: string): string => s.normalize('NFC').replace(/\s+/g, ' ').trim();

export function quoteInText(quote: string, text: string): boolean {
  const q = squash(quote);
  return q.length > 0 && squash(text).includes(q);
}