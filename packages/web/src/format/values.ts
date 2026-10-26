import type { GapUnit } from '../store/atlasApi.js';

export const MISSING = '—';

const THOUSAND = 1_000;
const MILLION = 1_000_000;

export function formatCompactCurrency(value: number | null): string {
  if (value === null) return MISSING;
  return `$${Math.round(value / THOUSAND)}k`;
}

export function formatFullCurrency(value: number | null): string {
  if (value === null) return MISSING;
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatPercent(share: number | null, fractionDigits = 0): string {
  if (share === null) return MISSING;
  return `${(share * 100).toFixed(fractionDigits)}%`;
}

export function formatRate(value: number | null, fractionDigits = 2): string {
  if (value === null) return MISSING;
  return value.toFixed(fractionDigits);
}

export function formatCount(value: number | null): string {
  if (value === null) return MISSING;
  return value.toLocaleString();
}

export function formatByUnit(value: number | null, unit: GapUnit): string {
  switch (unit) {
    case 'USD':
      return formatFullCurrency(value);
    case 'SHARE':
      return formatPercent(value);
    case 'PER_10K':
      return formatRate(value);
  }
}

export function formatCompactPeople(count: number): string {
  if (count >= MILLION) return `${(count / MILLION).toFixed(1)}M residents`;
  if (count >= THOUSAND) return `${Math.round(count / THOUSAND)}k residents`;
  return `${count} residents`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/**
 * Both institution directories shout their names in all caps; the table does
 * not. Anything already carrying lower case is left alone, so deliberate
 * casing like "deCordova" survives.
 *
 * A period counts as a word start so the initials that fill NYC school names —
 * P.S., I.S., J.H.S. — do not come back as "P.s.".
 */
export function titleCaseFromShout(text: string): string {
  if (/[a-z]/.test(text)) return text;
  return text
    .toLowerCase()
    .replace(/(^|[\s/(.-])([a-z])/g, (_, lead: string, letter: string) =>
      lead + letter.toUpperCase(),
    );
}
