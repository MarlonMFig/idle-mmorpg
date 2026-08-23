import type { LineageId } from '@/types/character-meta';
import { LINEAGE_IDS } from '@/types/character-meta';
import {
  DEFAULT_LINEAGE_ID_PROGRESS,
  DEFAULT_PLAYER_LINEAGE_PROGRESS,
  DEFAULT_SPECIALIZATION_PROGRESS,
  DEFAULT_SPECIALIZATION_SLOT_PROGRESS,
  type LineageIdProgress,
  type LineageRankIndex,
  type LineageSpecializationProgressMap,
  type LineageSpecializationSlot,
  type LineageSpecializationSlotProgress,
  type PlayerLineageProgress,
} from '@/types/lineage';
import { migrateSpecializationSlotIds } from '@/lib/lineage-specialization-migration';

function isLineageId(value: unknown): value is LineageId {
  return typeof value === 'string' && (LINEAGE_IDS as readonly string[]).includes(value);
}

function clampRank(value: unknown): LineageIdProgress['rank'] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.max(0, Math.min(4, Math.floor(value)));
  return n as LineageIdProgress['rank'];
}

function clampKills(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function clampSpecLevel(value: unknown): LineageIdProgress['specializationLevel'] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.max(0, Math.min(4, Math.floor(value)));
  return n as LineageIdProgress['specializationLevel'];
}

function isSpecSlot(value: unknown): LineageSpecializationSlot | null {
  return migrateSpecializationSlotIds(value);
}

function normalizeSlotProgress(raw: unknown): LineageSpecializationSlotProgress {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS };
  const entry = raw as Record<string, unknown>;
  return {
    level: clampSpecLevel(entry.level),
    onlineKills: clampKills(entry.onlineKills),
  };
}

function cloneSpecProgress(
  map?: LineageSpecializationProgressMap,
): LineageSpecializationProgressMap {
  return {
    specializationA: { ...(map?.specializationA ?? DEFAULT_SPECIALIZATION_SLOT_PROGRESS) },
    specializationB: { ...(map?.specializationB ?? DEFAULT_SPECIALIZATION_SLOT_PROGRESS) },
    specializationC: { ...(map?.specializationC ?? DEFAULT_SPECIALIZATION_SLOT_PROGRESS) },
  };
}

function normalizeSpecProgress(raw: unknown): LineageSpecializationProgressMap {
  const base = cloneSpecProgress();
  if (!raw || typeof raw !== 'object') return base;
  const entry = raw as Record<string, unknown>;
  return {
    specializationA: normalizeSlotProgress(entry.specializationA),
    specializationB: normalizeSlotProgress(entry.specializationB),
    specializationC: normalizeSlotProgress(entry.specializationC),
  };
}

function syncSelectedLevel(progress: LineageIdProgress): LineageIdProgress {
  const selected = progress.selectedSpecializationId;
  if (!selected) {
    return { ...progress, specializationLevel: 0 };
  }
  const slot = progress.specializationProgress[selected];
  return { ...progress, specializationLevel: slot.level };
}

export function getLineageIdProgress(
  progress: PlayerLineageProgress,
  lineageId: LineageId,
): LineageIdProgress {
  const raw = progress.byLineage[lineageId];
  if (!raw) return { ...DEFAULT_LINEAGE_ID_PROGRESS, specializationProgress: cloneSpecProgress() };
  return {
    ...raw,
    specializationProgress: cloneSpecProgress(raw.specializationProgress),
  };
}

export function getActiveLineageProgress(progress: PlayerLineageProgress): LineageIdProgress {
  if (!progress.lineageId) {
    return { ...DEFAULT_LINEAGE_ID_PROGRESS, specializationProgress: cloneSpecProgress() };
  }
  return getLineageIdProgress(progress, progress.lineageId);
}

/** Rank atual da Linhagem ativa (atalho). */
export function getActiveLineageRank(progress: PlayerLineageProgress): number {
  return getActiveLineageProgress(progress).rank;
}

export function getSelectedSpecializationProgress(
  progress: LineageIdProgress,
): LineageSpecializationSlotProgress | null {
  const id = progress.selectedSpecializationId;
  if (!id) return null;
  return progress.specializationProgress[id];
}

export function setLineageIdProgress(
  progress: PlayerLineageProgress,
  lineageId: LineageId,
  patch: Partial<LineageIdProgress>,
): PlayerLineageProgress {
  const prev = getLineageIdProgress(progress, lineageId);
  const merged: LineageIdProgress = {
    ...prev,
    ...patch,
    specializationProgress: patch.specializationProgress
      ? cloneSpecProgress(patch.specializationProgress)
      : cloneSpecProgress(prev.specializationProgress),
  };
  const next = syncSelectedLevel(merged);
  return {
    ...progress,
    byLineage: {
      ...progress.byLineage,
      [lineageId]: next,
    },
  };
}

