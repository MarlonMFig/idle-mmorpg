/**
 * Item 44 — World Boss backend (Postgres / Drizzle).
 * Global shared HP; commit de dano via transação + FOR UPDATE.
 * Sem Guild XP/Contribution; entitlement only (grant de inventário no client).
 */

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, or } from 'drizzle-orm';
import { getWorldBossDefinition, worldBossClaimId } from '@/constants/world-boss';
import { syncAttemptBucket } from '@/lib/boss-runtime';
import {
  applyAcceptedBossDamage,
  computeAcceptedBossDamage,
} from '@/lib/shared-boss-damage';
import type { SocialDb } from '@/server/db/client';
import {
  players,
  worldBossAttempts,
  worldBossCycles,
  worldBossParticipants,
  worldBossPendingClaims,
} from '@/server/db/schema';
import { SocialError } from '@/server/social/errors';
import {
  attemptResetCycleIdServer,
  getServerNextWeeklyResetMs,
  getServerWeeklyCycleId,
  serverNow,
} from '@/server/social/server-time';
import type { BossReward } from '@/types/boss';
import type {
  WorldBossActiveAttempt,
  WorldBossAttemptEndReason,
  WorldBossCycleState,
  WorldBossParticipant,
  WorldBossPendingClaim,
  WorldBossRankingSnapshot,
  WorldBossRankEntry,
  WorldBossStatus,
  WorldBossSubmitResult,
} from '@/types/world-boss';

type Tx = Parameters<Parameters<SocialDb['transaction']>[0]>[0];
type DbOrTx = SocialDb | Tx;
type CycleRow = typeof worldBossCycles.$inferSelect;
type ParticipantRow = typeof worldBossParticipants.$inferSelect;
type AttemptRow = typeof worldBossAttempts.$inferSelect;
type ClaimRow = typeof worldBossPendingClaims.$inferSelect;

/** Floor/cap no serviço — caller de validação também limita. */
const MAX_SUBMITTED_DAMAGE = 1_000_000_000_000;

function newAttemptId(): string {
  return `wba-${randomUUID()}`;
}

function newCycleRowId(bossId: string, cycleId: string): string {
  return `wbc-${bossId}-${cycleId}`;
}

function tsMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function resolveStatus(
  state: Pick<WorldBossCycleState, 'status' | 'currentHp' | 'endsAt'>,
): WorldBossStatus {
  if (state.status === 'DEFEATED' || state.currentHp <= 0) return 'DEFEATED';
  const endsAt = state.endsAt;
  if (endsAt != null && serverNow() >= endsAt) return 'EXPIRED';
  if (state.status === 'EXPIRED') return 'EXPIRED';
  // v1: sempre ACTIVE durante a semana até derrota/expiração (sem UPCOMING).
  return 'ACTIVE';
}

function emptyParticipant(playerId: string, nickname: string): WorldBossParticipant {
  return {
    playerId,
    nickname,
    attemptsUsed: 0,
    attemptsResetCycleId: null,
    totalDamage: 0,
    bestAttemptDamage: 0,
    participated: false,
    eligibleParticipation: false,
    eligibleDefeat: false,
    claimedIds: [],
    scoreUpdatedAt: 0,
  };
}

function participantFromRow(row: ParticipantRow): WorldBossParticipant {
  const claimedIds = Array.isArray(row.claimedIds) ? row.claimedIds : [];
  return {
    playerId: row.playerId,
    nickname: row.nickname,
    attemptsUsed: row.attemptsUsed,
    attemptsResetCycleId: row.attemptsResetCycleId,
    totalDamage: row.totalDamage,
    bestAttemptDamage: row.bestAttemptDamage,
    participated: row.participated,
    eligibleParticipation: row.eligibleParticipation,
    eligibleDefeat: row.eligibleDefeat,
    claimedIds,
    scoreUpdatedAt: row.scoreUpdatedAt ?? 0,
  };
}

function claimFromRow(row: ClaimRow): WorldBossPendingClaim {
  return {
    claimId: row.claimId,
    kind: row.kind as WorldBossPendingClaim['kind'],
    milestoneId: row.milestoneId ?? undefined,
    rewards: (row.rewardsJson as BossReward[]) ?? [],
    claimed: row.claimed,
  };
}

function countParticipated(participants: ParticipantRow[]): number {
  return participants.filter((p) => p.participated || p.totalDamage > 0).length;
}

