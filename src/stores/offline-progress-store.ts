import {
  MIN_OFFLINE_REPORT_MS,
  MS_PER_OFFLINE_HOUR,
  computeEffectiveOfflineDuration,
  type OfflineDurationResult,
} from '@/constants/offline';
import { OFFLINE_MASTERY_XP } from '@/constants/character-mastery';
import { computeOfflineDurationForPlayer } from '@/lib/offline-progress';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { createStore } from '@/stores/create-store';
import { resolveLoot } from '@/systems/loot-engine';
import { offlineRewardTxId, rewardIdempotency, rewardService } from '@/lib/reward-service';
import type { LootDropEntry, RewardResult } from '@/types/loot';

const STORAGE_KEY = 'idle-mmorpg:offline-progress-v1';

export interface OfflineLootContext {
  huntId: string | null;
  enemyLevel: number;
  isNaruto: boolean;
  lookType: number | null;
  characterId: string | null;
  table: LootDropEntry[];
  /** Legado. Maestria não usa progresso offline. */
  huntInstanceId?: string | null;
}

export interface PendingOfflineReward extends OfflineDurationResult {
  offlineRewardId: string;
  reward: RewardResult;
  applied: boolean;
  killsSimulated: number;
  masteryInstanceId: string | null;
  masteryXpGranted: number;
  masteryLevelBefore: number | null;
  masteryLevelAfter: number | null;
  masteryApplied: boolean;
}

export interface OfflineProgressState {
  lastSeenAt: number | null;
  pending: PendingOfflineReward | null;
  lastLootContext: OfflineLootContext | null;
  lastKillsPerHour: number;
  simulatorOpen: boolean;
}

const DEFAULT: OfflineProgressState = {
  lastSeenAt: null,
  pending: null,
  lastLootContext: null,
  lastKillsPerHour: 0,
  simulatorOpen: false,
};

