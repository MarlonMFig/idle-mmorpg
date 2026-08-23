import { inventoryStore } from '@/stores/inventory-store';
import { rewardService } from '@/lib/reward-service';
import type { RewardItem, RewardResult } from '@/types/loot';
import type { ItemGainSource } from '@/lib/item-events';
import type { RewardSource } from '@/types/reward';

export interface ApplyRewardResult {
  applied: RewardResult;
  leftover: RewardItem[];
}

function itemSourceToRewardSource(source: ItemGainSource): RewardSource {
  switch (source) {
    case 'combat':
    case 'combat-loot':
      return 'loot';
    case 'mission-reward':
      return 'mission';
    case 'daily-login':
      return 'dailyLogin';
    case 'achievement-reward':
      return 'achievement';
    case 'boss-reward':
      return 'boss';
    case 'dev':
      return 'dev';
    default:
      return 'unknown';
  }
}

/**
 * Adapter legado → RewardService (allowPartial).
 * Preferir rewardService.grant diretamente em código novo.
 */
export function addItemsToInventory(
  items: readonly RewardItem[],
  source: ItemGainSource = 'unknown',
): RewardItem[] {
  if (items.length === 0) return [];
  const result = rewardService.grant({
    rewards: { items: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })) },
    source: itemSourceToRewardSource(source),
    allowPartial: true,
  });
  return result.leftover;
}

export function consumeItem(itemId: string, quantity: number): boolean {
  if (quantity <= 0) return true;
  return inventoryStore.removeItem(itemId, quantity);
}

/**
 * Adapter legado: cobre + itens via RewardService.
 * Source default = loot (corrige "unknown" anterior quando usado por offline com source explícito).
 */
export function applyRewardResult(
  reward: RewardResult,
  opts?: {
    source?: RewardSource;
    sourceId?: string;
    transactionId?: string;
    allowPartial?: boolean;
  },
): ApplyRewardResult {
  const result = rewardService.grant({
    rewards: {
      copper: reward.copper > 0 ? reward.copper : undefined,
      items: reward.items.length ? reward.items : undefined,
    },
    source: opts?.source ?? 'loot',
    sourceId: opts?.sourceId,
    transactionId: opts?.transactionId,
    allowPartial: opts?.allowPartial ?? true,
  });

  return {
    applied: {
      copper: result.granted.copper ?? 0,
      items: result.granted.items ?? [],
    },
    leftover: result.leftover,
  };
}
