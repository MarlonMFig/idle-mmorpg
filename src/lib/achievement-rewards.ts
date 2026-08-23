import { getAchievementDefinition } from '@/data/achievements/achievement-registry';
import { getTitleDefinition } from '@/data/achievements/title-registry';
import { achievementRewardTxId, rewardService } from '@/lib/reward-service';
import type { AchievementReward } from '@/types/achievements';

export type ClaimRewardResult =
  | { ok: true; granted: AchievementReward[]; alreadyApplied?: boolean }
  | { ok: false; reason: string };

/**
 * Conquistas oficiais → RewardService para Copper.
 * Titles continuam via callback (não são reward econômico).
 */
export function grantAchievementRewards(
  rewards: readonly AchievementReward[],
  unlockTitle: (titleId: string) => void,
  opts?: { achievementId?: string },
): ClaimRewardResult {
  const granted: AchievementReward[] = [];
  let copper = 0;

  for (const reward of rewards) {
    if (reward.type === 'copper') {
      const amount = Math.max(0, Math.floor(reward.amount));
      if (amount > 0) copper += amount;
      continue;
    }
    if (reward.type === 'title') {
      const title = getTitleDefinition(reward.id);
      if (!title) return { ok: false, reason: `Título inexistente: ${reward.id}` };
      unlockTitle(title.id);
      granted.push({ type: 'title', id: title.id });
    }
  }

  if (copper > 0) {
    const transactionId = opts?.achievementId
      ? achievementRewardTxId(opts.achievementId)
      : undefined;
    const result = rewardService.grant({
      rewards: { copper },
      source: 'achievement',
      sourceId: opts?.achievementId,
      transactionId,
      allowPartial: false,
    });
    if (!result.success) {
      return { ok: false, reason: result.errors.join('; ') || 'Falha ao conceder' };
    }
    granted.push({
      type: 'copper',
      amount: result.alreadyApplied ? copper : (result.granted.copper ?? copper),
    });
  }

  return { ok: true, granted };
}

export function describeAchievementRewards(achievementId: string): string[] {
  const def = getAchievementDefinition(achievementId);
  if (!def) return [];
  return def.rewards.map((reward) => {
    if (reward.type === 'copper') return `${reward.amount} Copper (DEV)`;
    const title = getTitleDefinition(reward.id);
    return title ? `Título: ${title.name}` : `Título: ${reward.id}`;
  });
}
