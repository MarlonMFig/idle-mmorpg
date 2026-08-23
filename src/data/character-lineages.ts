import {
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
} from '@/data/character-packs';
import { resolveAnimeId } from '@/data/anime';
import { ANIME_TO_LINEAGE } from '@/types/anime';
import type { LineageId } from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';

/**
 * Afinidade de Linhagem do personagem → espelha a franquia (anime).
 * Default: Ninja / Naruto.
 */
const STARTER_LINEAGE: Record<StarterCharacterId, LineageId> = {
  'naruto-classic': 'ninja',
  'sasuke-classic': 'ninja',
  'rock-lee': 'ninja',
};

/** lookTypes Bleach ainda listados para referência / testes de pack. */
export const SHINIGAMI_LOOK_TYPES = new Set<number>([
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
]);

export function resolveCharacterLineageId(input: {
  lookType: number;
  starterId?: StarterCharacterId | null;
  source?: string | null;
  sourceId?: string | null;
}): LineageId {
  if (input.starterId && STARTER_LINEAGE[input.starterId]) {
    return STARTER_LINEAGE[input.starterId];
  }
  const anime = resolveAnimeId({
    lookType: input.lookType,
    source: input.source,
    sourceId: input.sourceId,
  });
  return ANIME_TO_LINEAGE[anime];
}

/** @deprecated use resolveCharacterLineageId */
export const resolveCharacterClan = resolveCharacterLineageId;

export function isLineageBonusEligible(params: {
  playerLineageId: LineageId | null;
  characterLineageId: LineageId;
}): boolean {
  if (!params.playerLineageId) return false;
  return params.playerLineageId === params.characterLineageId;
}

/** @deprecated use isLineageBonusEligible */
export const isClanBonusEligible = isLineageBonusEligible;
