/** Qualidade de instância / spawn (D–SSS). Não é identidade do CharacterDefinition. */
export type CharacterQuality = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

/** Componentes de potencial (ids do módulo de raridade). */
export type CharacterPotential = {
  hp: number;
  forca: number;
  defesa: number;
};

/** Grau derivado do potencial — nunca sorteado. */
export type CharacterGrade = 'bruto' | 'lapidado' | 'fino' | 'excelente' | 'perfeito';

/** Linhagem / afinidade de universo do personagem. */
export type LineageId =
  | 'ninja'
  | 'shinigami'
  | 'pirata'
  | 'cacador'
  | 'feiticeiro'
  | 'guerreiro';

/** @deprecated Renomeado para LineageId (Item 20 — Linhagem). */
export type CharacterClanId = LineageId;

/** Estrelas 0–5; o teto efetivo vem de getMaxStarsForRarity. */
export type CharacterStars = 0 | 1 | 2 | 3 | 4 | 5;

export const CHARACTER_QUALITIES: readonly CharacterQuality[] = [
  'D',
  'C',
  'B',
  'A',
  'S',
  'SS',
  'SSS',
] as const;

export const LINEAGE_IDS: readonly LineageId[] = [
  'ninja',
  'shinigami',
  'pirata',
  'cacador',
  'feiticeiro',
  'guerreiro',
] as const;

/** @deprecated use LINEAGE_IDS */
export const CHARACTER_CLAN_IDS: readonly LineageId[] = LINEAGE_IDS;
