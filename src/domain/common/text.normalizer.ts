const COMBINING_DIACRITICS = /[̀-ͯ]/g;
const WHITESPACE_SEQUENCE = /\s+/g;

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(WHITESPACE_SEQUENCE, ' ')
    .trim()
    .toLowerCase();
}
