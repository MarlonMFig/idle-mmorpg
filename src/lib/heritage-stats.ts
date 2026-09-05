import {
  getHeritageOption,
  getHeritageOptionModifiersAtLevel,
  HERITAGE_GATES,
  HERITAGE_OPTION_MAX_LEVEL,
  HERITAGE_SLOTS,
  clampHeritageOptionLevel,
  type HeritageSlotId,
} from '@/constants/heritage-system';
import {
  applyHeritageToAttributeValues,
  formatStatDelta,
  getLoadoutOptionLevel,
  resolveHeritageModifiers,
  type HeritageResolvedModifiers,
} from '@/lib/heritage-modifiers';
import type { HeritageLoadout } from '@/types/heritage';
import type { AttributeValues } from '@/types/attributes';
import type { SealedCharacter } from '@/types/team';
import { computeInstanceTotals } from '@/lib/character-instance-stats';

export interface HeritageStatsInput {
  loadout: HeritageLoadout;
  /** Totals antes da Herança (já com stars/level/quality/lineage/buffs). */
  baselineTotals: AttributeValues;
  senninActive?: boolean;
}

export interface HeritageFinalStats {
  baseline: AttributeValues;
  final: AttributeValues;
  resolved: HeritageResolvedModifiers;
  previewLines: string[];
}

function optionFor(slot: HeritageSlotId, id: string | null) {
  const option = id ? getHeritageOption(slot, id) : null;
  return option && 'levels' in option ? option : null;
}

export function buildHeritageFinalStats(input: HeritageStatsInput): HeritageFinalStats {
  const cla = optionFor('cla', input.loadout.claId);
  const summon = optionFor('summon', input.loadout.summonId);
  const cursedSeal = optionFor('cursedSeal', input.loadout.cursedSealId);
  const sennin = optionFor('sennin', input.loadout.senninId);
  const resolved = resolveHeritageModifiers({
    loadout: input.loadout,
    cla,
    summon,
    cursedSeal,
    sennin,
    senninActive: Boolean(input.senninActive),
  });
  const final = applyHeritageToAttributeValues(input.baselineTotals, resolved);
  // Ataque consolidado primeiro (todas as penalidades de clã/selo/etc.).
  const previewLines = [
    `Atk ${formatStatDelta(input.baselineTotals.strength, final.strength)}`,
    `Def ${formatStatDelta(input.baselineTotals.defense, final.defense)}`,
    `HP ${formatStatDelta(input.baselineTotals.hp, final.hp)}`,
    `Crít ${formatStatDelta(input.baselineTotals.critical, final.critical, 1)}`,
  ];
  if (resolved.combat.attackSpeedPercent !== 0) {
    const before = 100;
    const after = 100 * (1 + resolved.combat.attackSpeedPercent);
    previewLines.push(`Vel. atq ${formatStatDelta(before, after)}%`);
  }
  return {
    baseline: input.baselineTotals,
    final,
    resolved,
    previewLines,
  };
}

/** Preview com loadout hipotético sobre o personagem ativo/selecionado. */
export function previewHeritageForCharacter(
  character: Pick<
    SealedCharacter,
    'level' | 'stars' | 'quality' | 'qualityStatMultiplier' | 'characterId' | 'potential'
  >,
  loadout: HeritageLoadout,
  senninActive = false,
): HeritageFinalStats {
  const baseline = computeInstanceTotals(character);
  return buildHeritageFinalStats({ loadout, baselineTotals: baseline, senninActive });
}

export function isHeritageSlotUnlocked(slot: HeritageSlotId, rank: number): boolean {
  return rank >= HERITAGE_SLOTS[slot].requiredRank;
}

export function isHeritageGateLevelValid(level: number): boolean {
  return Number.isInteger(level) && level >= 0 && level <= HERITAGE_GATES.length;
}

export function clampOpenGateLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(HERITAGE_GATES.length, Math.floor(level)));
}

export function getOptionLevelFromLoadout(loadout: HeritageLoadout, optionId: string): number {
  return getLoadoutOptionLevel(loadout, optionId);
}

export function getOptionCurrentAndNextModifiers(loadout: HeritageLoadout, optionId: string) {
  const option = getHeritageOption(
    (Object.keys(HERITAGE_SLOTS) as HeritageSlotId[]).find((slot) =>
      HERITAGE_SLOTS[slot].options.some((row) => row.id === optionId),
    ) ?? 'cla',
    optionId,
  );
  if (!option || !('levels' in option)) return null;
  const level = getLoadoutOptionLevel(loadout, optionId);
  const maxLevel = option.levels.length;
  const current = getHeritageOptionModifiersAtLevel(option, level);
  const next =
    level < maxLevel ? getHeritageOptionModifiersAtLevel(option, level + 1) : null;
  return { option, level, maxLevel, current, next };
}

export { clampHeritageOptionLevel, HERITAGE_OPTION_MAX_LEVEL };
