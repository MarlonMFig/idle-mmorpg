import { COMBAT_TEST_XP_MULTIPLIER } from '@/constants/combat';
import { applyStageXpGain } from '@/data/xp-stages';
import { attributesStore } from '@/stores/attributes-store';
import { skillsStore } from '@/stores/skills-store';
import { villageStore } from '@/stores/village-store';
import { vitalsStore } from '@/stores/vitals-store';

/** Concede XP (com rate de stage WONSR) e sincroniza atributos em level-up.
 *  @returns XP efetivamente concedido (após multiplicadores).
 */
export function grantPlayerXp(amount: number): number {
  if (amount <= 0) return 0;
  const scaled = applyStageXpGain(
    amount * COMBAT_TEST_XP_MULTIPLIER,
    vitalsStore.getLevel(),
  );
  const leveled = vitalsStore.addXp(scaled);
  if (leveled) {
    attributesStore.onLevelChanged(true);

    const villageId = villageStore.getPlayerVillageId();
    if (villageId) {
      skillsStore.syncLevelUnlocks(villageId, vitalsStore.getLevel());
    }
  }
  return scaled;
}
