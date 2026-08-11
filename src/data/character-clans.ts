import {
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
} from '@/data/character-packs';
import { resolveAnimeId } from '@/data/anime';
import { ANIME_TO_CLAN } from '@/types/anime';
import type { CharacterClanId } from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';

/**
 * Afinidade de clã do personagem → espelha a franquia (anime).
 * Default: Ninja / Naruto.
 */
const STARTER_CLAN: Record<StarterCharacterId, CharacterClanId> = {
  'naruto-classic': 'ninja',
  'sasuke-classic': 'ninja',
  'rock-lee': 'ninja',
};

/** lookTypes Bleach ainda listados para referência / testes de pack. */
export const SHINIGAMI_LOOK_TYPES = new Set<number>([
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
]);

export function resolveCharacterClan(input: {
  lookType: number;
  starterId?: StarterCharacterId | null;
  source?: string | null;
  sourceId?: string | null;
}): CharacterClanId {
  if (input.starterId && STARTER_CLAN[input.starterId]) {
    return STARTER_CLAN[input.starterId];
  }
  const anime = resolveAnimeId({
    lookType: input.lookType,
    source: input.source,
    sourceId: input.sourceId,
  });
  return ANIME_TO_CLAN[anime];
}

export function isClanBonusEligible(params: {
  playerClanId: CharacterClanId | null;
  characterClanId: CharacterClanId;
}): boolean {
  if (!params.playerClanId) return false;
  return params.playerClanId === params.characterClanId;
}
