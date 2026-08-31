/**
 * Item 37 — Guild Boss backend (Postgres / Drizzle).
 * Paridade com LocalGuildBossProvider; commit de dano via transação + FOR UPDATE.
 */

import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { computeGuildBossContribution, getGuildBossDefinition } from '@/constants/guild-boss';
import { syncAttemptBucket } from '@/lib/boss-runtime';
import type { SocialDb } from '@/server/db/client';
import {
  guildBossAttempts,
  guildBossCycles,
  guildBossParticipants,
  guildBossPendingClaims,
  guildMembers,
  guilds,
  players,
  type GuildRow,
} from '@/server/db/schema';
import { addGuildXp, addMemberContribution } from '@/server/social/guild-service';
import { SocialError } from '@/server/social/errors';
import { getServerCombatDamageCap } from '@/server/social/save-service';
import {
  attemptResetCycleIdServer,
  getServerWeeklyCycleId,
  serverNow,
} from '@/server/social/server-time';
import type { BossReward } from '@/types/boss';
import type {
  GuildBossActiveAttempt,
  GuildBossAttemptEndReason,
  GuildBossParticipant,
  GuildBossPendingClaim,
  GuildBossState,
  GuildBossStatus,
  GuildBossSubmitResult,
} from '@/types/guild-boss';

type Tx = Parameters<Parameters<SocialDb['transaction']>[0]>[0];
type DbOrTx = SocialDb | Tx;
type CycleRow = typeof guildBossCycles.$inferSelect;
type ParticipantRow = typeof guildBossParticipants.$inferSelect;
type AttemptRow = typeof guildBossAttempts.$inferSelect;
type ClaimRow = typeof guildBossPendingClaims.$inferSelect;

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
  state: Pick<GuildBossState, 'status' | 'currentHp' | 'maxHp'>,
  guildLevel: number,
  reqLevel: number,
): GuildBossStatus {
  if (guildLevel < reqLevel) return 'LOCKED';
  if (state.status === 'DEFEATED') return 'DEFEATED';
  if (state.currentHp <= 0) return 'DEFEATED';
  if (state.status === 'EXPIRED') return 'EXPIRED';
  if (state.currentHp < state.maxHp) return 'ACTIVE';
  return 'AVAILABLE';
}

function emptyParticipant(playerId: string, nickname: string): GuildBossParticipant {
  return {
    playerId,
    nickname,
    attemptsUsed: 0,
    attemptsResetCycleId: null,
    totalDamage: 0,
    bestAttemptDamage: 0,
    participated: false,
    rewardClaimed: false,
    claimedIds: [],
    eligibleParticipation: false,
    eligibleDefeat: false,
  };
}

function participantFromRow(row: ParticipantRow): GuildBossParticipant {
  const claimedIds = Array.isArray(row.claimedIds) ? row.claimedIds : [];
  return {
    playerId: row.playerId,
    nickname: row.nickname,
    attemptsUsed: row.attemptsUsed,
    attemptsResetCycleId: row.attemptsResetCycleId,
    totalDamage: row.totalDamage,
    bestAttemptDamage: row.bestAttemptDamage,
    participated: row.participated,
    rewardClaimed: claimedIds.length > 0,
    claimedIds,
    eligibleParticipation: row.eligibleParticipation,
    eligibleDefeat: row.eligibleDefeat,
  };
}

function claimFromRow(row: ClaimRow): GuildBossPendingClaim {
  return {
    claimId: row.claimId,
    kind: row.kind as GuildBossPendingClaim['kind'],
    milestoneId: row.milestoneId ?? undefined,
    rewards: (row.rewardsJson as BossReward[]) ?? [],
    claimed: row.claimed,
  };
}

async function loadGuildLevel(db: DbOrTx, guildId: string): Promise<number> {
  const rows = await db
    .select({ level: guilds.level })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);
  if (!rows[0]) throw new SocialError('NOT_FOUND', 'Guild não encontrada.', 404);
  return rows[0].level;
}

async function assertMembership(db: DbOrTx, guildId: string, playerId: string): Promise<void> {
  const rows = await db
    .select({ playerId: guildMembers.playerId })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
    .limit(1);
  if (!rows[0]) {
    throw new SocialError('NOT_MEMBER', 'Você não é membro desta Guild.', 403);
  }
}

