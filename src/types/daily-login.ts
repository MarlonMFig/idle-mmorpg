/**
 * Recompensa Diária / Daily Login (Item 25).
 * Independente de Missões Diárias. Sem Battle Pass / Daily XP / moeda nova.
 */

export const DAILY_LOGIN_CYCLE_LENGTH = 7 as const;

export type DailyLoginDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DailyLoginReward =
  | { type: 'copper'; amount: number }
  | { type: 'item'; id: string; amount: number };

export interface DailyLoginDayDefinition {
  day: DailyLoginDay;
  rewards: readonly DailyLoginReward[];
  /** Balanceamento inicial / DEV. */
  rewardsDev?: boolean;
}

export interface DailyLoginState {
  /** Próximo dia da sequência a coletar (1–7). */
  currentDay: DailyLoginDay;
  /** cycleId (YYYY-MM-DD) do último claim. null = nunca coletou. */
  lastClaimCycleId: string | null;
  totalClaims: number;
}

export const DEFAULT_DAILY_LOGIN_STATE: DailyLoginState = {
  currentDay: 1,
  lastClaimCycleId: null,
  totalClaims: 0,
};

export type DailyLoginSlotStatus = 'claimed' | 'today' | 'collected-today' | 'locked';
