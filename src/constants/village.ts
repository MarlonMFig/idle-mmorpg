import type { VillageId, VillageStanding } from '@/types/village';

/** Pontos de vila por kill de monstro. */
export const VILLAGE_SCORE_PER_KILL = 2;

/** Multiplicador: XP de missão → pontos de vila. */
export const VILLAGE_SCORE_FROM_QUEST_XP = 0.5;

/** Duração padrão de uma guerra (preparado para o futuro). */
export const VILLAGE_WAR_DURATION_MS = 30 * 60 * 1000;

/** Standings iniciais (seed) — ranking vivo antes do jogador entrar. */
export const VILLAGE_SEED_STANDINGS: Record<VillageId, Omit<VillageStanding, 'villageId'>> = {
  konoha: { score: 1280, playerCount: 52 },
  suna: { score: 1110, playerCount: 41 },
  kiri: { score: 980, playerCount: 37 },
  kumo: { score: 1040, playerCount: 39 },
  iwa: { score: 920, playerCount: 34 },
};
