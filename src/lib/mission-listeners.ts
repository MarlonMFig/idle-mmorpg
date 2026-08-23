import { POTION_ITEM_IDS } from '@/config/gameConfig';
import { onCharacterAwakened } from '@/lib/awakening-events';
import { onCharacterCaptured } from '@/lib/capture-events';
import { onItemConsumed } from '@/lib/item-events';
import {
  onLineageRankPromoted,
  onLineageSpecializationLeveled,
  onLineageSpecializationSelected,
} from '@/lib/lineage-events';
import { onMasteryLevelUp } from '@/lib/mastery-events';
import { onBossDefeated } from '@/lib/boss-events';
import { missionsStore } from '@/stores/missions-store';

let bound = false;

const POTION_IDS = new Set<string>([
  POTION_ITEM_IDS.normal,
  POTION_ITEM_IDS.concentrated,
  POTION_ITEM_IDS.ultra,
]);

/**
 * Eventos oficiais → Mission Engine. `bound` impede duplicata (Strict Mode remount).
 */
export function bindMissionListeners(): () => void {
  if (bound || typeof window === 'undefined') {
    return () => undefined;
  }
  bound = true;

  const offs = [
    onCharacterCaptured(() => {
      missionsStore.applyGameplayEvent({ kind: 'capture' }, 'gameplay');
    }),
    onItemConsumed((itemId, quantity) => {
      if (POTION_IDS.has(itemId)) {
        missionsStore.applyGameplayEvent({ kind: 'potion', amount: quantity }, 'gameplay');
      }
      if (itemId === POTION_ITEM_IDS.revive) {
        missionsStore.applyGameplayEvent({ kind: 'revive', amount: quantity }, 'gameplay');
      }
    }),
    onMasteryLevelUp(() => {
      missionsStore.syncStateMissions();
    }),
    onBossDefeated(() => {
      missionsStore.applyGameplayEvent({ kind: 'bossDefeated' }, 'gameplay');
    }),
    onCharacterAwakened(() => {
      missionsStore.syncStateMissions();
    }),
    onLineageRankPromoted(() => {
      missionsStore.syncStateMissions();
    }),
    onLineageSpecializationSelected(() => {
      missionsStore.syncStateMissions();
    }),
    onLineageSpecializationLeveled(() => {
      missionsStore.syncStateMissions();
    }),
  ];

  missionsStore.ensureCycles();
  missionsStore.syncStateMissions({ silent: true });

  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    missionsStore.ensureCycles();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    for (const off of offs) off();
    document.removeEventListener('visibilitychange', onVisibility);
    bound = false;
  };
}
