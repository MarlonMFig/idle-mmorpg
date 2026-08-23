import { getWorldBossDefinition, WORLD_BOSS_DEFINITION } from '@/constants/world-boss';
import { getBossDefinition } from '@/data/bosses/boss-registry';
import { grantBossRewards } from '@/lib/boss-rewards';
import { makeBossInstanceId, resolveBossPhase } from '@/lib/boss-runtime';
import { getWorldBossProvider } from '@/lib/world-boss-provider';
import { createStore } from '@/stores/create-store';
import { bossStore } from '@/stores/boss-store';
import { guildStore } from '@/stores/guild-store';
import { locationStore } from '@/stores/location-store';
import { vitalsStore } from '@/stores/vitals-store';
import type {
  WorldBossAttemptEndReason,
  WorldBossCycleState,
  WorldBossPendingClaim,
  WorldBossRankingSnapshot,
  WorldBossSubmitResult,
} from '@/types/world-boss';

interface WorldBossUiState {
  tick: number;
  lastSubmit: WorldBossSubmitResult | null;
  error: string | null;
  ranking: WorldBossRankingSnapshot | null;
  cachedState: WorldBossCycleState | null;
}

const ui = createStore<WorldBossUiState>({
  tick: 0,
  lastSubmit: null,
  error: null,
  ranking: null,
  cachedState: null,
});

function provider() {
  return getWorldBossProvider();
}

let bound = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;

function bump(): void {
  ui.setState({ ...ui.getSnapshot(), tick: ui.getSnapshot().tick + 1 });
}

function ensureSync(): void {
  if (syncTimer || typeof window === 'undefined') return;
  syncTimer = setInterval(() => {
    void worldBossStore.refresh();
    void worldBossStore.refreshRanking();
  }, WORLD_BOSS_DEFINITION.syncIntervalMs);
}

function bind(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  const p = provider() as { onChange?: (fn: () => void) => void };
  if (typeof p.onChange === 'function') p.onChange(() => bump());
  ensureSync();
}

/**
 * Facade World Boss — UI não mexe em HP/damage direto.
 * Combate reutiliza bossStore + Combat Engine.
 */
