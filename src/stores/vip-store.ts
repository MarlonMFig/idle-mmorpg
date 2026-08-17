import { VIP_DURATION_MS } from '@/constants/vip';
import { createStore } from '@/stores/create-store';

const STORAGE_KEY = 'idle-mmorpg:vip-v1';

export interface VipPersisted {
  active: boolean;
  expiresAt: number | null;
}

export interface VipState extends VipPersisted {
  isOpen: boolean;
}

const DEFAULT: VipPersisted = { active: false, expiresAt: null };

function loadPersisted(): VipPersisted {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<VipPersisted>;
    const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
    const active = Boolean(parsed.active) && (expiresAt == null || expiresAt > Date.now());
    return { active, expiresAt: active ? expiresAt : null };
  } catch {
    return { ...DEFAULT };
  }
}

function persist(data: VipPersisted): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

const store = createStore<VipState>({
  isOpen: false,
  ...DEFAULT,
});

let hydrated = false;

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const saved = loadPersisted();
  const cur = store.getSnapshot();
  store.setState({ ...cur, ...saved, isOpen: cur.isOpen });
}

function expireIfNeeded(): VipState {
  ensureHydrated();
  const state = store.getSnapshot();
  if (state.active && state.expiresAt != null && state.expiresAt <= Date.now()) {
    const next = { ...state, active: false, expiresAt: null };
    store.setState(next);
    persist({ active: false, expiresAt: null });
    return next;
  }
  return state;
}

/**
 * Status VIP da conta. Persiste em localStorage; isOpen não.
 */
export const vipStore = {
  subscribe(listener: () => void): () => void {
    ensureHydrated();
    return store.subscribe(listener);
  },

  getSnapshot(): VipState {
    return expireIfNeeded();
  },

  isActive(): boolean {
    return expireIfNeeded().active;
  },

  open(): void {
    ensureHydrated();
    store.setState({ ...store.getSnapshot(), isOpen: true });
  },

  close(): void {
    store.setState({ ...store.getSnapshot(), isOpen: false });
  },

  toggleOpen(): void {
    ensureHydrated();
    const state = expireIfNeeded();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  /** Ativa VIP localmente (PIX entra depois). */
  activate(durationMs = VIP_DURATION_MS): void {
    ensureHydrated();
    const expiresAt = Date.now() + durationMs;
    const next = { ...store.getSnapshot(), active: true, expiresAt };
    store.setState(next);
    persist({ active: true, expiresAt });
  },
};
