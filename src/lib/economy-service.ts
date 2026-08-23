import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { pushEconomyTransaction } from '@/lib/economy-ledger';
import { gemStore } from '@/stores/gem-store';
import { inventoryStore } from '@/stores/inventory-store';
import type { EconomyCurrencyId, EconomySource } from '@/types/economy';
import { ECONOMY_SAFE_BALANCE_MAX } from '@/types/economy';

function floorAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

/**
 * Economy Service — único ponto para saldo / gastar / conceder.
 * Copper = inventário `item-copper-coin`. Anime Coins = gemStore.balance.
 */
export const economyService = {
  getBalance(currency: EconomyCurrencyId): number {
    if (currency === 'copper') {
      return Math.max(0, Math.floor(inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID)));
    }
    return Math.max(0, Math.floor(gemStore.getSnapshot().balance));
  },

  canAfford(currency: EconomyCurrencyId, amount: number): boolean {
    const need = floorAmount(amount);
    if (need <= 0) return true;
    return this.getBalance(currency) >= need;
  },

  /**
   * Concede moeda. Source = `dev` não alimenta missões de combate.
   * Retorna quantidade efetivamente concedida.
   */
  grantCurrency(
    currency: EconomyCurrencyId,
    amount: number,
    source: EconomySource,
    meta?: Record<string, string | number | boolean | null>,
  ): number {
    const qty = floorAmount(amount);
    if (qty <= 0) return 0;

    if (currency === 'copper') {
      const before = this.getBalance('copper');
      if (before + qty > ECONOMY_SAFE_BALANCE_MAX) {
        console.warn('[Economy] Copper próximo do limite Number.MAX_SAFE_INTEGER');
      }
      const itemSource =
        source === 'dev'
          ? 'dev'
          : source === 'missionReward'
            ? 'mission-reward'
            : source === 'dailyLogin'
              ? 'daily-login'
              : source === 'achievementReward'
                ? 'achievement-reward'
                : source === 'bossReward' ||
                    source === 'guildBossReward' ||
                    source === 'worldBossReward'
                  ? 'boss-reward'
                  : source === 'shopSale'
                    ? 'unknown'
                    : source === 'offline'
                      ? 'unknown'
                      : source === 'huntReward' || source === 'combatLoot'
                        ? 'combat'
                        : 'unknown';
      inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, qty, itemSource);
      pushEconomyTransaction({
        currency: 'copper',
        amount: qty,
        direction: 'in',
        source,
        meta,
      });
      return qty;
    }

    gemStore.addGems(qty, source === 'dev' ? 'DEV' : undefined);
    pushEconomyTransaction({
      currency: 'animeCoins',
      amount: qty,
      direction: 'in',
      source,
      meta,
    });
    return qty;
  },

  /**
   * Gasta moeda. Nunca deixa saldo negativo.
   * Source `dev` para remoção DEV.
   */
  spendCurrency(
    currency: EconomyCurrencyId,
    amount: number,
    source: EconomySource,
    meta?: Record<string, string | number | boolean | null>,
  ): boolean {
    const qty = floorAmount(amount);
    if (qty <= 0) return true;
    if (!this.canAfford(currency, qty)) return false;

    if (currency === 'copper') {
      if (!inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, qty)) return false;
      pushEconomyTransaction({
        currency: 'copper',
        amount: qty,
        direction: 'out',
        source,
        meta,
      });
      return true;
    }

    if (!gemStore.spendGems(qty)) return false;
    pushEconomyTransaction({
      currency: 'animeCoins',
      amount: qty,
      direction: 'out',
      source,
      meta,
    });
    return true;
  },
};