export const worldBossStore = {
  subscribe: ui.subscribe,
  getSnapshot: ui.getSnapshot,

  getStateSync(): WorldBossCycleState | null {
    bind();
    void ui.getSnapshot().tick;
    const peeked =
      (provider() as { peekState?: () => WorldBossCycleState | null }).peekState?.() ?? null;
    return peeked ?? ui.getSnapshot().cachedState;
  },

  async refresh(): Promise<WorldBossCycleState | null> {
    bind();
    const playerLevel = vitalsStore.getSnapshot().level;
    try {
      const state = await provider().ensureCycle(playerLevel);
      ui.setState({
        ...ui.getSnapshot(),
        cachedState: state,
        tick: ui.getSnapshot().tick + 1,
        error: null,
      });
      return state;
    } catch (error) {
      ui.setState({
        ...ui.getSnapshot(),
        error: error instanceof Error ? error.message : 'Falha World Boss',
      });
      return null;
    }
  },

  async refreshRanking(): Promise<WorldBossRankingSnapshot | null> {
    bind();
    const playerId = guildStore.ensurePlayerId();
    try {
      const ranking = await provider().getRanking(playerId);
      ui.setState({
        ...ui.getSnapshot(),
        ranking,
        tick: ui.getSnapshot().tick + 1,
      });
      return ranking;
    } catch {
      return ui.getSnapshot().ranking;
    }
  },

  async startFight(): Promise<{ ok: boolean; reason?: string }> {
    bind();
    const playerId = guildStore.ensurePlayerId();
    const nickname = guildStore.getSnapshot().nickname ?? 'Jogador';
    const playerLevel = vitalsStore.getSnapshot().level;

    // Resolve orphaned active attempt on reload → submit 0 (tentativa já consumida)
    const existing = await provider().getState();
    const orphan = existing?.activeAttempts[playerId];
    if (orphan?.status === 'active' && !bossStore.getSnapshot().runtime) {
      await provider().submitAttempt({
        attemptId: orphan.attemptId,
        playerId,
        damage: 0,
        endReason: 'disconnect',
      });
    }

    const started = await provider().startAttempt({
      playerId,
      nickname,
      playerLevel,
    });
    if (!started.ok || !started.attemptId) {
      return { ok: false, reason: started.reason };
    }

    const def = getWorldBossDefinition();
    const bossDef = getBossDefinition(def.bossId);
    if (!bossDef) return { ok: false, reason: 'BossDefinition ausente.' };

    const startHp = started.startHp ?? existing?.currentHp ?? def.maxHp;
    const maxHp = started.maxHp ?? def.maxHp;
    const cycleId = started.cycleId ?? existing?.cycleId ?? '';
    const nowMs = Date.now();
    const instanceId = makeBossInstanceId(def.bossId, nowMs);
    const phase = resolveBossPhase(maxHp > 0 ? startHp / maxHp : 0, bossDef.phases);

    bossStore.beginWorldBossRuntime({
      bossInstanceId: instanceId,
      bossId: def.bossId,
      currentHp: startHp,
      hpMax: maxHp,
      startedAt: nowMs,
      remainingTimeMs: def.attemptDurationMs,
      status: 'fighting',
      damageTaken: 0,
      phaseId: phase?.id ?? 'phase-1',
      currentSkillId: null,
      timerFrozen: false,
      worldBossContext: {
        attemptId: started.attemptId,
        sharedHpAtStart: startHp,
        cycleId,
      },
    });

    locationStore.enterBoss(bossDef.mapKey, bossDef.id);
    bump();
    return { ok: true };
  },

  async resolveAttempt(
    endReason: WorldBossAttemptEndReason,
  ): Promise<WorldBossSubmitResult | null> {
    const runtime = bossStore.getSnapshot().runtime;
    const ctx = runtime?.worldBossContext;
    if (!ctx) return null;
    return this.resolveAttemptWithPayload({
      attemptId: ctx.attemptId,
      damage: runtime.damageTaken,
      endReason,
    });
  },

  async resolveAttemptWithPayload(input: {
    attemptId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  }): Promise<WorldBossSubmitResult | null> {
    const playerId = guildStore.ensurePlayerId();
    const result = await provider().submitAttempt({
      attemptId: input.attemptId,
      playerId,
      damage: input.damage,
      endReason: input.endReason,
    });
    ui.setState({
      ...ui.getSnapshot(),
      lastSubmit: result,
      tick: ui.getSnapshot().tick + 1,
    });
    void this.refresh();
    void this.refreshRanking();
    return result;
  },

  async claim(claimId: string): Promise<{ ok: boolean; reason?: string }> {
    const playerId = guildStore.ensurePlayerId();
    const result = await provider().claimReward({ playerId, claimId });
    if (result.ok && result.rewards?.length) {
      const grant = grantBossRewards(result.rewards, {
        claimId,
        source: 'worldBoss',
      });
      if (!grant.ok) {
        bump();
        return { ok: false, reason: grant.reason };
      }
    }
    bump();
    void this.refresh();
    return { ok: result.ok, reason: result.reason };
  },

  myClaims(): WorldBossPendingClaim[] {
    const state = this.getStateSync();
    const playerId = guildStore.getSnapshot().playerId;
    if (!state || !playerId) return [];
    return state.pendingClaims[playerId] ?? [];
  },

  myRank(): number | null {
    const ranking = ui.getSnapshot().ranking;
    if (ranking?.myRank?.rank != null) return ranking.myRank.rank;

    const state = this.getStateSync();
    const playerId = guildStore.getSnapshot().playerId;
    if (!state || !playerId) return null;
    const sorted = Object.values(state.participants).sort((a, b) => b.totalDamage - a.totalDamage);
    const idx = sorted.findIndex((p) => p.playerId === playerId);
    return idx >= 0 ? idx + 1 : null;
  },

  attemptsRemaining(): number {
    const state = this.getStateSync();
    const playerId = guildStore.getSnapshot().playerId;
    const def = getWorldBossDefinition();
    if (!state || !playerId) return def.maxAttempts;
    const p = state.participants[playerId];
    const used = p?.attemptsUsed ?? 0;
    return Math.max(0, def.maxAttempts - used);
  },

  getRankingCache(): WorldBossRankingSnapshot | null {
    return ui.getSnapshot().ranking;
  },

  // —— DEV ——
  async devEnsure(): Promise<void> {
    await this.refresh();
  },

  async devSetHp(hp: number): Promise<void> {
    await provider().setSharedHp?.(hp);
    bump();
    void this.refresh();
  },

  async devSetHpPercent(pct: number): Promise<void> {
    const state = await this.refresh();
    if (!state) return;
    await provider().setSharedHp?.(Math.floor(state.maxHp * Math.max(0, Math.min(1, pct))));
    bump();
    void this.refresh();
  },

  async devMockDamage(damage: number): Promise<void> {
    await provider().applyExternalDamage?.(damage, `mock-${Date.now()}`);
    bump();
    void this.refresh();
    void this.refreshRanking();
  },

  async devSimulateOtherPlayer(damage: number): Promise<void> {
    await provider().applyExternalDamage?.(
      damage,
      `other-${Date.now()}`,
      'Other Player',
    );
    bump();
    void this.refresh();
    void this.refreshRanking();
  },

  async devForceMilestone(): Promise<void> {
    const state = await this.refresh();
    if (!state) return;
    const def = getWorldBossDefinition();
    const remaining = def.milestones
      .filter((ms) => !state.reachedMilestones.includes(ms.id))
      .sort((a, b) => b.hpRatio - a.hpRatio);
    const next = remaining[0];
    if (!next) return;
    // Place HP just above threshold, then apply damage so submit path crosses it.
    const justAbove = Math.floor(state.maxHp * next.hpRatio) + 1;
    await provider().setSharedHp?.(Math.min(state.currentHp, Math.max(1, justAbove)));
    await provider().applyExternalDamage?.(2, `milestone-cross-${Date.now()}`);
    bump();
    void this.refresh();
  },

  async devForceDefeat(): Promise<void> {
    await provider().forceDefeat?.({ grantEntitlements: true });
    bump();
    void this.refresh();
  },

  async devResetCycle(): Promise<void> {
    await provider().resetCycle?.();
    bump();
    void this.refresh();
    void this.refreshRanking();
  },

  async devResetAttempts(): Promise<void> {
    const playerId = guildStore.ensurePlayerId();
    await provider().resetPlayerAttempts?.(playerId);
    bump();
    void this.refresh();
  },

  async devSimulateConcurrent(a: number, b: number): Promise<{
    totalAccepted: number;
    finalHp: number;
  }> {
    await provider().resetCycle?.();
    await provider().setSharedHp?.(1000);
    const r1 = await provider().applyExternalDamage?.(a, 'conc-a');
    const r2 = await provider().applyExternalDamage?.(b, 'conc-b');
    const state = await provider().getState();
    bump();
    return {
      totalAccepted: (r1?.validDamage ?? 0) + (r2?.validDamage ?? 0),
      finalHp: state?.currentHp ?? 0,
    };
  },

  getProviderId(): string {
    return provider().id;
  },

  /** Poll: se shared HP zerou durante luta, encerra. */
  pollSharedDefeat(): void {
    const runtime = bossStore.getSnapshot().runtime;
    if (!runtime?.worldBossContext) return;
    const state = this.getStateSync();
    if (!state) return;
    if (state.currentHp <= 0 || state.status === 'DEFEATED') {
      bossStore.finishWorldBossAttempt('shared-defeated');
    }
  },
};
