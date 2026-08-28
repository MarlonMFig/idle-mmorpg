import type { CharacterSkillAnimDef } from '@/data/character-packs';
import { applySharedVfxToAnim } from '@/data/vfx/apply-skill-vfx';
import { isSkillExecutionType } from '@/data/skill-execution-def';
import { isDamageElement, type DamageElement } from '@/data/damage-elements';
import { getSkill } from '@/data/skills';
import { getAwakeningModifiers } from '@/lib/awakening-rewards';
import {
  resolveAwakeningRuntime,
  type AwakeningRuntimeContext,
} from '@/lib/awakening-runtime';
import { getActiveLineageSpecializationModifiers } from '@/lib/lineage-specialization-modifiers';
import type { SkillDefinition } from '@/types/skill';
import type { AwakeningSkillOverride } from '@/constants/character-awakening';

export function getSkillOverrideFor(
  skillId: string,
  context?: AwakeningRuntimeContext,
): AwakeningSkillOverride | null {
  const runtime = context ?? resolveAwakeningRuntime();
  return (
    getAwakeningModifiers(runtime.characterId, runtime.awakeningLevel).skillOverrides.find(
      (row) => row.skillId === skillId,
    ) ?? null
  );
}

/**
 * Skill base + overrides de Despertar. Não muta o catálogo.
 */
export function resolveEffectiveSkill(
  skillId: string | null | undefined,
  context?: AwakeningRuntimeContext,
): SkillDefinition | undefined {
  if (!skillId) return undefined;
  const base = getSkill(skillId);
  if (!base) return undefined;
  const runtime = context ?? resolveAwakeningRuntime();
  const override = getSkillOverrideFor(skillId, runtime);
  const lineageMods = getActiveLineageSpecializationModifiers(runtime.characterId);
  if (!override && !lineageMods.skillDamagePercent && !lineageMods.cooldownReduction && !lineageMods.healingPercent && !lineageMods.statusEffectiveness) {
    return base;
  }

  const next: SkillDefinition = { ...base };
  const damageMul =
    (typeof override?.damageMultiplier === 'number' && Number.isFinite(override.damageMultiplier)
      ? override.damageMultiplier
      : 1) * (1 + (lineageMods.skillDamagePercent ?? 0));
  if (damageMul !== 1) {
    next.damage = Math.max(0, Math.floor(base.damage * damageMul));
  }
  let cooldownMs = base.cooldownMs;
  if (typeof override?.cooldownMs === 'number' && Number.isFinite(override.cooldownMs)) {
    cooldownMs = override.cooldownMs;
  }
  if (lineageMods.cooldownReduction) {
    cooldownMs = Math.max(0, Math.floor(cooldownMs * (1 - lineageMods.cooldownReduction)));
  }
  next.cooldownMs = cooldownMs;
  if (lineageMods.healingPercent && typeof base.healPercent === 'number') {
    next.healPercent = base.healPercent * (1 + lineageMods.healingPercent);
  }
  if (override?.element && isDamageElement(override.element)) {
    next.element = override.element as DamageElement;
  }
  if (override?.executionType && isSkillExecutionType(override.executionType)) {
    next.execution = { ...(base.execution ?? {}), type: override.executionType };
  }
  const statusEffects = [
    ...(base.statusEffects ?? []),
    ...((override?.statusEffects as NonNullable<SkillDefinition['statusEffects']>) ?? []),
  ];
  if (statusEffects.length > 0) {
    const bonus = lineageMods.statusEffectiveness ?? 0;
    next.statusEffects = bonus
      ? statusEffects.map((row) => ({
          ...row,
          chance: Math.min(1, row.chance * (1 + bonus)),
        }))
      : statusEffects;
  }
  return next;
}

/** Aplica overrides de papel definidos no pack (ex.: skill de buff). */
export function resolveSkillWithAnim(
  skill: SkillDefinition,
  anim: CharacterSkillAnimDef | undefined,
): SkillDefinition {
  return anim?.effect ? { ...skill, effect: anim.effect } : skill;
}

/**
 * Anim/VFX efetivos: pack base + override de Despertar.
 */
export function resolveEffectiveSkillAnim(
  anim: CharacterSkillAnimDef | undefined,
  skillId: string,
  context?: AwakeningRuntimeContext,
): CharacterSkillAnimDef | undefined {
  if (!anim) return undefined;
  const override = getSkillOverrideFor(skillId, context);
  if (!override) return applySharedVfxToAnim(anim, anim.vfxId ?? null);

  const withPose: CharacterSkillAnimDef = override.poseAnimationId
    ? {
        ...anim,
        cast: { ...(anim.cast ?? {}), animationId: override.poseAnimationId },
      }
    : { ...anim };

  if (override.executionType && isSkillExecutionType(override.executionType)) {
    withPose.execution = { ...(withPose.execution ?? {}), type: override.executionType };
  }

  const vfxId = override.vfxId ?? withPose.vfxId ?? null;
  return applySharedVfxToAnim(withPose, vfxId);
}