async function findCycleByWeekly(
  db: DbOrTx,
  bossId: string,
  cycleId: string,
): Promise<CycleRow | null> {
  const rows = await db
    .select()
    .from(worldBossCycles)
    .where(and(eq(worldBossCycles.bossId, bossId), eq(worldBossCycles.cycleId, cycleId)))
    .limit(1);
  return rows[0] ?? null;
}

async function lockCycleRow(tx: Tx, cycleRowId: string): Promise<CycleRow> {
  const rows = await tx
    .select()
    .from(worldBossCycles)
    .where(eq(worldBossCycles.id, cycleRowId))
    .for('update')
    .limit(1);
  const row = rows[0];
  if (!row) throw new SocialError('NOT_FOUND', 'Ciclo do World Boss inexistente.', 404);
  return row;
}

async function loadParticipants(db: DbOrTx, cycleRowId: string): Promise<ParticipantRow[]> {
  return db
    .select()
    .from(worldBossParticipants)
    .where(eq(worldBossParticipants.cycleRowId, cycleRowId));
}

async function loadAttempts(db: DbOrTx, cycleRowId: string): Promise<AttemptRow[]> {
  return db.select().from(worldBossAttempts).where(eq(worldBossAttempts.cycleRowId, cycleRowId));
}

async function loadClaims(db: DbOrTx, cycleRowId: string): Promise<ClaimRow[]> {
  return db
    .select()
    .from(worldBossPendingClaims)
    .where(eq(worldBossPendingClaims.cycleRowId, cycleRowId));
}

function mapToState(
  cycle: CycleRow,
  participants: ParticipantRow[],
  attempts: AttemptRow[],
  claims: ClaimRow[],
): WorldBossCycleState {
  const participantMap: Record<string, WorldBossParticipant> = {};
  for (const p of participants) {
    participantMap[p.playerId] = participantFromRow(p);
  }

  const pendingClaims: Record<string, WorldBossPendingClaim[]> = {};
  for (const c of claims) {
    const list = pendingClaims[c.playerId] ?? [];
    list.push(claimFromRow(c));
    pendingClaims[c.playerId] = list;
  }

  const activeAttempts: Record<string, WorldBossActiveAttempt> = {};
  for (const a of attempts) {
    if (a.status === 'active') {
      activeAttempts[a.playerId] = {
        attemptId: a.id,
        playerId: a.playerId,
        bossId: cycle.bossId,
        cycleId: cycle.cycleId,
        startedAt: tsMs(a.startedAt) ?? serverNow(),
        status: 'active',
        localDamage: 0,
      };
    }
  }

  const base: WorldBossCycleState = {
    id: cycle.id,
    bossId: cycle.bossId,
    definitionId: cycle.definitionId,
    cycleId: cycle.cycleId,
    maxHp: cycle.maxHp,
    currentHp: cycle.currentHp,
    status: cycle.status as WorldBossStatus,
    startedAt: tsMs(cycle.startedAt),
    endsAt: tsMs(cycle.endsAt),
    defeatedAt: tsMs(cycle.defeatedAt),
    totalDamage: cycle.totalDamage,
    participantCount: cycle.participantCount || countParticipated(participants),
    reachedMilestones: Array.isArray(cycle.reachedMilestones) ? [...cycle.reachedMilestones] : [],
    participants: participantMap,
    pendingClaims,
    activeAttempts,
  };

  return {
    ...base,
    status: resolveStatus(base),
  };
}

async function assembleState(db: DbOrTx, cycle: CycleRow): Promise<WorldBossCycleState> {
  const [participants, attempts, claims] = await Promise.all([
    loadParticipants(db, cycle.id),
    loadAttempts(db, cycle.id),
    loadClaims(db, cycle.id),
  ]);
  return mapToState(cycle, participants, attempts, claims);
}

async function ensureClaim(
  tx: Tx,
  input: {
    claimId: string;
    cycleRowId: string;
    playerId: string;
    kind: WorldBossPendingClaim['kind'];
    milestoneId?: string;
    rewards: readonly BossReward[];
  },
): Promise<void> {
  await tx
    .insert(worldBossPendingClaims)
    .values({
      claimId: input.claimId,
      cycleRowId: input.cycleRowId,
      playerId: input.playerId,
      kind: input.kind,
      milestoneId: input.milestoneId ?? null,
      rewardsJson: [...input.rewards],
      claimed: false,
    })
    .onConflictDoNothing();
}

