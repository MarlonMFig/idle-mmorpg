import { starAttributeMultiplier as starMultFromSpec } from '@/constants/aiw-quality';
import { potentialPowerMultiplier } from '@/lib/potential';
import type { CharacterPotential } from '@/types/potential';
import { ATTRIBUTE_ORDER } from '@/constants/attributes';
import type { AttributeValues } from '@/types/attributes';

/**
 * Aplica bônus de estrelas e potencial aos atributos base.
 */
export function applyStarBonusToBase(
  base: AttributeValues,
  stars: number,
  potential?: CharacterPotential,
): AttributeValues {
  const mult = starMultFromSpec(stars) * potentialPowerMultiplier(potential);
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
