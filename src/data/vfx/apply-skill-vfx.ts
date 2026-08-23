import type { CharacterSkillAnimDef } from '@/data/character-packs';
import { getVfxDefinition, sharedVfxToSheet } from './registry';

export interface SkillVfxOverlay {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Resolve o FX da skill: catálogo (`vfxId`) tem prioridade sobre `fx` inline.
 * Offsets/scale do argumento são override da Skill (lab ou pack), não da definição.
 */
export function applySharedVfxToAnim(
  anim: CharacterSkillAnimDef,
  vfxId: string | null | undefined,
  overlay?: SkillVfxOverlay,
): CharacterSkillAnimDef {
  const id = vfxId === undefined ? anim.vfxId ?? null : vfxId;
  const catalog = id ? getVfxDefinition(id) : null;
  const fx = anim.fx ? { ...anim.fx } : anim.fx;
  if (!catalog) {
    return {
      ...anim,
      vfxId: id ?? undefined,
      fxScale: overlay?.scale ?? anim.fxScale,
      fx: fx
        ? {
            ...fx,
            offsetX: overlay?.offsetX ?? fx.offsetX,
            offsetY: overlay?.offsetY ?? fx.offsetY,
          }
        : fx,
    };
  }

  const sheet = sharedVfxToSheet(catalog);
  return {
    ...anim,
    vfxId: catalog.id,
    fxScale: overlay?.scale ?? anim.fxScale ?? catalog.defaultScale,
    fx: {
      ...sheet,
      offsetX: overlay?.offsetX ?? anim.vfxOffsetX ?? catalog.defaultOffsetX,
      offsetY: overlay?.offsetY ?? anim.vfxOffsetY ?? catalog.defaultOffsetY,
    },
  };
}
