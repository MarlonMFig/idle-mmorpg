/**
 * World Boss (Item 44) — Boss GLOBAL do servidor.
 * Combate individual; HP compartilhado server-authoritative.
 * Sem raid visual, sem Guild XP/Contribution, sem Offline.
 */

import type { BossReward } from '@/types/boss';
import type { CloudSavePayload } from '@/server/social/save-service';

export type WorldBossStatus = 'UPCOMING' | 'ACTIVE' | 'DEFEATED' | 'EXPIRED';

export type WorldBossAttemptEndReason =
  'timeout' | 'player-death' | 'abandon' | 'boss-defeated' | 'shared-defeated' | 'disconnect';

export type WorldBossAttemptResetType = 'daily' | 'weekly';
export type WorldBossCycleType = 'weekly';

export interface WorldBossMilestoneDef {
  hpRatio: number;
  id: string;
  rewards: readonly BossReward[];
}

/** Overlay global — não duplica stats de BossDefinition. */
export interface WorldBossDefinition {
  id: string;
  bossId: string;
  cycleType: WorldBossCycleType;
  maxHp: number;
  attemptDurationMs: number;
  maxAttempts: number;
  attemptResetType: WorldBossAttemptResetType;
  minimumPlayerLevel: number;
  participationRewards: readonly BossReward[];
  defeatRewards: readonly BossReward[];
  milestones: readonly WorldBossMilestoneDef[];
  /** Ranking rewards — não implementados neste item. */
  rankingRewards?: readonly never[];
  abandonKeepsDamage: boolean;
  minimumParticipationDamage: number;
  /** Polling client (ms). */
  syncIntervalMs: number;
}

export interface WorldBossParticipant {
  playerId: string;
  nickname: string;
  attemptsUsed: number;
  attemptsResetCycleId: string | null;
  totalDamage: number;
  bestAttemptDamage: number;
  participated: boolean;
  eligibleParticipation: boolean;
  eligibleDefeat: boolean;
  claimedIds: string[];
  /** Epoch ms — tie-break estável. */
  scoreUpdatedAt: number;
}

export interface WorldBossActiveAttempt {
  attemptId: string;
  playerId: string;
  bossId: string;
  cycleId: string;
  startedAt: number;
  status: 'active' | 'submitted';
  localDamage: number;
}

export interface WorldBossPendingClaim {
  claimId: string;
  kind: 'participation' | 'defeat' | 'milestone';
  milestoneId?: string;
  rewards: BossReward[];
  claimed: boolean;
}

export interface WorldBossCycleState {
  id: string;
  bossId: string;
  definitionId: string;
  cycleId: string;
  maxHp: number;
  currentHp: number;
  status: WorldBossStatus;
  startedAt: number | null;
  endsAt: number | null;
  defeatedAt: number | null;
  totalDamage: number;
  participantCount: number;
  reachedMilestones: string[];
  participants: Record<string, WorldBossParticipant>;
  pendingClaims: Record<string, WorldBossPendingClaim[]>;
  activeAttempts: Record<string, WorldBossActiveAttempt>;
}

export interface WorldBossSubmitResult {
  ok: boolean;
  reason?: string;
  validDamage: number;
  currentHp: number;
  defeated: boolean;
  alreadyProcessed: boolean;
  milestonesReached: string[];
}

export interface WorldBossRankEntry {
  rank: number;
  playerId: string;
  nickname: string;
  totalDamage: number;
  bestAttemptDamage: number;
}

export interface WorldBossRankingSnapshot {
  top: WorldBossRankEntry[];
  myRank: WorldBossRankEntry | null;
  totalParticipants: number;
}

export interface WorldBossProvider {
  readonly id: string;
  getState(): Promise<WorldBossCycleState | null>;
  ensureCycle(playerLevel?: number): Promise<WorldBossCycleState>;
  startAttempt(input: { playerId: string; nickname: string; playerLevel: number }): Promise<{
    ok: boolean;
    reason?: string;
    attemptId?: string;
    startHp?: number;
    maxHp?: number;
    cycleId?: string;
  }>;
  submitAttempt(input: {
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  }): Promise<WorldBossSubmitResult>;
  getRanking(playerId: string): Promise<WorldBossRankingSnapshot>;
  claimReward(input: { playerId: string; claimId: string }): Promise<{
    ok: boolean;
    reason?: string;
    rewards?: BossReward[];
    serverApplied?: boolean;
    save?: CloudSavePayload;
  }>;
  /** DEV */
  applyExternalDamage?(
    damage: number,
    actorId?: string,
    nickname?: string,
  ): Promise<WorldBossSubmitResult>;
  setSharedHp?(hp: number): Promise<void>;
  forceDefeat?(opts?: { grantEntitlements?: boolean }): Promise<void>;
  resetCycle?(): Promise<void>;
  resetPlayerAttempts?(playerId: string): Promise<void>;
  setForceFail?(fail: boolean): void;
}
