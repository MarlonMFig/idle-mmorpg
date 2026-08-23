import { getItem } from '@/data/items';
import {
  bossRewardTxId,
  guildBossRewardTxId,
  rewardService,
  worldBossRewardTxId,
} from '@/lib/reward-service';
import type { BossReward } from '@/types/boss';

export type BossGrantResult =
  | { ok: true; granted: BossReward[]; alreadyApplied?: boolean }
  | { ok: false; reason: string };

export function grantBossRewards(
  rewards: readonly BossReward[],
  opts?: { claimId?: string; source?: 'boss' | 'guildBoss' | 'worldBoss' },
): BossGrantResult {
  for (const reward of rewards) {
    if (reward.type === 'copper' || reward.type === 'animeCoins') {
      if (!(reward.amount > 0)) return { ok: false, reason: 'Quantidade inválida' };
      continue;
    }
    if (!getItem(reward.id)) return { ok: false, reason: `Item inexistente: ${reward.id}` };
    if (!(reward.amount > 0)) return { ok: false, reason: 'Quantidade inválida' };
  }

  let copper = 0;
  let animeCoins = 0;
  const items: { itemId: string; quantity: number }[] = [];
  for (const reward of rewards) {
    if (reward.type === 'copper') copper += Math.floor(reward.amount);
    else if (reward.type === 'animeCoins') animeCoins += Math.floor(reward.amount);
    else items.push({ itemId: reward.id, quantity: Math.floor(reward.amount) });
  }

  const source = opts?.source ?? 'boss';
  const transactionId = opts?.claimId
    ? source === 'guildBoss'
      ? guildBossRewardTxId(opts.claimId)
      : source === 'worldBoss'
        ? worldBossRewardTxId(opts.claimId)
        : bossRewardTxId(opts.claimId)
    : undefined;

  const result = rewardService.grant({
    rewards: {
      copper: copper || undefined,
      animeCoins: animeCoins || undefined,
      items: items.length ? items : undefined,
    },
    source,
    sourceId: opts?.claimId,
    transactionId,
    allowPartial: false,
  });

  if (!result.success) {
    return { ok: false, reason: result.errors.join('; ') || 'Falha ao conceder' };
  }

  const granted: BossReward[] = [];
  if ((result.granted.copper ?? 0) > 0) {
    granted.push({ type: 'copper', amount: result.granted.copper! });
  } else if (result.alreadyApplied && copper > 0) {
    granted.push({ type: 'copper', amount: copper });
  }
  if ((result.granted.animeCoins ?? 0) > 0) {
    granted.push({ type: 'animeCoins', amount: result.granted.animeCoins! });
  } else if (result.alreadyApplied && animeCoins > 0) {
    granted.push({ type: 'animeCoins', amount: animeCoins });
  }
  for (const row of result.granted.items ?? []) {
    granted.push({ type: 'item', id: row.itemId, amount: row.quantity });
  }
  if (result.alreadyApplied && (result.granted.items?.length ?? 0) === 0) {
    for (const reward of rewards) {
      if (reward.type === 'item') {
        granted.push({ type: 'item', id: reward.id, amount: Math.floor(reward.amount) });
      }
    }
  }

  return { ok: true, granted, alreadyApplied: result.alreadyApplied };
}

export function describeBossRewards(rewards: readonly BossReward[]): string[] {
  return rewards.map((reward) => {
    if (reward.type === 'copper') return `${reward.amount} Copper (DEV)`;
    if (reward.type === 'animeCoins') return `${reward.amount} Anime Coins`;
    const item = getItem(reward.id);
    return `${reward.amount}× ${item?.name ?? reward.id}`;
  });
}