function floorSubmittedDamage(damage: number): number {
  const raw = Math.max(0, Math.floor(Number(damage)));
  if (!Number.isFinite(raw)) return 0;
  return Math.min(raw, MAX_SUBMITTED_DAMAGE);
}

function failSubmit(reason: string, currentHp = 0): WorldBossSubmitResult {
  return {
    ok: false,
    reason,
    validDamage: 0,
    currentHp,
    defeated: currentHp <= 0,
    alreadyProcessed: false,
    milestonesReached: [],
  };
}

function rankEntryFromRow(row: ParticipantRow, rank: number): WorldBossRankEntry {
  return {
    rank,
    playerId: row.playerId,
    nickname: row.nickname,
    totalDamage: row.totalDamage,
    bestAttemptDamage: row.bestAttemptDamage,
  };
}

export async function ensureCycle(db: SocialDb): Promise<WorldBossCycleState> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const existing = await findCycleByWeekly(db, def.bossId, weekly);

  if (existing) {
    const status = resolveStatus({
      status: existing.status as WorldBossStatus,
      currentHp: existing.currentHp,
      endsAt: tsMs(existing.endsAt),
    });
    if (status !== existing.status) {
      await db
        .update(worldBossCycles)
        .set({ status, updatedAt: new Date() })
        .where(eq(worldBossCycles.id, existing.id));
      return assembleState(db, { ...existing, status });
    }
    return assembleState(db, existing);
  }

  const now = new Date();
  const endsAtMs = getServerNextWeeklyResetMs();
  const id = newCycleRowId(def.bossId, weekly);
  const status: WorldBossStatus = 'ACTIVE';

  try {
    await db.insert(worldBossCycles).values({
      id,
      bossId: def.bossId,
      definitionId: def.id,
      cycleId: weekly,
      maxHp: def.maxHp,
      currentHp: def.maxHp,
      status,
      startedAt: now,
      endsAt: new Date(endsAtMs),
      defeatedAt: null,
      totalDamage: 0,
      participantCount: 0,
      reachedMilestones: [],
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    const raced = await findCycleByWeekly(db, def.bossId, weekly);
    if (raced) return assembleState(db, raced);
    // Fallback id se colisão de PK com formato legado.
    try {
      const fallbackId = randomUUID();
      await db.insert(worldBossCycles).values({
        id: fallbackId,
        bossId: def.bossId,
        definitionId: def.id,
        cycleId: weekly,
        maxHp: def.maxHp,
        currentHp: def.maxHp,
        status,
        startedAt: now,
        endsAt: new Date(endsAtMs),
        defeatedAt: null,
        totalDamage: 0,
        participantCount: 0,
        reachedMilestones: [],
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      const raced2 = await findCycleByWeekly(db, def.bossId, weekly);
      if (raced2) return assembleState(db, raced2);
      throw new SocialError('INTERNAL', 'Falha ao criar ciclo do World Boss.', 500);
    }
  }

  console.info('[world-boss]', 'ensureCycle', { cycleId: weekly, status });
  const created = await findCycleByWeekly(db, def.bossId, weekly);
  if (!created) throw new SocialError('INTERNAL', 'Ciclo não encontrado após insert.', 500);
  return assembleState(db, created);
}

export async function getState(db: SocialDb): Promise<WorldBossCycleState | null> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, def.bossId, weekly);
  if (!cycle) return null;

  const status = resolveStatus({
    status: cycle.status as WorldBossStatus,
    currentHp: cycle.currentHp,
    endsAt: tsMs(cycle.endsAt),
  });
  if (status !== cycle.status) {
    await db
      .update(worldBossCycles)
      .set({ status, updatedAt: new Date() })
      .where(eq(worldBossCycles.id, cycle.id));
    return assembleState(db, { ...cycle, status });
  }
  return assembleState(db, cycle);
}

export async function startAttempt(
  db: SocialDb,
  input: { playerId: string; nickname: string; playerLevel: number },
): Promise<{
  ok: boolean;
  reason?: string;
  attemptId?: string;
  startHp?: number;
  maxHp?: number;
  cycleId?: string;
}> {
  const def = getWorldBossDefinition();

  if (input.playerLevel < def.minimumPlayerLevel) {
    return {
      ok: false,
      reason: `Requer Level ${def.minimumPlayerLevel}.`,
    };
  }

  const state = await ensureCycle(db);
  const status = resolveStatus(state);

  if (status === 'DEFEATED' || state.currentHp <= 0) {
    return { ok: false, reason: 'World Boss já derrotado neste ciclo.' };
  }
  if (status === 'EXPIRED') {
    return { ok: false, reason: 'Ciclo expirado.' };
  }
  if (status !== 'ACTIVE') {
    return { ok: false, reason: 'World Boss indisponível.' };
  }

  const cycle = await findCycleByWeekly(db, def.bossId, state.cycleId);
  if (!cycle) return { ok: false, reason: 'Estado inexistente' };

  const existingActive = await db
    .select()
    .from(worldBossAttempts)
    .where(
      and(
        eq(worldBossAttempts.cycleRowId, cycle.id),
        eq(worldBossAttempts.playerId, input.playerId),
        eq(worldBossAttempts.status, 'active'),
      ),
    )
    .limit(1);
  if (existingActive[0]) {
    return {
      ok: false,
      reason: 'Já existe uma tentativa ativa (não recuperável por reload).',
      attemptId: existingActive[0].id,
      cycleId: cycle.cycleId,
    };
  }

  const attemptId = newAttemptId();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const locked = await lockCycleRow(tx, cycle.id);
      const lockedStatus = resolveStatus({
        status: locked.status as WorldBossStatus,
        currentHp: locked.currentHp,
        endsAt: tsMs(locked.endsAt),
      });
      if (locked.currentHp <= 0 || lockedStatus === 'DEFEATED') {
        throw new SocialError('BOSS_DEFEATED', 'World Boss já derrotado neste ciclo.');
      }
      if (lockedStatus === 'EXPIRED') {
        throw new SocialError('VALIDATION', 'Ciclo expirado.');
      }

      const stillActive = await tx
        .select()
        .from(worldBossAttempts)
        .where(
          and(
            eq(worldBossAttempts.cycleRowId, locked.id),
            eq(worldBossAttempts.playerId, input.playerId),
            eq(worldBossAttempts.status, 'active'),
          ),
        )
        .limit(1);
      if (stillActive[0]) {
        throw new SocialError(
          'CONFLICT',
          'Já existe uma tentativa ativa (não recuperável por reload).',
          409,
        );
      }

      const partRows = await tx
        .select()
        .from(worldBossParticipants)
        .where(
          and(
            eq(worldBossParticipants.cycleRowId, locked.id),
            eq(worldBossParticipants.playerId, input.playerId),
          ),
        )
        .for('update')
        .limit(1);

      let part = partRows[0]
        ? participantFromRow(partRows[0])
        : emptyParticipant(input.playerId, input.nickname);
      const resetCycleId = attemptResetCycleIdServer(def.attemptResetType);
      const synced = syncAttemptBucket(
        { used: part.attemptsUsed, resetCycleId: part.attemptsResetCycleId },
        def.attemptResetType,
        resetCycleId,
      );
      part = {
        ...part,
        attemptsUsed: synced.used,
        attemptsResetCycleId: synced.resetCycleId,
        nickname: input.nickname || part.nickname,
      };
      if (part.attemptsUsed >= def.maxAttempts) {
        throw new SocialError('NO_ATTEMPTS', 'Sem tentativas restantes hoje.');
      }

      // INCREMENT attemptsUsed on start — reload cannot refund.
      part = { ...part, attemptsUsed: part.attemptsUsed + 1 };

      await tx
        .insert(worldBossParticipants)
        .values({
          cycleRowId: locked.id,
          playerId: input.playerId,
          nickname: part.nickname,
          attemptsUsed: part.attemptsUsed,
          attemptsResetCycleId: part.attemptsResetCycleId,
          totalDamage: part.totalDamage,
          bestAttemptDamage: part.bestAttemptDamage,
          participated: part.participated,
          eligibleParticipation: part.eligibleParticipation,
          eligibleDefeat: part.eligibleDefeat,
          claimedIds: part.claimedIds,
          scoreUpdatedAt: part.scoreUpdatedAt,
        })
        .onConflictDoUpdate({
          target: [worldBossParticipants.cycleRowId, worldBossParticipants.playerId],
          set: {
            nickname: part.nickname,
            attemptsUsed: part.attemptsUsed,
            attemptsResetCycleId: part.attemptsResetCycleId,
          },
        });

      await tx.insert(worldBossAttempts).values({
        id: attemptId,
        cycleRowId: locked.id,
        playerId: input.playerId,
        status: 'active',
        startedAt: now,
      });

      await tx
        .update(worldBossCycles)
        .set({
          status: 'ACTIVE',
          startedAt: locked.startedAt ?? now,
          updatedAt: now,
        })
        .where(eq(worldBossCycles.id, locked.id));
    });
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Falha',
      cycleId: cycle.cycleId,
    };
  }

  const refreshed = await findCycleByWeekly(db, def.bossId, state.cycleId);
  console.info('[world-boss]', 'startAttempt', {
    playerId: input.playerId,
    attemptId,
    cycleId: cycle.cycleId,
  });

  return {
    ok: true,
    attemptId,
    startHp: refreshed?.currentHp ?? state.currentHp,
    maxHp: refreshed?.maxHp ?? state.maxHp,
    cycleId: cycle.cycleId,
  };
}

