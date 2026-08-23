import { onBossDefeated } from '@/lib/boss-events';
import { onMasteryLevelUp } from '@/lib/mastery-events';
import {
  onLineageRankPromoted,
  onLineageSpecializationLeveled,
  onLineageSpecializationSelected,
} from '@/lib/lineage-events';
import { rankingStore } from '@/stores/ranking-store';
import { gemStore } from '@/stores/gem-store';
import { vitalsStore } from '@/stores/vitals-store';
import { teamStore } from '@/stores/team-store';
import { achievementsStore } from '@/stores/achievements-store';
import { accountStore } from '@/stores/account-store';

let bound = false;

/**
 * Debounce de métricas → RankingProvider.submitScore.
 * Falha do Ranking nunca propaga para o gameplay.
 */
export function bindRankingListeners(): () => void {
  if (bound || typeof window === 'undefined') {
    return () => undefined;
  }
  bound = true;

  const bump = () => rankingStore.notifyMetricChanged();
  const offs = [
    onBossDefeated(() => bump()),
    onMasteryLevelUp(() => bump()),
    onLineageRankPromoted(() => bump()),
    onLineageSpecializationLeveled(() => bump()),
    onLineageSpecializationSelected(() => bump()),
    gemStore.subscribe(bump),
    vitalsStore.subscribe(bump),
    teamStore.subscribe(bump),
    achievementsStore.subscribe(bump),
    accountStore.subscribe(bump),
  ];

  return () => {
    for (const off of offs) off();
    bound = false;
  };
}
