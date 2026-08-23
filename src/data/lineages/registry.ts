import { LINEAGE_CONFIGS } from '@/data/lineages/lineage-configs';
import type { LineageId } from '@/types/character-meta';
import { LINEAGE_IDS } from '@/types/character-meta';
import type { LineageDefinition } from '@/types/lineage';

export const LINEAGE_REGISTRY: Record<LineageId, LineageDefinition> = LINEAGE_CONFIGS;

export const LINEAGE_LIST: readonly LineageDefinition[] = LINEAGE_IDS.map(
  (id) => LINEAGE_REGISTRY[id],
);

export function getLineageDefinition(id: LineageId | null | undefined): LineageDefinition | null {
  if (!id) return null;
  return LINEAGE_REGISTRY[id] ?? null;
}

export function listLineageDefinitions(): LineageDefinition[] {
  return [...LINEAGE_LIST];
}