export async function submitAttempt(
  db: SocialDb,
  input: {
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  },
): Promise<WorldBossSubmitResult> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, def.bossId, weekly);
  if (!cycle) return failSubmit('Estado inexistente');

  try {
    const result = await db.transaction(async (tx) => {
      const locked = await lockCycleRow(tx, cycle.id);

      const attemptRows = await tx
        .select()
        .from(worldBossAttempts)
        .where(eq(worldBossAttempts.id, input.attemptId))
        .for('update')
        .limit(1);
      const attempt = attemptRows[0];
      if (!attempt || attempt.cycleRowId !== locked.id) {
        return failSubmit('Tentativa inválida', locked.currentHp);
      }

      if (attempt.status !== 'active') {
        return {
          ok: true,
          validDamage: 0,
          currentHp: locked.currentHp,
          defeated: locked.currentHp <= 0 || locked.status === 'DEFEATED',
          alreadyProcessed: true,
          milestonesReached: [] as string[],
        } satisfies WorldBossSubmitResult;
      }

      if (attempt.playerId !== input.playerId) {
        return failSubmit('Tentativa inválida', locked.currentHp);
      }

      const submitted = floorSubmittedDamage(input.damage);
      let keepDamage = true;
      if (input.endReason === 'abandon' && !def.abandonKeepsDamage) {
        keepDamage = false;
      }

      let acceptedDamage = 0;
      if (keepDamage && locked.currentHp > 0 && locked.status !== 'DEFEATED') {
        acceptedDamage = computeAcceptedBossDamage(submitted, locked.currentHp);
      }

      const hpBefore = locked.currentHp;
      const applied = applyAcceptedBossDamage(locked.currentHp, acceptedDamage);
      const currentHp = applied.currentHp;
      const defeated = applied.defeated;
      const hpAfter = currentHp;
      const now = new Date();
      const nowMs = serverNow();

      const partRows = await tx
        .select()
        .from(worldBossParticipants)
        .where(
          and(
            eq(worldBossParticipants.cycleRowId, locked.id),
            eq(worldBossParticipants.playerId, input.playerId),
          ),
        )
        .for('update')
        .limit(1);

      let participant = partRows[0]
        ? participantFromRow(partRows[0])
        : emptyParticipant(input.playerId, input.playerId);

      const nextTotal = participant.totalDamage + acceptedDamage;
      participant = {
        ...participant,
        totalDamage: nextTotal,
        bestAttemptDamage: Math.max(participant.bestAttemptDamage, acceptedDamage),
        participated: participant.participated || acceptedDamage > 0,
        eligibleParticipation:
          participant.eligibleParticipation ||
          acceptedDamage >= def.minimumParticipationDamage ||
          nextTotal >= def.minimumParticipationDamage,
        scoreUpdatedAt: acceptedDamage > 0 ? nowMs : participant.scoreUpdatedAt,
      };

      await tx
        .insert(worldBossParticipants)
        .values({
          cycleRowId: locked.id,
          playerId: input.playerId,
          nickname: participant.nickname,
          attemptsUsed: participant.attemptsUsed,
          attemptsResetCycleId: participant.attemptsResetCycleId,
          totalDamage: participant.totalDamage,
          bestAttemptDamage: participant.bestAttemptDamage,
          participated: participant.participated,
          eligibleParticipation: participant.eligibleParticipation,
          eligibleDefeat: participant.eligibleDefeat,
          claimedIds: participant.claimedIds,
          scoreUpdatedAt: participant.scoreUpdatedAt,
        })
        .onConflictDoUpdate({
          target: [worldBossParticipants.cycleRowId, worldBossParticipants.playerId],
          set: {
            totalDamage: participant.totalDamage,
            bestAttemptDamage: participant.bestAttemptDamage,
            participated: participant.participated,
            eligibleParticipation: participant.eligibleParticipation,
            scoreUpdatedAt: participant.scoreUpdatedAt,
          },
        });

      const reached = Array.isArray(locked.reachedMilestones) ? [...locked.reachedMilestones] : [];
      const milestonesReached: string[] = [];
      const ratioBefore = locked.maxHp > 0 ? hpBefore / locked.maxHp : 0;
      const ratioAfter = locked.maxHp > 0 ? hpAfter / locked.maxHp : 0;

      const allParts = await tx
        .select()
        .from(worldBossParticipants)
        .where(eq(worldBossParticipants.cycleRowId, locked.id));

      for (const ms of def.milestones) {
        if (reached.includes(ms.id)) continue;
        const crossed = ratioBefore > ms.hpRatio && ratioAfter <= ms.hpRatio;
        if (!crossed) continue;
        reached.push(ms.id);
        milestonesReached.push(ms.id);

        const recipients = new Set<string>([input.playerId]);
        for (const part of allParts) {
          if (part.participated || part.playerId === input.playerId) recipients.add(part.playerId);
        }
        if (participant.participated) recipients.add(input.playerId);

        for (const pid of recipients) {
          await ensureClaim(tx, {
            claimId: worldBossClaimId({
              cycleId: locked.cycleId,
              bossId: locked.bossId,
              playerId: pid,
              rewardType: 'milestone',
              milestoneId: ms.id,
            }),
            cycleRowId: locked.id,
            playerId: pid,
            kind: 'milestone',
            milestoneId: ms.id,
            rewards: ms.rewards,
          });
        }
      }

      if (participant.eligibleParticipation) {
        await ensureClaim(tx, {
          claimId: worldBossClaimId({
            cycleId: locked.cycleId,
            bossId: locked.bossId,
            playerId: input.playerId,
            rewardType: 'participation',
          }),
          cycleRowId: locked.id,
          playerId: input.playerId,
          kind: 'participation',
          rewards: def.participationRewards,
        });
      }

      if (defeated) {
        participant = {
          ...participant,
          eligibleDefeat: participant.eligibleParticipation,
        };
        await tx
          .update(worldBossParticipants)
          .set({ eligibleDefeat: participant.eligibleDefeat })
          .where(
            and(
              eq(worldBossParticipants.cycleRowId, locked.id),
              eq(worldBossParticipants.playerId, input.playerId),
            ),
          );

        const partsForDefeat = await tx
          .select()
          .from(worldBossParticipants)
          .where(eq(worldBossParticipants.cycleRowId, locked.id));

        for (const part of partsForDefeat) {
          const eligible =
            part.eligibleParticipation ||
            (part.playerId === input.playerId && participant.eligibleParticipation);
          if (!eligible) continue;
          await ensureClaim(tx, {
            claimId: worldBossClaimId({
              cycleId: locked.cycleId,
              bossId: locked.bossId,
              playerId: part.playerId,
              rewardType: 'defeat',
            }),
            cycleRowId: locked.id,
            playerId: part.playerId,
            kind: 'defeat',
            rewards: def.defeatRewards,
          });
          await tx
            .update(worldBossParticipants)
            .set({ eligibleDefeat: true })
            .where(
              and(
                eq(worldBossParticipants.cycleRowId, locked.id),
                eq(worldBossParticipants.playerId, part.playerId),
              ),
            );
        }
      }

      const participantCount = countParticipated(
        allParts.map((p) =>
          p.playerId === input.playerId
            ? {
                ...p,
                participated: participant.participated,
                totalDamage: participant.totalDamage,
              }
            : p,
        ),
      );

      const nextStatus: WorldBossStatus = defeated
        ? 'DEFEATED'
        : resolveStatus({
            status: locked.status as WorldBossStatus,
            currentHp,
            endsAt: tsMs(locked.endsAt),
          });

      await tx
        .update(worldBossCycles)
        .set({
          currentHp,
          totalDamage: locked.totalDamage + acceptedDamage,
          status: nextStatus === 'EXPIRED' && !defeated ? 'EXPIRED' : nextStatus,
          defeatedAt: defeated ? now : locked.defeatedAt,
          reachedMilestones: reached,
          participantCount,
          updatedAt: now,
        })
        .where(eq(worldBossCycles.id, locked.id));

      await tx
        .update(worldBossAttempts)
        .set({
          status: 'submitted',
          submittedDamage: submitted,
          acceptedDamage,
          endReason: input.endReason,
          finishedAt: now,
        })
        .where(eq(worldBossAttempts.id, input.attemptId));

      return {
        ok: true,
        validDamage: acceptedDamage,
        currentHp,
        defeated,
        alreadyProcessed: false,
        milestonesReached,
      } satisfies WorldBossSubmitResult;
    });

    console.info('[world-boss]', 'submitAttempt', {
      attemptId: input.attemptId,
      playerId: input.playerId,
      validDamage: result.validDamage,
      defeated: result.defeated,
      alreadyProcessed: result.alreadyProcessed,
    });

    return result;
  } catch (e) {
    return failSubmit(e instanceof Error ? e.message : 'Falha', cycle.currentHp);
  }
}

