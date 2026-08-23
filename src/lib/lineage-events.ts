export type LineageRankPromotedListener = (event: {
  lineageId: string;
  oldRank: number;
  newRank: number;
}) => void;

const listeners = new Set<LineageRankPromotedListener>();

export function onLineageRankPromoted(listener: LineageRankPromotedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLineageRankPromoted(event: {
  lineageId: string;
  oldRank: number;
  newRank: number;
}): void {
  for (const listener of listeners) listener(event);
}

export type LineageSpecializationSelectedListener = (event: {
  lineageId: string;
  specializationId: string;
}) => void;

const selectedListeners = new Set<LineageSpecializationSelectedListener>();

export function onLineageSpecializationSelected(
  listener: LineageSpecializationSelectedListener,
): () => void {
  selectedListeners.add(listener);
  return () => selectedListeners.delete(listener);
}

export function emitLineageSpecializationSelected(event: {
  lineageId: string;
  specializationId: string;
}): void {
  for (const listener of selectedListeners) listener(event);
}

export type LineageSpecializationLeveledListener = (event: {
  lineageId: string;
  specializationId: string;
  oldLevel: number;
  newLevel: number;
}) => void;

const leveledListeners = new Set<LineageSpecializationLeveledListener>();

export function onLineageSpecializationLeveled(
  listener: LineageSpecializationLeveledListener,
): () => void {
  leveledListeners.add(listener);
  return () => leveledListeners.delete(listener);
}

export function emitLineageSpecializationLeveled(event: {
  lineageId: string;
  specializationId: string;
  oldLevel: number;
  newLevel: number;
}): void {
  for (const listener of leveledListeners) listener(event);
}