async function findCycleByWeekly(
  db: DbOrTx,
  guildId: string,
  bossId: string,
  cycleId: string,
): Promise<CycleRow | null> {
  const rows = await db
    .select()
    .from(guildBossCycles)
    .where(
      and(
        eq(guildBossCycles.guildId, guildId),
        eq(guildBossCycles.bossId, bossId),
        eq(guildBossCycles.cycleId, cycleId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function lockCycleRow(tx: Tx, cycleRowId: string): Promise<CycleRow> {
  const rows = await tx
    .select()
    .from(guildBossCycles)
    .where(eq(guildBossCycles.id, cycleRowId))
    .for('update')
    .limit(1);
  const row = rows[0];
  if (!row) throw new SocialError('NOT_FOUND', 'Ciclo do Guild Boss inexistente.', 404);
  return row;
}

async function loadParticipants(db: DbOrTx, cycleRowId: string): Promise<ParticipantRow[]> {
  return db
    .select()
    .from(guildBossParticipants)
    .where(eq(guildBossParticipants.cycleRowId, cycleRowId));
}

async function loadAttempts(db: DbOrTx, cycleRowId: string): Promise<AttemptRow[]> {
  return db.select().from(guildBossAttempts).where(eq(guildBossAttempts.cycleRowId, cycleRowId));
}

async function loadClaims(db: DbOrTx, cycleRowId: string): Promise<ClaimRow[]> {
  return db
    .select()
    .from(guildBossPendingClaims)
    .where(eq(guildBossPendingClaims.cycleRowId, cycleRowId));
}

function mapToState(
  cycle: CycleRow,
  participants: ParticipantRow[],
  attempts: AttemptRow[],
  claims: ClaimRow[],
  guildLevel: number,
): GuildBossState {
  const def = getGuildBossDefinition();
  const participantMap: Record<string, GuildBossParticipant> = {};
  for (const p of participants) {
    participantMap[p.playerId] = participantFromRow(p);
  }

  const pendingClaims: Record<string, GuildBossPendingClaim[]> = {};
  for (const c of claims) {
    const list = pendingClaims[c.playerId] ?? [];
    list.push(claimFromRow(c));
    pendingClaims[c.playerId] = list;
  }

  const activeAttempts: Record<string, GuildBossActiveAttempt> = {};
  const processedAttemptIds: string[] = [];
  for (const a of attempts) {
    if (a.status === 'active') {
      activeAttempts[a.playerId] = {
        attemptId: a.id,
        playerId: a.playerId,
        bossId: cycle.bossId,
        guildId: cycle.guildId,
        startedAt: tsMs(a.startedAt) ?? serverNow(),
        status: 'active',
        localDamage: 0,
      };
    } else {
      processedAttemptIds.push(a.id);
    }
  }

  const base: GuildBossState = {
    guildId: cycle.guildId,
    bossId: cycle.bossId,
    definitionId: cycle.definitionId,
    cycleId: cycle.cycleId,
    maxHp: cycle.maxHp,
    currentHp: cycle.currentHp,
    status: cycle.status as GuildBossStatus,
    startedAt: tsMs(cycle.startedAt),
    defeatedAt: tsMs(cycle.defeatedAt),
    participants: participantMap,
    totalDamage: cycle.totalDamage,
    reachedMilestones: Array.isArray(cycle.reachedMilestones) ? [...cycle.reachedMilestones] : [],
    guildXpGranted: cycle.guildXpGranted,
    pendingClaims,
    activeAttempts,
    processedAttemptIds: processedAttemptIds.slice(-500),
  };

  return {
    ...base,
    status: resolveStatus(base, guildLevel, def.guildLevelRequirement),
  };
}

async function assembleState(
  db: DbOrTx,
  cycle: CycleRow,
  guildLevel: number,
): Promise<GuildBossState> {
  const [participants, attempts, claims] = await Promise.all([
    loadParticipants(db, cycle.id),
    loadAttempts(db, cycle.id),
    loadClaims(db, cycle.id),
  ]);
  return mapToState(cycle, participants, attempts, claims, guildLevel);
}

async function syncParticipantAttempts(
  db: DbOrTx,
  cycleRowId: string,
  playerId: string,
  nickname: string,
): Promise<GuildBossParticipant> {
  const def = getGuildBossDefinition();
  const resetCycleId = attemptResetCycleIdServer(def.attemptResetType);

  const existing = await db
    .select()
    .from(guildBossParticipants)
    .where(
      and(
        eq(guildBossParticipants.cycleRowId, cycleRowId),
        eq(guildBossParticipants.playerId, playerId),
      ),
    )
    .limit(1);

  let p = existing[0]
    ? participantFromRow({ ...existing[0], nickname: nickname || existing[0].nickname })
    : emptyParticipant(playerId, nickname);

  const synced = syncAttemptBucket(
    { used: p.attemptsUsed, resetCycleId: p.attemptsResetCycleId },
    def.attemptResetType,
    resetCycleId,
  );
  p = {
    ...p,
    nickname: nickname || p.nickname,
    attemptsUsed: synced.used,
    attemptsResetCycleId: synced.resetCycleId,
  };

  await db
    .insert(guildBossParticipants)
    .values({
      cycleRowId,
      playerId,
      nickname: p.nickname,
      attemptsUsed: p.attemptsUsed,
      attemptsResetCycleId: p.attemptsResetCycleId,
      totalDamage: p.totalDamage,
      bestAttemptDamage: p.bestAttemptDamage,
      participated: p.participated,
      eligibleParticipation: p.eligibleParticipation,
      eligibleDefeat: p.eligibleDefeat,
      claimedIds: p.claimedIds,
    })
    .onConflictDoUpdate({
      target: [guildBossParticipants.cycleRowId, guildBossParticipants.playerId],
      set: {
        nickname: p.nickname,
        attemptsUsed: p.attemptsUsed,
        attemptsResetCycleId: p.attemptsResetCycleId,
      },
    });

  return p;
}

async function ensureClaim(
  tx: Tx,
  input: {
    claimId: string;
    cycleRowId: string;
    playerId: string;
    kind: GuildBossPendingClaim['kind'];
    milestoneId?: string;
    rewards: readonly BossReward[];
  },
): Promise<void> {
  await tx
    .insert(guildBossPendingClaims)
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

export async function ensureCycle(
  db: SocialDb,
  guildId: string,
  guildLevel: number,
): Promise<GuildBossState> {
  const def = getGuildBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const existing = await findCycleByWeekly(db, guildId, def.bossId, weekly);

  if (existing) {
    const status = resolveStatus(
      {
        status: existing.status as GuildBossStatus,
        currentHp: existing.currentHp,
        maxHp: existing.maxHp,
      },
      guildLevel,
      def.guildLevelRequirement,
    );
    if (status !== existing.status) {
      await db
        .update(guildBossCycles)
        .set({ status, updatedAt: new Date() })
        .where(eq(guildBossCycles.id, existing.id));
      const refreshed = { ...existing, status };
      return assembleState(db, refreshed, guildLevel);
    }
    return assembleState(db, existing, guildLevel);
  }

  // Confirma guild existe.
  await loadGuildLevel(db, guildId);

  const status: GuildBossStatus = guildLevel < def.guildLevelRequirement ? 'LOCKED' : 'AVAILABLE';
  const id = randomUUID();
  const now = new Date();
  const startedAt = status === 'AVAILABLE' ? now : null;

  try {
    await db.insert(guildBossCycles).values({
      id,
      guildId,
      bossId: def.bossId,
      definitionId: def.id,
      cycleId: weekly,
      maxHp: def.sharedHp,
      currentHp: def.sharedHp,
      status,
      startedAt,
      defeatedAt: null,
      totalDamage: 0,
      reachedMilestones: [],
      guildXpGranted: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // Race: outro writer criou o ciclo — relê.
    const raced = await findCycleByWeekly(db, guildId, def.bossId, weekly);
    if (raced) return assembleState(db, raced, guildLevel);
    throw new SocialError('INTERNAL', 'Falha ao criar ciclo do Guild Boss.', 500);
  }

  console.info('[guild]', 'ensureCycle', { guildId, cycleId: weekly, status });
  const created = await findCycleByWeekly(db, guildId, def.bossId, weekly);
  if (!created) throw new SocialError('INTERNAL', 'Ciclo não encontrado após insert.', 500);
  return assembleState(db, created, guildLevel);
}

export async function getBossState(db: SocialDb, guildId: string): Promise<GuildBossState | null> {
  const def = getGuildBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, guildId, def.bossId, weekly);
  if (!cycle) return null;
  let guildLevel = 1;
  try {
    guildLevel = await loadGuildLevel(db, guildId);
  } catch {
    guildLevel = 1;
  }
  return assembleState(db, cycle, guildLevel);
}

export async function startAttempt(
  db: SocialDb,
  input: { guildId: string; playerId: string; nickname: string },
): Promise<{ ok: boolean; reason?: string; attemptId?: string; startHp?: number; maxHp?: number }> {
  try {
    await assertMembership(db, input.guildId, input.playerId);
  } catch (e) {
    return { ok: false, reason: e instanceof SocialError ? e.message : 'Falha' };
  }

  const def = getGuildBossDefinition();
  let guildLevel: number;
  try {
    guildLevel = await loadGuildLevel(db, input.guildId);
  } catch (e) {
    return { ok: false, reason: e instanceof SocialError ? e.message : 'Guild não encontrada.' };
  }

  const state = await ensureCycle(db, input.guildId, guildLevel);
  const status = resolveStatus(state, guildLevel, def.guildLevelRequirement);

  if (status === 'LOCKED') {
    return { ok: false, reason: `Requer Guild Level ${def.guildLevelRequirement}.` };
  }
  if (status === 'DEFEATED' || state.currentHp <= 0) {
    return { ok: false, reason: 'Guild Boss já derrotado neste ciclo.' };
  }
  if (status === 'EXPIRED') {
    return { ok: false, reason: 'Ciclo expirado.' };
  }

  const cycle = await findCycleByWeekly(db, input.guildId, def.bossId, state.cycleId);
  if (!cycle) return { ok: false, reason: 'Estado inexistente' };

  const existingActive = await db
    .select()
    .from(guildBossAttempts)
    .where(
      and(
        eq(guildBossAttempts.cycleRowId, cycle.id),
        eq(guildBossAttempts.playerId, input.playerId),
        eq(guildBossAttempts.status, 'active'),
      ),
    )
    .limit(1);
  if (existingActive[0]) {
    return {
      ok: false,
      reason: 'Já existe uma tentativa ativa (não recuperável por reload).',
      attemptId: existingActive[0].id,
    };
  }

  const participant = await syncParticipantAttempts(db, cycle.id, input.playerId, input.nickname);
  if (participant.attemptsUsed >= def.maxAttemptsPerMember) {
    return { ok: false, reason: 'Sem tentativas restantes hoje.' };
  }

  const attemptId = randomUUID();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const locked = await lockCycleRow(tx, cycle.id);
      if (locked.currentHp <= 0 || locked.status === 'DEFEATED') {
        throw new SocialError('BOSS_DEFEATED', 'Guild Boss já derrotado neste ciclo.');
      }

      const stillActive = await tx
        .select()
        .from(guildBossAttempts)
        .where(
          and(
            eq(guildBossAttempts.cycleRowId, locked.id),
            eq(guildBossAttempts.playerId, input.playerId),
            eq(guildBossAttempts.status, 'active'),
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
        .from(guildBossParticipants)
        .where(
          and(
            eq(guildBossParticipants.cycleRowId, locked.id),
            eq(guildBossParticipants.playerId, input.playerId),
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
      if (part.attemptsUsed >= def.maxAttemptsPerMember) {
        throw new SocialError('NO_ATTEMPTS', 'Sem tentativas restantes hoje.');
      }

      // INCREMENT attemptsUsed on start — reload cannot refund.
      part = { ...part, attemptsUsed: part.attemptsUsed + 1 };

      await tx
        .insert(guildBossParticipants)
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
        })
        .onConflictDoUpdate({
          target: [guildBossParticipants.cycleRowId, guildBossParticipants.playerId],
          set: {
            nickname: part.nickname,
            attemptsUsed: part.attemptsUsed,
            attemptsResetCycleId: part.attemptsResetCycleId,
          },
        });

      await tx.insert(guildBossAttempts).values({
        id: attemptId,
        cycleRowId: locked.id,
        playerId: input.playerId,
        status: 'active',
        startedAt: now,
      });

      await tx
        .update(guildBossCycles)
        .set({
          status: 'ACTIVE',
          startedAt: locked.startedAt ?? now,
          updatedAt: now,
        })
        .where(eq(guildBossCycles.id, locked.id));
    });
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Falha',
    };
  }

  const refreshed = await findCycleByWeekly(db, input.guildId, def.bossId, state.cycleId);
  console.info('[guild]', 'startAttempt', {
    guildId: input.guildId,
    playerId: input.playerId,
    attemptId,
  });

  return {
    ok: true,
    attemptId,
    startHp: refreshed?.currentHp ?? state.currentHp,
    maxHp: refreshed?.maxHp ?? state.maxHp,
  };
}

function failSubmit(reason: string, currentHp = 0): GuildBossSubmitResult {
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

export async function submitAttempt(
  db: SocialDb,
  input: {
    guildId: string;
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: GuildBossAttemptEndReason;
  },
): Promise<GuildBossSubmitResult> {
  const def = getGuildBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, input.guildId, def.bossId, weekly);
  if (!cycle) return failSubmit('Estado inexistente');
  const attemptMeta = await db
    .select({ startedAt: guildBossAttempts.startedAt })
    .from(guildBossAttempts)
    .where(eq(guildBossAttempts.id, input.attemptId))
    .limit(1);
  const elapsedMs = attemptMeta[0]
    ? serverNow() - (tsMs(attemptMeta[0].startedAt) ?? serverNow())
    : 0;
  const serverDamageCap = await getServerCombatDamageCap(
    db,
    input.playerId,
    elapsedMs,
    def.attemptDurationMs,
  );
  if (serverDamageCap == null && process.env.NODE_ENV === 'production') {
    return failSubmit('Save em nuvem obrigatório para validar o dano.', cycle.currentHp);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const locked = await lockCycleRow(tx, cycle.id);

      const attemptRows = await tx
        .select()
        .from(guildBossAttempts)
        .where(eq(guildBossAttempts.id, input.attemptId))
        .for('update')
        .limit(1);
      const attempt = attemptRows[0];
      if (!attempt || attempt.cycleRowId !== locked.id) {
        return failSubmit('Tentativa inválida', locked.currentHp);
      }

      // Idempotente: já submetido.
      if (attempt.status !== 'active') {
        return {
          ok: true,
          validDamage: 0,
          currentHp: locked.currentHp,
          defeated: locked.currentHp <= 0 || locked.status === 'DEFEATED',
          alreadyProcessed: true,
          milestonesReached: [] as string[],
        } satisfies GuildBossSubmitResult;
      }

      if (attempt.playerId !== input.playerId) {
        return failSubmit('Tentativa inválida', locked.currentHp);
      }

      let keepDamage = true;
      if (input.endReason === 'abandon' && !def.abandonKeepsDamage) {
        keepDamage = false;
      }

      let acceptedDamage = 0;
      if (keepDamage && locked.currentHp > 0 && locked.status !== 'DEFEATED') {
        const raw = Math.min(
          Math.max(0, Math.floor(input.damage)),
          serverDamageCap ?? Number.MAX_SAFE_INTEGER,
        );
        acceptedDamage = Math.min(raw, locked.currentHp);
      }

      const hpBefore = locked.currentHp;
      const currentHp = Math.max(0, locked.currentHp - acceptedDamage);
      const defeated = currentHp <= 0;
      const hpAfter = currentHp;
      const now = new Date();

      // Participant row.
      const partRows = await tx
        .select()
        .from(guildBossParticipants)
        .where(
          and(
            eq(guildBossParticipants.cycleRowId, locked.id),
            eq(guildBossParticipants.playerId, input.playerId),
          ),
        )
        .for('update')
        .limit(1);

      let participant = partRows[0]
        ? participantFromRow(partRows[0])
        : emptyParticipant(input.playerId, input.playerId);

      participant = {
        ...participant,
        totalDamage: participant.totalDamage + acceptedDamage,
        bestAttemptDamage: Math.max(participant.bestAttemptDamage, acceptedDamage),
        participated: participant.participated || acceptedDamage > 0,
        eligibleParticipation:
          participant.eligibleParticipation ||
          acceptedDamage >= def.minimumParticipationDamage ||
          participant.totalDamage >= def.minimumParticipationDamage,
      };

      await tx
        .insert(guildBossParticipants)
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
        })
        .onConflictDoUpdate({
          target: [guildBossParticipants.cycleRowId, guildBossParticipants.playerId],
          set: {
            totalDamage: participant.totalDamage,
            bestAttemptDamage: participant.bestAttemptDamage,
            participated: participant.participated,
            eligibleParticipation: participant.eligibleParticipation,
          },
        });

      // Milestones.
      const reached = Array.isArray(locked.reachedMilestones) ? [...locked.reachedMilestones] : [];
      const milestonesReached: string[] = [];
      const ratioBefore = locked.maxHp > 0 ? hpBefore / locked.maxHp : 0;
      const ratioAfter = locked.maxHp > 0 ? hpAfter / locked.maxHp : 0;

      const allParts = await tx
        .select()
        .from(guildBossParticipants)
        .where(eq(guildBossParticipants.cycleRowId, locked.id));

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
        // Include current submitter participation flag.
        if (participant.participated) recipients.add(input.playerId);

        for (const pid of recipients) {
          await ensureClaim(tx, {
            claimId: `gb-ms:${locked.cycleId}:${ms.id}:${pid}`,
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
          claimId: `gb-part:${locked.cycleId}:${input.playerId}`,
          cycleRowId: locked.id,
          playerId: input.playerId,
          kind: 'participation',
          rewards: def.participationRewards,
        });
      }

      let guildXpGranted = locked.guildXpGranted;
      if (defeated) {
        participant = {
          ...participant,
          eligibleDefeat: participant.eligibleParticipation,
        };
        await tx
          .update(guildBossParticipants)
          .set({ eligibleDefeat: participant.eligibleDefeat })
          .where(
            and(
              eq(guildBossParticipants.cycleRowId, locked.id),
              eq(guildBossParticipants.playerId, input.playerId),
            ),
          );

        const partsForDefeat = await tx
          .select()
          .from(guildBossParticipants)
          .where(eq(guildBossParticipants.cycleRowId, locked.id));

        for (const part of partsForDefeat) {
          const eligible =
            part.eligibleParticipation ||
            (part.playerId === input.playerId && participant.eligibleParticipation);
          if (!eligible) continue;
          await ensureClaim(tx, {
            claimId: `gb-defeat:${locked.cycleId}:${part.playerId}`,
            cycleRowId: locked.id,
            playerId: part.playerId,
            kind: 'defeat',
            rewards: def.defeatRewards,
          });
          await tx
            .update(guildBossParticipants)
            .set({ eligibleDefeat: true })
            .where(
              and(
                eq(guildBossParticipants.cycleRowId, locked.id),
                eq(guildBossParticipants.playerId, part.playerId),
              ),
            );
        }

        if (!guildXpGranted) {
          guildXpGranted = true;
        }
      }

      const nextStatus: GuildBossStatus = defeated
        ? 'DEFEATED'
        : currentHp < locked.maxHp
          ? 'ACTIVE'
          : (locked.status as GuildBossStatus);

      await tx
        .update(guildBossCycles)
        .set({
          currentHp,
          totalDamage: locked.totalDamage + acceptedDamage,
          status: nextStatus,
          defeatedAt: defeated ? now : locked.defeatedAt,
          reachedMilestones: reached,
          guildXpGranted,
          updatedAt: now,
        })
        .where(eq(guildBossCycles.id, locked.id));

      await tx
        .update(guildBossAttempts)
        .set({
          status: 'submitted',
          submittedDamage: Math.max(0, Math.floor(input.damage)),
          acceptedDamage,
          endReason: input.endReason,
          finishedAt: now,
        })
        .where(eq(guildBossAttempts.id, input.attemptId));

      return {
        ok: true,
        validDamage: acceptedDamage,
        currentHp,
        defeated,
        alreadyProcessed: false,
        milestonesReached,
        _grantGuildXp: defeated && !locked.guildXpGranted,
        _contribution: computeGuildBossContribution(acceptedDamage, locked.maxHp),
      };
    });

    // Pós-transação: XP/contribution (evita lock cruzado com guilds).
    const extended = result as GuildBossSubmitResult & {
      _grantGuildXp?: boolean;
      _contribution?: number;
    };
    if (extended._grantGuildXp) {
      await addGuildXp(db, input.guildId, def.guildXpOnDefeat);
    }
    if (extended._contribution && extended._contribution > 0) {
      await addMemberContribution(db, input.guildId, input.playerId, extended._contribution);
    }

    console.info('[guild]', 'submitAttempt', {
      guildId: input.guildId,
      attemptId: input.attemptId,
      playerId: input.playerId,
      validDamage: extended.validDamage,
      defeated: extended.defeated,
      alreadyProcessed: extended.alreadyProcessed,
    });

    return {
      ok: extended.ok,
      reason: extended.reason,
      validDamage: extended.validDamage,
      currentHp: extended.currentHp,
      defeated: extended.defeated,
      alreadyProcessed: extended.alreadyProcessed,
      milestonesReached: extended.milestonesReached,
    };
  } catch (e) {
    return failSubmit(e instanceof Error ? e.message : 'Falha', cycle.currentHp);
  }
}

