import type { LineageRankIndex, LineageSpecializationModifiers } from '@/types/lineage';

/**
 * Requisitos universais de promoção (Item 21).
 * Rank II, III e IV — mesmos valores para TODAS as Linhagens.
 * Rank I é automático ao escolher Linhagem.
 */

/**
 * Bônus cumulativos por graduação (total no rank atual).
 * Universais para todas as Linhagens; personagens incompatíveis não recebem.
 */
export const LINEAGE_RANK_MODIFIERS: Record<LineageRankIndex, LineageSpecializationModifiers> = {
  1: { attackPercent: 0.01, hpPercent: 0.01 },
  2: { attackPercent: 0.02, hpPercent: 0.02, defensePercent: 0.01 },
  3: {
    attackPercent: 0.03,
    hpPercent: 0.03,
    defensePercent: 0.02,
    skillDamagePercent: 0.015,
  },
  4: {
    attackPercent: 0.04,
    hpPercent: 0.04,
    defensePercent: 0.03,
    skillDamagePercent: 0.025,
    criticalChance: 0.01,
  },
};

export type LineageRankRequirement =
  | { type: 'playerLevel'; value: number }
  | { type: 'onlineKills'; value: number }
  | { type: 'uniqueLineageCharacters'; value: number }
  | { type: 'masteryCharacters'; count: number; masteryLevel: number }
  | { type: 'starCharacters'; count: number; minStars: number }
  /** Preparado — Hunt System. Não usado nos requisitos iniciais. */
  | { type: 'huntsCompleted'; value: number; huntIds?: readonly string[] };

export type LineageRankRequirements = Record<
  Exclude<LineageRankIndex, 1>,
  readonly LineageRankRequirement[]
>;

/** Promoção para Rank II, III e IV. */
export const LINEAGE_RANK_REQUIREMENTS: LineageRankRequirements = {
  2: [
    { type: 'playerLevel', value: 20 },
    { type: 'onlineKills', value: 500 },
    { type: 'uniqueLineageCharacters', value: 3 },
    { type: 'masteryCharacters', count: 1, masteryLevel: 10 },
  ],
  3: [
    { type: 'playerLevel', value: 40 },
    { type: 'onlineKills', value: 2_500 },
    { type: 'uniqueLineageCharacters', value: 6 },
    { type: 'masteryCharacters', count: 3, masteryLevel: 25 },
    { type: 'starCharacters', count: 2, minStars: 2 },
  ],
  4: [
    { type: 'playerLevel', value: 70 },
    { type: 'onlineKills', value: 10_000 },
    { type: 'uniqueLineageCharacters', value: 10 },
    { type: 'masteryCharacters', count: 5, masteryLevel: 50 },
    { type: 'starCharacters', count: 3, minStars: 3 },
  ],
};

/** Títulos temáticos de promoção (UI). Chave: lineageId → rank alvo. */
export const LINEAGE_RANK_PROMOTION_TITLES: Record<
  string,
  Partial<Record<LineageRankIndex, string>>
> = {
  ninja: { 2: 'EXAME CHUNIN', 3: 'EXAME JONIN', 4: 'TÍTULO KAGE' },
  shinigami: { 2: 'PROMOÇÃO DE OFICIAL', 3: 'PROMOÇÃO DE TENENTE', 4: 'PROMOÇÃO DE CAPITÃO' },
  pirata: { 2: 'SUPERNOVA', 3: 'COMANDANTE', 4: 'IMPERADOR DOS MARES' },
  cacador: { 2: 'CAÇADOR EXPERIENTE', 3: 'CAÇADOR DE ELITE', 4: 'CAÇADOR LENDÁRIO' },
  feiticeiro: { 2: 'GRAU 2', 3: 'GRAU 1', 4: 'GRAU ESPECIAL' },
  guerreiro: { 2: 'GUERREIRO DE ELITE', 3: 'MESTRE GUERREIRO', 4: 'GUERREIRO LENDÁRIO' },
};

/** Especialização desbloqueia no Rank II (Item 22). */
export const LINEAGE_SPECIALIZATION_UNLOCK_RANK: LineageRankIndex = 2;