export async function getRanking(
  db: SocialDb,
  playerId: string,
): Promise<WorldBossRankingSnapshot> {
  const empty: WorldBossRankingSnapshot = { top: [], myRank: null, totalParticipants: 0 };
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, def.bossId, weekly);
  if (!cycle) return empty;

  const ranked = await db
    .select()
    .from(worldBossParticipants)
    .where(
      and(
        eq(worldBossParticipants.cycleRowId, cycle.id),
        or(eq(worldBossParticipants.participated, true), gt(worldBossParticipants.totalDamage, 0)),
      ),
    )
    .orderBy(
      desc(worldBossParticipants.totalDamage),
      desc(worldBossParticipants.bestAttemptDamage),
      asc(worldBossParticipants.scoreUpdatedAt),
    );

  const totalParticipants = ranked.length;
  const top = ranked.slice(0, 100).map((row, i) => rankEntryFromRow(row, i + 1));

  const myIndex = ranked.findIndex((r) => r.playerId === playerId);
  const myRank = myIndex >= 0 ? rankEntryFromRow(ranked[myIndex]!, myIndex + 1) : null;

  return { top, myRank, totalParticipants };
}

export async function claimReward(
  db: SocialDb,
  input: { playerId: string; claimId: string },
): Promise<{ ok: boolean; reason?: string; rewards?: BossReward[] }> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, def.bossId, weekly);
  if (!cycle) return { ok: false, reason: 'Estado inexistente' };

  const claimed = await db.transaction(async (tx) => {
    const claimRows = await tx
      .select()
      .from(worldBossPendingClaims)
      .where(
        and(
          eq(worldBossPendingClaims.claimId, input.claimId),
          eq(worldBossPendingClaims.cycleRowId, cycle.id),
          eq(worldBossPendingClaims.playerId, input.playerId),
        ),
      )
      .for('update')
      .limit(1);
    const claim = claimRows[0];
    if (!claim) return { ok: false as const, reason: 'Recompensa não encontrada' };
    if (claim.claimed) return { ok: false as const, reason: 'Já coletado' };

    await tx
      .update(worldBossPendingClaims)
      .set({ claimed: true })
      .where(eq(worldBossPendingClaims.claimId, input.claimId));

    const partRows = await tx
      .select()
      .from(worldBossParticipants)
      .where(
        and(
          eq(worldBossParticipants.cycleRowId, cycle.id),
          eq(worldBossParticipants.playerId, input.playerId),
        ),
      )
      .limit(1);
    if (partRows[0]) {
      const claimedIds = Array.isArray(partRows[0].claimedIds) ? [...partRows[0].claimedIds] : [];
      if (!claimedIds.includes(input.claimId)) claimedIds.push(input.claimId);
      await tx
        .update(worldBossParticipants)
        .set({ claimedIds })
        .where(
          and(
            eq(worldBossParticipants.cycleRowId, cycle.id),
            eq(worldBossParticipants.playerId, input.playerId),
          ),
        );
    }

    const rewards = (claim.rewardsJson as BossReward[]) ?? [];
    return { ok: true as const, rewards };
  });

  if (claimed.ok) {
    console.info('[world-boss]', 'claimReward', {
      playerId: input.playerId,
      claimId: input.claimId,
    });
  }
  return claimed;
}

