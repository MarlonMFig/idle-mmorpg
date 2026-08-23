import {
  computeGuildBossContribution,
  getGuildBossDefinition,
} from '@/constants/guild-boss';
import {
  emitGuildBossAttemptFinished,
  emitGuildBossDefeated,
  emitGuildBossMilestoneReached,
} from '@/lib/guild-boss-events';
import { getDailyCycleId, getWeeklyCycleId, missionNow } from '@/lib/mission-cycle';
import { attemptResetCycleId, syncAttemptBucket } from '@/lib/boss-runtime';
import { grantBossRewards } from '@/lib/boss-rewards';
import { getLocalGuildProvider } from '@/lib/guild-local-provider';
import type {
  GuildBossActiveAttempt,
  GuildBossAttemptEndReason,
  GuildBossParticipant,
  GuildBossPendingClaim,
  GuildBossProvider,
  GuildBossState,
  GuildBossStatus,
  GuildBossSubmitResult,
} from '@/types/guild-boss';

const STORAGE_KEY = 'idle-mmorpg:guild-boss-v1';

function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `gba-${crypto.randomUUID()}`;
  }
  return `gba-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function resolveStatus(
  state: GuildBossState,
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

/**
 * Provider local — simulação DEV.
 * Commit de dano é atômico no event-loop (JS single-thread).
 * Guild Boss global real exige backend com transação.
 */
export class LocalGuildBossProvider implements GuildBossProvider {
  readonly id = 'local-mock';
  private states = new Map<string, GuildBossState>();
  private loaded = false;
  private forceFail = false;
  private bumpListeners = new Set<() => void>();

  setForceFail(fail: boolean): void {
    this.forceFail = fail;
  }

  onChange(fn: () => void): () => void {
    this.bumpListeners.add(fn);
    return () => this.bumpListeners.delete(fn);
  }

  private bump(): void {
    for (const fn of this.bumpListeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  private assertReady(): void {
    if (this.forceFail) throw new Error('Guild Boss provider indisponível');
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, GuildBossState>;
      for (const [id, state] of Object.entries(parsed)) {
        if (state?.guildId) this.states.set(id, state);
      }
    } catch {
      // ignore
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') {
      this.bump();
      return;
    }
    try {
      const obj: Record<string, GuildBossState> = {};
      for (const [id, s] of this.states) obj[id] = s;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
    this.bump();
  }

  private get(guildId: string): GuildBossState | null {
    this.ensureLoaded();
    return this.states.get(guildId) ?? null;
  }

  /** Leitura síncrona para UI/DEV. */
  peekState(guildId: string): GuildBossState | null {
    return this.get(guildId);
  }

  private set(state: GuildBossState): void {
    this.states.set(state.guildId, state);
    this.persist();
  }

  invalidateState(guildId: string): void {
    this.ensureLoaded();
    this.states.delete(guildId);
    this.persist();
  }

  async getBossState(guildId: string): Promise<GuildBossState | null> {
    this.assertReady();
    return this.get(guildId);
  }

  async ensureCycle(guildId: string, guildLevel: number): Promise<GuildBossState> {
    this.assertReady();
    const def = getGuildBossDefinition();
    const weekly = getWeeklyCycleId();
    const existing = this.get(guildId);
    if (existing && existing.cycleId === weekly) {
      const status = resolveStatus(existing, guildLevel, def.guildLevelRequirement);
      if (status !== existing.status) {
        const next = { ...existing, status };
        this.set(next);
        return next;
      }
      return existing;
    }
    // Novo ciclo — não carrega HP anterior
    const status: GuildBossStatus =
      guildLevel < def.guildLevelRequirement ? 'LOCKED' : 'AVAILABLE';
    const state: GuildBossState = {
      guildId,
      bossId: def.bossId,
      definitionId: def.id,
      cycleId: weekly,
      maxHp: def.sharedHp,
      currentHp: def.sharedHp,
      status,
      startedAt: status === 'AVAILABLE' ? missionNow() : null,
      defeatedAt: null,
      participants: {},
      totalDamage: 0,
      reachedMilestones: [],
      guildXpGranted: false,
      pendingClaims: {},
      activeAttempts: {},
      processedAttemptIds: [],
    };
    this.set(state);
    return state;
  }

  private ensureParticipant(
    state: GuildBossState,
    playerId: string,
    nickname: string,
  ): GuildBossParticipant {
    const def = getGuildBossDefinition();
    const daily = getDailyCycleId();
    const weekly = getWeeklyCycleId();
    const cycleId = attemptResetCycleId(def.attemptResetType, daily, weekly);
    let p = state.participants[playerId];
    if (!p) {
      p = emptyParticipant(playerId, nickname);
    } else {
      p = { ...p, nickname: nickname || p.nickname };
    }
    const synced = syncAttemptBucket(
      { used: p.attemptsUsed, resetCycleId: p.attemptsResetCycleId },
      def.attemptResetType,
      cycleId,
    );
    p = {
      ...p,
      attemptsUsed: synced.used,
      attemptsResetCycleId: synced.resetCycleId,
    };
    return p;
  }

  async startAttempt(input: {
    guildId: string;
    playerId: string;
    nickname: string;
  }): Promise<{ ok: boolean; reason?: string; attemptId?: string; startHp?: number; maxHp?: number }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = getLocalGuildProvider().listAll().find((g) => g.id === input.guildId);
    if (!guild) return { ok: false, reason: 'Guild não encontrada.' };
    if (!guild.members.some((m) => m.playerId === input.playerId)) {
      return { ok: false, reason: 'Você não é membro desta Guild.' };
    }
    const def = getGuildBossDefinition();
    let state = await this.ensureCycle(input.guildId, guild.level);
    state = { ...state, status: resolveStatus(state, guild.level, def.guildLevelRequirement) };

    if (state.status === 'LOCKED') {
      return { ok: false, reason: `Requer Guild Level ${def.guildLevelRequirement}.` };
    }
    if (state.status === 'DEFEATED' || state.currentHp <= 0) {
      return { ok: false, reason: 'Guild Boss já derrotado neste ciclo.' };
    }
    if (state.status === 'EXPIRED') {
      return { ok: false, reason: 'Ciclo expirado.' };
    }

    const existing = state.activeAttempts[input.playerId];
    if (existing?.status === 'active') {
      return {
        ok: false,
        reason: 'Já existe uma tentativa ativa (não recuperável por reload).',
        attemptId: existing.attemptId,
      };
    }

    let participant = this.ensureParticipant(state, input.playerId, input.nickname);
    if (participant.attemptsUsed >= def.maxAttemptsPerMember) {
      return { ok: false, reason: 'Sem tentativas restantes hoje.' };
    }

    const attemptId = newAttemptId();
    participant = {
      ...participant,
      attemptsUsed: participant.attemptsUsed + 1,
    };
    const active: GuildBossActiveAttempt = {
      attemptId,
      playerId: input.playerId,
      bossId: def.bossId,
      guildId: input.guildId,
      startedAt: missionNow(),
      status: 'active',
      localDamage: 0,
    };

    const next: GuildBossState = {
      ...state,
      status: state.currentHp < state.maxHp ? 'ACTIVE' : 'ACTIVE',
      startedAt: state.startedAt ?? missionNow(),
      participants: { ...state.participants, [input.playerId]: participant },
      activeAttempts: { ...state.activeAttempts, [input.playerId]: active },
    };
    this.set(next);
    return {
      ok: true,
      attemptId,
      startHp: next.currentHp,
      maxHp: next.maxHp,
    };
  }

  /**
   * Commit atômico de dano.
   * validDamage = min(damage, currentHp). Overkill descartado.
   * attemptId processado uma única vez (idempotência).
   */
  async submitAttempt(input: {
    guildId: string;
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: GuildBossAttemptEndReason;
  }): Promise<GuildBossSubmitResult> {
    try {
      this.assertReady();
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : 'Falha',
        validDamage: 0,
        currentHp: 0,
        defeated: false,
        alreadyProcessed: false,
        milestonesReached: [],
      };
    }

    const state = this.get(input.guildId);
    if (!state) {
      return {
        ok: false,
        reason: 'Estado inexistente',
        validDamage: 0,
        currentHp: 0,
        defeated: false,
        alreadyProcessed: false,
        milestonesReached: [],
      };
    }

    if (state.processedAttemptIds.includes(input.attemptId)) {
      return {
        ok: true,
        validDamage: 0,
        currentHp: state.currentHp,
        defeated: state.currentHp <= 0,
        alreadyProcessed: true,
        milestonesReached: [],
      };
    }

    const active = state.activeAttempts[input.playerId];
    if (!active || active.attemptId !== input.attemptId) {
      return {
        ok: false,
        reason: 'Tentativa inválida',
        validDamage: 0,
        currentHp: state.currentHp,
        defeated: state.currentHp <= 0,
        alreadyProcessed: false,
        milestonesReached: [],
      };
    }

    const def = getGuildBossDefinition();
    let keepDamage = true;
    if (input.endReason === 'abandon' && !def.abandonKeepsDamage) {
      keepDamage = false;
    }

    // Boss já morto antes deste commit → 0
    let validDamage = 0;
    if (keepDamage && state.currentHp > 0 && state.status !== 'DEFEATED') {
      const raw = Math.max(0, Math.floor(input.damage));
      validDamage = Math.min(raw, state.currentHp);
    }

    const currentHp = Math.max(0, state.currentHp - validDamage);
    const defeated = currentHp <= 0;
    const hpBefore = state.currentHp;
    const hpAfter = currentHp;

    let participant =
      state.participants[input.playerId] ??
      emptyParticipant(input.playerId, input.playerId);
    participant = {
      ...participant,
      totalDamage: participant.totalDamage + validDamage,
      bestAttemptDamage: Math.max(participant.bestAttemptDamage, validDamage),
      participated: participant.participated || validDamage > 0,
      eligibleParticipation:
        participant.eligibleParticipation ||
        validDamage >= def.minimumParticipationDamage ||
        participant.totalDamage + validDamage >= def.minimumParticipationDamage,
    };

    const contribution = computeGuildBossContribution(validDamage, state.maxHp);
    if (contribution > 0) {
      void this.applyMemberContribution(input.guildId, input.playerId, contribution);
    }

    const milestonesReached: string[] = [];
    const reached = [...state.reachedMilestones];
    const pendingClaims = { ...state.pendingClaims };
    const ratioBefore = state.maxHp > 0 ? hpBefore / state.maxHp : 0;
    const ratioAfter = state.maxHp > 0 ? hpAfter / state.maxHp : 0;

    for (const ms of def.milestones) {
      if (reached.includes(ms.id)) continue;
      const crossed = ratioBefore > ms.hpRatio && ratioAfter <= ms.hpRatio;
      if (!crossed) continue;
      reached.push(ms.id);
      milestonesReached.push(ms.id);
      emitGuildBossMilestoneReached({
        guildId: input.guildId,
        milestoneId: ms.id,
        hpRatio: ms.hpRatio,
      });
      const recipients = new Set<string>([input.playerId]);
      for (const [pid, part] of Object.entries(state.participants)) {
        if (part.participated) recipients.add(pid);
      }
      for (const pid of recipients) {
        const claimId = `gb-ms:${state.cycleId}:${ms.id}:${pid}`;
        const list = pendingClaims[pid] ? [...pendingClaims[pid]] : [];
        if (!list.some((c) => c.claimId === claimId)) {
          list.push({
            claimId,
            kind: 'milestone',
            milestoneId: ms.id,
            rewards: [...ms.rewards],
            claimed: false,
          });
          pendingClaims[pid] = list;
        }
      }
    }

    if (participant.eligibleParticipation) {
      const claimId = `gb-part:${state.cycleId}:${input.playerId}`;
      const list = pendingClaims[input.playerId] ? [...pendingClaims[input.playerId]] : [];
      if (!list.some((c) => c.claimId === claimId)) {
        list.push({
          claimId,
          kind: 'participation',
          rewards: [...def.participationRewards],
          claimed: false,
        });
        pendingClaims[input.playerId] = list;
      }
    }

    let guildXpGranted = state.guildXpGranted;
    if (defeated) {
      participant = { ...participant, eligibleDefeat: participant.eligibleParticipation };
      // Defeat rewards for all eligible participants
      const allParts = {
        ...state.participants,
        [input.playerId]: participant,
      };
      for (const [pid, part] of Object.entries(allParts)) {
        const eligible =
          part.eligibleParticipation ||
          (pid === input.playerId && participant.eligibleParticipation);
        if (!eligible) continue;
        const claimId = `gb-defeat:${state.cycleId}:${pid}`;
        const list = pendingClaims[pid] ? [...pendingClaims[pid]] : [];
        if (!list.some((c) => c.claimId === claimId)) {
          list.push({
            claimId,
            kind: 'defeat',
            rewards: [...def.defeatRewards],
            claimed: false,
          });
          pendingClaims[pid] = list;
        }
        allParts[pid] = { ...part, eligibleDefeat: true };
      }
      Object.assign(state.participants, allParts);

      if (!guildXpGranted) {
        guildXpGranted = true;
        void getLocalGuildProvider().addGuildXp(input.guildId, def.guildXpOnDefeat);
      }
      emitGuildBossDefeated({
        guildId: input.guildId,
        bossId: state.bossId,
        cycleId: state.cycleId,
      });
    }

    const activeAttempts = { ...state.activeAttempts };
    delete activeAttempts[input.playerId];

    const next: GuildBossState = {
      ...state,
      currentHp,
      status: defeated ? 'DEFEATED' : currentHp < state.maxHp ? 'ACTIVE' : state.status,
      defeatedAt: defeated ? missionNow() : state.defeatedAt,
      totalDamage: state.totalDamage + validDamage,
      participants: {
        ...state.participants,
        [input.playerId]: participant,
      },
      reachedMilestones: reached,
      pendingClaims,
      guildXpGranted,
      activeAttempts,
      processedAttemptIds: [...state.processedAttemptIds, input.attemptId].slice(-500),
    };
    this.set(next);

    emitGuildBossAttemptFinished({
      guildId: input.guildId,
      attemptId: input.attemptId,
      playerId: input.playerId,
      validDamage,
      endReason: input.endReason,
    });

    return {
      ok: true,
      validDamage,
      currentHp,
      defeated,
      alreadyProcessed: false,
      milestonesReached,
    };
  }

  private async applyMemberContribution(
    guildId: string,
    playerId: string,
    amount: number,
  ): Promise<void> {
    await getLocalGuildProvider().addMemberContribution(guildId, playerId, amount);
  }

  async getParticipants(guildId: string): Promise<GuildBossParticipant[]> {
    this.assertReady();
    const state = this.get(guildId);
    if (!state) return [];
    return Object.values(state.participants).sort((a, b) => b.totalDamage - a.totalDamage);
  }

  async claimReward(input: {
    guildId: string;
    playerId: string;
    claimId: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Falha' };
    }
    const guild = getLocalGuildProvider().listAll().find((g) => g.id === input.guildId);
    if (!guild?.members.some((m) => m.playerId === input.playerId)) {
      return { ok: false, reason: 'Rewards ligados à Guild do ciclo — você não é membro.' };
    }
    const state = this.get(input.guildId);
    if (!state) return { ok: false, reason: 'Estado inexistente' };
    const list = state.pendingClaims[input.playerId] ?? [];
    const claim = list.find((c) => c.claimId === input.claimId);
    if (!claim) return { ok: false, reason: 'Recompensa não encontrada' };
    if (claim.claimed) return { ok: false, reason: 'Já coletado' };

    const marked: GuildBossPendingClaim = { ...claim, claimed: true };
    const nextList = list.map((c) => (c.claimId === input.claimId ? marked : c));
    const participant = state.participants[input.playerId];
    const nextParticipant = participant
      ? {
          ...participant,
          claimedIds: [...participant.claimedIds, input.claimId],
          rewardClaimed: true,
        }
      : participant;

    const grant = grantBossRewards(claim.rewards, {
      claimId: input.claimId,
      source: 'guildBoss',
    });
    if (!grant.ok) {
      return { ok: false, reason: grant.reason };
    }

    this.set({
      ...state,
      pendingClaims: { ...state.pendingClaims, [input.playerId]: nextList },
      participants: nextParticipant
        ? { ...state.participants, [input.playerId]: nextParticipant }
        : state.participants,
    });
    return { ok: true };
  }

  async applyExternalDamage(
    guildId: string,
    damage: number,
    actorId = 'mock-other',
  ): Promise<GuildBossSubmitResult> {
    this.assertReady();
    let state = this.get(guildId);
    if (!state) {
      state = await this.ensureCycle(guildId, 99);
    }
    const attemptId = newAttemptId();
    const nickname = actorId;
    const participant = this.ensureParticipant(state, actorId, nickname);
    const active: GuildBossActiveAttempt = {
      attemptId,
      playerId: actorId,
      bossId: state.bossId,
      guildId,
      startedAt: missionNow(),
      status: 'active',
      localDamage: 0,
    };
    this.set({
      ...state,
      participants: { ...state.participants, [actorId]: participant },
      activeAttempts: { ...state.activeAttempts, [actorId]: active },
    });
    return this.submitAttempt({
      guildId,
      attemptId,
      playerId: actorId,
      damage,
      endReason: 'timeout',
    });
  }

  async setSharedHp(guildId: string, hp: number): Promise<void> {
    this.assertReady();
    const state = this.get(guildId) ?? (await this.ensureCycle(guildId, 99));
    const currentHp = Math.max(0, Math.min(state.maxHp, Math.floor(hp)));
    this.set({
      ...state,
      currentHp,
      status: currentHp <= 0 ? 'DEFEATED' : currentHp < state.maxHp ? 'ACTIVE' : 'AVAILABLE',
      defeatedAt: currentHp <= 0 ? missionNow() : null,
    });
  }

  async forceDefeat(guildId: string): Promise<void> {
    await this.setSharedHp(guildId, 0);
  }

  async resetCycle(guildId: string): Promise<void> {
    this.assertReady();
    this.states.delete(guildId);
    this.persist();
    await this.ensureCycle(guildId, 99);
  }
}

let singleton: LocalGuildBossProvider | null = null;

export function getLocalGuildBossProvider(): LocalGuildBossProvider {
  if (!singleton) singleton = new LocalGuildBossProvider();
  return singleton;
}

export function resetLocalGuildBossProvider(): void {
  singleton = new LocalGuildBossProvider();
}

/** @deprecated Prefer `@/lib/guild-boss-provider`. Mantido para imports existentes. */
export { getGuildBossProvider } from '@/lib/guild-boss-provider';

