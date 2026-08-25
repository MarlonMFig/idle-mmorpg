import { isDevMode } from '@/config/devConfig';
import { getBossDefinition, listSoloBossDefinitions } from '@/data/bosses/boss-registry';
import { getDailyCycleId, getWeeklyCycleId } from '@/lib/mission-cycle';
import {
  emitBossAttemptStarted,
  emitBossDefeated,
  emitBossFailed,
} from '@/lib/boss-events';
import { grantBossRewards } from '@/lib/boss-rewards';
import {
  attemptResetCycleId,
  canConsumeAttempt,
  clampHpRatio,
  consumeAttempt,
  makeBossClaimId,
  makeBossInstanceId,
  remainingAttempts,
  resolveBossPhase,
  skillsForPhase,
  syncAttemptBucket,
} from '@/lib/boss-runtime';
import { flushSessionSaveNow } from '@/lib/session-save-flush';
import { grantMasteryXpFromKills } from '@/lib/grant-mastery-xp';
import { createStore } from '@/stores/create-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type {
  BossCombatInstance,
  BossCombatResult,
  BossDefeatReason,
  BossDefinition,
  BossPendingReward,
  BossProgressState,
} from '@/types/boss';
import { DEFAULT_BOSS_PROGRESS } from '@/types/boss';
import { d, decimalToUnsafeNumber, type Decimal } from '@/lib/decimal';

interface BossStoreState extends BossProgressState {
  isOpen: boolean;
  confirmBossId: string | null;
  abandonConfirm: boolean;
  runtime: BossCombatInstance | null;
  result: BossCombatResult | null;
  lastSkillId: string | null;
  pendingHp: number | null;
  pendingPhaseId: string | null;
}

const claimInFlight = new Set<string>();
const resolvedInstances = new Set<string>();

const store = createStore<BossStoreState>({
  ...DEFAULT_BOSS_PROGRESS,
  isOpen: false,
  confirmBossId: null,
  abandonConfirm: false,
  runtime: null,
  result: null,
  lastSkillId: null,
  pendingHp: null,
  pendingPhaseId: null,
});

function cloneProgress(state: BossProgressState): BossProgressState {
  return {
    attempts: Object.fromEntries(
      Object.entries(state.attempts).map(([id, row]) => [id, { ...row }]),
    ),
    defeatedBosses: { ...state.defeatedBosses },
    bestResult: Object.fromEntries(
      Object.entries(state.bestResult).map(([id, row]) => [id, { ...row }]),
    ),
    pendingReward: state.pendingReward
      ? { ...state.pendingReward, rewards: [...state.pendingReward.rewards] }
      : null,
  };
}

function cycleFor(def: BossDefinition): string | null {
  return attemptResetCycleId(def.attemptRules.resetType, getDailyCycleId(), getWeeklyCycleId());
}

function syncedAttempts(bossId: string): { used: number; resetCycleId: string | null } {
  const def = getBossDefinition(bossId);
  if (!def) return { used: 0, resetCycleId: null };
  return syncAttemptBucket(store.getSnapshot().attempts[bossId], def.attemptRules.resetType, cycleFor(def));
}

/**
 * Boss encounters — persistência só de progresso. Runtime de luta não vai ao save.
 */