/** DEV / tests — aplica dano externo sem fluxo de UI. */
export async function applyExternalDamage(
  db: SocialDb,
  damage: number,
  actorId = 'mock-other',
  nickname = actorId,
): Promise<WorldBossSubmitResult> {
  await db
    .insert(players)
    .values({
      id: actorId,
      nickname,
      tokenHash: `test-${actorId}`,
    })
    .onConflictDoNothing();

  await ensureCycle(db);
  const started = await startAttempt(db, {
    playerId: actorId,
    nickname,
    playerLevel: 99,
  });
  if (!started.ok || !started.attemptId) {
    return failSubmit(started.reason ?? 'Falha ao iniciar tentativa');
  }
  return submitAttempt(db, {
    attemptId: started.attemptId,
    playerId: actorId,
    damage,
    endReason: 'timeout',
  });
}

/** DEV — define HP compartilhado. */
export async function setSharedHp(db: SocialDb, hp: number): Promise<void> {
  const state = await ensureCycle(db);
  const currentHp = Math.max(0, Math.min(state.maxHp, Math.floor(hp)));
  const now = new Date();
  const status: WorldBossStatus =
    currentHp <= 0
      ? 'DEFEATED'
      : resolveStatus({ status: 'ACTIVE', currentHp, endsAt: state.endsAt });

  await db
    .update(worldBossCycles)
    .set({
      currentHp,
      status,
      defeatedAt: currentHp <= 0 ? now : null,
      updatedAt: now,
    })
    .where(eq(worldBossCycles.id, state.id));
}

