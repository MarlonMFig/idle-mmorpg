/**
 * Item 43 — Presets de equipe.
 * Referências a CharacterInstance IDs — nunca snapshot de stats/HP/Energy/Skills.
 */

export type TeamPresetSlotId = string | null;

export type TeamPresetSlots = [
  TeamPresetSlotId,
  TeamPresetSlotId,
  TeamPresetSlotId,
];

export interface TeamPreset {
  id: string;
  name: string;
  slots: TeamPresetSlots;
}

export interface TeamPresetsState {
  presets: TeamPreset[];
  activePresetId: string | null;
}

/** Blob no session save. */
export interface PersistedTeamPresets {
  presets: TeamPreset[];
  activePresetId: string | null;
}
