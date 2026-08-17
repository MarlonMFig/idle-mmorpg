/** Qualidade natural imutável (rank de personagem). */
export type CharacterQuality = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

/** Clãs de conta do jogador. */
export type CharacterClanId =
  | 'ninja'
  | 'shinigami'
  | 'pirata'
  | 'cacador'
  | 'feiticeiro'
  | 'guerreiro';

/** Estrelas 0–8 (teto depende da qualidade). */
export type CharacterStars = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const CHARACTER_QUALITIES: readonly CharacterQuality[] = [
  'D',
  'C',
  'B',
  'A',
  'S',
  'SS',
  'SSS',
] as const;

export const CHARACTER_CLAN_IDS: readonly CharacterClanId[] = [
  'ninja',
  'shinigami',
  'pirata',
  'cacador',
  'feiticeiro',
  'guerreiro',
] as const;
