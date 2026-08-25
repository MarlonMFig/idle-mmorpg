import Decimal from 'break_infinity.js';

export { Decimal };

/** Constrói um Decimal. Aceita número, string (ex. "1e20") ou Decimal. */
export function d(value: Decimal | string | number): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function cloneDecimal(value: Decimal): Decimal {
  return new Decimal(value);
}

/** Aceita Decimal, number ou string de save. Negativo vira 0. */
export function parseDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) return value.lt(0) ? d(0) : value;
  if (typeof value === 'number' && Number.isFinite(value)) return d(Math.max(0, value));
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = d(value);
    if (Number.isFinite(parsed.m) && Number.isFinite(parsed.e)) {
      return parsed.lt(0) ? d(0) : parsed;
    }
  }
  return d(0);
}

/**
 * Borda legado (save/ranking). IEEE-754 perde inteiros acima de 2^53.
 * Não usar em combate nem na curva de XP.
 */
export function decimalToUnsafeNumber(value: Decimal): number {
  const n = value.toNumber();
  return Number.isFinite(n) ? n : 0;
}

/** Barra de HP / thresholds. IEEE-754 só no ratio 0–1, nunca no HP absoluto. */
export function hpRatio(hp: Decimal | number, hpMax: Decimal | number): number {
  const max = d(hpMax);
  if (max.lte(0)) return 0;
  const r = d(hp).div(max).toNumber();
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}

export function floorNonNeg(value: Decimal | number): Decimal {
  const n = d(value);
  if (n.lte(0)) return d(0);
  return n.floor();
}
