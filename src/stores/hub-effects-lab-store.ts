import { createStore, type WritableStore } from '@/stores/create-store';
import {
  cloneHubEffects,
  HUB_EFFECTS,
  type HubEffect,
  type HubSmokeEffect,
} from '@/data/hub-effects';
import { HUB_NATIVE_HEIGHT, HUB_NATIVE_WIDTH } from '@/data/hub-backgrounds';

export interface HubEffectsLabState {
  active: boolean;
  effects: HubEffect[];
  selectedId: string | null;
  /** Clique no hub reposiciona o efeito selecionado (smoke). */
  pickMode: boolean;
  committedEffects: HubEffect[];
  pointerWorldX: number | null;
  pointerWorldY: number | null;
}

const STORE_KEY = '__idleMmorpgHubEffectsLabStore';
type G = { [STORE_KEY]?: WritableStore<HubEffectsLabState> };

function emptyState(): HubEffectsLabState {
  const effects = cloneHubEffects(HUB_EFFECTS);
  return {
    active: false,
    effects,
    selectedId: effects.find((e) => e.kind === 'smoke')?.id ?? effects[0]?.id ?? null,
    pickMode: false,
    committedEffects: cloneHubEffects(effects),
    pointerWorldX: null,
    pointerWorldY: null,
  };
}

function getStore(): WritableStore<HubEffectsLabState> {
  const g = globalThis as G;
  if (!g[STORE_KEY]) g[STORE_KEY] = createStore(emptyState());
  return g[STORE_KEY]!;
}

function patch(partial: Partial<HubEffectsLabState>): void {
  const store = getStore();
  store.setState({ ...store.getSnapshot(), ...partial });
}

function clampCoord(value: number, max: number): number {
  return Math.round(Math.min(max, Math.max(0, value)));
}

export const hubEffectsLabStore = {
  subscribe: (listener: () => void) => getStore().subscribe(listener),
  getSnapshot: () => getStore().getSnapshot(),

  setActive(active: boolean): void {
    if (active) {
      const effects = cloneHubEffects(HUB_EFFECTS);
      patch({
        active: true,
        effects,
        committedEffects: cloneHubEffects(effects),
        selectedId: effects.find((e) => e.kind === 'smoke')?.id ?? effects[0]?.id ?? null,
        pickMode: false,
      });
    } else {
      patch({ active: false, pickMode: false });
    }
  },

  select(id: string | null): void {
    patch({ selectedId: id });
  },

  setPickMode(pickMode: boolean): void {
    patch({ pickMode });
  },

  setPointerWorld(x: number | null, y: number | null): void {
    const s = getStore().getSnapshot();
    if (s.pointerWorldX === x && s.pointerWorldY === y) return;
    patch({ pointerWorldX: x, pointerWorldY: y });
  },

  toggleEnabled(id: string): void {
    const s = getStore().getSnapshot();
    patch({
      effects: s.effects.map((entry) =>
        entry.id === id ? { ...entry, enabled: !entry.enabled } : entry,
      ),
    });
  },

  setSmokePosition(id: string, x: number, y: number): void {
    const s = getStore().getSnapshot();
    patch({
      effects: s.effects.map((entry) =>
        entry.id === id && entry.kind === 'smoke'
          ? {
              ...entry,
              x: clampCoord(x, HUB_NATIVE_WIDTH),
              y: clampCoord(y, HUB_NATIVE_HEIGHT),
            }
          : entry,
      ),
    });
  },

  nudgeSelected(dx: number, dy: number): void {
    const s = getStore().getSnapshot();
    if (!s.selectedId) return;
    const entry = s.effects.find((e) => e.id === s.selectedId);
    if (!entry || entry.kind !== 'smoke') return;
    hubEffectsLabStore.setSmokePosition(entry.id, entry.x + dx, entry.y + dy);
  },

  applyPointerToSelected(): void {
    const s = getStore().getSnapshot();
    if (!s.selectedId || s.pointerWorldX == null || s.pointerWorldY == null) return;
    const entry = s.effects.find((e) => e.id === s.selectedId);
    if (!entry || entry.kind !== 'smoke') return;
    hubEffectsLabStore.setSmokePosition(entry.id, s.pointerWorldX, s.pointerWorldY);
  },

  addSmoke(label = 'Nova fumaça'): void {
    const s = getStore().getSnapshot();
    const id = `smoke-${Date.now().toString(36)}`;
    const entry: HubSmokeEffect = {
      id,
      kind: 'smoke',
      label,
      enabled: true,
      x: Math.round(HUB_NATIVE_WIDTH * 0.5),
      y: Math.round(HUB_NATIVE_HEIGHT * 0.35),
    };
    patch({
      effects: [...s.effects, entry],
      selectedId: id,
      pickMode: true,
    });
  },

  removeSelected(): void {
    const s = getStore().getSnapshot();
    if (!s.selectedId) return;
    const entry = s.effects.find((e) => e.id === s.selectedId);
    if (!entry) return;
    if (entry.kind === 'birds') return;
    const next = s.effects.filter((e) => e.id !== s.selectedId);
    patch({
      effects: next,
      selectedId: next.find((e) => e.kind === 'smoke')?.id ?? next[0]?.id ?? null,
      pickMode: false,
    });
  },

  resetTest(): void {
    const effects = cloneHubEffects(HUB_EFFECTS);
    patch({
      effects,
      committedEffects: cloneHubEffects(effects),
      selectedId: effects.find((e) => e.kind === 'smoke')?.id ?? effects[0]?.id ?? null,
      pickMode: false,
    });
  },

  markOfficialSaved(effects: HubEffect[]): void {
    const cloned = cloneHubEffects(effects);
    patch({
      effects: cloned,
      committedEffects: cloneHubEffects(cloned),
      pickMode: false,
    });
  },

  isDirty(): boolean {
    const s = getStore().getSnapshot();
    return JSON.stringify(s.effects) !== JSON.stringify(s.committedEffects);
  },

  getLiveOverrides(): { effects: HubEffect[] } | null {
    const s = getStore().getSnapshot();
    if (!s.active) return null;
    return { effects: cloneHubEffects(s.effects) };
  },
};
