import {
  MAX_AWAKENING_LEVEL,
  clampAwakeningLevel,
  formatAwakeningRoman,
  type AwakeningReward,
  type AwakeningSkillOverride,
  type AwakeningStatPercents,
  type AwakeningTargetLevel,
} from '@/constants/character-awakening';
import { getPassiveDefinition } from '@/data/passives/registry';
import { resolveAwakeningDefinition } from '@/lib/character-awakening';
import type { AttributeId, AttributeModifiers } from '@/types/attributes';

export interface ActiveAwakeningReward {
  level: AwakeningTargetLevel;
  reward: AwakeningReward;
}

const STAT_PERCENT_TO_ATTR: Record<keyof AwakeningStatPercents, AttributeId> = {
  attackPercent: 'strength',
  hpPercent: 'hp',
  defensePercent: 'defense',
  speedPercent: 'speed',
  accuracyPercent: 'accuracy',
  criticalPercent: 'critical',
};

export function isAwakeningRewardConfigured(reward: AwakeningReward | null | undefined): boolean {
  if (!reward) return false;
  const stats = reward.stats;
  if (stats && Object.values(stats).some((value) => typeof value === 'number' && value !== 0)) {
    return true;
  }
  if (reward.passiveId) return true;
  if (reward.skillOverrides && reward.skillOverrides.length > 0) return true;
  if (reward.appearanceId || reward.skinId || reward.formId || reward.poseAnimationId) return true;
  return false;
}

export function getActiveAwakeningRewards(
  characterId: string | null | undefined,
  awakeningLevel: number,
): ActiveAwakeningReward[] {
  const def = resolveAwakeningDefinition(characterId);
  if (!def) return [];
  const current = clampAwakeningLevel(awakeningLevel);
  const active: ActiveAwakeningReward[] = [];
  for (let level = 1; level <= current && level <= MAX_AWAKENING_LEVEL; level += 1) {
    const reward = def.rewards[level as AwakeningTargetLevel];
    if (!isAwakeningRewardConfigured(reward)) continue;
    active.push({ level: level as AwakeningTargetLevel, reward });
  }
  return active;
}

export function getAwakeningStatPercents(
  characterId: string | null | undefined,
  awakeningLevel: number,
): Required<AwakeningStatPercents> {
  const totals: Required<AwakeningStatPercents> = {
    attackPercent: 0,
    hpPercent: 0,
    defensePercent: 0,
    speedPercent: 0,
    accuracyPercent: 0,
    criticalPercent: 0,
  };
  for (const row of getActiveAwakeningRewards(characterId, awakeningLevel)) {
    const stats = row.reward.stats;
    if (!stats) continue;
    for (const key of Object.keys(STAT_PERCENT_TO_ATTR) as (keyof AwakeningStatPercents)[]) {
      const value = stats[key];
      if (typeof value === 'number' && Number.isFinite(value)) totals[key] += value;
    }
  }
  return totals;
}

/** Modifiers derivados sobre (base×stars + level). Não mutam stats base. */
export function getAwakeningStatModifiers(
  progressed: Partial<Record<AttributeId, number>>,
  characterId: string | null | undefined,
  awakeningLevel: number,
): AttributeModifiers {
  const percents = getAwakeningStatPercents(characterId, awakeningLevel);
  const result: AttributeModifiers = {};
  for (const [percentKey, attr] of Object.entries(STAT_PERCENT_TO_ATTR) as [
    keyof AwakeningStatPercents,
    AttributeId,
  ][]) {
    const percent = percents[percentKey];
    if (!percent) continue;
    const base = progressed[attr] ?? 0;
    const add = base * percent;
    if (add !== 0) result[attr] = add;
  }
  return result;
}

export function getAwakeningModifiers(
  characterId: string | null | undefined,
  awakeningLevel: number,
): {
  percents: Required<AwakeningStatPercents>;
  passives: string[];
  skillOverrides: AwakeningSkillOverride[];
  appearanceId: string | null;
  skinId: string | null;
  formId: string | null;
  poseAnimationId: string | null;
} {
  const percents = getAwakeningStatPercents(characterId, awakeningLevel);
  const passives: string[] = [];
  const bySkill = new Map<string, AwakeningSkillOverride>();
  let appearanceId: string | null = null;
  let skinId: string | null = null;
  let formId: string | null = null;
  let poseAnimationId: string | null = null;

  for (const row of getActiveAwakeningRewards(characterId, awakeningLevel)) {
    const reward = row.reward;
    if (reward.passiveId && !passives.includes(reward.passiveId)) passives.push(reward.passiveId);
    if (reward.appearanceId) appearanceId = reward.appearanceId;
    if (reward.skinId) skinId = reward.skinId;
    if (reward.formId) formId = reward.formId;
    if (reward.poseAnimationId) poseAnimationId = reward.poseAnimationId;
    for (const override of reward.skillOverrides ?? []) {
      if (!override.skillId) continue;
      const prev = bySkill.get(override.skillId) ?? { skillId: override.skillId };
      bySkill.set(override.skillId, mergeSkillOverride(prev, override));
    }
  }

  return {
    percents,
    passives,
    skillOverrides: [...bySkill.values()],
    appearanceId,
    skinId,
    formId,
    poseAnimationId,
  };
}

function mergeSkillOverride(
  base: AwakeningSkillOverride,
  next: AwakeningSkillOverride,
): AwakeningSkillOverride {
  return {
    ...base,
    ...next,
    skillId: next.skillId || base.skillId,
    statusEffects: next.statusEffects ?? base.statusEffects,
  };
}

export function describeAwakeningReward(reward: AwakeningReward): string[] {
  const lines: string[] = [];
  const stats = reward.stats;
  if (stats) {
    if (stats.attackPercent) lines.push(`+${Math.round(stats.attackPercent * 100)}% Attack`);
    if (stats.hpPercent) lines.push(`+${Math.round(stats.hpPercent * 100)}% HP`);
    if (stats.defensePercent) lines.push(`+${Math.round(stats.defensePercent * 100)}% Defense`);
    if (stats.speedPercent) lines.push(`+${Math.round(stats.speedPercent * 100)}% Speed`);
    if (stats.accuracyPercent) lines.push(`+${Math.round(stats.accuracyPercent * 100)}% Accuracy`);
    if (stats.criticalPercent) lines.push(`+${Math.round(stats.criticalPercent * 100)}% Critical`);
  }
  if (reward.passiveId) {
    const passive = getPassiveDefinition(reward.passiveId);
    lines.push(`Passiva: ${passive?.name ?? reward.passiveId}`);
  }
  for (const override of reward.skillOverrides ?? []) {
    const bits = [override.skillId];
    if (override.vfxId) bits.push(`VFX ${override.vfxId}`);
    if (override.executionType) bits.push(override.executionType);
    if (override.damageMultiplier != null) bits.push(`dmg ×${override.damageMultiplier}`);
    lines.push(`Skill: ${bits.join(' · ')}`);
  }
  if (reward.formId) lines.push(`Forma: ${reward.formId}`);
  if (reward.appearanceId) lines.push(`Aparência: ${reward.appearanceId}`);
  if (reward.skinId) lines.push(`Skin: ${reward.skinId}`);
  if (reward.poseAnimationId) lines.push(`Pose: ${reward.poseAnimationId}`);
  return lines;
}

export function describeAwakeningLevelLabel(level: number): string {
  return `Despertar ${formatAwakeningRoman(level)}`;
}

export { getAwakeningReward } from '@/lib/character-awakening';
