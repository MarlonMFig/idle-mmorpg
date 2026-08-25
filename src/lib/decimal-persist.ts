import { d, parseDecimal, type Decimal } from '@/lib/decimal';

/**
 * Serialização de Decimal para save JSON.
 * Nunca passar Decimal cru para JSON.stringify (objeto mantissa/exponent).
 */
export function decimalToSave(value: Decimal): string {
  if (!Number.isFinite(value.m) || !Number.isFinite(value.e) || value.lt(0)) {
    return '0';
  }
  return value.toString();
}

/** Lê string nova, number legado, ou Decimal já hidratado. */
export function decimalFromSave(raw: unknown): Decimal {
  return parseDecimal(raw);
}

export function decimalsEq(a: Decimal, b: Decimal): boolean {
  return a.eq(b);
}

export function jsonRoundTripDecimal(value: Decimal): Decimal {
  const encoded = JSON.stringify({ xp: decimalToSave(value) });
  const parsed = JSON.parse(encoded) as { xp: unknown };
  return decimalFromSave(parsed.xp);
}

export { d };
