import { REPORT_SUMMARY_MAX_LENGTH } from '@streetwise/shared';

/**
 * Community rules: reports name places, never people or plates. These patterns
 * err on the side of removing too much; a summary is a hint, not evidence.
 */
const TITLES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'mai', 'baba', 'sekuru', 'ambuya', 'mbuya', 'mukoma', 'sisi', 'tete'];
const anyCase = (word: string) => word.split('').map((c) => `[${c.toUpperCase()}${c}]`).join('');
/** Three-letter words that are not plate prefixes ("the 2024 floods"). */
const NOT_PLATES = ['the', 'and', 'for', 'are', 'was', 'not', 'but', 'has', 'had', 'our', 'you', 'all', 'any', 'can', 'did', 'got', 'its', 'now', 'off', 'one', 'out', 'two', 'who', 'way', 'day', 'top', 'est', 'cnr'];

const RULES: { pattern: RegExp; replacement: string }[] = [
  // Honorific + name: "Mr Moyo", "mrs. chipo Dube", "Mai Rudo", "Sekuru Tendai".
  {
    pattern: new RegExp(`\\b(?:${TITLES.map(anyCase).join('|')})\\.?\\s+[A-Za-z][a-z'’-]+(?:\\s+[A-Z][a-z'’-]+)?`, 'g'),
    replacement: '[person]',
  },
  // Zimbabwe plates: AEB 1234, ABC-1234, abc1234.
  { pattern: new RegExp(`\\b(?!(?:${NOT_PLATES.join('|')})\\b)[a-z]{3}[\\s-]?\\d{4}\\b`, 'gi'), replacement: '[plate]' },
  // Phone numbers: +263 77 123 4567, 0771234567, 077-123-4567 (any run of 7+ digits).
  { pattern: /(?:\+\s?)?\d(?:[\s-]?\d){6,}/g, replacement: '[number]' },
];

export const redactText = (text: string): { text: string; redacted: boolean } => {
  let out = text;
  for (const rule of RULES) out = out.replace(rule.pattern, rule.replacement);
  return { text: out, redacted: out !== text };
};

/** Redacted, single-line, capitalised and clipped to the public summary length. */
export const toPublicSummary = (transcript: string): { summary: string; redacted: boolean } => {
  const { text, redacted } = redactText(transcript.replace(/\s+/g, ' ').trim());
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  const summary =
    capitalised.length > REPORT_SUMMARY_MAX_LENGTH ? `${capitalised.slice(0, REPORT_SUMMARY_MAX_LENGTH - 1).trimEnd()}…` : capitalised;
  return { summary, redacted };
};
