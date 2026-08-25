import { Decimal, d } from '@/lib/decimal';

const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'] as const;

/**
 * Formatação única de HP, dano e XP.
 * Aceita number | Decimal para HP (ainda number) e XP (Decimal) saírem iguais.
 * Ex.: 63 → "63" · 319600 → "319,6k" · 23800000 → "23,8M" · 1860000000 → "1,86B"
 */
export function formatStat(value: number | Decimal | string): string {
  const n = d(value);
  if (!Number.isFinite(n.m) || !Number.isFinite(n.e)) return '—';
  if (n.eq(0)) return '0';

  const sign = n.lt(0) ? '-' : '';
  let abs = n.abs();
  const exp = abs.e;
  if (!Number.isFinite(exp) || exp < 3) {
    return sign + abs.round().toFixed(0);
  }

  let group = Math.floor(exp / 3);
  if (group >= SUFFIXES.length) {
    return sign + toComma(abs.toExponential(2));
  }
  let scaled = abs.div(Decimal.pow(10, group * 3));
  if (scaled.gte(1000) && group + 1 < SUFFIXES.length) {
    group += 1;
    scaled = abs.div(Decimal.pow(10, group * 3));
  }

  const decimals = scaled.lt(10) ? 2 : 1;
  const shown = toComma(scaled.toFixed(decimals));
  return sign + shown + SUFFIXES[group];
}

function toComma(raw: string): string {
  return raw.replace('.', ',');
}
