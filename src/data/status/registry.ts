import { getDevStatus, mergeDevStatusCatalog } from '@/lib/dev/dev-runtime-registry';
import type { StatusEffectDefinition } from '@/data/status-effect-def';
import { STATUS_BY_ID } from './catalog';

export function getStatusDefinition(statusId: string | null | undefined): StatusEffectDefinition | null {
  if (!statusId) return null;
  const overlay = getDevStatus(statusId);
  if (overlay) return overlay;
  return STATUS_BY_ID[statusId] ?? null;
}

export function listStatusDefinitions(): StatusEffectDefinition[] {
  return Object.values(mergeDevStatusCatalog(STATUS_BY_ID))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function statusMatchesQuery(def: StatusEffectDefinition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return def.id.toLowerCase().includes(q) || def.name.toLowerCase().includes(q) || def.type.includes(q);
}
