import { getItem } from '@/data/items';
import { getDailyLoginDayDefinition } from '@/data/daily-login/daily-login-rewards';
import { dailyLoginRewardTxId, rewardService } from '@/lib/reward-service';
import type { DailyLoginReward } from '@/types/daily-login';

export type DailyLoginGrantResult =
  | { ok: true; granted: DailyLoginReward[]; alreadyApplied?: boolean }
  | { ok: false; reason: string };

/**
 * Daily Login oficial → RewardService.
 * Única fonte de claim diário (Item 34 — gemStore.claimDailyLogin removido).
 */
export function grantDailyLoginRewards(
  rewards: readonly DailyLoginReward[],
  opts?: { cycleId?: string; day?: number },
): DailyLoginGrantResult {
  for (const reward of rewards) {
    if (reward.type === 'copper') {
      if (!(reward.amount > 0)) return { ok: false, reason: 'Copper inválido' };
      continue;
    }
    if (reward.type === 'item') {
      if (!getItem(reward.id)) return { ok: false, reason: `Item inexistente: ${reward.id}` };
      if (!(reward.amount > 0)) return { ok: false, reason: 'Quantidade inválida' };
    }
  }

  let copper = 0;
  const items: { itemId: string; quantity: number }[] = [];
  for (const reward of rewards) {
    if (reward.type === 'copper') {
      copper += Math.floor(reward.amount);
    } else if (reward.type === 'item') {
      items.push({ itemId: reward.id, quantity: Math.floor(reward.amount) });
    }
  }

  const transactionId =
    opts?.cycleId != null && opts?.day != null
      ? dailyLoginRewardTxId(opts.cycleId, opts.day)
      : undefined;

  const result = rewardService.grant({
    rewards: { copper: copper || undefined, items: items.length ? items : undefined },
    source: 'dailyLogin',
    sourceId: opts?.day != null ? String(opts.day) : undefined,
    transactionId,
    allowPartial: false,
  });

  if (!result.success) {
    return { ok: false, reason: result.errors.join('; ') || 'Falha ao conceder' };
  }

  const granted: DailyLoginReward[] = [];
  if ((result.granted.copper ?? 0) > 0) {
    granted.push({ type: 'copper', amount: result.granted.copper! });
  } else if (result.alreadyApplied && copper > 0) {
    granted.push({ type: 'copper', amount: copper });
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

export function describeDailyLoginRewards(day: number): string[] {
  const def = getDailyLoginDayDefinition(day);
  if (!def) return [];
  return def.rewards.map((reward) => {
    if (reward.type === 'copper') return `${reward.amount} Copper (DEV)`;
    const item = getItem(reward.id);
    return `${reward.amount}× ${item?.name ?? reward.id}`;
  });
}
