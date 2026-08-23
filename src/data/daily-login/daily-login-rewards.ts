import { POTION_ITEM_IDS } from '@/config/gameConfig';
import { SEALING_SCROLL_ITEM_ID } from '@/constants/sealing';
import type { DailyLoginDayDefinition } from '@/types/daily-login';

/**
 * Ciclo de 7 dias — valores conservadores (BALANCEAMENTO INICIAL).
 * Dia 7 é o melhor do ciclo, sem economia agressiva.
 */
export const DAILY_LOGIN_REWARDS: readonly DailyLoginDayDefinition[] = [
  {
    day: 1,
    rewards: [{ type: 'copper', amount: 80 }],
    rewardsDev: true,
  },
  {
    day: 2,
    rewards: [{ type: 'item', id: POTION_ITEM_IDS.normal, amount: 2 }],
    rewardsDev: true,
  },
  {
    day: 3,
    rewards: [
      { type: 'copper', amount: 120 },
      { type: 'item', id: POTION_ITEM_IDS.normal, amount: 1 },
    ],
    rewardsDev: true,
  },
  {
    day: 4,
    rewards: [{ type: 'item', id: POTION_ITEM_IDS.concentrated, amount: 1 }],
    rewardsDev: true,
  },
  {
    day: 5,
    rewards: [
      { type: 'copper', amount: 180 },
      { type: 'item', id: SEALING_SCROLL_ITEM_ID, amount: 1 },
    ],
    rewardsDev: true,
  },
  {
    day: 6,
    rewards: [
      { type: 'item', id: POTION_ITEM_IDS.ultra, amount: 1 },
      { type: 'item', id: POTION_ITEM_IDS.revive, amount: 1 },
    ],
    rewardsDev: true,
  },
  {
    day: 7,
    rewards: [
      { type: 'copper', amount: 350 },
      { type: 'item', id: SEALING_SCROLL_ITEM_ID, amount: 2 },
      { type: 'item', id: POTION_ITEM_IDS.concentrated, amount: 2 },
    ],
    rewardsDev: true,
  },
];

export function getDailyLoginDayDefinition(day: number): DailyLoginDayDefinition | null {
  return DAILY_LOGIN_REWARDS.find((row) => row.day === day) ?? null;
}
