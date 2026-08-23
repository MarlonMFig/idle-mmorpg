/**
 * Economia (Item 30) — Copper + Anime Coins.
 * Sem moedas novas (Guild/Boss/Mission/Lineage Coin).
 */

export type EconomyCurrencyId = 'copper' | 'animeCoins';

/** Origem de toda entrada/saída. */
export type EconomySource =
  | 'huntReward'
  | 'combatLoot'
  | 'bossReward'
  | 'guildBossReward'
  | 'worldBossReward'
  | 'missionReward'
  | 'dailyLogin'
  | 'achievementReward'
  | 'shopPurchase'
  | 'guildShopPurchase'
  | 'shopSale'
  | 'vipRestock'
  | 'forge'
  | 'awakening'
  | 'guildDonate'
  | 'offline'
  | 'medic'
  | 'dev'
  | 'unknown';

export type EconomyDirection = 'in' | 'out';

export interface EconomyTransaction {
  id: string;
  currency: EconomyCurrencyId;
  amount: number;
  direction: EconomyDirection;
  source: EconomySource;
  timestamp: number;
  meta?: Record<string, string | number | boolean | null>;
}

export const ECONOMY_LEDGER_LIMIT = 100;

/** Limite seguro documentado (Number). Não migrar BigInt neste item. */
export const ECONOMY_SAFE_BALANCE_MAX = Number.MAX_SAFE_INTEGER;
