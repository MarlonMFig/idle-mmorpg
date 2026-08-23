import type { WorldBossDefinition } from '@/types/world-boss';
import { POTION_ITEM_IDS } from '@/config/gameConfig';

/** BossDefinition id — combat/phases/skills. */
export const WORLD_BOSS_BOSS_ID = 'world-boss-weekly-dummy';

export const WORLD_BOSS_DEFINITION_ID = 'world-boss-weekly';

/**
 * Config DEV — não é balanceamento final.
 * Ciclo WEEKLY; tentativas DIÁRIAS; HP alto via bigint no backend.
 */
export const WORLD_BOSS_DEFINITION: WorldBossDefinition = {
  id: WORLD_BOSS_DEFINITION_ID,
  bossId: WORLD_BOSS_BOSS_ID,
  cycleType: 'weekly',
  /** 10B — DEV; testes usam setSharedHp / HP menor. */
  maxHp: 10_000_000_000,
  attemptDurationMs: 120_000,
  maxAttempts: 3,
  attemptResetType: 'daily',
  minimumPlayerLevel: 1,
  participationRewards: [
    { type: 'copper', amount: 200 },
    { type: 'item', id: POTION_ITEM_IDS.normal, amount: 1 },
  ],
  defeatRewards: [
    { type: 'copper', amount: 800 },
    { type: 'animeCoins', amount: 3 },
  ],
  milestones: [
    {
      id: 'wb-ms-75',
      hpRatio: 0.75,
      rewards: [{ type: 'copper', amount: 60 }],
    },
    {
      id: 'wb-ms-50',
      hpRatio: 0.5,
      rewards: [{ type: 'copper', amount: 100 }],
    },
    {
      id: 'wb-ms-25',
      hpRatio: 0.25,
      rewards: [{ type: 'copper', amount: 140 }],
    },
    {
      id: 'wb-ms-0',
      hpRatio: 0,
      rewards: [{ type: 'copper', amount: 250 }],
    },
  ],
  abandonKeepsDamage: true,
  minimumParticipationDamage: 1,
  syncIntervalMs: 5_000,
};

export function getWorldBossDefinition(): WorldBossDefinition {
  return WORLD_BOSS_DEFINITION;
}

export function worldBossClaimId(input: {
  cycleId: string;
  bossId: string;
  playerId: string;
  rewardType: string;
  milestoneId?: string;
}): string {
  const suffix = input.milestoneId
    ? `${input.rewardType}:${input.milestoneId}`
    : input.rewardType;
  return `world-boss:${input.cycleId}:${input.bossId}:${input.playerId}:${suffix}`;
}
