/**
 * Sistema de Ranking (Item 27).
 * ALL-TIME. Sem Seasons / Guild / Event rewards neste item.
 * Posição NÃO é salva no Player Save — vem da consulta ao provider.
 */

import type { LineageId } from '@/types/character-meta';
import type { BossRankingMode } from '@/types/boss';

export const RANKING_TOP_LIMIT = 100;

export const RANKING_CATEGORY_IDS = [
  'general',
  'level',
  'power',
  'mastery',
  'collection',
  'kills',
  'lineage',
  'boss',
] as const;

export type RankingCategoryId = (typeof RANKING_CATEGORY_IDS)[number];

export type RankingSortDirection = 'asc' | 'desc';

export type RankingMetricId =
  | 'accountPower'
  | 'playerLevel'
  | 'totalMastery'
  | 'uniqueCharacters'
  | 'onlineKills'
  | 'lineageComposite'
  | 'bossBest';

export type RankingTieBreakerId =
  | 'totalXp'
  | 'playerLevel'
  | 'onlineKills'
  | 'uniqueCharacters'
  | 'collectionRarityScore'
  | 'accountPower'
  | 'lineageRank'
  | 'specializationLevel'
  | 'lineageOnlineKills'
  | 'bossTimeMs'
  | 'bossDamage'
  | 'nickname';

export interface RankingCategoryDefinition {
  id: RankingCategoryId;
  name: string;
  metric: RankingMetricId;
  sortDirection: RankingSortDirection;
  tieBreakers: readonly RankingTieBreakerId[];
  /** Formatação do valor principal. */
  formatter: 'level' | 'number' | 'power' | 'mastery' | 'collection' | 'kills' | 'lineage' | 'bossTime' | 'bossDamage';
}

/** Snapshot público mínimo — sem inventário / save completo. */
export interface RankingPlayerProfile {
  playerId: string;
  nickname: string;
  playerLevel: number;
  /** XP no nível atual (desempate Level). */
  levelXp: number;
  /** XP total acumulada (desempate Level). */
  totalXp: number;
  /** Power provisório DEV — ver ranking-metrics. */
  accountPower: number;
  accountPowerProvisional: boolean;
  totalMastery: number;
  uniqueCharacters: number;
  collectionRarityScore: number;
  onlineKills: number;
  lineageId: LineageId | null;
  lineageRank: number;
  specializationId: string | null;
  specializationLevel: number;
  lineageOnlineKills: number;
  equippedTitleId: string | null;
  /** Melhores resultados por bossId. */
  bossBest: Record<string, { bestTimeMs: number | null; bestDamage: number; victory: boolean }>;
}

export interface RankingEntry {
  playerId: string;
  nickname: string;
  value: number;
  rank: number;
  titleId: string | null;
  lineageId: LineageId | null;
  metadata: {
    playerLevel?: number;
    specializationLevel?: number;
    lineageRank?: number;
    bossId?: string;
    bossTimeMs?: number | null;
    bossDamage?: number;
    valueLabel?: string;
  };
}

export interface RankingQuery {
  categoryId: RankingCategoryId;
  lineageFilter?: LineageId | 'all';
  bossId?: string | null;
  /** Página 0-based. */
  page?: number;
  pageSize?: number;
}

export interface RankingBoardResult {
  categoryId: RankingCategoryId;
  entries: RankingEntry[];
  totalEntries: number;
  page: number;
  pageSize: number;
  myRank: number | null;
  myEntry: RankingEntry | null;
  refreshedAt: number;
  queryMs: number;
  empty: boolean;
}

export interface RankingProvider {
  readonly id: string;
  getLeaderboard(query: RankingQuery): Promise<RankingBoardResult>;
  getPlayerRank(query: RankingQuery, playerId: string): Promise<number | null>;
  /** Atualiza/insere o snapshot do jogador local no provider. */
  submitScore(profile: RankingPlayerProfile): Promise<void>;
  /** DEV: popula mocks. */
  seedMocks?(count: number): Promise<void>;
  clearMocks?(): Promise<void>;
  /** Força falha (DEV). */
  setForceFail?(fail: boolean): void;
}

export interface RankingUiState {
  isOpen: boolean;
  categoryId: RankingCategoryId;
  lineageFilter: LineageId | 'all';
  bossId: string | null;
  page: number;
  loading: boolean;
  error: string | null;
  board: RankingBoardResult | null;
  lastRefreshAt: number | null;
  refreshCooldownUntil: number;
  providerId: string;
  queryMs: number;
  mockCount: number;
  forceFail: boolean;
}

/** Campos futuros (não usados neste item). */
export type RankingSeasonId = string | null;
