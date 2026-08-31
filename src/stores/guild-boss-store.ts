import { getGuildBossDefinition } from '@/constants/guild-boss';
import { getBossDefinition } from '@/data/bosses/boss-registry';
import { grantBossRewards } from '@/lib/boss-rewards';
import { applyPersistedSession } from '@/lib/session-persist';
import { resolveBossPhase } from '@/lib/boss-runtime';
import { getGuildBossProvider } from '@/lib/guild-boss-provider';
import { makeBossInstanceId } from '@/lib/boss-runtime';
import { createStore } from '@/stores/create-store';
import { bossStore } from '@/stores/boss-store';
import { guildStore } from '@/stores/guild-store';
import { locationStore } from '@/stores/location-store';
import type {
  GuildBossAttemptEndReason,
  GuildBossPendingClaim,
  GuildBossState,
  GuildBossSubmitResult,
} from '@/types/guild-boss';

interface GuildBossUiState {
  tick: number;
  lastSubmit: GuildBossSubmitResult | null;
  error: string | null;
}

const ui = createStore<GuildBossUiState>({
  tick: 0,
  lastSubmit: null,
  error: null,
});

function provider() {
  return getGuildBossProvider();
}

let bound = false;

function bump(): void {
  ui.setState({ ...ui.getSnapshot(), tick: ui.getSnapshot().tick + 1 });
}

function bind(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  const p = provider() as { onChange?: (fn: () => void) => void };
  if (typeof p.onChange === 'function') p.onChange(() => bump());
}

/**
 * Facade Guild Boss â€” UI nÃ£o mexe em HP/damage direto.
 * Combate reutiliza bossStore + Combat Engine.
 */
