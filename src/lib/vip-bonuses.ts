import { VIP_EXP_MULT, VIP_LOOT_MULT, VIP_POTION_RESTOCK_QTY } from '@/constants/vip';
import { getShopOfferByItemId } from '@/data/shop';
import { emitSystemMessage } from '@/lib/system-log';
import { inventoryStore } from '@/stores/inventory-store';
import { vipStore } from '@/stores/vip-store';

let lastPotionWarnAt = 0;

export function vipExpMultiplier(): number {
  return vipStore.isActive() ? VIP_EXP_MULT : 1;
}

export function vipLootMultiplier(): number {
  return vipStore.isActive() ? VIP_LOOT_MULT : 1;
}

/** Aplica o bônus de drop (chance × 1.15, teto 100%). */
export function scaleLootChance(chance: number): number {
  return Math.min(1, chance * vipLootMultiplier());
}

/**
 * Compra a poção escolhida no mercado se o VIP estiver ativo e o stock zerar.
 * @returns true se passou a haver pelo menos 1 unidade.
 */
export function tryVipRestockPotion(itemId: string, nowMs = Date.now()): boolean {
  if (inventoryStore.countItem(itemId) >= 1) return true;
  if (!vipStore.isActive()) return false;

  const offer = getShopOfferByItemId(itemId);
  if (!offer) return false;

  const result = inventoryStore.buyItem({
    itemId: offer.itemId,
    quantity: VIP_POTION_RESTOCK_QTY,
    price: offer.price,
    currencyItemId: offer.currencyItemId,
  });

  if (result === 'ok') {
    emitSystemMessage(`VIP: reposição de ${VIP_POTION_RESTOCK_QTY}× ${offer.name} no mercado.`);
    return true;
  }

  if (nowMs - lastPotionWarnAt > 6000) {
    lastPotionWarnAt = nowMs;
    if (result === 'no-funds') {
      emitSystemMessage('VIP: cobre insuficiente para repor poções no mercado.');
    } else if (result === 'no-space') {
      emitSystemMessage('VIP: inventário cheio — não foi possível repor poções.');
    }
  }
  return inventoryStore.countItem(itemId) >= 1;
}
