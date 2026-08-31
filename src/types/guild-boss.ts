/**
 * Guild Boss (Item 29) — especialização do Boss System.
 * Combate individual; HP compartilhado via provider. Sem raid multiplayer.
 */

import type { BossRankingMode, BossReward } from '@/types/boss';
import type { CloudSavePayload } from '@/server/social/save-service';

export type GuildBossStatus = 'LOCKED' | 'AVAILABLE' | 'ACTIVE' | 'DEFEATED' | 'EXPIRED';

export type GuildBossAttemptEndReason =
  'timeout' | 'player-death' | 'abandon' | 'boss-defeated' | 'shared-defeated' | 'disconnect';

export type GuildBossAttemptResetType = 'daily' | 'weekly';
export type GuildBossActivationMode = 'auto' | 'leaderStart';

export interface GuildBossMilestoneDef {
  /** HP ratio remaining threshold (ex.: 0.75 = 75% restante). */
  hpRatio: number;
  id: string;
  rewards: readonly BossReward[];
}

/** Configuração Guild Boss — não duplica stats de BossDefinition. */
export interface GuildBossDefinition {
  id: string;
  /** Referência ao BossDefinition (combat/phases/skills). */
  bossId: string;
  guildLevelRequirement: number;
  maxAttemptsPerMember: number;
  attemptResetType: GuildBossAttemptResetType;
  /** Duração da tentativa (ms). Sobrescreve timeLimit do Boss se definido. */
  attemptDurationMs: number;
  sharedHp: number;
  participationRewards: readonly BossReward[];
  defeatRewards: readonly BossReward[];
  milestones: readonly GuildBossMilestoneDef[];
  rankingMode: BossRankingMode;
  activationMode: GuildBossActivationMode;
  /** Abandon mantém dano e consome tentativa. */
  abandonKeepsDamage: boolean;
  minimumParticipationDamage: number;
  guildXpOnDefeat: number;
  /**
   * Contribution = floor(validDamage / sharedHp * contributionScale).
   * Não é 1 damage = 1 contribution.
   */
  contributionScale: number;
}

export interface GuildBossParticipant {
  playerId: string;
  nickname: string;
  attemptsUsed: number;
  attemptsResetCycleId: string | null;
  totalDamage: number;
  bestAttemptDamage: number;
  participated: boolean;
  rewardClaimed: boolean;
  /** claimIds já resgatados neste ciclo. */
  claimedIds: string[];
  eligibleParticipation: boolean;
  eligibleDefeat: boolean;
}

export interface GuildBossActiveAttempt {
  attemptId: string;
  playerId: string;
  bossId: string;
  guildId: string;
  startedAt: number;
  status: 'active' | 'submitted';
  /** Dano local acumulado (não commitado). */
  localDamage: number;
}

export interface GuildBossPendingClaim {
  claimId: string;
  kind: 'participation' | 'defeat' | 'milestone';
  milestoneId?: string;
  rewards: BossReward[];
  claimed: boolean;
}

export interface GuildBossState {
  guildId: string;
  bossId: string;
  definitionId: string;
  cycleId: string;
  maxHp: number;
  currentHp: number;
  status: GuildBossStatus;
  startedAt: number | null;
  defeatedAt: number | null;
  participants: Record<string, GuildBossParticipant>;
  totalDamage: number;
  reachedMilestones: string[];
  guildXpGranted: boolean;
  pendingClaims: Record<string, GuildBossPendingClaim[]>;
  activeAttempts: Record<string, GuildBossActiveAttempt>;
  processedAttemptIds: string[];
}

export interface GuildBossSubmitResult {
  ok: boolean;
  reason?: string;
  validDamage: number;
  currentHp: number;
  defeated: boolean;
  alreadyProcessed: boolean;
  milestonesReached: string[];
}

export interface GuildBossProvider {
  readonly id: string;
  getBossState(guildId: string): Promise<GuildBossState | null>;
  ensureCycle(guildId: string, guildLevel: number): Promise<GuildBossState>;
  startAttempt(input: { guildId: string; playerId: string; nickname: string }): Promise<{
    ok: boolean;
    reason?: string;
    attemptId?: string;
    startHp?: number;
    maxHp?: number;
  }>;
  submitAttempt(input: {
    guildId: string;
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: GuildBossAttemptEndReason;
  }): Promise<GuildBossSubmitResult>;
  getParticipants(guildId: string): Promise<GuildBossParticipant[]>;
  claimReward(input: { guildId: string; playerId: string; claimId: string }): Promise<{
    ok: boolean;
    reason?: string;
    rewards?: BossReward[];
    serverApplied?: boolean;
    save?: CloudSavePayload;
  }>;
  /** DEV / tests */
  applyExternalDamage?(
    guildId: string,
    damage: number,
    actorId?: string,
  ): Promise<GuildBossSubmitResult>;
  setSharedHp?(guildId: string, hp: number): Promise<void>;
  forceDefeat?(guildId: string): Promise<void>;
  resetCycle?(guildId: string): Promise<void>;
  setForceFail?(fail: boolean): void;
}
