import { getWorldBossDefinition, worldBossClaimId } from '@/constants/world-boss';
import { attemptResetCycleId, syncAttemptBucket } from '@/lib/boss-runtime';
import { grantBossRewards } from '@/lib/boss-rewards';
import {
  getDailyCycleId,
  getNextWeeklyResetMs,
  getWeeklyCycleId,
  missionNow,
} from '@/lib/mission-cycle';
import {
  applyAcceptedBossDamage,
  computeAcceptedBossDamage,
} from '@/lib/shared-boss-damage';
import type { BossReward } from '@/types/boss';
import type {
  WorldBossActiveAttempt,
  WorldBossAttemptEndReason,
  WorldBossCycleState,
  WorldBossParticipant,
  WorldBossPendingClaim,
  WorldBossProvider,
  WorldBossRankEntry,
  WorldBossRankingSnapshot,
  WorldBossStatus,
  WorldBossSubmitResult,
} from '@/types/world-boss';

const STORAGE_KEY = 'idle-mmorpg:world-boss-v1';
const MAX_SUBMITTED_DAMAGE = 1_000_000_000_000;

type StoredBlob = {
  state: WorldBossCycleState | null;
  processedAttemptIds: string[];
};

function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `wba-${crypto.randomUUID()}`;
  }
  return `wba-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function resolveStatus(
  state: Pick<WorldBossCycleState, 'status' | 'currentHp' | 'endsAt'>,
): WorldBossStatus {
  if (state.status === 'DEFEATED' || state.currentHp <= 0) return 'DEFEATED';
  const endsAt = state.endsAt;
  if (endsAt != null && missionNow() >= endsAt) return 'EXPIRED';
  if (state.status === 'EXPIRED') return 'EXPIRED';
  return 'ACTIVE';
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

function compareRank(a: WorldBossParticipant, b: WorldBossParticipant): number {
  if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
  if (b.bestAttemptDamage !== a.bestAttemptDamage) {
    return b.bestAttemptDamage - a.bestAttemptDamage;
  }
  return a.scoreUpdatedAt - b.scoreUpdatedAt;
}

function toRankEntry(p: WorldBossParticipant, rank: number): WorldBossRankEntry {
  return {
    rank,
    playerId: p.playerId,
    nickname: p.nickname,
    totalDamage: p.totalDamage,
    bestAttemptDamage: p.bestAttemptDamage,
  };
}

/**
 * Provider local — simulação DEV (estado global único, não per-guild).
 * Commits de dano serializam no event-loop (mesmo clamp do server).
 */
export class LocalWorldBossProvider implements WorldBossProvider {
  readonly id = 'local-mock';
  private state: WorldBossCycleState | null = null;
  private processedAttemptIds: string[] = [];
  private loaded = false;
  private forceFail = false;
  private submitChain: Promise<unknown> = Promise.resolve();
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
    if (this.forceFail) throw new Error('World Boss provider indisponível');
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.submitChain.then(fn, fn);
    this.submitChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredBlob | WorldBossCycleState;
      if (parsed && 'state' in parsed) {
        this.state = parsed.state ?? null;
        this.processedAttemptIds = Array.isArray(parsed.processedAttemptIds)
          ? parsed.processedAttemptIds
          : [];
      } else if (parsed && 'cycleId' in parsed) {
        this.state = parsed as WorldBossCycleState;
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
      const blob: StoredBlob = {
        state: this.state,
        processedAttemptIds: this.processedAttemptIds.slice(-500),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch {
      // ignore
    }
    this.bump();
  }

  private setState(next: WorldBossCycleState | null): void {
    this.state = next;
    this.persist();
  }

  /** Leitura síncrona para UI/DEV. */
  peekState(): WorldBossCycleState | null {
    this.ensureLoaded();
    return this.state;
  }

  async getState(): Promise<WorldBossCycleState | null> {
    this.assertReady();
    this.ensureLoaded();
    if (!this.state) return null;
    const status = resolveStatus(this.state);
    if (status !== this.state.status) {
      const next = { ...this.state, status };
      this.setState(next);
      return next;
    }
    return this.state;
  }

  async ensureCycle(_playerLevel?: number): Promise<WorldBossCycleState> {
    this.assertReady();
    this.ensureLoaded();
    const def = getWorldBossDefinition();
    const weekly = getWeeklyCycleId();
    const existing = this.state;

    if (existing && existing.cycleId === weekly) {
      const status = resolveStatus(existing);
      if (status !== existing.status) {
        const next = { ...existing, status };
        this.setState(next);
        return next;
      }
      return existing;
    }

    const now = missionNow();
    const state: WorldBossCycleState = {
      id: `wbc-${def.bossId}-${weekly}`,
      bossId: def.bossId,
      definitionId: def.id,
      cycleId: weekly,
      maxHp: def.maxHp,
      currentHp: def.maxHp,
      status: 'ACTIVE',
      startedAt: now,
      endsAt: getNextWeeklyResetMs(),
      defeatedAt: null,
      totalDamage: 0,
      participantCount: 0,
      reachedMilestones: [],
      participants: {},
      pendingClaims: {},
      activeAttempts: {},
    };
    this.processedAttemptIds = [];
    this.setState(state);
    return state;
  }

  private ensureParticipant(
    state: WorldBossCycleState,
    playerId: string,
    nickname: string,
  ): WorldBossParticipant {
    const def = getWorldBossDefinition();
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
    return {
      ...p,
      attemptsUsed: synced.used,
      attemptsResetCycleId: synced.resetCycleId,
    };
  }

  async startAttempt(input: {
    playerId: string;
    nickname: string;
    playerLevel: number;
  }): Promise<{
    ok: boolean;
    reason?: string;
    attemptId?: string;
    startHp?: number;
    maxHp?: number;
    cycleId?: string;
  }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Falha' };
    }

    const def = getWorldBossDefinition();
    if (input.playerLevel < def.minimumPlayerLevel) {
      return { ok: false, reason: `Requer Level ${def.minimumPlayerLevel}.` };
    }

    let state = await this.ensureCycle(input.playerLevel);
    const status = resolveStatus(state);
    state = { ...state, status };

    if (status === 'DEFEATED' || state.currentHp <= 0) {
      return { ok: false, reason: 'World Boss já derrotado neste ciclo.', cycleId: state.cycleId };
    }
    if (status === 'EXPIRED') {
      return { ok: false, reason: 'Ciclo expirado.', cycleId: state.cycleId };
    }
    if (status !== 'ACTIVE') {
      return { ok: false, reason: 'World Boss indisponível.', cycleId: state.cycleId };
    }

    const existing = state.activeAttempts[input.playerId];
    if (existing?.status === 'active') {
      return {
        ok: false,
        reason: 'Já existe uma tentativa ativa (não recuperável por reload).',
        attemptId: existing.attemptId,
        cycleId: state.cycleId,
      };
    }

    let participant = this.ensureParticipant(state, input.playerId, input.nickname);
    if (participant.attemptsUsed >= def.maxAttempts) {
      return { ok: false, reason: 'Sem tentativas restantes hoje.', cycleId: state.cycleId };
    }

    const attemptId = newAttemptId();
    participant = {
      ...participant,
      attemptsUsed: participant.attemptsUsed + 1,
    };
    const active: WorldBossActiveAttempt = {
      attemptId,
      playerId: input.playerId,
      bossId: def.bossId,
      cycleId: state.cycleId,
      startedAt: missionNow(),
      status: 'active',
      localDamage: 0,
    };

    const next: WorldBossCycleState = {
      ...state,
      status: 'ACTIVE',
      startedAt: state.startedAt ?? missionNow(),
      participants: { ...state.participants, [input.playerId]: participant },
      activeAttempts: { ...state.activeAttempts, [input.playerId]: active },
    };
    this.setState(next);

    return {
      ok: true,
      attemptId,
      startHp: next.currentHp,
      maxHp: next.maxHp,
      cycleId: next.cycleId,
    };
  }

  async submitAttempt(input: {
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  }): Promise<WorldBossSubmitResult> {
    return this.enqueue(() => this.submitAttemptUnlocked(input));
  }

  private async submitAttemptUnlocked(input: {
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  }): Promise<WorldBossSubmitResult> {
    try {
      this.assertReady();
    } catch (e) {
      return failSubmit(e instanceof Error ? e.message : 'Falha');
    }

    this.ensureLoaded();
    const state = this.state;
    if (!state) return failSubmit('Estado inexistente');

    if (this.processedAttemptIds.includes(input.attemptId)) {
      return {
        ok: true,
        validDamage: 0,
        currentHp: state.currentHp,
        defeated: state.currentHp <= 0 || state.status === 'DEFEATED',
        alreadyProcessed: true,
        milestonesReached: [],
      };
    }

    const active = state.activeAttempts[input.playerId];
    if (!active || active.attemptId !== input.attemptId || active.status !== 'active') {
      return failSubmit('Tentativa inválida', state.currentHp);
    }

    const def = getWorldBossDefinition();
    const submitted = floorSubmittedDamage(input.damage);
    let keepDamage = true;
    if (input.endReason === 'abandon' && !def.abandonKeepsDamage) {
      keepDamage = false;
    }

    let acceptedDamage = 0;
    if (keepDamage && state.currentHp > 0 && state.status !== 'DEFEATED') {
      acceptedDamage = computeAcceptedBossDamage(submitted, state.currentHp);
    }

    const hpBefore = state.currentHp;
    const applied = applyAcceptedBossDamage(state.currentHp, acceptedDamage);
    const currentHp = applied.currentHp;
    const defeated = applied.defeated;
    const hpAfter = currentHp;
    const nowMs = missionNow();

    let participant =
      state.participants[input.playerId] ?? emptyParticipant(input.playerId, input.playerId);
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

    const reached = [...state.reachedMilestones];
    const milestonesReached: string[] = [];
    const pendingClaims = { ...state.pendingClaims };
    const ratioBefore = state.maxHp > 0 ? hpBefore / state.maxHp : 0;
    const ratioAfter = state.maxHp > 0 ? hpAfter / state.maxHp : 0;

    const pushClaim = (
      pid: string,
      claim: WorldBossPendingClaim,
    ): void => {
      const list = pendingClaims[pid] ? [...pendingClaims[pid]!] : [];
      if (!list.some((c) => c.claimId === claim.claimId)) {
        list.push(claim);
        pendingClaims[pid] = list;
      }
    };

    const participantsSnapshot: Record<string, WorldBossParticipant> = {
      ...state.participants,
      [input.playerId]: participant,
    };

    for (const ms of def.milestones) {
      if (reached.includes(ms.id)) continue;
      const crossed = ratioBefore > ms.hpRatio && ratioAfter <= ms.hpRatio;
      if (!crossed) continue;
      reached.push(ms.id);
      milestonesReached.push(ms.id);

      const recipients = new Set<string>([input.playerId]);
      for (const [pid, part] of Object.entries(participantsSnapshot)) {
        if (part.participated || pid === input.playerId) recipients.add(pid);
      }

      for (const pid of recipients) {
        pushClaim(pid, {
          claimId: worldBossClaimId({
            cycleId: state.cycleId,
            bossId: state.bossId,
            playerId: pid,
            rewardType: 'milestone',
            milestoneId: ms.id,
          }),
          kind: 'milestone',
          milestoneId: ms.id,
          rewards: [...ms.rewards],
          claimed: false,
        });
      }
    }

    if (participant.eligibleParticipation) {
      pushClaim(input.playerId, {
        claimId: worldBossClaimId({
          cycleId: state.cycleId,
          bossId: state.bossId,
          playerId: input.playerId,
          rewardType: 'participation',
        }),
        kind: 'participation',
        rewards: [...def.participationRewards],
        claimed: false,
      });
    }

    if (defeated) {
      participant = {
        ...participant,
        eligibleDefeat: participant.eligibleParticipation,
      };
      participantsSnapshot[input.playerId] = participant;

      for (const [pid, part] of Object.entries(participantsSnapshot)) {
        const eligible =
          part.eligibleParticipation ||
          (pid === input.playerId && participant.eligibleParticipation);
        if (!eligible) continue;
        pushClaim(pid, {
          claimId: worldBossClaimId({
            cycleId: state.cycleId,
            bossId: state.bossId,
            playerId: pid,
            rewardType: 'defeat',
          }),
          kind: 'defeat',
          rewards: [...def.defeatRewards],
          claimed: false,
        });
        participantsSnapshot[pid] = { ...part, eligibleDefeat: true };
      }
    }

    const activeAttempts = { ...state.activeAttempts };
    delete activeAttempts[input.playerId];

    const participantCount = Object.values(participantsSnapshot).filter(
      (p) => p.participated || p.totalDamage > 0,
    ).length;

    const nextStatus: WorldBossStatus = defeated
      ? 'DEFEATED'
      : resolveStatus({ status: state.status, currentHp, endsAt: state.endsAt });

    const next: WorldBossCycleState = {
      ...state,
      currentHp,
      status: nextStatus === 'EXPIRED' && !defeated ? 'EXPIRED' : nextStatus,
      defeatedAt: defeated ? nowMs : state.defeatedAt,
      totalDamage: state.totalDamage + acceptedDamage,
      participantCount,
      participants: participantsSnapshot,
      reachedMilestones: reached,
      pendingClaims,
      activeAttempts,
    };

    this.processedAttemptIds = [...this.processedAttemptIds, input.attemptId].slice(-500);
    this.setState(next);

    return {
      ok: true,
      validDamage: acceptedDamage,
      currentHp,
      defeated,
      alreadyProcessed: false,
      milestonesReached,
    };
  }

  async getRanking(playerId: string): Promise<WorldBossRankingSnapshot> {
    this.assertReady();
    this.ensureLoaded();
    const empty: WorldBossRankingSnapshot = { top: [], myRank: null, totalParticipants: 0 };
    const state = this.state;
    if (!state) return empty;

    const ranked = Object.values(state.participants)
      .filter((p) => p.participated || p.totalDamage > 0)
      .sort(compareRank);

    const totalParticipants = ranked.length;
    const top = ranked.slice(0, 100).map((p, i) => toRankEntry(p, i + 1));
    const myIndex = ranked.findIndex((p) => p.playerId === playerId);
    const myRank = myIndex >= 0 ? toRankEntry(ranked[myIndex]!, myIndex + 1) : null;

    return { top, myRank, totalParticipants };
  }

  async claimReward(input: {
    playerId: string;
    claimId: string;
  }): Promise<{ ok: boolean; reason?: string; rewards?: BossReward[] }> {
    try {
      this.assertReady();
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Falha' };
    }

    this.ensureLoaded();
    const state = this.state;
    if (!state) return { ok: false, reason: 'Estado inexistente' };

    const list = state.pendingClaims[input.playerId] ?? [];
    const claim = list.find((c) => c.claimId === input.claimId);
    if (!claim) return { ok: false, reason: 'Recompensa não encontrada' };
    if (claim.claimed) return { ok: false, reason: 'Já coletado' };

    const marked: WorldBossPendingClaim = { ...claim, claimed: true };
    const nextList = list.map((c) => (c.claimId === input.claimId ? marked : c));
    const participant = state.participants[input.playerId];
    const nextParticipant = participant
      ? {
          ...participant,
          claimedIds: participant.claimedIds.includes(input.claimId)
            ? participant.claimedIds
            : [...participant.claimedIds, input.claimId],
        }
      : participant;

    this.setState({
      ...state,
      pendingClaims: { ...state.pendingClaims, [input.playerId]: nextList },
      participants: nextParticipant
        ? { ...state.participants, [input.playerId]: nextParticipant }
        : state.participants,
    });

    const grant = grantBossRewards(claim.rewards, {
      claimId: input.claimId,
      source: 'worldBoss',
    });
    if (!grant.ok) {
      return { ok: false, reason: grant.reason, rewards: [...claim.rewards] };
    }

    return { ok: true, rewards: [...claim.rewards] };
  }

  async applyExternalDamage(
    damage: number,
    actorId = 'mock-other',
    nickname = actorId,
  ): Promise<WorldBossSubmitResult> {
    this.assertReady();
    await this.ensureCycle(99);
    const started = await this.startAttempt({
      playerId: actorId,
      nickname,
      playerLevel: 99,
    });
    if (!started.ok || !started.attemptId) {
      return failSubmit(started.reason ?? 'Falha ao iniciar tentativa');
    }
    return this.submitAttempt({
      attemptId: started.attemptId,
      playerId: actorId,
      damage,
      endReason: 'timeout',
    });
  }

  async setSharedHp(hp: number): Promise<void> {
    this.assertReady();
    const state = await this.ensureCycle();
    const currentHp = Math.max(0, Math.min(state.maxHp, Math.floor(hp)));
    const status: WorldBossStatus =
      currentHp <= 0
        ? 'DEFEATED'
        : resolveStatus({ status: 'ACTIVE', currentHp, endsAt: state.endsAt });
    this.setState({
      ...state,
      currentHp,
      status,
      defeatedAt: currentHp <= 0 ? missionNow() : null,
    });
  }

  async forceDefeat(opts?: { grantEntitlements?: boolean }): Promise<void> {
    this.assertReady();
    const state = await this.ensureCycle();
    const now = missionNow();
    const def = getWorldBossDefinition();
    const pendingClaims = { ...state.pendingClaims };
    const participants = { ...state.participants };

    if (opts?.grantEntitlements) {
      for (const [pid, part] of Object.entries(participants)) {
        if (!part.eligibleParticipation) continue;
        const claimId = worldBossClaimId({
          cycleId: state.cycleId,
          bossId: state.bossId,
          playerId: pid,
          rewardType: 'defeat',
        });
        const list = pendingClaims[pid] ? [...pendingClaims[pid]!] : [];
        if (!list.some((c) => c.claimId === claimId)) {
          list.push({
            claimId,
            kind: 'defeat',
            rewards: [...def.defeatRewards],
            claimed: false,
          });
          pendingClaims[pid] = list;
        }
        participants[pid] = { ...part, eligibleDefeat: true };
      }
    }

    this.setState({
      ...state,
      currentHp: 0,
      status: 'DEFEATED',
      defeatedAt: state.defeatedAt ?? now,
      participants,
      pendingClaims,
    });
  }

  async resetCycle(): Promise<void> {
    this.assertReady();
    this.state = null;
    this.processedAttemptIds = [];
    this.persist();
    await this.ensureCycle();
  }

  async resetPlayerAttempts(playerId: string): Promise<void> {
    this.assertReady();
    this.ensureLoaded();
    const state = this.state;
    if (!state) return;

    const def = getWorldBossDefinition();
    const daily = getDailyCycleId();
    const weekly = getWeeklyCycleId();
    const resetId = attemptResetCycleId(def.attemptResetType, daily, weekly);
    const participant = state.participants[playerId];
    const participants = { ...state.participants };
    if (participant) {
      participants[playerId] = {
        ...participant,
        attemptsUsed: 0,
        attemptsResetCycleId: resetId,
      };
    }

    const activeAttempts = { ...state.activeAttempts };
    delete activeAttempts[playerId];

    this.setState({
      ...state,
      participants,
      activeAttempts,
    });
  }
}

let singleton: LocalWorldBossProvider | null = null;

export function getLocalWorldBossProvider(): LocalWorldBossProvider {
  if (!singleton) singleton = new LocalWorldBossProvider();
  return singleton;
}

export function resetLocalWorldBossProvider(): void {
  singleton = new LocalWorldBossProvider();
}