export function patchSpecializationSlot(
  progress: PlayerLineageProgress,
  lineageId: LineageId,
  slot: LineageSpecializationSlot,
  patch: Partial<LineageSpecializationSlotProgress>,
): PlayerLineageProgress {
  const current = getLineageIdProgress(progress, lineageId);
  const prev = current.specializationProgress[slot];
  return setLineageIdProgress(progress, lineageId, {
    specializationProgress: {
      ...current.specializationProgress,
      [slot]: { ...prev, ...patch },
    },
  });
}

function normalizeIdProgress(raw: unknown): LineageIdProgress {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LINEAGE_ID_PROGRESS, specializationProgress: cloneSpecProgress() };
  }
  const entry = raw as Record<string, unknown>;
  const selected = isSpecSlot(entry.selectedSpecializationId);
  const specProgress = normalizeSpecProgress(entry.specializationProgress);
  const legacyLevel = clampSpecLevel(entry.specializationLevel);
  if (selected && specProgress[selected].level === 0 && legacyLevel > 0) {
    specProgress[selected] = { ...specProgress[selected], level: legacyLevel };
  }
  return syncSelectedLevel({
    rank: clampRank(entry.rank),
    onlineKills: clampKills(entry.onlineKills),
    selectedSpecializationId: selected,
    specializationLevel: legacyLevel,
    specializationProgress: specProgress,
  });
}

export function normalizePlayerLineageProgress(raw: unknown): PlayerLineageProgress {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PLAYER_LINEAGE_PROGRESS };
  }
  const entry = raw as Record<string, unknown>;
  const lineageId = isLineageId(entry.lineageId) ? entry.lineageId : null;
  const byLineage: Partial<Record<LineageId, LineageIdProgress>> = {};

  if (entry.byLineage && typeof entry.byLineage === 'object') {
    for (const id of LINEAGE_IDS) {
      const row = (entry.byLineage as Record<string, unknown>)[id];
      if (row) byLineage[id] = normalizeIdProgress(row);
    }
  }

  // Migração Item 20 → 21 → 22: rank flat + onlineKills/spec defaults
  if (lineageId) {
    const legacyRank = clampRank(entry.rank);
    const existing = byLineage[lineageId] ?? {
      ...DEFAULT_LINEAGE_ID_PROGRESS,
      specializationProgress: cloneSpecProgress(),
    };
    if (legacyRank > 0 && existing.rank === 0) {
      existing.rank = legacyRank;
    }
    if (existing.rank === 0 && legacyRank === 0 && isLineageId(entry.lineageId)) {
      existing.rank = 1;
    }
    if (existing.onlineKills === 0 && entry.onlineKills != null) {
      existing.onlineKills = clampKills(entry.onlineKills);
    }
    if (entry.selectedSpecializationId !== undefined && !existing.selectedSpecializationId) {
      existing.selectedSpecializationId = isSpecSlot(entry.selectedSpecializationId);
    }
    if (entry.specializationLevel !== undefined && existing.specializationLevel === 0) {
      existing.specializationLevel = clampSpecLevel(entry.specializationLevel);
    }
    if (!existing.specializationProgress) {
      existing.specializationProgress = cloneSpecProgress();
    }
    byLineage[lineageId] = syncSelectedLevel(existing);
  }

  return { lineageId, byLineage };
}

/** Resolve lineageId de save legado (clanId / playerClanId / playerLineageId). */
export function migrateLegacyPlayerLineageId(accountRaw: Record<string, unknown> | undefined): LineageId | null {
  if (!accountRaw) return null;
  if (accountRaw.lineageProgress && typeof accountRaw.lineageProgress === 'object') {
    const progress = normalizePlayerLineageProgress(accountRaw.lineageProgress);
    if (progress.lineageId) return progress.lineageId;
  }
  if (isLineageId(accountRaw.playerLineageId)) return accountRaw.playerLineageId;
  if (isLineageId(accountRaw.clanId)) return accountRaw.clanId;
  if (isLineageId(accountRaw.playerClanId)) return accountRaw.playerClanId;
  return null;
}

export function rankNameFor(
  ranks: readonly { rank: LineageRankIndex; name: string }[],
  rank: number,
): string {
  return ranks.find((row) => row.rank === rank)?.name ?? `Rank ${rank}`;
}

export function cloneDefaultSpecializationProgress(): LineageSpecializationProgressMap {
  return cloneSpecProgress();
}
