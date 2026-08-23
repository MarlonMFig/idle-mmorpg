import type { CharacterAwakeningConfig } from '@/constants/character-awakening';

/**
 * Rewards por CharacterDefinition.
 * Não duplicar no save da instância.
 *
 * Item 19: um personagem de teste (Itachi). Não é balanceamento final.
 */
export const CHARACTER_AWAKENING_CONFIGS: Record<string, CharacterAwakeningConfig> = {
  'uchiha-itachi': {
    enabled: true,
    rewards: {
      1: {
        stats: { attackPercent: 0.05 },
      },
      2: {
        stats: { hpPercent: 0.05 },
        passiveId: 'awakening-test-focus',
      },
      3: {
        stats: { defensePercent: 0.05 },
        skillOverrides: [
          {
            skillId: 'skill-itachi-tsukuyomi',
            slot: 3,
            vfxId: 'kamui',
            damageMultiplier: 1.1,
            executionType: 'persistent',
          },
        ],
      },
    },
  },
};

export const AWAKENING_TEST_CHARACTER_ID = 'uchiha-itachi';
