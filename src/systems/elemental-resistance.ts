/**
 * Resistência / vulnerabilidade / imunidade elemental.
 *
 * Clamp técnico (não é balanceamento de conteúdo):
 *   MIN = −1.0  → no máximo +100% de dano (2×). Evita −10000%.
 *   MAX = +0.90 → no máximo −90% de dano. 100% não é imunidade:
 *                 imunidade é lista explícita e zera o dano.
 *
 * Fórmula: `max(0, floor(raw * (1 - clamp(resistance))))`
 * Neutral ignora o modificador (defesa física/mágica atual continua antes).
 *
 * Ordem no pipeline de entrada (não muda o que já existia; só insere o passo):
 *   Attack + skill multiplier
 *   → bônus STAR_3 (se houver)
 *   → DEV scaleOutgoingDamage
 *   → Shield
 *   → Defense (`mitigateIncomingDamage`)
 *   → Element resistance / immunity   ← esta função
 *   → HP
 *
 * Hunt não rola crítico em Skills; esse passo não existe e não foi criado.
 * Defense Down altera defesa, não esta tabela.
 */

import {
  DEFAULT_SKILL_ELEMENT,
  type CombatAffinityFields,
  type DamageElement,
  type ElementResistanceMap,
} from '@/data/damage-elements';
import { Decimal, d, floorNonNeg, type Decimal as DecimalValue } from '@/lib/decimal';

export const MIN_ELEMENT_RESISTANCE = -1;
export const MAX_ELEMENT_RESISTANCE = 0.9;

export type ElementFloaterTag = 'RESIST' | 'WEAK' | 'IMMUNE';

export interface ElementalApplyResult {
  rawDamage: DecimalValue;
  element: DamageElement;
  skipped: boolean;
  immune: boolean;
  resistance: number;
  afterResistance: DecimalValue;
  finalDamage: DecimalValue;
  tag: ElementFloaterTag | null;
}

export function clampElementResistance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_ELEMENT_RESISTANCE, Math.max(MIN_ELEMENT_RESISTANCE, value));
}

export function validateAffinity(profile: CombatAffinityFields): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const id of profile.immunities ?? []) {
    if (seen.has(id)) warnings.push(`duplicate immunity: ${id}`);
    seen.add(id);
    if (typeof id !== 'string') warnings.push('invalid immunity entry');
  }
  for (const [key, value] of Object.entries(profile.resistances ?? {})) {
    if (!Number.isFinite(value)) {
      warnings.push(`invalid resistance: ${key}=${String(value)}`);
      continue;
    }
    if (value > MAX_ELEMENT_RESISTANCE || value < MIN_ELEMENT_RESISTANCE) {
      warnings.push(
        `resistance ${key}=${value} fora do clamp ${MIN_ELEMENT_RESISTANCE}…${MAX_ELEMENT_RESISTANCE} (será limitada)`,
      );
    }
  }
  return warnings;
}

export function applyElementalResistance(
  rawDamage: number | DecimalValue,
  element: DamageElement,
  target: CombatAffinityFields,
  resistanceBonus = 0,
): ElementalApplyResult {
  const raw = floorNonNeg(rawDamage);
  const base: ElementalApplyResult = {
    rawDamage: raw,
    element,
    skipped: false,
    immune: false,
    resistance: 0,
    afterResistance: raw,
    finalDamage: raw,
    tag: null,
  };

  if (raw.lte(0)) {
    return { ...base, afterResistance: d(0), finalDamage: d(0) };
  }

  if (element === DEFAULT_SKILL_ELEMENT) {
    return { ...base, skipped: true };
  }

  if ((target.immunities ?? []).includes(element)) {
    return {
      ...base,
      immune: true,
      afterResistance: d(0),
      finalDamage: d(0),
      tag: 'IMMUNE',
    };
  }

  const stored = (target.resistances as ElementResistanceMap | undefined)?.[element] ?? 0;
  const resistance = clampElementResistance(stored + resistanceBonus);
  const after = Decimal.max(d(0), raw.mul(1 - resistance).floor());
  let tag: ElementFloaterTag | null = null;
  if (resistance > 0.0001) tag = 'RESIST';
  else if (resistance < -0.0001) tag = 'WEAK';

  return {
    ...base,
    resistance,
    afterResistance: after,
    finalDamage: after,
    tag,
  };
}