/** DEV — força derrota; opcionalmente cria entitlements de defeat. */
export async function forceDefeat(
  db: SocialDb,
  opts?: { grantEntitlements?: boolean },
): Promise<void> {
  const state = await ensureCycle(db);
  const now = new Date();

  await db.transaction(async (tx) => {
    const locked = await lockCycleRow(tx, state.id);
    await tx
      .update(worldBossCycles)
      .set({
        currentHp: 0,
        status: 'DEFEATED',
        defeatedAt: locked.defeatedAt ?? now,
        updatedAt: now,
      })
      .where(eq(worldBossCycles.id, locked.id));

    if (!opts?.grantEntitlements) return;

    const def = getWorldBossDefinition();
    const parts = await tx
      .select()
      .from(worldBossParticipants)
      .where(eq(worldBossParticipants.cycleRowId, locked.id));

    for (const part of parts) {
      if (!part.eligibleParticipation) continue;
      await ensureClaim(tx, {
        claimId: worldBossClaimId({
          cycleId: locked.cycleId,
          bossId: locked.bossId,
          playerId: part.playerId,
          rewardType: 'defeat',
        }),
        cycleRowId: locked.id,
        playerId: part.playerId,
        kind: 'defeat',
        rewards: def.defeatRewards,
      });
      await tx
        .update(worldBossParticipants)
        .set({ eligibleDefeat: true })
        .where(
          and(
            eq(worldBossParticipants.cycleRowId, locked.id),
            eq(worldBossParticipants.playerId, part.playerId),
          ),
        );
    }
  });
}

