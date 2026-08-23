/** Franquia (anime) usada em drops, rótulos e afinidade de conteúdo. */
export type AnimeId =
  | 'naruto'
  | 'bleach'
  | 'one-piece'
  | 'hunter'
  | 'jujutsu'
  | 'dragon-ball';

export const ANIME_IDS: readonly AnimeId[] = [
  'naruto',
  'bleach',
  'one-piece',
  'hunter',
  'jujutsu',
  'dragon-ball',
] as const;

export const ANIME_LABELS: Record<AnimeId, string> = {
  naruto: 'Naruto',
  bleach: 'Bleach',
  'one-piece': 'One Piece',
  hunter: 'Hunter × Hunter',
  jujutsu: 'Jujutsu Kaisen',
  'dragon-ball': 'Dragon Ball',
};

import type { LineageId } from '@/types/character-meta';

/** Linhagem de conta que representa cada anime (1:1). */
export const ANIME_TO_LINEAGE: Record<AnimeId, LineageId> = {
  naruto: 'ninja',
  bleach: 'shinigami',
  'one-piece': 'pirata',
  hunter: 'cacador',
  jujutsu: 'feiticeiro',
  'dragon-ball': 'guerreiro',
};

/** @deprecated use ANIME_TO_LINEAGE */
export const ANIME_TO_CLAN = ANIME_TO_LINEAGE;
