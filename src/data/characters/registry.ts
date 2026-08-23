import {
  getCharacterPackById,
  getCuratedPackByLookType,
  getCuratedPackBySlug,
  isInactiveCharacterPackId,
  listCharacterPacks,
  listLookTypesForPack,
  type CharacterPack,
  type CharacterSkillAnimDef,
} from '@/data/character-packs';
import { applySharedVfxToAnim } from '@/data/vfx/apply-skill-vfx';
import { resolveCharacterLineageId } from '@/data/character-lineages';
import { getPackAnimation } from '@/data/characters/animation-slots';
import { resolveCharacterUniverse } from '@/data/characters/universes';
import { getSkill } from '@/data/skills';
import { STARTERS } from '@/data/starters';
import { CHARACTER_AWAKENING_CONFIGS } from '@/data/awakening/character-awakening-configs';
import type {
  CharacterAnimSlot,
  CharacterDefinition,
  CharacterSkillBinding,
  VfxDefinition,
} from '@/types/character-definition';
import type { SkillHitSpec } from '@/types/skill';

function toDefinition(pack: CharacterPack): CharacterDefinition {
  const lookTypes = listLookTypesForPack(pack.id);
  return {
    id: pack.id,
    universe: resolveCharacterUniverse(pack.id, lookTypes),
    lineageId: resolveCharacterLineageId({
      lookType: lookTypes[0] ?? pack.outfit?.lookType ?? 0,
      starterId: pack.id === 'naruto-classic' || pack.id === 'sasuke-classic' || pack.id === 'rock-lee'
        ? pack.id
        : null,
      sourceId: pack.id,
    }),
    lookTypes,
    active: !isInactiveCharacterPackId(pack.id),
    pack,
    skillIds: pack.hotbarSkillIds.filter((id): id is string => Boolean(id)),
    awakeningConfig: CHARACTER_AWAKENING_CONFIGS[pack.id],
  };
}

function vfxFromSkillAnim(
  packId: string,
  skillId: string,
  anim: CharacterSkillAnimDef,
): VfxDefinition | null {
  const resolved = applySharedVfxToAnim(anim, anim.vfxId ?? null);
  if (!resolved.fx) return null;
  return {
    id: resolved.vfxId ?? `${packId}:${skillId}:fx`,
    asset: resolved.fx,
    scale: resolved.fxScale,
    offsetX: resolved.fx.offsetX,
    offsetY: resolved.fx.offsetY,
    spawnPoint: resolved.fxAttach,
    durationMs: resolved.durationMs,
    independentScale: resolved.fxIndependentScale,
  };
}

function hitsForBinding(anim: CharacterSkillAnimDef | undefined, skillHits?: readonly SkillHitSpec[]): readonly SkillHitSpec[] {
  if (skillHits && skillHits.length > 0) return skillHits;
  if (anim) return [{ delayMs: anim.hitDelayMs, kind: 'instant' }];
  return [{ delayMs: 0, kind: 'instant' }];
}

/**
 * Fonte central de personagens cadastrados.
 * Combat / Equipe / Hunt / Test Mode devem consultar daqui em vez de
 * duplicar lookType, slug e preview.
 *
 * Fonte do pack (DEV): `GET /api/dev/character-config?characterId=`
 * localiza o arquivo em `src/data`. Não expor no gameplay.
 */
export const CharacterRegistry = {
  get(characterId: string): CharacterDefinition | null {
    const pack =
      getCharacterPackById(characterId) ?? getCuratedPackBySlug(characterId);
    return pack ? toDefinition(pack) : null;
  },

  getByLookType(lookType: number, options?: { includeInactive?: boolean }): CharacterDefinition | null {
    const curated = getCuratedPackByLookType(lookType);
    if (curated) return toDefinition(curated);
    if (!options?.includeInactive) return null;
    const match = listCharacterPacks({ includeInactive: true }).find((entry) =>
      listLookTypesForPack(entry.id).includes(lookType),
    );
    return match ? toDefinition(match) : null;
  },

  list(options?: { includeInactive?: boolean }): CharacterDefinition[] {
    return listCharacterPacks(options).map(toDefinition);
  },

  getPack(characterId: string): CharacterPack | null {
    return this.get(characterId)?.pack ?? null;
  },

  getAnimation(characterId: string, slot: CharacterAnimSlot) {
    const pack = this.getPack(characterId);
    return pack ? getPackAnimation(pack, slot) : null;
  },

  getSkillBinding(characterId: string, skillId: string): CharacterSkillBinding | null {
    const def = this.get(characterId);
    if (!def) return null;
    const skill = getSkill(skillId);
    if (!skill) return null;
    const animation = def.pack.skillAnims[skillId];
    return {
      skill,
      animation,
      vfx: animation ? vfxFromSkillAnim(def.id, skillId, animation) : null,
      hits: hitsForBinding(animation, skill.hits),
    };
  },

  starterIds(): readonly string[] {
    return STARTERS.map((entry) => entry.id);
  },
};

export function getCharacterDefinition(characterId: string): CharacterDefinition | null {
  return CharacterRegistry.get(characterId);
}

export function getCharacterDefinitionByLookType(
  lookType: number,
  options?: { includeInactive?: boolean },
): CharacterDefinition | null {
  return CharacterRegistry.getByLookType(lookType, options);
}
