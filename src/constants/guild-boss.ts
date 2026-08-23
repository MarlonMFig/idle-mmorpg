import type { GuildBossDefinition } from '@/types/guild-boss';
import { POTION_ITEM_IDS } from '@/config/gameConfig';

/** BossDefinition id usado pelo Guild Boss semanal (DEV). */
export const GUILD_BOSS_BOSS_ID = 'guild-boss-weekly-dummy';

export const GUILD_BOSS_DEFINITION_ID = 'guild-boss-weekly';

/**
 * Configuração central — valores DEV, não balanceamento final.
 * Tentativas DIÁRIAS dentro do ciclo WEEKLY do Guild Boss.
 */
export const GUILD_BOSS_DEFINITION: GuildBossDefinition = {
  id: GUILD_BOSS_DEFINITION_ID,
  bossId: GUILD_BOSS_BOSS_ID,
  guildLevelRequirement: 1,
  maxAttemptsPerMember: 3,
  attemptResetType: 'daily',
  attemptDurationMs: 120_000,
  sharedHp: 100_000_000,
  participationRewards: [
    { type: 'copper', amount: 150 },
    { type: 'item', id: POTION_ITEM_IDS.normal, amount: 1 },
  ],
  defeatRewards: [
    { type: 'copper', amount: 500 },
    { type: 'animeCoins', amount: 2 },
  ],
  milestones: [
    {
      id: 'ms-75',
      hpRatio: 0.75,
      rewards: [{ type: 'copper', amount: 50 }],
    },
    {
      id: 'ms-50',
      hpRatio: 0.5,
      rewards: [{ type: 'copper', amount: 80 }],
    },
    {
      id: 'ms-25',
      hpRatio: 0.25,
      rewards: [{ type: 'copper', amount: 120 }],
    },
    {
      id: 'ms-0',
      hpRatio: 0,
      rewards: [{ type: 'copper', amount: 200 }],
    },
  ],
  rankingMode: 'highestDamage',
  activationMode: 'auto',
  abandonKeepsDamage: true,
  /** Anti-AFK: mínimo 1 de dano válido. */
  minimumParticipationDamage: 1,
  guildXpOnDefeat: 5_000,
  /** Contribution ≈ percentual de HP × scale (não 1:1). */
  contributionScale: 100,
};

export function getGuildBossDefinition(): GuildBossDefinition {
  return GUILD_BOSS_DEFINITION;
}

/** Contribution a partir do dano válido (não 1 damage = 1 contrib). */
export function computeGuildBossContribution(
  validDamage: number,
  sharedHpMax: number,
  scale = GUILD_BOSS_DEFINITION.contributionScale,
): number {
  if (!(sharedHpMax > 0) || !(validDamage > 0)) return 0;
  const pct = (validDamage / sharedHpMax) * 100;
  return Math.max(0, Math.floor(pct * (scale / 100)));
}
