import type { CharacterSkillAnimDef } from '@/data/character-packs';
import { getSkill } from '@/data/skills';
import { applySharedVfxToAnim } from '@/data/vfx/apply-skill-vfx';
import { getActiveLineageSpecializationModifiers } from '@/lib/lineage-specialization-modifiers';
import type { SkillDefinition } from '@/types/skill';

/**
 * Skill base + modificadores ativos. Não muta o catálogo.
 */
export function resolveEffectiveSkill(
  skillId: string | null | undefined,
  characterId?: string | null,
): SkillDefinition | undefined {
  if (!skillId) return undefined;
  const base = getSkill(skillId);
  if (!base) return undefined;
  const lineageMods = getActiveLineageSpecializationModifiers(characterId ?? null);
  if (
    !lineageMods.skillDamagePercent &&
    !lineageMods.cooldownReduction &&
    !lineageMods.healingPercent &&
    !lineageMods.statusEffectiveness
  ) {
    return base;
  }

  const next: SkillDefinition = { ...base };
  const damageMul = 1 + (lineageMods.skillDamagePercent ?? 0);
  if (damageMul !== 1) {
    next.damage = Math.max(0, Math.floor(base.damage * damageMul));
  }
  let cooldownMs = base.cooldownMs;
  if (lineageMods.cooldownReduction) {
    cooldownMs = Math.max(0, Math.floor(cooldownMs * (1 - lineageMods.cooldownReduction)));
  }
  next.cooldownMs = cooldownMs;
  if (lineageMods.healingPercent && typeof base.healPercent === 'number') {
    next.healPercent = base.healPercent * (1 + lineageMods.healingPercent);
  }
  const statusEffects = [...(base.statusEffects ?? [])];
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

export function resolveEffectiveSkillAnim(
  anim: CharacterSkillAnimDef | undefined,
  skillId: string,
): CharacterSkillAnimDef | undefined {
  void skillId;
  if (!anim) return undefined;
  return applySharedVfxToAnim(anim, anim.vfxId ?? null);
}