export const bossStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  setOpen(open: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen: open, confirmBossId: open ? store.getSnapshot().confirmBossId : null });
  },

  toggleOpen(): void {
    this.setOpen(!store.getSnapshot().isOpen);
  },

  setConfirmBoss(bossId: string | null): void {
    store.setState({ ...store.getSnapshot(), confirmBossId: bossId });
  },

  setAbandonConfirm(open: boolean): void {
    store.setState({ ...store.getSnapshot(), abandonConfirm: open });
  },

  reset(): void {
    store.setState({
      ...DEFAULT_BOSS_PROGRESS,
      isOpen: false,
      confirmBossId: null,
      abandonConfirm: false,
      runtime: null,
      result: null,
      lastSkillId: null,
      pendingHp: null,
      pendingPhaseId: null,
    });
    resolvedInstances.clear();
  },

  hydrate(partial: Partial<BossProgressState> | null | undefined): void {
    const ui = store.getSnapshot();
    if (!partial) {
      store.setState({
        ...ui,
        ...DEFAULT_BOSS_PROGRESS,
        runtime: null,
      });
      return;
    }
    store.setState({
      ...ui,
      attempts: partial.attempts ?? {},
      defeatedBosses: partial.defeatedBosses ?? {},
      bestResult: partial.bestResult ?? {},
      pendingReward: partial.pendingReward ?? null,
      runtime: null,
    });
  },

  getPersistedProgress(): BossProgressState {
    return cloneProgress(store.getSnapshot());
  },

  isEncounterActive(): boolean {
    return store.getSnapshot().runtime?.status === 'fighting';
  },

  getDefinition(bossId: string): BossDefinition | null {
    return getBossDefinition(bossId);
  },

  /** Runtime Guild Boss — não consome tentativas solo do Boss System. */
  beginGuildBossRuntime(runtime: BossCombatInstance): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      runtime,
      result: null,
      confirmBossId: null,
      isOpen: false,
      abandonConfirm: false,
      lastSkillId: null,
    });
  },

  /** Runtime World Boss — não consome tentativas solo do Boss System. */
  beginWorldBossRuntime(runtime: BossCombatInstance): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      runtime,
      result: null,
      confirmBossId: null,
      isOpen: false,
      abandonConfirm: false,
      lastSkillId: null,
    });
  },

  /**
   * Encerra tentativa Guild Boss: submit damage via provider.
   * Sem Mastery, sem Online Kill, sem rewards solo do Item 26.
   */
  finishGuildBossAttempt(
    reason: BossDefeatReason | 'boss-defeated' | 'shared-defeated',
  ): BossCombatResult | null {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime?.guildContext) return null;
    if (resolvedInstances.has(runtime.bossInstanceId)) return state.result;
    resolvedInstances.add(runtime.bossInstanceId);

    const durationMs = Math.max(0, Date.now() - runtime.startedAt);
    const result: BossCombatResult = {
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      victory: reason === 'boss-defeated' || reason === 'shared-defeated',
      damageDealt: runtime.damageTaken,
      durationMs,
      playerHpRemaining: decimalToUnsafeNumber(vitalsStore.getSnapshot().hp),
      defeatReason:
        reason === 'boss-defeated' || reason === 'shared-defeated'
          ? undefined
          : reason,
      firstClear: false,
    };

    const endReason =
      reason === 'timeout' || reason === 'player-death' || reason === 'abandon'
        ? reason
        : reason === 'shared-defeated'
          ? 'shared-defeated'
          : 'boss-defeated';

    const ctx = runtime.guildContext;
    const damage = runtime.damageTaken;

    store.setState({
      ...state,
      runtime: null,
      result,
      abandonConfirm: false,
    });

    void import('@/stores/guild-boss-store').then(({ guildBossStore }) => {
      void guildBossStore
        .resolveAttemptWithPayload({
          guildId: ctx.guildId,
          attemptId: ctx.attemptId,
          damage,
          endReason,
        })
        .then(() => {
          flushSessionSaveNow();
        });
    });

    return result;
  },

  /**
   * Encerra tentativa World Boss: submit damage via provider.
   * Sem Mastery, sem Online Kill, sem rewards solo do Item 26.
   */
  finishWorldBossAttempt(
    reason: BossDefeatReason | 'boss-defeated' | 'shared-defeated',
  ): BossCombatResult | null {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime?.worldBossContext) return null;
    if (resolvedInstances.has(runtime.bossInstanceId)) return state.result;
    resolvedInstances.add(runtime.bossInstanceId);

    const durationMs = Math.max(0, Date.now() - runtime.startedAt);
    const result: BossCombatResult = {
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      victory: reason === 'boss-defeated' || reason === 'shared-defeated',
      damageDealt: runtime.damageTaken,
      durationMs,
      playerHpRemaining: decimalToUnsafeNumber(vitalsStore.getSnapshot().hp),
      defeatReason:
        reason === 'boss-defeated' || reason === 'shared-defeated'
          ? undefined
          : reason,
      firstClear: false,
    };

    const endReason =
      reason === 'timeout' || reason === 'player-death' || reason === 'abandon'
        ? reason
        : reason === 'shared-defeated'
          ? 'shared-defeated'
          : 'boss-defeated';

    const ctx = runtime.worldBossContext;
    const damage = runtime.damageTaken;

    store.setState({
      ...state,
      runtime: null,
      result,
      abandonConfirm: false,
    });

    void import('@/stores/world-boss-store').then(({ worldBossStore }) => {
      void worldBossStore
        .resolveAttemptWithPayload({
          attemptId: ctx.attemptId,
          damage,
          endReason,
        })
        .then(() => {
          flushSessionSaveNow();
        });
    });

    return result;
  },

  list(): readonly BossDefinition[] {
    return listSoloBossDefinitions();
  },

  getRemainingAttempts(bossId: string): number | null {
    const def = getBossDefinition(bossId);
    if (!def) return 0;
    const bucket = syncedAttempts(bossId);
    return remainingAttempts(bucket.used, def.attemptRules.maxAttempts);
  },

  isEligible(bossId: string, playerLevel: number, lineageRank: number): { ok: boolean; reason?: string } {
    const def = getBossDefinition(bossId);
    if (!def) return { ok: false, reason: 'Boss inexistente' };
    if (def.eligibility?.playerLevel != null && playerLevel < def.eligibility.playerLevel) {
      return { ok: false, reason: `Requer nível ${def.eligibility.playerLevel}` };
    }
    if (def.eligibility?.lineageRank != null && lineageRank < def.eligibility.lineageRank) {
      return { ok: false, reason: `Requer graduação ${def.eligibility.lineageRank}` };
    }
    return { ok: true };
  },

  canStart(bossId: string, playerLevel: number, lineageRank: number): { ok: boolean; reason?: string } {
    const eligible = this.isEligible(bossId, playerLevel, lineageRank);
    if (!eligible.ok) return eligible;
    const def = getBossDefinition(bossId)!;
    const bucket = syncedAttempts(bossId);
    if (!canConsumeAttempt(bucket.used, def.attemptRules.maxAttempts)) {
      return { ok: false, reason: 'Sem tentativas restantes' };
    }
    if (store.getSnapshot().pendingReward && !store.getSnapshot().pendingReward?.claimed) {
      return { ok: false, reason: 'Há recompensa pendente para coletar' };
    }
    return { ok: true };
  },

  startAttempt(bossId: string, nowMs = Date.now()): { ok: boolean; reason?: string; instanceId?: string } {
    const def = getBossDefinition(bossId);
    if (!def) return { ok: false, reason: 'Boss inexistente' };
    const state = store.getSnapshot();
    const bucket = syncAttemptBucket(state.attempts[bossId], def.attemptRules.resetType, cycleFor(def));
    if (!canConsumeAttempt(bucket.used, def.attemptRules.maxAttempts)) {
      return { ok: false, reason: 'Sem tentativas restantes' };
    }
    const used = consumeAttempt(bucket.used, def.attemptRules.maxAttempts);
    const instanceId = makeBossInstanceId(bossId, nowMs);
    const phase = resolveBossPhase(1, def.phases);
    const runtime: BossCombatInstance = {
      bossInstanceId: instanceId,
      bossId,
      currentHp: def.hp,
      hpMax: def.hp,
      startedAt: nowMs,
      remainingTimeMs: def.timeLimit,
      status: 'fighting',
      damageTaken: 0,
      phaseId: phase?.id ?? 'phase-1',
      currentSkillId: null,
      timerFrozen: false,
    };
    store.setState({
      ...state,
      attempts: { ...state.attempts, [bossId]: { used, resetCycleId: bucket.resetCycleId } },
      runtime,
      result: null,
      confirmBossId: null,
      isOpen: false,
      abandonConfirm: false,
      lastSkillId: null,
    });
    flushSessionSaveNow();
    emitBossAttemptStarted({ bossId, instanceId });
    return { ok: true, instanceId };
  },

  syncFromEnemy(hp: number | Decimal, hpMax: number | Decimal): void {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime || runtime.status !== 'fighting') return;
    const def = getBossDefinition(runtime.bossId);
    if (!def) return;
    const hpN = decimalToUnsafeNumber(d(hp));
    const hpMaxN = decimalToUnsafeNumber(d(hpMax));
    const damageTaken = Math.max(runtime.damageTaken, runtime.hpMax - Math.max(0, hpN));
    const phase = resolveBossPhase(clampHpRatio(hp, hpMax), def.phases);
    store.setState({
      ...state,
      runtime: {
        ...runtime,
        currentHp: Math.max(0, hpN),
        hpMax: hpMaxN,
        damageTaken,
        phaseId: phase?.id ?? runtime.phaseId,
      },
    });
  },

  /** Avança o timer. Retorna true se estourou. */
  tickTimer(dtMs: number): boolean {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime || runtime.status !== 'fighting') return false;
    if (runtime.remainingTimeMs == null || runtime.timerFrozen) return false;
    const remaining = Math.max(0, runtime.remainingTimeMs - Math.max(0, dtMs));
    store.setState({ ...state, runtime: { ...runtime, remainingTimeMs: remaining } });
    return remaining <= 0;
  },

  noteSkill(skillId: string | null): void {
    const state = store.getSnapshot();
    if (!state.runtime) return;
    store.setState({
      ...state,
      lastSkillId: skillId,
      runtime: { ...state.runtime, currentSkillId: skillId },
    });
  },

  currentSkills(): readonly string[] {
    const runtime = store.getSnapshot().runtime;
    if (!runtime) return [];
    const def = getBossDefinition(runtime.bossId);
    if (!def) return [];
    const phase = def.phases.find((row) => row.id === runtime.phaseId) ?? resolveBossPhase(
      clampHpRatio(runtime.currentHp, runtime.hpMax),
      def.phases,
    );
    return skillsForPhase(def, phase);
  },

  currentDamageMul(): number {
    const runtime = store.getSnapshot().runtime;
    if (!runtime) return 1;
    const def = getBossDefinition(runtime.bossId);
    const phase = def?.phases.find((row) => row.id === runtime.phaseId);
    return phase?.statModifiers?.damageMul ?? 1;
  },

  finishVictory(input: { officialReward: boolean }): BossCombatResult | null {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime) return null;
    if (runtime.guildContext) {
      return this.finishGuildBossAttempt('boss-defeated');
    }
    if (runtime.worldBossContext) {
      return this.finishWorldBossAttempt('boss-defeated');
    }
    if (resolvedInstances.has(runtime.bossInstanceId)) return state.result;
    resolvedInstances.add(runtime.bossInstanceId);
    const def = getBossDefinition(runtime.bossId);
    if (!def) return null;
    const alreadyCleared = Boolean(state.defeatedBosses[runtime.bossId]);
    const durationMs = Math.max(0, Date.now() - runtime.startedAt);
    const result: BossCombatResult = {
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      victory: true,
      damageDealt: runtime.damageTaken,
      durationMs,
      playerHpRemaining: decimalToUnsafeNumber(vitalsStore.getSnapshot().hp),
      firstClear: !alreadyCleared,
    };
    const rewards = [...def.rewards, ...(result.firstClear && def.firstClearReward ? def.firstClearReward : [])];
    const pending: BossPendingReward | null = input.officialReward
      ? {
          claimId: makeBossClaimId(runtime.bossId, runtime.bossInstanceId),
          bossId: runtime.bossId,
          instanceId: runtime.bossInstanceId,
          rewards,
          firstClear: result.firstClear,
          claimed: false,
        }
      : state.pendingReward;
    const prevBest = state.bestResult[runtime.bossId];
    const bestTime =
      result.victory && (prevBest?.bestTimeMs == null || durationMs < prevBest.bestTimeMs)
        ? durationMs
        : prevBest?.bestTimeMs ?? durationMs;
    store.setState({
      ...state,
      runtime: null,
      result,
      defeatedBosses: { ...state.defeatedBosses, [runtime.bossId]: true },
      bestResult: {
        ...state.bestResult,
        [runtime.bossId]: {
          bestTimeMs: bestTime,
          bestDamage: Math.max(prevBest?.bestDamage ?? 0, runtime.damageTaken),
        },
      },
      pendingReward: pending,
    });
    flushSessionSaveNow();
    emitBossDefeated({
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      damageDealt: runtime.damageTaken,
      durationMs,
      firstClear: result.firstClear,
    });
    if (input.officialReward) {
      const active = teamStore.getActive();
      if (active) grantMasteryXpFromKills(active.id, def.level, 1);
    }
    return result;
  },

  finishDefeat(reason: BossDefeatReason): BossCombatResult | null {
    const state = store.getSnapshot();
    const runtime = state.runtime;
    if (!runtime) return null;
    if (runtime.guildContext) {
      return this.finishGuildBossAttempt(reason);
    }
    if (runtime.worldBossContext) {
      return this.finishWorldBossAttempt(reason);
    }
    if (resolvedInstances.has(runtime.bossInstanceId)) return state.result;
    resolvedInstances.add(runtime.bossInstanceId);
    const def = getBossDefinition(runtime.bossId);
    const durationMs = Math.max(0, Date.now() - runtime.startedAt);
    const result: BossCombatResult = {
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      victory: false,
      damageDealt: runtime.damageTaken,
      durationMs,
      playerHpRemaining: decimalToUnsafeNumber(vitalsStore.getSnapshot().hp),
      defeatReason: reason,
      firstClear: false,
    };
    let attempts = state.attempts;
    if (reason === 'abandon' && def && !def.attemptRules.abandonConsumesAttempt) {
      const bucket = syncedAttempts(runtime.bossId);
      attempts = {
        ...state.attempts,
        [runtime.bossId]: { used: Math.max(0, bucket.used - 1), resetCycleId: bucket.resetCycleId },
      };
    }
    store.setState({
      ...state,
      runtime: null,
      result,
      attempts,
      abandonConfirm: false,
    });
    flushSessionSaveNow();
    emitBossFailed({
      bossId: runtime.bossId,
      instanceId: runtime.bossInstanceId,
      reason,
      damageDealt: runtime.damageTaken,
    });
    return result;
  },

  claimPending(): { ok: boolean; reason?: string } {
    const state = store.getSnapshot();
    const pending = state.pendingReward;
    if (!pending) return { ok: false, reason: 'Nada para coletar' };
    if (pending.claimed) return { ok: false, reason: 'Já coletado' };
    if (claimInFlight.has(pending.claimId) || claimInFlight.has('boss-reward:*')) {
      return { ok: false, reason: 'Resgate em andamento' };
    }
    claimInFlight.add(pending.claimId);
    claimInFlight.add('boss-reward:*');
    try {
      const grant = grantBossRewards(pending.rewards, {
        claimId: pending.claimId,
        source: 'boss',
      });
      if (!grant.ok) {
        return { ok: false, reason: grant.reason };
      }
      store.setState({
        ...store.getSnapshot(),
        pendingReward: { ...pending, claimed: true },
      });
      flushSessionSaveNow();
      return { ok: true };
    } finally {
      claimInFlight.delete(pending.claimId);
      claimInFlight.delete('boss-reward:*');
    }
  },

  clearResult(): void {
    store.setState({ ...store.getSnapshot(), result: null });
  },

  consumePendingHp(): number | null {
    const state = store.getSnapshot();
    if (state.pendingHp == null) return null;
    const hp = state.pendingHp;
    store.setState({ ...state, pendingHp: null });
    return hp;
  },

  consumePendingPhase(): string | null {
    const state = store.getSnapshot();
    if (!state.pendingPhaseId) return null;
    const id = state.pendingPhaseId;
    store.setState({ ...state, pendingPhaseId: null });
    return id;
  },

  devSetHp(hp: number): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    if (!state.runtime) return;
    const next = Math.max(0, Math.min(state.runtime.hpMax, Math.floor(hp)));
    store.setState({
      ...state,
      pendingHp: next,
      runtime: { ...state.runtime, currentHp: next },
    });
  },

  devSetPhase(phaseId: string): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    if (!state.runtime) return;
    const def = getBossDefinition(state.runtime.bossId);
    const phase = def?.phases.find((row) => row.id === phaseId);
    if (!phase) return;
    const hp = Math.floor(state.runtime.hpMax * phase.hpThreshold);
    store.setState({
      ...state,
      pendingPhaseId: phaseId,
      pendingHp: hp,
      runtime: { ...state.runtime, phaseId, currentHp: hp },
    });
  },

  devFreezeTimer(frozen: boolean): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    if (!state.runtime) return;
    store.setState({ ...state, runtime: { ...state.runtime, timerFrozen: frozen } });
  },

  devResetTimer(): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    if (!state.runtime) return;
    const def = getBossDefinition(state.runtime.bossId);
    store.setState({
      ...state,
      runtime: { ...state.runtime, remainingTimeMs: def?.timeLimit ?? null },
    });
  },

  devForceVictory(applyReward: boolean): void {
    if (!isDevMode()) return;
    this.finishVictory({ officialReward: applyReward });
  },

  devForceDefeat(): void {
    if (!isDevMode()) return;
    this.finishDefeat('player-death');
  },

  devResetAttempts(bossId?: string): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    if (!bossId) {
      store.setState({ ...state, attempts: {} });
      return;
    }
    const next = { ...state.attempts };
    delete next[bossId];
    store.setState({ ...state, attempts: next });
  },
};
