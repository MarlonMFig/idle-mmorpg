import { COMBAT_TEST_XP_MULTIPLIER } from '@/constants/combat';
import { expProgressMultiplier } from '@/lib/progression-bonuses';
import { applyStageXpGain } from '@/data/xp-stages';
import { achievementStore } from '@/stores/gem-store';
import { attributesStore } from '@/stores/attributes-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import { vitalsStore } from '@/stores/vitals-store';

/** Concede XP (com rate de stage WONSR) e sincroniza atributos em level-up.
 *  @returns XP efetivamente concedido (após multiplicadores).
 */
export function grantPlayerXp(amount: number): number {
  if (amount <= 0) return 0;
  const scaled = applyStageXpGain(
    amount * COMBAT_TEST_XP_MULTIPLIER * expProgressMultiplier(),
    vitalsStore.getLevel(),
  );
  const accountLeveled = vitalsStore.addXp(scaled);
  achievementStore.checkAccountLevel(vitalsStore.getLevel());
  const active = teamStore.getActive();
  const characterLeveled = active ? teamStore.addCharacterXp(active.id, scaled) : false;
  if (characterLeveled) {
    attributesStore.onLevelChanged(true);
  }
  if (accountLeveled) {
    const villageId = villageStore.getPlayerVillageId();
    if (villageId) {
      skillsStore.syncLevelUnlocks(villageId, vitalsStore.getLevel());
    }
  }
  return scaled;
}