export const guildBossStore = {
  subscribe: ui.subscribe,
  getSnapshot: ui.getSnapshot,

  getStateSync(): GuildBossState | null {
    bind();
    void ui.getSnapshot().tick;
    const guildId = guildStore.getSnapshot().guildId;
    if (!guildId) return null;
    return (
      (provider() as { peekState?: (id: string) => GuildBossState | null }).peekState?.(guildId) ??
      null
    );
  },

  async refresh(): Promise<GuildBossState | null> {
    bind();
    const guild = guildStore.getMyGuild();
    if (!guild) return null;
    try {
      const state = await provider().ensureCycle(guild.id, guild.level);
      bump();
      return state;
    } catch (error) {
      ui.setState({
        ...ui.getSnapshot(),
        error: error instanceof Error ? error.message : 'Falha Guild Boss',
      });
      return null;
    }
  },

  async startFight(): Promise<{ ok: boolean; reason?: string }> {
    bind();
    const guild = guildStore.getMyGuild();
    const playerId = guildStore.getSnapshot().playerId;
    const nickname = guildStore.getSnapshot().nickname ?? 'Jogador';
    if (!guild || !playerId) return { ok: false, reason: 'Sem Guild.' };

    // Resolve orphaned active attempt on reload â†’ submit 0 (tentativa jÃ¡ consumida)
    const existing = await provider().getBossState(guild.id);
    const orphan = existing?.activeAttempts[playerId];
    if (orphan?.status === 'active' && !bossStore.getSnapshot().runtime) {
      await provider().submitAttempt({
        guildId: guild.id,
        attemptId: orphan.attemptId,
        playerId,
        damage: 0,
        endReason: 'disconnect',
      });
    }

    const started = await provider().startAttempt({
      guildId: guild.id,
      playerId,
      nickname,
    });
    if (!started.ok || !started.attemptId) {
      return { ok: false, reason: started.reason };
    }

    const def = getGuildBossDefinition();
    const bossDef = getBossDefinition(def.bossId);
    if (!bossDef) return { ok: false, reason: 'BossDefinition ausente.' };

    const startHp = started.startHp ?? existing?.currentHp ?? def.sharedHp;
    const maxHp = started.maxHp ?? def.sharedHp;
    const nowMs = Date.now();
    const instanceId = makeBossInstanceId(def.bossId, nowMs);
    const phase = resolveBossPhase(maxHp > 0 ? startHp / maxHp : 0, bossDef.phases);

    // Runtime via bossStore (guild context â€” sem Mastery / Online Kill)
    bossStore.beginGuildBossRuntime({
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
      guildContext: {
        guildId: guild.id,
        attemptId: started.attemptId,
        sharedHpAtStart: startHp,
      },
    });

    locationStore.enterBoss(bossDef.mapKey, bossDef.id);
    bump();
    return { ok: true };
  },

  async resolveAttempt(
    endReason: GuildBossAttemptEndReason,
  ): Promise<GuildBossSubmitResult | null> {
    const runtime = bossStore.getSnapshot().runtime;
    const ctx = runtime?.guildContext;
    if (!ctx) return null;
    return this.resolveAttemptWithPayload({
      guildId: ctx.guildId,
      attemptId: ctx.attemptId,
      damage: runtime.damageTaken,
      endReason,
    });
  },

  async resolveAttemptWithPayload(input: {
    guildId: string;
    attemptId: string;
    damage: number;
    endReason: GuildBossAttemptEndReason;
  }): Promise<GuildBossSubmitResult | null> {
    const playerId = guildStore.getSnapshot().playerId;
    if (!playerId) return null;

    const result = await provider().submitAttempt({
      guildId: input.guildId,
      attemptId: input.attemptId,
      playerId,
      damage: input.damage,
      endReason: input.endReason,
    });
    ui.setState({ ...ui.getSnapshot(), lastSubmit: result, tick: ui.getSnapshot().tick + 1 });
    return result;
  },

  async claim(claimId: string): Promise<{ ok: boolean; reason?: string }> {
    const guildId = guildStore.getSnapshot().guildId;
    const playerId = guildStore.getSnapshot().playerId;
    if (!guildId || !playerId) return { ok: false, reason: 'Sem Guild.' };
    const result = await provider().claimReward({ guildId, playerId, claimId });
    if (result.ok && result.serverApplied && result.save) {
      applyPersistedSession(result.save as unknown as Parameters<typeof applyPersistedSession>[0]);
    } else if (result.ok && result.rewards?.length) {
      const grant = grantBossRewards(result.rewards, {
        claimId,
        source: 'guildBoss',
      });
      if (!grant.ok) return { ok: false, reason: grant.reason };
    }
    bump();
    return result;
  },

  myClaims(): GuildBossPendingClaim[] {
    const state = this.getStateSync();
    const playerId = guildStore.getSnapshot().playerId;
    if (!state || !playerId) return [];
    return state.pendingClaims[playerId] ?? [];
  },

  myRank(): number | null {
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
    const def = getGuildBossDefinition();
    if (!state || !playerId) return def.maxAttemptsPerMember;
    const p = state.participants[playerId];
    const used = p?.attemptsUsed ?? 0;
    return Math.max(0, def.maxAttemptsPerMember - used);
  },

  // â€”â€” DEV â€”â€”
  async devSetHp(hp: number): Promise<void> {
    const guildId = guildStore.getSnapshot().guildId;
    if (!guildId) return;
    await provider().setSharedHp?.(guildId, hp);
    bump();
  },

  async devSetHpPercent(pct: number): Promise<void> {
    const state = await this.refresh();
    if (!state) return;
    await provider().setSharedHp?.(
      state.guildId,
      Math.floor(state.maxHp * Math.max(0, Math.min(1, pct))),
    );
    bump();
  },

  async devMockDamage(damage: number): Promise<void> {
    const guildId = guildStore.getSnapshot().guildId;
    if (!guildId) return;
    await provider().applyExternalDamage?.(guildId, damage, `mock-${Date.now()}`);
    bump();
  },

  async devForceDefeat(): Promise<void> {
    const guildId = guildStore.getSnapshot().guildId;
    if (!guildId) return;
    await provider().forceDefeat?.(guildId);
    bump();
  },

  async devResetCycle(): Promise<void> {
    const guildId = guildStore.getSnapshot().guildId;
    if (!guildId) return;
    await provider().resetCycle?.(guildId);
    bump();
  },

  async devSimulateConcurrent(
    a: number,
    b: number,
  ): Promise<{
    totalAccepted: number;
    finalHp: number;
  }> {
    const guild = guildStore.getMyGuild();
    if (!guild) return { totalAccepted: 0, finalHp: 0 };
    await provider().resetCycle?.(guild.id);
    await provider().setSharedHp?.(guild.id, 1000);
    const r1 = await provider().applyExternalDamage?.(guild.id, a, 'conc-a');
    const r2 = await provider().applyExternalDamage?.(guild.id, b, 'conc-b');
    const state = await provider().getBossState(guild.id);
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
    if (!runtime?.guildContext) return;
    const state = this.getStateSync();
    if (!state) return;
    if (state.currentHp <= 0 || state.status === 'DEFEATED') {
      bossStore.finishGuildBossAttempt('shared-defeated');
    }
  },
};
