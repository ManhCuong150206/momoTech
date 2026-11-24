export function foldVietnamese(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

const LEGAL_TERMS =
  /\b(?:cong ty|co phan|trach nhiem huu han|tnhh|mtv|jsc|ltd|company|corporation|corp)\b/g;

function companyName(name: string): string {
  return foldVietnamese(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(LEGAL_TERMS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function companyNameMatches(
  company: string,
  placeName: string | null,
): boolean {
  const expected = companyName(company);
  return !!expected && !!placeName && expected === companyName(placeName);
}
