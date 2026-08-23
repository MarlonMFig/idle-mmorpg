/**
 * Fundação do sistema de Bosses (Item 26).
 * Conteúdo separado da Hunt infinita. Guild Boss (Item 29) especializa via guildContext.
 */

import type { CombatAffinityFields, DamageElement } from '@/data/damage-elements';
import type { MapKey } from '@/maps/map-registry';

export type BossAttemptResetType = 'none' | 'daily' | 'weekly' | 'event';

export type BossCombatStatus =
  | 'idle'
  | 'fighting'
  | 'victory'
  | 'defeat'
  | 'abandoned';

export type BossDefeatReason = 'player-death' | 'timeout' | 'abandon';

export type BossReward =
  | { type: 'copper'; amount: number }
  | { type: 'item'; id: string; amount: number }
  | { type: 'animeCoins'; amount: number };

export type BossEntryCost = { type: 'item'; id: string; amount: number };

export interface BossPhase {
  id: string;
  /** HP% (0–1) a partir do qual esta fase vale, descendo. */
  hpThreshold: number;
  skillOverrides?: readonly string[];
  statModifiers?: {
    damageMul?: number;
    speedMul?: number;
  };
}

export interface BossEligibility {
  playerLevel?: number;
  lineageRank?: number;
}

/** Item 27 — modo de Ranking por Boss. */
export type BossRankingMode = 'fastestKill' | 'highestDamage' | 'none';

export interface BossAttemptRules {
  maxAttempts: number | null;
  resetType: BossAttemptResetType;
  /** Se abandono consome a tentativa desta entrada. */
  abandonConsumesAttempt: boolean;
}

export interface BossDefinition {
  id: string;
  name: string;
  level: number;
  /** Apresentação reutiliza Enemy/lookType existente. */
  lookType: number;
  mapKey: MapKey;
  hp: number;
  speed: number;
  xp: number;
  skills: readonly string[];
  elements?: readonly DamageElement[];
  resistances?: CombatAffinityFields['resistances'];
  immunities?: CombatAffinityFields['immunities'];
  statusResistances?: CombatAffinityFields['statusResistances'];
  statusImmunities?: CombatAffinityFields['statusImmunities'];
  /** ms. null = sem limite. */
  timeLimit: number | null;
  attemptRules: BossAttemptRules;
  /** Reservado. Vazio neste item. */
  entryCost: readonly BossEntryCost[];
  phases: readonly BossPhase[];
  rewards: readonly BossReward[];
  firstClearReward?: readonly BossReward[];
  eligibility?: BossEligibility;
  /** Ranking do Boss (Item 27). Default: none. */
  rankingMode?: BossRankingMode;
  rewardsDev?: boolean;
}

/** Contexto Guild Boss (Item 29) — combate individual ligado ao HP compartilhado. */
export interface BossGuildContext {
  guildId: string;
  attemptId: string;
  /** HP compartilhado no início da tentativa (fase). */
  sharedHpAtStart: number;
}

/** Contexto World Boss (Item 44) — combate individual ligado ao HP global. */
export interface BossWorldContext {
  attemptId: string;
  sharedHpAtStart: number;
  cycleId: string;
}

export interface BossCombatInstance {
  bossInstanceId: string;
  bossId: string;
  currentHp: number;
  hpMax: number;
  startedAt: number;
  remainingTimeMs: number | null;
  status: Extract<BossCombatStatus, 'fighting'>;
  damageTaken: number;
  phaseId: string;
  currentSkillId: string | null;
  timerFrozen: boolean;
  /** Se definido, finish não concede Mastery/Online Kill/solo rewards. */
  guildContext?: BossGuildContext;
  /** Se definido, finish não concede Mastery/Online Kill/solo rewards. */
  worldBossContext?: BossWorldContext;
}

export interface BossCombatResult {
  bossId: string;
  instanceId: string;
  victory: boolean;
  damageDealt: number;
  durationMs: number;
  playerHpRemaining: number;
  defeatReason?: BossDefeatReason;
  firstClear: boolean;
}

export interface BossPendingReward {
  claimId: string;
  bossId: string;
  instanceId: string;
  rewards: BossReward[];
  firstClear: boolean;
  claimed: boolean;
}

export interface BossAttemptState {
  used: number;
  resetCycleId: string | null;
}

export interface BossBestResult {
  bestTimeMs: number | null;
  bestDamage: number;
}

export interface BossProgressState {
  attempts: Record<string, BossAttemptState>;
  defeatedBosses: Record<string, true>;
  bestResult: Record<string, BossBestResult>;
  pendingReward: BossPendingReward | null;
}

export const DEFAULT_BOSS_PROGRESS: BossProgressState = {
  attempts: {},
  defeatedBosses: {},
  bestResult: {},
  pendingReward: null,
};
