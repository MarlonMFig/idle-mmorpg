import { isDevMode } from '@/config/devConfig';
import { getDailyLoginDayDefinition } from '@/data/daily-login/daily-login-rewards';
import { emitDailyRewardClaimed } from '@/lib/daily-login-events';
import {
  mergeDailyLoginWithGemLegacy,
  type DailyLoginLegacyMigrationResult,
} from '@/lib/daily-login-legacy-migration';
import { grantDailyLoginRewards } from '@/lib/daily-login-rewards';
import {
  addDaysToCycleId,
  advanceDevToNextDay,
  getDailyCycleId,
  getNextDailyResetMs,
} from '@/lib/mission-cycle';
import { flushSessionSaveNow } from '@/lib/session-save-flush';
import { createStore } from '@/stores/create-store';
import { gemStore } from '@/stores/gem-store';
import {
  DAILY_LOGIN_CYCLE_LENGTH,
  DEFAULT_DAILY_LOGIN_STATE,
  type DailyLoginDay,
  type DailyLoginSlotStatus,
  type DailyLoginState,
} from '@/types/daily-login';

interface DailyLoginStoreState extends DailyLoginState {
  isOpen: boolean;
  /** Já ofereceu o modal nesta sessão (não reabrir a cada navegação). */
  promptedThisSession: boolean;
  /**
   * @deprecated Item 33 — override local removido; use TimeProvider (setGameClockOverride).
   * Campo mantido só para não quebrar ticks/UI antigos; sempre null.
   */
  devForcedCycleId: string | null;
  /** Item 34 — meta de migration do gem Daily Login (DEV / debug). */
  legacyMigrationStatus: 'none' | 'migrated' | 'applied-empty';
}

let lastLegacyMigration: DailyLoginLegacyMigrationResult | null = null;

const claimInFlight = new Set<string>();

const store = createStore<DailyLoginStoreState>({
  ...DEFAULT_DAILY_LOGIN_STATE,
  isOpen: false,
  promptedThisSession: false,
  devForcedCycleId: null,
  legacyMigrationStatus: 'none',
});

function clampDay(value: unknown): DailyLoginDay {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1;
  const wrapped = ((n - 1) % DAILY_LOGIN_CYCLE_LENGTH) + 1;
  if (wrapped === 1 || wrapped === 2 || wrapped === 3 || wrapped === 4 || wrapped === 5 || wrapped === 6 || wrapped === 7) {
    return wrapped;
  }
  return 1;
}

function nextDay(day: DailyLoginDay): DailyLoginDay {
  return day === 7 ? 1 : ((day + 1) as DailyLoginDay);
}

function previousDay(day: DailyLoginDay): DailyLoginDay {
  return day === 1 ? 7 : ((day - 1) as DailyLoginDay);
}

function cloneProgress(state: DailyLoginState): DailyLoginState {
  return {
    currentDay: state.currentDay,
    lastClaimCycleId: state.lastClaimCycleId,
    totalClaims: state.totalClaims,
  };
}

export { addDaysToCycleId };

/**
 * Recompensa Diária (Item 25).
 * Sequência 1–7 por logins em dias diferentes. Ausência não reseta nem acumula.
 * Ciclo diário: GameCycleService / America/Sao_Paulo.
 */