export async function claimReward(
  db: SocialDb,
  input: { guildId: string; playerId: string; claimId: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await assertMembership(db, input.guildId, input.playerId);
  } catch {
    return { ok: false, reason: 'Rewards ligados à Guild do ciclo — você não é membro.' };
  }

  const def = getGuildBossDefinition();
  const weekly = getServerWeeklyCycleId();
  const cycle = await findCycleByWeekly(db, input.guildId, def.bossId, weekly);
  if (!cycle) return { ok: false, reason: 'Estado inexistente' };

  const claimed = await db.transaction(async (tx) => {
    const claimRows = await tx
      .select()
      .from(guildBossPendingClaims)
      .where(
        and(
          eq(guildBossPendingClaims.claimId, input.claimId),
          eq(guildBossPendingClaims.cycleRowId, cycle.id),
          eq(guildBossPendingClaims.playerId, input.playerId),
        ),
      )
      .for('update')
      .limit(1);
    const claim = claimRows[0];
    if (!claim) return { ok: false as const, reason: 'Recompensa não encontrada' };
    if (claim.claimed) return { ok: false as const, reason: 'Já coletado' };

    await tx
      .update(guildBossPendingClaims)
      .set({ claimed: true })
      .where(eq(guildBossPendingClaims.claimId, input.claimId));

    const partRows = await tx
      .select()
      .from(guildBossParticipants)
      .where(
        and(
          eq(guildBossParticipants.cycleRowId, cycle.id),
          eq(guildBossParticipants.playerId, input.playerId),
        ),
      )
      .limit(1);
    if (partRows[0]) {
      const claimedIds = Array.isArray(partRows[0].claimedIds) ? [...partRows[0].claimedIds] : [];
      if (!claimedIds.includes(input.claimId)) claimedIds.push(input.claimId);
      await tx
        .update(guildBossParticipants)
        .set({ claimedIds })
        .where(
          and(
            eq(guildBossParticipants.cycleRowId, cycle.id),
            eq(guildBossParticipants.playerId, input.playerId),
          ),
        );
    }

    return { ok: true as const };
  });

  if (claimed.ok) {
    console.info('[guild]', 'claimReward', {
      guildId: input.guildId,
      playerId: input.playerId,
      claimId: input.claimId,
    });
  }
  return claimed;
}

