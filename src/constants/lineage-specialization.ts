import { LINEAGE_SPECIALIZATION_UNLOCK_RANK } from '@/constants/lineage-rank-requirements';
import type {
  LineageModifierId,
  LineageRankIndex,
  LineageSpecializationLevelIndex,
  LineageSpecializationModifiers,
} from '@/types/lineage';

export { LINEAGE_SPECIALIZATION_UNLOCK_RANK };

/**
 * Orçamento de especialização (não exibido ao jogador).
 * Cada nível adiciona ~2 pontos; acumulado no IV = 8 (~+8%).
 */
export const SPECIALIZATION_POWER_BUDGET = {
  perLevel: {
    1: 2,
    2: 2,
    3: 2,
    4: 2,
  } as Record<LineageSpecializationLevelIndex, number>,
  cumulative: {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
  } as Record<LineageSpecializationLevelIndex, number>,
  maxCumulative: 8,
  epsilon: 0.08,
} as const;

/**
 * 1% Attack ≠ 1% Crit. Custo = valorFração * 100 * peso.
 */
export const SPECIALIZATION_MODIFIER_WEIGHTS: Record<LineageModifierId, number> = {
  attackPercent: 1,
  hpPercent: 1,
  defensePercent: 1,
  skillDamagePercent: 1,
  healingPercent: 1,
  accuracy: 1,
  criticalChance: 2,
  criticalDamage: 1.5,
  attackSpeedPercent: 1.5,
  cooldownReduction: 2,
  evasion: 1.5,
  statusEffectiveness: 1.5,
};

export const LINEAGE_MODIFIER_LABELS: Record<LineageModifierId, string> = {
  attackPercent: 'Attack',
  hpPercent: 'HP',
  defensePercent: 'Defense',
  skillDamagePercent: 'Skill Damage',
  criticalChance: 'Critical Chance',
  criticalDamage: 'Critical Damage',
  attackSpeedPercent: 'Attack Speed',
  cooldownReduction: 'Cooldown',
  accuracy: 'Precisão',
  evasion: 'Evasão',
  statusEffectiveness: 'Efeitos de Status',
  healingPercent: 'Cura',
};

export type LineageSpecializationRequirement =
  | { type: 'lineageRank'; value: LineageRankIndex }
  | { type: 'specializationOnlineKills'; value: number }
  | { type: 'masteryCharacters'; count: number; masteryLevel: number }
  | { type: 'starCharacters'; count: number; minStars: number };

/** Nível I é concedido na seleção. II–IV usam estes requisitos universais. */
export const LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS: Record<
  2 | 3 | 4,
  readonly LineageSpecializationRequirement[]
> = {
  2: [
    { type: 'lineageRank', value: 2 },
    { type: 'specializationOnlineKills', value: 1_000 },
    { type: 'masteryCharacters', count: 2, masteryLevel: 20 },
  ],
  3: [
    { type: 'lineageRank', value: 3 },
    { type: 'specializationOnlineKills', value: 3_000 },
    { type: 'masteryCharacters', count: 3, masteryLevel: 35 },
    { type: 'starCharacters', count: 2, minStars: 3 },
  ],
  4: [
    { type: 'lineageRank', value: 4 },
    { type: 'specializationOnlineKills', value: 7_500 },
    { type: 'masteryCharacters', count: 5, masteryLevel: 50 },
    { type: 'starCharacters', count: 3, minStars: 3 },
  ],
};

export function specializationPowerCost(modifiers: LineageSpecializationModifiers): number {
  let total = 0;
  for (const [key, raw] of Object.entries(modifiers) as [LineageModifierId, number | undefined][]) {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) continue;
    total += Math.abs(raw) * 100 * (SPECIALIZATION_MODIFIER_WEIGHTS[key] ?? 1);
  }
  return total;
}

export function emptyLineageModifiers(): Required<LineageSpecializationModifiers> {
  return {
    attackPercent: 0,
    hpPercent: 0,
    defensePercent: 0,
    skillDamagePercent: 0,
    criticalChance: 0,
    criticalDamage: 0,
    attackSpeedPercent: 0,
    cooldownReduction: 0,
    accuracy: 0,
    evasion: 0,
    statusEffectiveness: 0,
    healingPercent: 0,
  };
}

export function addLineageModifiers(
  target: LineageSpecializationModifiers,
  extra: LineageSpecializationModifiers | undefined,
): LineageSpecializationModifiers {
  if (!extra) return target;
  const next: LineageSpecializationModifiers = { ...target };
  for (const [key, raw] of Object.entries(extra) as [LineageModifierId, number | undefined][]) {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) continue;
    next[key] = (next[key] ?? 0) + raw;
  }
  return next;
}

export function formatModifierPercent(value: number): string {
  const pct = value * 100;
  const rounded = Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Math.round(pct * 100) / 100;
  const sign = value > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

export function formatSpecializationModifierLines(
  modifiers: LineageSpecializationModifiers,
): string[] {
  const lines: string[] = [];
  for (const key of Object.keys(LINEAGE_MODIFIER_LABELS) as LineageModifierId[]) {
    const value = modifiers[key];
    if (!value) continue;
    const label = LINEAGE_MODIFIER_LABELS[key];
    if (key === 'cooldownReduction') {
      lines.push(`${formatModifierPercent(value)} ${label}`);
    } else {
      lines.push(`${formatModifierPercent(value)} ${label}`);
    }
  }
  return lines;
}
