import { cloneHubEffects, HUB_EFFECTS, type HubEffect } from '@/data/hub-effects';
import { hubEffectsLabStore } from '@/stores/hub-effects-lab-store';

/** Rascunho do lab (se ativo) ou lista oficial. */
export function resolveHubEffects(): HubEffect[] {
  const draft = hubEffectsLabStore.getLiveOverrides();
  if (draft) return cloneHubEffects(draft.effects);
  return cloneHubEffects(HUB_EFFECTS);
}
