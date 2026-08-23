import { AWAKENING_SKILL_OVERRIDE_KEYS, MAX_AWAKENING_LEVEL } from '@/constants/character-awakening';
import { CHARACTER_AWAKENING_CONFIGS } from '@/data/awakening/character-awakening-configs';
import { getCharacterDefinition } from '@/data/characters';
import { getPassiveDefinition } from '@/data/passives/registry';
import { getSkill } from '@/data/skills';
import { getVfxDefinition } from '@/data/vfx/registry';
import { CHARACTER_ANIM_SLOTS } from '@/types/character-definition';
import { isSkillExecutionType } from '@/data/skill-execution-def';
import { isDamageElement } from '@/data/damage-elements';
import type { AwakeningReward, AwakeningSkillOverride } from '@/constants/character-awakening';

const SLOT_SET = new Set([1, 2, 3, 4]);
const ALLOWED_OVERRIDE = new Set<string>(AWAKENING_SKILL_OVERRIDE_KEYS);

export function validateSkillOverride(
  override: AwakeningSkillOverride,
  characterId?: string | null,
): string[] {
  const warnings: string[] = [];
  for (const key of Object.keys(override)) {
    if (!ALLOWED_OVERRIDE.has(key)) warnings.push(`override campo inválido: ${key}`);
  }
  if (!override.skillId) warnings.push('skillOverride sem skillId');
  else if (!getSkill(override.skillId)) warnings.push(`skillId inexistente: ${override.skillId}`);
  if (override.slot != null && !SLOT_SET.has(override.slot)) {
    warnings.push(`slot inválido: ${override.slot}`);
  }
  if (override.vfxId && !getVfxDefinition(override.vfxId)) {
    warnings.push(`vfxId inexistente: ${override.vfxId}`);
  }
  if (override.poseAnimationId) {
    const known = (CHARACTER_ANIM_SLOTS as readonly string[]).includes(override.poseAnimationId);
    const packHas = characterId
      ? Boolean(getCharacterDefinition(characterId)?.pack.skillAnims[override.poseAnimationId])
      : false;
    if (!known && !packHas) warnings.push(`animationId inexistente: ${override.poseAnimationId}`);
  }
  if (override.executionType && !isSkillExecutionType(override.executionType)) {
    warnings.push(`executionType inválido: ${override.executionType}`);
  }
  if (override.element && !isDamageElement(override.element)) {
    warnings.push(`element inválido: ${override.element}`);
  }
  if (override.damageMultiplier != null && !(override.damageMultiplier > 0)) {
    warnings.push(`damageMultiplier inválido: ${override.damageMultiplier}`);
  }
  return warnings;
}

export function validateAwakeningReward(reward: AwakeningReward, characterId?: string | null): string[] {
  const warnings: string[] = [];
  if (reward.passiveId && !getPassiveDefinition(reward.passiveId)) {
    warnings.push(`passiveId inexistente: ${reward.passiveId}`);
  }
  for (const override of reward.skillOverrides ?? []) {
    warnings.push(...validateSkillOverride(override, characterId));
  }
  return warnings;
}

export function validateAwakeningConfigs(): string[] {
  const warnings: string[] = [];
  for (const [characterId, config] of Object.entries(CHARACTER_AWAKENING_CONFIGS)) {
    for (const rawLevel of Object.keys(config.rewards ?? {})) {
      const level = Number(rawLevel);
      if (!Number.isInteger(level) || level < 1 || level > MAX_AWAKENING_LEVEL) {
        warnings.push(`${characterId}: Awakening ${rawLevel} acima do máximo`);
        continue;
      }
      const reward = config.rewards?.[level as 1 | 2 | 3];
      if (reward) warnings.push(...validateAwakeningReward(reward, characterId).map((row) => `${characterId} ${level}: ${row}`));
    }
  }
  return warnings;
}
