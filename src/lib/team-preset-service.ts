/**
 * Serviço de presets de equipe (Item 43).
 * Hub only para ativar. Não toca Energy, HP, Médico, Skills defs, Combat Engine.
 */

import { resolveCharacterPack } from '@/data/resolve-character-pack';
import { emitSystemMessage } from '@/lib/system-log';
import {
  hasDuplicateInstanceIds,
  repairSlotsAgainstCollection,
  slotsFromTeamIds,
  teamIdsFromSlots,
} from '@/lib/team-preset';
import { attributesStore } from '@/stores/attributes-store';
import { locationStore } from '@/stores/location-store';
import { skillsStore } from '@/stores/skills-store';
import { teamPresetStore } from '@/stores/team-preset-store';
import { teamStore } from '@/stores/team-store';
import type { TeamPreset, TeamPresetSlots } from '@/types/team-preset';

export type TeamPresetActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing'
        | 'in-hunt'
        | 'empty'
        | 'duplicate'
        | 'invalid'
        | 'busy';
    };

let busy = false;

function collectionIdSet(): Set<string> {
  return new Set(teamStore.getSnapshot().collection.map((c) => c.id));
}

function resolvedSlots(preset: TeamPreset): TeamPresetSlots {
  return repairSlotsAgainstCollection(preset.slots, collectionIdSet());
}

function syncRuntimeAfterFormation(previousActiveId: string | null): void {
  const active = teamStore.getActive();
  if (!active) return;
  if (active.id === previousActiveId) return;
  const pack = resolveCharacterPack(active, active.starterId ?? 'naruto-classic');
  skillsStore.applyCharacterHotbar(pack.hotbarSkillIds);
  attributesStore.onActiveCharacterChanged(true);
  // Hub: recarrega cena como troca manual de ativo. Bloqueado em Hunt.
  locationStore.reloadScene();
}

export function canChangeTeamPreset(): boolean {
  return !locationStore.isCombat();
}

export function getPresetDisplaySlots(presetId: string): TeamPresetSlots {
  const preset = teamPresetStore.getPreset(presetId);
  if (!preset) return [null, null, null];
  return resolvedSlots(preset);
}

export function isActivePresetDirty(): boolean {
  return teamPresetStore.isDirty(teamStore.getSnapshot().teamIds);
}

/** Salva equipe atual neste preset (snapshot de IDs). */
export function saveCurrentTeamToPreset(presetId: string): TeamPresetActionResult {
  if (busy) return { ok: false, reason: 'busy' };
  busy = true;
  try {
    const preset = teamPresetStore.getPreset(presetId);
    if (!preset) return { ok: false, reason: 'missing' };

    const slots = slotsFromTeamIds(teamStore.getSnapshot().teamIds);
    if (hasDuplicateInstanceIds(slots)) {
      emitSystemMessage('Preset inválido: a mesma instância em dois slots.');
      return { ok: false, reason: 'duplicate' };
    }
    if (!teamPresetStore.writeSlots(presetId, slots)) {
      return { ok: false, reason: 'invalid' };
    }
    emitSystemMessage(`Preset "${preset.name}" salvo.`);
    return { ok: true };
  } finally {
    busy = false;
  }
}

/** Ativa preset → aplica formação no Team Store (atômico). */
export function activateTeamPreset(presetId: string): TeamPresetActionResult {
  if (busy) return { ok: false, reason: 'busy' };
  busy = true;
  try {
    if (!canChangeTeamPreset()) {
      emitSystemMessage('Não é possível trocar equipe durante a Hunt.');
      return { ok: false, reason: 'in-hunt' };
    }

    const preset = teamPresetStore.getPreset(presetId);
    if (!preset) return { ok: false, reason: 'missing' };

    const slots = resolvedSlots(preset);
    if (hasDuplicateInstanceIds(slots)) {
      emitSystemMessage('Preset inválido: instância duplicada.');
      return { ok: false, reason: 'duplicate' };
    }

    const teamIds = teamIdsFromSlots(slots);
    if (teamIds.length === 0) {
      emitSystemMessage('Preset vazio: adicione personagens antes de ativar.');
      return { ok: false, reason: 'empty' };
    }

    const previousActiveId = teamStore.getSnapshot().activeId;
    // Ativo = primeiro slot não vazio (ordem do preset).
    const activeId = teamIds[0]!;

    if (!teamStore.applyFormation(teamIds, activeId)) {
      emitSystemMessage('Não foi possível aplicar o preset.');
      return { ok: false, reason: 'invalid' };
    }

    teamPresetStore.setActivePresetId(presetId);
    syncRuntimeAfterFormation(previousActiveId);
    emitSystemMessage(`Preset "${preset.name}" ativado.`);
    return { ok: true };
  } finally {
    busy = false;
  }
}

export function renameTeamPreset(presetId: string, name: string): TeamPresetActionResult {
  if (!teamPresetStore.rename(presetId, name)) {
    return { ok: false, reason: 'missing' };
  }
  return { ok: true };
}

export function clearTeamPreset(presetId: string): TeamPresetActionResult {
  if (!teamPresetStore.clearSlots(presetId)) {
    return { ok: false, reason: 'missing' };
  }
  emitSystemMessage('Preset limpo (equipe atual intacta).');
  return { ok: true };
}

/** Testes. */
export function resetTeamPresetBusyForTests(): void {
  busy = false;
}
