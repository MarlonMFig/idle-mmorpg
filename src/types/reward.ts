/**
 * Reward Service (Item 32) — payload tipado.
 * Não decide drop/XP/Mastery; só aplica o que outro sistema decidiu.
 */

export type RewardSource =
  | 'hunt'
  | 'loot'
  | 'mission'
  | 'dailyLogin'
  | 'achievement'
  | 'boss'
  | 'guildBoss'
  | 'worldBoss'
  | 'offline'
  | 'shop'
  | 'sell'
  | 'capture'
  | 'dev'
  | 'migration'
  | 'admin'
  | 'unknown';

export interface RewardItemEntry {
  itemId: string;
  quantity: number;
}

export interface RewardBundle {
  copper?: number;
  animeCoins?: number;
  items?: RewardItemEntry[];
}

export interface RewardGrantRequest {
  rewards: RewardBundle;
  source: RewardSource;
  sourceId?: string;
  /** Idempotência: mesma id não aplica duas vezes. */
  transactionId?: string;
  meta?: Record<string, string | number | boolean | null>;
  /**
   * Se true, itens que não cabem voltam em leftover (loot/offline).
   * Se false (default), falha o bundle inteiro antes de commit.
   */
  allowPartial?: boolean;
}

export interface RewardGrantResult {
  success: boolean;
  alreadyApplied: boolean;
  transactionId?: string;
  granted: RewardBundle;
  leftover: RewardItemEntry[];
  errors: string[];
}

/** Limite de IDs lembrados no session (claims). */
export const REWARD_TX_HISTORY_LIMIT = 200;