function newRewardId(): string {
  return `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseReward(raw: unknown): RewardResult {
  if (!raw || typeof raw !== 'object') return { copper: 0, items: [] };
  const value = raw as Record<string, unknown>;
  const copper = Math.max(0, Number(value.copper) || 0);
  const items = Array.isArray(value.items)
    ? value.items
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const item = row as Record<string, unknown>;
          const itemId = typeof item.itemId === 'string' ? item.itemId : '';
          const quantity = Math.max(0, Number(item.quantity) || 0);
          return itemId && quantity > 0 ? { itemId, quantity } : null;
        })
        .filter((row): row is { itemId: string; quantity: number } => row != null)
    : [];
  return { copper, items };
}

function parsePending(raw: unknown): PendingOfflineReward | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const actualOfflineDuration = Number(value.actualOfflineDuration);
  const effectiveOfflineDuration = Number(value.effectiveOfflineDuration);
  const offlineLimitUsed = Number(value.offlineLimitUsed);
  if (
    !Number.isFinite(actualOfflineDuration) ||
    !Number.isFinite(effectiveOfflineDuration) ||
    !Number.isFinite(offlineLimitUsed)
  ) {
    return null;
  }
  return {
    actualOfflineDuration,
    effectiveOfflineDuration,
    offlineLimitUsed,
    vipStatusUsed: value.vipStatusUsed === true,
    offlineRewardId: typeof value.offlineRewardId === 'string' ? value.offlineRewardId : newRewardId(),
    reward: parseReward(value.reward),
    applied: value.applied === true,
    killsSimulated: Math.max(0, Number(value.killsSimulated) || 0),
    masteryInstanceId: null,
    masteryXpGranted: OFFLINE_MASTERY_XP,
    masteryLevelBefore: null,
    masteryLevelAfter: null,
    masteryApplied: true,
  };
}

function parseLootContext(raw: unknown): OfflineLootContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    huntId: typeof value.huntId === 'string' ? value.huntId : null,
    enemyLevel: Math.max(1, Number(value.enemyLevel) || 1),
    isNaruto: value.isNaruto === true,
    lookType: typeof value.lookType === 'number' ? value.lookType : null,
    characterId: typeof value.characterId === 'string' ? value.characterId : null,
    table: Array.isArray(value.table) ? (value.table as LootDropEntry[]) : [],
    huntInstanceId: typeof value.huntInstanceId === 'string' ? value.huntInstanceId : null,
  };
}

function buildOfflineReward(
  duration: OfflineDurationResult,
  context: OfflineLootContext | null,
  killsPerHour: number,
): PendingOfflineReward {
  const hours = duration.effectiveOfflineDuration / MS_PER_OFFLINE_HOUR;
  const killsSimulated = Math.max(0, Math.round(killsPerHour * hours));
  const reward =
    context && killsSimulated > 0
      ? resolveLoot({
          kills: killsSimulated,
          enemyLevel: context.enemyLevel,
          table: context.table,
          naruto: context.isNaruto
            ? { lookType: context.lookType, characterId: context.characterId }
            : undefined,
        })
      : { copper: 0, items: [] };
  return {
    ...duration,
    offlineRewardId: newRewardId(),
    reward,
    applied: false,
    killsSimulated,
    masteryInstanceId: null,
    masteryXpGranted: OFFLINE_MASTERY_XP,
    masteryLevelBefore: null,
    masteryLevelAfter: null,
    masteryApplied: true,
  };
}

function loadPersisted(): Pick<
  OfflineProgressState,
  'lastSeenAt' | 'pending' | 'lastLootContext' | 'lastKillsPerHour'
> {
  if (typeof window === 'undefined') {
    return { lastSeenAt: null, pending: null, lastLootContext: null, lastKillsPerHour: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { lastSeenAt: null, pending: null, lastLootContext: null, lastKillsPerHour: 0 };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const lastSeenAt = typeof parsed.lastSeenAt === 'number' ? parsed.lastSeenAt : null;
    return {
      lastSeenAt,
      pending: parsePending(parsed.pending),
      lastLootContext: parseLootContext(parsed.lastLootContext),
      lastKillsPerHour: Math.max(0, Number(parsed.lastKillsPerHour) || 0),
    };
  } catch {
    return { lastSeenAt: null, pending: null, lastLootContext: null, lastKillsPerHour: 0 };
  }
}

function persist(state: OfflineProgressState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lastSeenAt: state.lastSeenAt,
        pending: state.pending,
        lastLootContext: state.lastLootContext,
        lastKillsPerHour: state.lastKillsPerHour,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

const store = createStore<OfflineProgressState>({ ...DEFAULT });

let hydrated = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const saved = loadPersisted();
  const cur = store.getSnapshot();
  store.setState({ ...cur, ...saved, simulatorOpen: cur.simulatorOpen });
}

function commit(next: OfflineProgressState): void {
  store.setState(next);
  persist(next);
}

export const offlineProgressStore = {
  subscribe(listener: () => void): () => void {
    ensureHydrated();
    return store.subscribe(listener);
  },

  getSnapshot(): OfflineProgressState {
    ensureHydrated();
    return store.getSnapshot();
  },

  rememberLootContext(context: OfflineLootContext): void {
    ensureHydrated();
    const state = store.getSnapshot();
    const rates = huntAnalyzerStore.getRates();
    commit({
      ...state,
      lastLootContext: context,
      lastKillsPerHour: rates.killsPerHour,
    });
  },

  markPresence(now = Date.now()): void {
    ensureHydrated();
    const state = store.getSnapshot();
    const rates = huntAnalyzerStore.getRates(now);
    commit({
      ...state,
      lastSeenAt: now,
      lastKillsPerHour: rates.killsPerHour || state.lastKillsPerHour,
    });
  },

  evaluateReturn(now = Date.now()): PendingOfflineReward | null {
    ensureHydrated();
    const state = store.getSnapshot();
    if (state.pending) return state.pending;
    if (state.lastSeenAt == null) {
      commit({ ...state, lastSeenAt: now });
      return null;
    }
    const actual = now - state.lastSeenAt;
    if (actual < MIN_OFFLINE_REPORT_MS) {
      commit({ ...state, lastSeenAt: now });
      return null;
    }
    const duration = computeOfflineDurationForPlayer(actual);
    const pending = buildOfflineReward(duration, state.lastLootContext, state.lastKillsPerHour);
    commit({ ...state, lastSeenAt: now, pending });
    return pending;
  },

  collectPending(now = Date.now()): void {
    ensureHydrated();
    const state = store.getSnapshot();
    const pending = state.pending;
    if (!pending) return;

    const empty = pending.reward.copper <= 0 && pending.reward.items.length === 0;
    if (pending.applied && empty) {
      commit({ ...state, pending: null, lastSeenAt: now });
      return;
    }

    const txId = offlineRewardTxId(pending.offlineRewardId);

    // Crash recovery: grant completo já registrado → limpa pending sem duplicar.
    if (rewardIdempotency.has(txId) && !pending.applied) {
      commit({ ...state, pending: null, lastSeenAt: now });
      return;
    }

    const outcome = rewardService.grant({
      rewards: {
        copper: pending.reward.copper > 0 ? pending.reward.copper : undefined,
        items: pending.reward.items.length ? pending.reward.items : undefined,
      },
      source: 'offline',
      sourceId: pending.offlineRewardId,
      transactionId: txId,
      allowPartial: true,
    });

    if (outcome.alreadyApplied) {
      commit({ ...state, pending: null, lastSeenAt: now });
      return;
    }

    if (!outcome.success) {
      return;
    }

    if (outcome.leftover.length === 0) {
      commit({ ...state, pending: null, lastSeenAt: now });
      return;
    }
    commit({
      ...state,
      lastSeenAt: now,
      pending: {
        ...pending,
        applied: true,
        masteryApplied: true,
        masteryXpGranted: OFFLINE_MASTERY_XP,
        reward: { copper: 0, items: outcome.leftover },
      },
    });
  },

  /** Fecha o relatório: tenta coletar e sempre limpa `pending` (a janela some). */
  dismissPending(now = Date.now()): void {
    this.collectPending(now);
    ensureHydrated();
    const state = store.getSnapshot();
    if (!state.pending) return;
    commit({ ...state, pending: null, lastSeenAt: now });
  },

  simulateDev(params: { hours: number; isVip: boolean; now?: number }): PendingOfflineReward {
    ensureHydrated();
    const now = params.now ?? Date.now();
    const duration = computeEffectiveOfflineDuration(params.hours * MS_PER_OFFLINE_HOUR, params.isVip);
    const state = store.getSnapshot();
    const pending = buildOfflineReward(duration, state.lastLootContext, state.lastKillsPerHour);
    pending.vipStatusUsed = params.isVip;
    pending.offlineLimitUsed = duration.offlineLimitUsed;
    // Item 35: simulação DEV só em memória — não persiste no offline oficial.
    store.setState({ ...state, lastSeenAt: now, pending, simulatorOpen: state.simulatorOpen });
    return pending;
  },

  setSimulatorOpen(simulatorOpen: boolean): void {
    ensureHydrated();
    store.setState({ ...store.getSnapshot(), simulatorOpen });
  },

  startPresenceTracking(): () => void {
    ensureHydrated();
    this.evaluateReturn();
    const onHide = () => this.markPresence();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => this.markPresence(), 15_000);
    this.markPresence();
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };
  },
};