export const dailyLoginStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  setOpen(open: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen: open });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  markPromptedThisSession(): void {
    store.setState({ ...store.getSnapshot(), promptedThisSession: true });
  },

  reset(): void {
    lastLegacyMigration = null;
    store.setState({
      ...DEFAULT_DAILY_LOGIN_STATE,
      isOpen: false,
      promptedThisSession: false,
      devForcedCycleId: null,
      legacyMigrationStatus: 'none',
    });
  },

  hydrate(partial: Partial<DailyLoginState> | null | undefined): void {
    const ui = store.getSnapshot();
    if (!partial) {
      store.setState({
        ...DEFAULT_DAILY_LOGIN_STATE,
        isOpen: ui.isOpen,
        promptedThisSession: ui.promptedThisSession,
        devForcedCycleId: null,
        legacyMigrationStatus: ui.legacyMigrationStatus,
      });
      return;
    }
    store.setState({
      currentDay: clampDay(partial.currentDay ?? 1),
      lastClaimCycleId:
        typeof partial.lastClaimCycleId === 'string' ? partial.lastClaimCycleId : null,
      totalClaims:
        typeof partial.totalClaims === 'number' && Number.isFinite(partial.totalClaims)
          ? Math.max(0, Math.floor(partial.totalClaims))
          : 0,
      isOpen: ui.isOpen,
      promptedThisSession: ui.promptedThisSession,
      devForcedCycleId: null,
      legacyMigrationStatus: ui.legacyMigrationStatus,
    });
  },

  /**
   * Item 34 — aplica merge com gemStore.lastLoginDay e limpa o campo legado.
   * NÃO concede reward. Idempotente após clear do legacy field.
   */
  applyGemLegacyMigration(): DailyLoginLegacyMigrationResult {
    const before = cloneProgress(store.getSnapshot());
    const legacyDay = gemStore.getSnapshot().lastLoginDay;
    const result = mergeDailyLoginWithGemLegacy({
      official: before,
      legacyLastLoginDay: legacyDay,
    });
    lastLegacyMigration = result;
    const ui = store.getSnapshot();
    store.setState({
      ...ui,
      ...result.state,
      legacyMigrationStatus: result.consumedLegacy ? 'migrated' : 'applied-empty',
      devForcedCycleId: null,
    });
    if (result.consumedLegacy) {
      gemStore.clearLegacyDailyLoginField();
    }
    return result;
  },

  getLegacyMigrationDebug(): {
    status: DailyLoginStoreState['legacyMigrationStatus'];
    last: DailyLoginLegacyMigrationResult | null;
  } {
    return {
      status: store.getSnapshot().legacyMigrationStatus,
      last: lastLegacyMigration,
    };
  },

  getPersistedProgress(): DailyLoginState {
    return cloneProgress(store.getSnapshot());
  },

  /** Mesma regra de dia das Missões Diárias / Shop / Gem legado. */
  getCycleId(): string {
    return getDailyCycleId();
  },

  isAvailable(): boolean {
    const state = store.getSnapshot();
    return state.lastClaimCycleId !== this.getCycleId();
  },

  getClaimId(): string {
    return `daily-login:${this.getCycleId()}`;
  },

  getTodaySlotDay(): DailyLoginDay {
    const state = store.getSnapshot();
    if (this.isAvailable()) return state.currentDay;
    return previousDay(state.currentDay);
  },

  getSlotStatus(day: DailyLoginDay): DailyLoginSlotStatus {
    const state = store.getSnapshot();
    const available = this.isAvailable();
    if (available) {
      if (day < state.currentDay) return 'claimed';
      if (day === state.currentDay) return 'today';
      return 'locked';
    }
    const collected = previousDay(state.currentDay);
    if (day < collected) return 'claimed';
    if (day === collected) return 'collected-today';
    return 'locked';
  },

  claim(): { ok: boolean; reason?: string; day?: DailyLoginDay } {
    const cycleId = this.getCycleId();
    const claimId = `daily-login:${cycleId}`;
    if (claimInFlight.has(claimId) || claimInFlight.has('daily-login:*')) {
      return { ok: false, reason: 'Resgate em andamento' };
    }

    claimInFlight.add(claimId);
    claimInFlight.add('daily-login:*');
    try {
      const state = store.getSnapshot();
      if (state.lastClaimCycleId === cycleId) {
        return { ok: false, reason: 'Já coletado hoje' };
      }
      const day = state.currentDay;
      const def = getDailyLoginDayDefinition(day);
      if (!def) return { ok: false, reason: 'Recompensa inexistente' };

      const grant = grantDailyLoginRewards(def.rewards, { cycleId, day });
      if (!grant.ok) {
        return { ok: false, reason: grant.reason };
      }

      const nextDayValue = nextDay(day);
      const marked: DailyLoginStoreState = {
        ...state,
        lastClaimCycleId: cycleId,
        currentDay: nextDayValue,
        totalClaims: state.totalClaims + 1,
        devForcedCycleId: null,
      };
      store.setState(marked);
      flushSessionSaveNow();

      emitDailyRewardClaimed({ day, cycleId, totalClaims: marked.totalClaims });
      return { ok: true, day };
    } finally {
      claimInFlight.delete(claimId);
      claimInFlight.delete('daily-login:*');
    }
  },

  getNextResetMs(): number {
    return getNextDailyResetMs();
  },

  // —— DEV ——
  devSetDay(day: DailyLoginDay): void {
    if (!isDevMode()) return;
    store.setState({ ...store.getSnapshot(), currentDay: day });
  },

  /** Avança o relógio compartilhado do jogo (TimeProvider) para o próximo dia SP. */
  devSimulateNextDay(): void {
    if (!isDevMode()) return;
    advanceDevToNextDay();
    store.setState({ ...store.getSnapshot(), devForcedCycleId: null });
  },

  devReset(): void {
    if (!isDevMode()) return;
    this.reset();
  },

  devForceAvailable(): void {
    if (!isDevMode()) return;
    const cycleId = this.getCycleId();
    store.setState({
      ...store.getSnapshot(),
      lastClaimCycleId: addDaysToCycleId(cycleId, -1),
    });
  },

  devClaimTestReward(): { ok: boolean; reason?: string } {
    if (!isDevMode()) return { ok: false, reason: 'DEV only' };
    return this.claim();
  },
};
