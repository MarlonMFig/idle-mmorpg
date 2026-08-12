import {
  HP_POTION_ITEM_ID,
  isHelperPotion,
  isSealingScrollId,
  REVIVE_ITEM_ID,
  type HelperPotionId,
} from '@/data/helper-items';
import { SEALING_SCROLL_ITEM_ID, type SealingScrollTierId } from '@/constants/sealing';
import { createStore } from '@/stores/create-store';

const STORAGE_KEY = 'idle-mmorpg:helper-v1';

export const HELPER_HP_THRESHOLDS = [25, 40, 50, 60, 75] as const;
export type HelperHpThresholdPct = (typeof HELPER_HP_THRESHOLDS)[number];

export interface HelperSettings {
  autoPotion: boolean;
  autoSeal: boolean;
  autoRevive: boolean;
  potionItemId: HelperPotionId;
  hpThresholdPct: HelperHpThresholdPct;
  scrollItemId: SealingScrollTierId;
  reviveItemId: string;
}

export interface HelperState extends HelperSettings {
  isOpen: boolean;
}

const DEFAULT_SETTINGS: HelperSettings = {
  autoPotion: false,
  autoSeal: true,
  autoRevive: false,
  potionItemId: HP_POTION_ITEM_ID,
  hpThresholdPct: 50,
  scrollItemId: SEALING_SCROLL_ITEM_ID,
  reviveItemId: REVIVE_ITEM_ID,
};

function isThreshold(n: unknown): n is HelperHpThresholdPct {
  return typeof n === 'number' && (HELPER_HP_THRESHOLDS as readonly number[]).includes(n);
}

function loadSettings(): HelperSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<HelperSettings>;
    return {
      autoPotion: Boolean(parsed.autoPotion),
      autoSeal: parsed.autoSeal !== false,
      autoRevive: Boolean(parsed.autoRevive),
      potionItemId: isHelperPotion(parsed.potionItemId ?? '')
        ? parsed.potionItemId!
        : DEFAULT_SETTINGS.potionItemId,
      hpThresholdPct: isThreshold(parsed.hpThresholdPct)
        ? parsed.hpThresholdPct
        : DEFAULT_SETTINGS.hpThresholdPct,
      scrollItemId: isSealingScrollId(parsed.scrollItemId ?? '')
        ? parsed.scrollItemId!
        : DEFAULT_SETTINGS.scrollItemId,
      reviveItemId:
        typeof parsed.reviveItemId === 'string' && parsed.reviveItemId
          ? parsed.reviveItemId
          : DEFAULT_SETTINGS.reviveItemId,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: HelperSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

function toSettings(state: HelperState): HelperSettings {
  return {
    autoPotion: state.autoPotion,
    autoSeal: state.autoSeal,
    autoRevive: state.autoRevive,
    potionItemId: state.potionItemId,
    hpThresholdPct: state.hpThresholdPct,
    scrollItemId: state.scrollItemId,
    reviveItemId: state.reviveItemId,
  };
}

const initial = { ...DEFAULT_SETTINGS };
const store = createStore<HelperState>({
  isOpen: false,
  ...initial,
});

let hydrated = false;

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const settings = loadSettings();
  const cur = store.getSnapshot();
  store.setState({ ...cur, ...settings, isOpen: cur.isOpen });
}

function patch(partial: Partial<HelperState>): void {
  ensureHydrated();
  const next = { ...store.getSnapshot(), ...partial };
  store.setState(next);
  persistSettings(toSettings(next));
}

/**
 * Preferências do Auto-Helper (painel + runtime).
 * Settings persistem em localStorage; isOpen não.
 */
export const helperStore = {
  subscribe(listener: () => void): () => void {
    ensureHydrated();
    return store.subscribe(listener);
  },

  getSnapshot(): HelperState {
    ensureHydrated();
    return store.getSnapshot();
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
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setAutoPotion(autoPotion: boolean): void {
    patch({ autoPotion });
  },

  setAutoSeal(autoSeal: boolean): void {
    patch({ autoSeal });
  },

  setAutoRevive(autoRevive: boolean): void {
    patch({ autoRevive });
  },

  setPotionItemId(potionItemId: HelperPotionId): void {
    patch({ potionItemId });
  },

  setHpThresholdPct(hpThresholdPct: HelperHpThresholdPct): void {
    patch({ hpThresholdPct });
  },

  setScrollItemId(scrollItemId: SealingScrollTierId): void {
    patch({ scrollItemId });
  },

  setReviveItemId(reviveItemId: string): void {
    patch({ reviveItemId });
  },
};
