export const SKILL_VFX_TARGET_MODES = ['caster', 'travel-to-target', 'instant-target'] as const;
export type SkillVfxTargetMode = (typeof SKILL_VFX_TARGET_MODES)[number];
