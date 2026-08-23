import { applyMasteryXp, masteryXpFromKills, type MasteryApplyResult } from '@/lib/character-mastery';
import { emitMasteryLevelUp } from '@/lib/mastery-events';
import { teamStore } from '@/stores/team-store';

/**
 * Fonte única de ganho ONLINE. Sem multiplicador de Player/VIP/DEV XP.
 */
export function grantMasteryXp(
  instanceId: string,
  amount: number,
  options?: { force?: boolean },
): MasteryApplyResult | null {
  if (!instanceId) return null;
  if (amount <= 0) return null;
  const instance = teamStore.getCharacterInstance(instanceId);
  if (!instance) return null;
  const applied = applyMasteryXp(
    { masteryLevel: instance.masteryLevel ?? 0, masteryXp: instance.masteryXp ?? 0 },
    amount,
  );
  teamStore.setCharacterMastery(instanceId, {
    masteryLevel: applied.masteryLevel,
    masteryXp: applied.masteryXp,
  });
  if (applied.xpGranted > 0 && !options?.force) {
    void import('@/stores/missions-store').then(({ missionsStore }) => {
      missionsStore.applyGameplayEvent({ kind: 'masteryXp', amount: applied.xpGranted }, 'gameplay');
    });
  }
  if (applied.leveled) {
    emitMasteryLevelUp({
      instanceId,
      oldLevel: applied.oldLevel,
      newLevel: applied.newLevel,
    });
  }
  return applied;
}

export function grantMasteryXpFromKills(
  instanceId: string,
  huntLevel: number,
  kills = 1,
  options?: { force?: boolean },
): MasteryApplyResult | null {
  return grantMasteryXp(instanceId, masteryXpFromKills(kills, huntLevel), options);
}
