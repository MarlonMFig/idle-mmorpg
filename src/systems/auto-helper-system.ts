import { getHelperConsumable } from '@/data/helper-items';
import { emitSystemMessage } from '@/lib/system-log';
import { tryVipRestockPotion } from '@/lib/vip-bonuses';
import { helperStore } from '@/stores/helper-store';
import { inventoryStore } from '@/stores/inventory-store';
import { vitalsStore } from '@/stores/vitals-store';

const POTION_COOLDOWN_MS = 800;

let lastPotionAt = 0;
let lastReviveWarnAt = 0;

/**
 * Runtime do Auto-Helper: Auto Cura no tick; Auto Revive sob demanda do combate.
 */
export const autoHelperSystem = {
  /** Tenta curar se Auto Cura ligado e HP abaixo do threshold. */
  tick(nowMs: number): void {
    const settings = helperStore.getSnapshot();
    const potionId = settings.potionItemId;

    if (inventoryStore.countItem(potionId) < 1) {
      tryVipRestockPotion(potionId, nowMs);
    }

    if (!settings.autoPotion) return;
    if (vitalsStore.isDead()) return;

    const { hp, hpMax } = vitalsStore.getSnapshot();
    if (hpMax <= 0 || hp <= 0) return;
    if (hp >= hpMax) return;

    const pct = (hp / hpMax) * 100;
    if (pct > settings.hpThresholdPct) return;
    if (nowMs - lastPotionAt < POTION_COOLDOWN_MS) return;

    const consumable = getHelperConsumable(potionId);
    if (!consumable || consumable.kind !== 'heal-percent') return;

    if (inventoryStore.countItem(potionId) < 1) return;
    if (!inventoryStore.removeItem(potionId, 1)) return;

    lastPotionAt = nowMs;
    const amount = Math.max(1, Math.floor(hpMax * (consumable.healPercent ?? 0.35)));
    vitalsStore.heal(amount);
  },

  /**
   * Consome 1 Revive se Auto Revive ligado e houver stock.
   * Retorna true se o revive pode prosseguir.
   */
  tryConsumeRevive(nowMs = Date.now()): boolean {
    const settings = helperStore.getSnapshot();
    if (!settings.autoRevive) return false;

    const reviveId = settings.reviveItemId;
    const consumable = getHelperConsumable(reviveId);
    if (!consumable || consumable.kind !== 'revive') return false;

    if (inventoryStore.countItem(reviveId) < 1) {
      if (nowMs - lastReviveWarnAt > 4000) {
        lastReviveWarnAt = nowMs;
        emitSystemMessage('Auto Revive: sem Revive no inventário.');
      }
      return false;
    }

    if (!inventoryStore.removeItem(reviveId, 1)) return false;
    return true;
  },

  resetCooldowns(): void {
    lastPotionAt = 0;
    lastReviveWarnAt = 0;
  },
};
