import {
  addLineageModifiers,
  emptyLineageModifiers,
} from '@/constants/lineage-specialization';
import { getCharacterDefinition } from '@/data/characters';
import { getLineageDefinition } from '@/data/lineages/registry';
import { isCharacterCompatibleWithLineage } from '@/lib/lineage-compatibility';
import { getActiveLineageProgress, getLineageIdProgress } from '@/lib/lineage-progress';
import { resolveLineageRuntime } from '@/lib/lineage-runtime';
import type { CharacterDefinition } from '@/types/character-definition';
import type { LineageId } from '@/types/character-meta';
import type {
  LineageIdProgress,
  LineageSpecializationDefinition,
  LineageSpecializationModifiers,
  PlayerLineageProgress,
} from '@/types/lineage';
import type { SealedCharacter } from '@/types/team';
import type { AttributeId, AttributeModifiers } from '@/types/attributes';

const ATTR_PERCENT: Partial<Record<keyof LineageSpecializationModifiers, AttributeId>> = {
  attackPercent: 'strength',
  hpPercent: 'hp',
  defensePercent: 'defense',
  accuracy: 'accuracy',
  criticalChance: 'critical',
  evasion: 'speed',
};

export function sumSpecializationLevelModifiers(
  spec: LineageSpecializationDefinition,
  level: number,
): LineageSpecializationModifiers {
  let total: LineageSpecializationModifiers = {};
  for (const row of spec.levels) {
    if (row.level > level) continue;
    total = addLineageModifiers(total, row.modifiers);
  }
  return total;
}

export function getLineageSpecializationModifiers(
  playerLineageProgress: PlayerLineageProgress,
  character:
    | Pick<CharacterDefinition, 'lineageId'>
    | Pick<SealedCharacter, 'characterId' | 'lineageId' | 'clanId' | 'lookType' | 'starterId' | 'sourceId'>
    | string
    | null
    | undefined,
  lineageIdOverride?: LineageId | null,
): LineageSpecializationModifiers {
  const lineageId = lineageIdOverride ?? playerLineageProgress.lineageId;
  if (!lineageId) return {};
  const definition = getLineageDefinition(lineageId);
  if (!definition) return {};

  let compatibleChar:
    | Pick<CharacterDefinition, 'lineageId'>
    | Pick<SealedCharacter, 'characterId' | 'lineageId' | 'clanId' | 'lookType' | 'starterId' | 'sourceId'>
    | null = null;
  if (typeof character === 'string') {
    compatibleChar = getCharacterDefinition(character) ?? null;
  } else {
    compatibleChar = character ?? null;
  }
  if (!compatibleChar || !isCharacterCompatibleWithLineage(compatibleChar, lineageId)) {
    return {};
  }

  const idProgress: LineageIdProgress = getLineageIdProgress(playerLineageProgress, lineageId);
  const selected = idProgress.selectedSpecializationId;
  if (!selected) return {};
  const spec = definition.specializations.find((row) => row.id === selected);
  if (!spec) return {};
  const level = idProgress.specializationProgress[selected]?.level ?? idProgress.specializationLevel;
  if (level <= 0) return {};
  return sumSpecializationLevelModifiers(spec, level);
}

export function getActiveLineageSpecializationModifiers(
  characterId: string | null | undefined,
): LineageSpecializationModifiers {
  try {
    const runtime = resolveLineageRuntime();
    return getLineageSpecializationModifiers(runtime.progress, characterId ?? null, runtime.active.lineageId);
  } catch {
    return {};
  }
}

export function lineageModifiersToAttributeModifiers(
  progressed: Partial<Record<AttributeId, number>>,
  mods: LineageSpecializationModifiers,
): AttributeModifiers {
  const result: AttributeModifiers = {};
  for (const [key, attr] of Object.entries(ATTR_PERCENT) as [
    keyof typeof ATTR_PERCENT,
    AttributeId,
  ][]) {
    const percent = mods[key];
    if (!percent) continue;
    const add = (progressed[attr] ?? 0) * percent;
    if (add !== 0) result[attr] = (result[attr] ?? 0) + add;
  }
  return result;
}

export function getLineageSpecializationStatModifiers(
  progressed: Partial<Record<AttributeId, number>>,
  characterId: string | null | undefined,
  explicit?: LineageSpecializationModifiers,
): AttributeModifiers {
  const mods = explicit ?? getActiveLineageSpecializationModifiers(characterId);
  return lineageModifiersToAttributeModifiers(progressed, mods);
}

export function filledLineageModifiers(
  mods: LineageSpecializationModifiers,
): Required<LineageSpecializationModifiers> {
  return { ...emptyLineageModifiers(), ...mods };
}

export function getActiveLineageIdProgressSafe(): LineageIdProgress | null {
  try {
    const runtime = resolveLineageRuntime();
    if (!runtime.active.lineageId) return null;
    return getActiveLineageProgress(runtime.progress);
  } catch {
    return null;
  }
}