export async function getParticipants(
  db: SocialDb,
  guildId: string,
): Promise<GuildBossParticipant[]> {
  const state = await getBossState(db, guildId);
  if (!state) return [];
  return Object.values(state.participants).sort((a, b) => b.totalDamage - a.totalDamage);
}

/** DEV / tests — aplica dano externo sem fluxo de UI. */
export async function applyExternalDamage(
  db: SocialDb,
  guildId: string,
  damage: number,
  actorId = 'mock-other',
): Promise<GuildBossSubmitResult> {
  // Garante player stub (FK).
  await db
    .insert(players)
    .values({
      id: actorId,
      nickname: actorId,
      tokenHash: `test-${actorId}`,
    })
    .onConflictDoNothing();

  // Garante membership se guild existir (senão ensureCycle falha).
  const guildRows = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
  const guild = guildRows[0] as GuildRow | undefined;
  if (!guild) {
    return failSubmit('Guild não encontrada.');
  }

  const member = await db
    .select()
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, actorId)))
    .limit(1);
  if (!member[0]) {
    // Não incrementa memberCount em path de teste se cheio — insert direto com cuidado.
    try {
      await db.insert(guildMembers).values({
        guildId,
        playerId: actorId,
        role: 'member',
        nickname: actorId,
        contribution: 0,
        playerLevel: 1,
      });
      await db
        .update(guilds)
        .set({ memberCount: sql`${guilds.memberCount} + 1`, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));
    } catch {
      // Já membro ou conflito — ok para teste.
    }
  }

  await ensureCycle(db, guildId, Math.max(99, guild.level));
  const started = await startAttempt(db, {
    guildId,
    playerId: actorId,
    nickname: actorId,
  });
  if (!started.ok || !started.attemptId) {
    return failSubmit(started.reason ?? 'Falha ao iniciar tentativa');
  }
  return submitAttempt(db, {
    guildId,
    attemptId: started.attemptId,
    playerId: actorId,
    damage,
    endReason: 'timeout',
  });
}
