import { getItem } from '@/data/items';
import { getMissionDefinition } from '@/data/missions/mission-registry';
import { missionRewardTxId, rewardService } from '@/lib/reward-service';
import type { MissionReward } from '@/types/missions';

export type MissionClaimGrantResult =
  | { ok: true; granted: MissionReward[]; alreadyApplied?: boolean }
  | { ok: false; reason: string };

/**
 * Recompensas de missão via RewardService (source mission).
 * transactionId estável: mission:{cycleId}:{missionId}
 */
export function grantMissionRewards(
  rewards: readonly MissionReward[],
  opts?: { cycleId?: string; missionId?: string },
): MissionClaimGrantResult {
  let copper = 0;
  const items: { itemId: string; quantity: number }[] = [];

  for (const reward of rewards) {
    if (reward.type === 'copper') {
      const amount = Math.max(0, Math.floor(reward.amount));
      if (amount > 0) copper += amount;
      continue;
    }
    if (reward.type === 'item') {
      if (!getItem(reward.id)) return { ok: false, reason: `Item inexistente: ${reward.id}` };
      const amount = Math.max(0, Math.floor(reward.amount));
      if (amount > 0) items.push({ itemId: reward.id, quantity: amount });
    }
  }

  const transactionId =
    opts?.cycleId && opts?.missionId
      ? missionRewardTxId(opts.cycleId, opts.missionId)
      : undefined;

  const result = rewardService.grant({
    rewards: { copper: copper || undefined, items: items.length ? items : undefined },
    source: 'mission',
    sourceId: opts?.missionId,
    transactionId,
    allowPartial: false,
  });

  if (!result.success) {
    return { ok: false, reason: result.errors.join('; ') || 'Falha ao conceder' };
  }

  const granted: MissionReward[] = [];
  if ((result.granted.copper ?? 0) > 0 || (copper > 0 && result.alreadyApplied)) {
    granted.push({ type: 'copper', amount: result.alreadyApplied ? copper : result.granted.copper! });
  }
  for (const row of result.granted.items ?? []) {
    granted.push({ type: 'item', id: row.itemId, amount: row.quantity });
  }
  if (result.alreadyApplied && granted.length === 0) {
    for (const reward of rewards) {
      if (reward.type === 'copper' && reward.amount > 0) {
        granted.push({ type: 'copper', amount: Math.floor(reward.amount) });
      }
      if (reward.type === 'item' && reward.amount > 0) {
        granted.push({ type: 'item', id: reward.id, amount: Math.floor(reward.amount) });
      }
    }
  }

  return { ok: true, granted, alreadyApplied: result.alreadyApplied };
}

export function describeMissionRewards(missionId: string): string[] {
  const def = getMissionDefinition(missionId);
  if (!def) return [];
  return def.rewards.map((reward) => {
    if (reward.type === 'copper') return `${reward.amount} Copper (DEV)`;
    const item = getItem(reward.id);
    return `${reward.amount}× ${item?.name ?? reward.id}`;
  });
}
