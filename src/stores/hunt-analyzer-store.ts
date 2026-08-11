import { createStore } from '@/stores/create-store';

export interface HuntAnalyzerState {
  isOpen: boolean;
  /** Timestamp do início da sessão de contagem (primeiro kill / track). */
  sessionStartedAt: number | null;
  kills: number;
  sealed: number;
  xpGained: number;
  lootCopper: number;
  lootItems: number;
  /** Pergaminhos consumidos em tentativas de selamento. */
  scrollsUsed: number;
  sealLogs: string[];
}

const MAX_SEAL_LOGS = 40;

const emptySession = (): Omit<HuntAnalyzerState, 'isOpen'> => ({
  sessionStartedAt: null,
  kills: 0,
  sealed: 0,
  xpGained: 0,
  lootCopper: 0,
  lootItems: 0,
  scrollsUsed: 0,
  sealLogs: [],
});

const store = createStore<HuntAnalyzerState>({
  isOpen: false,
  ...emptySession(),
});

function ensureSession(now = Date.now()): void {
  const state = store.getSnapshot();
  if (state.sessionStartedAt == null) {
    store.setState({ ...state, sessionStartedAt: now });
  }
}

function elapsedMs(state: HuntAnalyzerState, now = Date.now()): number {
  if (state.sessionStartedAt == null) return 0;
  return Math.max(0, now - state.sessionStartedAt);
}

function perHour(value: number, ms: number): number {
  if (ms <= 0 || value === 0) return 0;
  return Math.round((value / ms) * 3_600_000);
}

/**
 * Estatísticas da sessão de caça (estilo Hunt Analyzer).
 * Reinicia com `resetSession`; não é persistido entre reloads.
 */
export const huntAnalyzerStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  open(): void {
    store.setState({ ...store.getSnapshot(), isOpen: true });
  },

  close(): void {
    store.setState({ ...store.getSnapshot(), isOpen: false });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  resetSession(): void {
    const { isOpen } = store.getSnapshot();
    store.setState({ isOpen, ...emptySession() });
  },

  recordKill(params: { xp: number; copper: number }): void {
    ensureSession();
    const state = store.getSnapshot();
    store.setState({
      ...state,
      kills: state.kills + 1,
      xpGained: state.xpGained + Math.max(0, params.xp),
      lootCopper: state.lootCopper + Math.max(0, params.copper),
    });
  },

  /** Materiais / itens de drop (exceto moedas já contadas em recordKill). */
  recordLootItems(quantity: number): void {
    if (quantity <= 0) return;
    if (store.getSnapshot().sessionStartedAt == null) return;
    const state = store.getSnapshot();
    store.setState({
      ...state,
      lootItems: state.lootItems + quantity,
    });
  },

  recordSealAttempt(usedScroll: boolean): void {
    if (!usedScroll) return;
    ensureSession();
    const state = store.getSnapshot();
    store.setState({
      ...state,
      scrollsUsed: state.scrollsUsed + 1,
    });
  },

  recordSealSuccess(name: string): void {
    ensureSession();
    const state = store.getSnapshot();
    const line = `${name} selado`;
    store.setState({
      ...state,
      sealed: state.sealed + 1,
      sealLogs: [...state.sealLogs, line].slice(-MAX_SEAL_LOGS),
    });
  },

  /** Métricas derivadas para a UI (tick a cada segundo). */
  getRates(now = Date.now()) {
    const state = store.getSnapshot();
    const ms = elapsedMs(state, now);
    const balance = state.lootCopper; // supply monstruário em cobre não existe ainda
    return {
      elapsedMs: ms,
      copperPerHour: perHour(state.lootCopper, ms),
      xpPerHour: perHour(state.xpGained, ms),
      killsPerHour: perHour(state.kills, ms),
      balance,
    };
  },
};

export function formatHuntDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
