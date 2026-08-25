import Decimal from 'break_infinity.js';

export { Decimal };

export function d(value: Decimal | string | number): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function cloneDecimal(value: Decimal): Decimal {
  return new Decimal(value);
}
