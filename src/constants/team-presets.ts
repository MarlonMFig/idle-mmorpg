/**
 * Item 43 — Presets de equipe (QoL).
 * Sem bônus, VIP, custo ou cópia de CharacterInstance.
 */

import { TEAM_SLOT_COUNT } from '@/constants/sealing';

export const MAX_TEAM_PRESETS = 5;

/** Limite de caracteres do nome (após trim). */
export const TEAM_PRESET_NAME_MAX_LENGTH = 24;

export const DEFAULT_TEAM_PRESET_NAMES = [
  'Equipe 1',
  'Equipe 2',
  'Equipe 3',
  'Equipe 4',
  'Equipe 5',
] as const;

export function teamPresetIdForIndex(index: number): string {
  return `preset-${index + 1}`;
}

export function defaultTeamPresetName(index: number): string {
  return DEFAULT_TEAM_PRESET_NAMES[index] ?? `Equipe ${index + 1}`;
}

/** Confirma alinhamento com slots de equipe. */
export const TEAM_PRESET_SLOT_COUNT = TEAM_SLOT_COUNT;
