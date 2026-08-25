/**
 * Formatação abreviada de HP/dano/XP.
 * Run: npx --yes tsx scripts/test-format-stat.ts
 */
import { d } from '../src/lib/decimal';
import { formatStat } from '../src/lib/format-stat';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

{
  assert('63', formatStat(63) === '63');
  assert('57', formatStat(57) === '57');
  assert('0', formatStat(0) === '0');
}

{
  assert('319,6k number', formatStat(319_600) === '319,6k');
  assert('319,6k Decimal', formatStat(d(319_600)) === '319,6k');
  assert('23,8M', formatStat(23_800_000) === '23,8M');
  assert('1,86B', formatStat(1_860_000_000) === '1,86B');
}

{
  assert('number e Decimal iguais (k)', formatStat(319_600) === formatStat(d(319_600)));
  assert('number e Decimal iguais (B)', formatStat(1_860_000_000) === formatStat(d(1_860_000_000)));
}

{
  const e16 = d('1e16');
  const e20 = d('1e20');
  const f16 = formatStat(e16);
  const f20 = formatStat(e20);
  assert('10^16 não imprime dígitos crus', !/^\d{10,}$/.test(f16) && f16.includes(','), f16);
  assert('10^20 não imprime dígitos crus', !/^\d{10,}$/.test(f20) && /[A-Za-z]/.test(f20), f20);
  assert('10^16 ≠ 10^20', f16 !== f20, `${f16} vs ${f20}`);
}

console.log('PASS test-format-stat');