/** DEV — apaga ciclo atual e recria. */
export async function resetCycle(db: SocialDb): Promise<void> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const existing = await findCycleByWeekly(db, def.bossId, weekly);
  if (existing) {
    await db.delete(worldBossCycles).where(eq(worldBossCycles.id, existing.id));
  }
  await ensureCycle(db);
}

/** DEV — zera tentativas do jogador no ciclo atual. */
export async function resetPlayerAttempts(db: SocialDb, playerId: string): Promise<void> {
  const def = getWorldBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, def.bossId, weekly);
  if (!cycle) return;

  const resetCycleId = attemptResetCycleIdServer(def.attemptResetType);
  await db
    .update(worldBossParticipants)
    .set({
      attemptsUsed: 0,
      attemptsResetCycleId: resetCycleId,
    })
    .where(
      and(
        eq(worldBossParticipants.cycleRowId, cycle.id),
        eq(worldBossParticipants.playerId, playerId),
      ),
    );

  // Cancela tentativas ativas órfãs do jogador neste ciclo.
  await db
    .update(worldBossAttempts)
    .set({
      status: 'submitted',
      endReason: 'abandon',
      finishedAt: new Date(),
      submittedDamage: 0,
      acceptedDamage: 0,
    })
    .where(
      and(
        eq(worldBossAttempts.cycleRowId, cycle.id),
        eq(worldBossAttempts.playerId, playerId),
        eq(worldBossAttempts.status, 'active'),
      ),
    );
}
