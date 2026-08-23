import { createStore } from '@/stores/create-store';
import {
  createDefaultTeamPresets,
  emptyPresetSlots,
  normalizePresetName,
  parsePersistedTeamPresets,
  repairSlotsAgainstCollection,
  slotsEqual,
  slotsFromTeamIds,
} from '@/lib/team-preset';
import { defaultTeamPresetName, teamPresetIdForIndex } from '@/constants/team-presets';
import type { PersistedTeamPresets, TeamPreset, TeamPresetsState } from '@/types/team-preset';

const defaults = createDefaultTeamPresets([]);
const store = createStore<TeamPresetsState>({
  presets: defaults.presets,
  activePresetId: defaults.activePresetId,
});

function commit(next: TeamPresetsState): void {
  store.setState(next);
}

function collectionIdSet(collectionIds: ReadonlySet<string> | readonly string[]): Set<string> {
  return collectionIds instanceof Set ? new Set(collectionIds) : new Set(collectionIds);
}

/**
 * Presets de formação (Item 43).
 * Não altera CharacterInstance — só IDs de referência.
 */
export const teamPresetStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  /** New game / reset: Preset 1 = equipe atual; 2–5 vazios. */
  reset(currentTeamIds: readonly string[] = []): void {
    const next = createDefaultTeamPresets(currentTeamIds);
    commit(next);
  },

  hydrate(
    raw: unknown,
    collectionIds: ReadonlySet<string> | readonly string[],
    fallbackTeamIds: readonly string[],
  ): void {
    const ids = collectionIdSet(collectionIds);
    const parsed = parsePersistedTeamPresets(raw, ids, fallbackTeamIds);
    commit({
      presets: parsed.presets,
      activePresetId: parsed.activePresetId,
    });
  },

  getPersisted(): PersistedTeamPresets {
    const state = store.getSnapshot();
    return {
      activePresetId: state.activePresetId,
      presets: state.presets.map((p) => ({
        id: p.id,
        name: p.name,
        slots: [...p.slots] as TeamPreset['slots'],
      })),
    };
  },

  getPreset(presetId: string): TeamPreset | null {
    return store.getSnapshot().presets.find((p) => p.id === presetId) ?? null;
  },

  setActivePresetId(presetId: string | null): void {
    const state = store.getSnapshot();
    if (presetId != null && !state.presets.some((p) => p.id === presetId)) return;
    if (state.activePresetId === presetId) return;
    commit({ ...state, activePresetId: presetId });
  },

  rename(presetId: string, name: string): boolean {
    const state = store.getSnapshot();
    const index = state.presets.findIndex((p) => p.id === presetId);
    if (index < 0) return false;
    const fallback =
      defaultTeamPresetName(index) ||
      state.presets[index]!.name ||
      teamPresetIdForIndex(index);
    const nextName = normalizePresetName(name, fallback);
    if (state.presets[index]!.name === nextName) return true;
    const presets = state.presets.map((p, i) =>
      i === index ? { ...p, name: nextName } : p,
    );
    commit({ ...state, presets });
    return true;
  },

  /**
   * Limpa slots do preset. Mantém nome.
   * Não desmonta a equipe atual.
   */
  clearSlots(presetId: string): boolean {
    const state = store.getSnapshot();
    const index = state.presets.findIndex((p) => p.id === presetId);
    if (index < 0) return false;
    const presets = state.presets.map((p, i) =>
      i === index ? { ...p, slots: emptyPresetSlots() } : p,
    );
    commit({ ...state, presets });
    return true;
  },

  /** Grava slots (já sanitizados) no preset. */
  writeSlots(presetId: string, slots: TeamPreset['slots']): boolean {
    const state = store.getSnapshot();
    const index = state.presets.findIndex((p) => p.id === presetId);
    if (index < 0) return false;
    const presets = state.presets.map((p, i) =>
      i === index ? { ...p, slots: [...slots] as TeamPreset['slots'] } : p,
    );
    commit({ ...state, presets, activePresetId: presetId });
    return true;
  },

  /**
   * Dirty: equipe atual ≠ slots do preset ativo.
   * Se não há activePresetId, false.
   */
  isDirty(currentTeamIds: readonly string[]): boolean {
    const state = store.getSnapshot();
    if (!state.activePresetId) return false;
    const preset = state.presets.find((p) => p.id === state.activePresetId);
    if (!preset) return false;
    return !slotsEqual(preset.slots, slotsFromTeamIds(currentTeamIds));
  },

  /** Repara todos os presets contra a collection (load / pós-remoção). */
  repairAgainstCollection(collectionIds: ReadonlySet<string> | readonly string[]): void {
    const ids = collectionIdSet(collectionIds);
    const state = store.getSnapshot();
    let changed = false;
    const presets = state.presets.map((p) => {
      const next = repairSlotsAgainstCollection(p.slots, ids);
      if (next[0] === p.slots[0] && next[1] === p.slots[1] && next[2] === p.slots[2]) {
        return p;
      }
      changed = true;
      return { ...p, slots: next };
    });
    if (changed) commit({ ...state, presets });
  },
};
