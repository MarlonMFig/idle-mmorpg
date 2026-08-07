import {
  getCharacterPack,
  getCuratedPackByLookType,
  getCuratedPackBySlug,
  type CharacterPack,
  type SpriteSheetDef,
} from '@/data/character-packs';
import {
  resolveHotbarSkillIds,
  resolveWonsrCharacterSlug,
} from '@/data/character-skills';
import {
  type WonsrDirection,
  type WonsrSpriteIndex,
} from '@/data/wonsr-sprites';
import type { SealedCharacter } from '@/types/team';

const DEFAULT_CONTENT = { x: 1, y: 29, width: 30, height: 35 };
const DEFAULT_DIRECTIONS: readonly WonsrDirection[] = ['north', 'east', 'south', 'west'];

function outfitSheet(
  lookType: number,
  content: { x: number; y: number; width: number; height: number },
): SpriteSheetDef {
  return {
    key: `wonsr-outfits-${lookType}`,
    url: `/sprites/wonsr/outfits/${lookType}.png`,
    frameWidth: 32,
    frameHeight: 64,
    frameCount: 12,
    contentHeight: content.height,
  };
}

/**
 * Monta um pack dinâmico a partir do lookType (capturados).
 * Starters curados continuam em `getCharacterPack`.
 */
export function buildPackFromLookType(
  member: SealedCharacter,
  spriteIndex?: WonsrSpriteIndex | null,
): CharacterPack {
  const sheet = spriteIndex?.groups.outfits[String(member.lookType)];
  const content = sheet?.content ?? DEFAULT_CONTENT;
  const directions = sheet?.directions ?? DEFAULT_DIRECTIONS;
  const phases = sheet?.phases ?? 3;
  const walk = outfitSheet(member.lookType, content);
  const hotbarSkillIds = resolveHotbarSkillIds(member);

  return {
    id: member.id,
    walk,
    attack: walk,
    outfit: {
      lookType: member.lookType,
      phases,
      directions,
      content,
    },
    skillAnims: {},
    hotbarSkillIds,
  };
}

/** Pack lateral curado (Shikamaru, …) — hotbar e skillAnims do pack. */
function buildCuratedSealedPack(
  base: CharacterPack,
  member: SealedCharacter,
): CharacterPack {
  return {
    ...base,
    id: member.id,
  };
}

/** Resolve o pack visual/habilidades do membro ativo (ou fallback starter). */
export function resolveCharacterPack(
  member: SealedCharacter | null,
  fallbackStarterId: string,
  spriteIndex?: WonsrSpriteIndex | null,
): CharacterPack {
  if (!member) {
    return getCharacterPack(
      fallbackStarterId as 'naruto-classic' | 'sasuke-classic' | 'rock-lee',
    );
  }

  if (member.starterId) {
    return getCharacterPack(member.starterId);
  }

  const byLook = getCuratedPackByLookType(member.lookType);
  if (byLook) return buildCuratedSealedPack(byLook, member);

  const bySlug = getCuratedPackBySlug(resolveWonsrCharacterSlug(member));
  if (bySlug) return buildCuratedSealedPack(bySlug, member);

  return buildPackFromLookType(member, spriteIndex);
}
