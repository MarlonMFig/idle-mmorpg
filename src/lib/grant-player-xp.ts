import { attributesStore } from '@/stores/attributes-store';
import { vitalsStore } from '@/stores/vitals-store';

/** Concede XP e sincroniza atributos em level-up. */
export function grantPlayerXp(amount: number): void {
  if (amount <= 0) return;
  const leveled = vitalsStore.addXp(amount);
  if (leveled) attributesStore.onLevelChanged(true);
}
