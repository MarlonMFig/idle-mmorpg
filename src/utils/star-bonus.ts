import { starAttributeMultiplier } from '@/constants/character-progression';
import { ATTRIBUTE_ORDER } from '@/constants/attributes';
import type { AttributeValues } from '@/types/attributes';

/**
 * Aplica bônus de estrelas aos atributos base (linear, não composto).
 * Mantém precisão float; arredondar só na UI.
 */
export function applyStarBonusToBase(
  base: AttributeValues,
  stars: number,
): AttributeValues {
  const mult = starAttributeMultiplier(stars);
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
