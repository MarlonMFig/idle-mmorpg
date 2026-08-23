import { onCharacterAwakened } from '@/lib/awakening-events';
import { onCharacterCaptured } from '@/lib/capture-events';
import {
  onLineageRankPromoted,
  onLineageSpecializationLeveled,
  onLineageSpecializationSelected,
} from '@/lib/lineage-events';
import { onMasteryLevelUp } from '@/lib/mastery-events';
import { achievementsStore } from '@/stores/achievements-store';

let bound = false;

/**
 * Assina eventos oficiais. Avaliação pontual — nunca por frame.
 */
export function bindAchievementListeners(): () => void {
  if (bound || typeof window === 'undefined') {
    return () => undefined;
  }
  bound = true;

  const offs = [
    onMasteryLevelUp(() => {
      achievementsStore.evaluate('characterProgress');
    }),
    onCharacterAwakened(() => {
      achievementsStore.evaluate('characterProgress');
    }),
    onCharacterCaptured(() => {
      achievementsStore.evaluate('collection');
    }),
    onLineageRankPromoted(() => {
      achievementsStore.evaluate('lineage');
    }),
    onLineageSpecializationSelected(() => {
      achievementsStore.evaluate('lineage');
    }),
    onLineageSpecializationLeveled(() => {
      achievementsStore.evaluate('lineage');
    }),
  ];

  return () => {
    for (const off of offs) off();
    bound = false;
  };
}

export function notifyAchievementPlayerLevel(): void {
  achievementsStore.evaluate('playerLevel');
}

export function notifyAchievementOnlineKill(): void {
  achievementsStore.evaluate('onlineKills');
}

export function notifyAchievementGuild(): void {
  achievementsStore.evaluate('guild');
}

export function notifyAchievementStarsChanged(): void {
  achievementsStore.evaluate('characterProgress');
}
