/**
 * Helpers puros — presets de equipe (Item 43).
 */

import {
  DEFAULT_TEAM_PRESET_NAMES,
  MAX_TEAM_PRESETS,
  TEAM_PRESET_NAME_MAX_LENGTH,
  TEAM_PRESET_SLOT_COUNT,
  defaultTeamPresetName,
  teamPresetIdForIndex,
} from '@/constants/team-presets';
import type {
  PersistedTeamPresets,
  TeamPreset,
  TeamPresetSlotId,
  TeamPresetSlots,
} from '@/types/team-preset';

export function emptyPresetSlots(): TeamPresetSlots {
  return [null, null, null];
}

export function normalizePresetName(raw: string, fallback: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, TEAM_PRESET_NAME_MAX_LENGTH);
}

/** teamIds (1–3) → slots fixos de 3. */
export function slotsFromTeamIds(teamIds: readonly string[]): TeamPresetSlots {
  const slots = emptyPresetSlots();
  const seen = new Set<string>();
  let slot = 0;
  for (const id of teamIds) {
    if (slot >= TEAM_PRESET_SLOT_COUNT) break;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    slots[slot] = id;
    slot += 1;
  }
  return slots;
}

export function teamIdsFromSlots(slots: TeamPresetSlots): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of slots) {
    if (typeof id !== 'string' || !id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function slotsEqual(a: TeamPresetSlots, b: TeamPresetSlots): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Garante length 3, IDs string, sem duplicata (primeira ocorrência vence).
 */
export function sanitizePresetSlots(raw: unknown): TeamPresetSlots {
  const slots = emptyPresetSlots();
  if (!Array.isArray(raw)) return slots;
  const seen = new Set<string>();
  for (let i = 0; i < TEAM_PRESET_SLOT_COUNT; i += 1) {
    const value = raw[i];
    if (typeof value !== 'string' || !value) {
      slots[i] = null;
      continue;
    }
    if (seen.has(value)) {
      slots[i] = null;
      continue;
    }
    seen.add(value);
    slots[i] = value;
  }
  return slots;
}

/** Instâncias ausentes da collection → null (não escolhe substituto). */
export function repairSlotsAgainstCollection(
  slots: TeamPresetSlots,
  collectionIds: ReadonlySet<string>,
): TeamPresetSlots {
  return [
    slots[0] && collectionIds.has(slots[0]) ? slots[0] : null,
    slots[1] && collectionIds.has(slots[1]) ? slots[1] : null,
    slots[2] && collectionIds.has(slots[2]) ? slots[2] : null,
  ];
}

export function hasDuplicateInstanceIds(slots: TeamPresetSlots): boolean {
  const seen = new Set<string>();
  for (const id of slots) {
    if (!id) continue;
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

export function createDefaultTeamPresets(
  currentTeamIds: readonly string[] = [],
): { presets: TeamPreset[]; activePresetId: string } {
  const presets: TeamPreset[] = [];
  for (let i = 0; i < MAX_TEAM_PRESETS; i += 1) {
    presets.push({
      id: teamPresetIdForIndex(i),
      name: defaultTeamPresetName(i),
      slots: i === 0 ? slotsFromTeamIds(currentTeamIds) : emptyPresetSlots(),
    });
  }
  return { presets, activePresetId: teamPresetIdForIndex(0) };
}

export function parsePersistedTeamPresets(
  raw: unknown,
  collectionIds: ReadonlySet<string>,
  fallbackTeamIds: readonly string[],
): PersistedTeamPresets {
  if (!raw || typeof raw !== 'object') {
    return createDefaultTeamPresets(fallbackTeamIds);
  }
  const data = raw as Record<string, unknown>;
  const list = Array.isArray(data.presets) ? data.presets : [];

  const byId = new Map<string, TeamPreset>();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id) continue;
    const indexHint = DEFAULT_TEAM_PRESET_NAMES.findIndex(
      (_, i) => teamPresetIdForIndex(i) === row.id,
    );
    const fallbackName =
      indexHint >= 0 ? defaultTeamPresetName(indexHint) : 'Equipe';
    const name = normalizePresetName(
      typeof row.name === 'string' ? row.name : fallbackName,
      fallbackName,
    );
    const slots = repairSlotsAgainstCollection(
      sanitizePresetSlots(row.slots),
      collectionIds,
    );
    byId.set(row.id, { id: row.id, name, slots });
  }

  const presets: TeamPreset[] = [];
  for (let i = 0; i < MAX_TEAM_PRESETS; i += 1) {
    const id = teamPresetIdForIndex(i);
    const existing = byId.get(id);
    if (existing) {
      presets.push(existing);
    } else if (i === 0 && byId.size === 0) {
      // Migration: sem blob → Preset 1 = equipe atual.
      presets.push({
        id,
        name: defaultTeamPresetName(i),
        slots: slotsFromTeamIds(fallbackTeamIds),
      });
    } else {
      presets.push({
        id,
        name: defaultTeamPresetName(i),
        slots: emptyPresetSlots(),
      });
    }
  }

  let activePresetId =
    typeof data.activePresetId === 'string' && data.activePresetId
      ? data.activePresetId
      : null;
  if (!activePresetId || !presets.some((p) => p.id === activePresetId)) {
    activePresetId = presets[0]?.id ?? teamPresetIdForIndex(0);
  }

  return { presets, activePresetId };
}

export function clonePersistedTeamPresets(
  state: PersistedTeamPresets,
): PersistedTeamPresets {
  return {
    activePresetId: state.activePresetId,
    presets: state.presets.map((p) => ({
      id: p.id,
      name: p.name,
      slots: [...p.slots] as TeamPresetSlots,
    })),
  };
}

export type { TeamPresetSlotId };
