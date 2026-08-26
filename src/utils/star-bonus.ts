import { starAttributeMultiplier as starMultFromSpec } from '@/config/gameConfig';
import { ATTRIBUTE_ORDER } from '@/constants/attributes';
import type { AttributeValues } from '@/types/attributes';

/**
 * Aplica o bônus de estrelas (+8% cada) aos atributos base.
 */
export function applyStarBonusToBase(base: AttributeValues, stars: number): AttributeValues {
  const mult = starMultFromSpec(stars);
  const result = { ...base };
  for (const id of ATTRIBUTE_ORDER) {
    result[id] = base[id] * mult;
  }
  return result;
}

/** Valor para exibição (UI). Cálculo interno permanece float. */
export function roundAttributeForDisplay(value: number): number {
  return Math.round(value);
}
