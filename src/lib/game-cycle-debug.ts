import { isDevMode } from '@/config/devConfig';
import { getDailyCycleId, getGameCycleDebugSnapshot, getWeeklyCycleId } from '@/lib/mission-cycle';
import { bossStore } from '@/stores/boss-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { guildBossStore } from '@/stores/guild-boss-store';
import { missionsStore } from '@/stores/missions-store';

export interface GameCycleConsumerRow {
  system: string;
  kind: 'daily' | 'weekly' | 'both' | 'none';
  observedDaily: string | null;
  observedWeekly: string | null;
}

/**
 * Snapshot DEV dos consumidores de ciclo.
 * VIP não tem reset diário/semanal de calendário — só expiresAt absoluto.
 * Daily Login: apenas dailyLoginStore (Item 34).
 */
export function listGameCycleConsumers(): GameCycleConsumerRow[] {
  missionsStore.ensureCycles();
  const dailyCanon = getDailyCycleId();
  const weeklyCanon = getWeeklyCycleId();
  const missions = missionsStore.getSnapshot();
  const guildState = guildBossStore.getStateSync();
  const attemptCycles = Object.values(bossStore.getSnapshot().attempts)
    .map((a) => a.resetCycleId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return [
    {
      system: 'Daily Missions',
      kind: 'daily',
      observedDaily: missions.daily.cycleId || dailyCanon,
      observedWeekly: null,
    },
    {
      system: 'Weekly Missions',
      kind: 'weekly',
      observedDaily: null,
      observedWeekly: missions.weekly.cycleId || weeklyCanon,
    },
    {
      system: 'Daily Login',
      kind: 'daily',
      observedDaily: dailyLoginStore.getCycleId(),
      observedWeekly: null,
    },
    {
      system: 'Shop limits',
      kind: 'both',
      observedDaily: dailyCanon,
      observedWeekly: weeklyCanon,
    },
    {
      system: 'VIP',
      kind: 'none',
      observedDaily: null,
      observedWeekly: null,
    },
    {
      system: 'Gem/Premium (economy only)',
      kind: 'none',
      observedDaily: null,
      observedWeekly: null,
    },
    {
      system: 'Guild Boss',
      kind: 'weekly',
      observedDaily: null,
      observedWeekly: guildState?.cycleId ?? weeklyCanon,
    },
    {
      system: 'Boss Attempts',
      kind: 'both',
      observedDaily: attemptCycles.find((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)) ?? dailyCanon,
      observedWeekly: attemptCycles.find((id) => /^\d{4}-W\d{2}$/.test(id)) ?? weeklyCanon,
    },
  ];
}

export function detectGameCycleDivergences(): string[] {
  if (!isDevMode()) return [];
  const snap = getGameCycleDebugSnapshot();
  const warnings: string[] = [];
  for (const row of listGameCycleConsumers()) {
    if ((row.kind === 'daily' || row.kind === 'both') && row.observedDaily) {
      if (row.observedDaily !== snap.dailyCycleId) {
        warnings.push(
          `[GAME CYCLE] ${row.system} daily="${row.observedDaily}" ≠ canon="${snap.dailyCycleId}"`,
        );
      }
    }
    if ((row.kind === 'weekly' || row.kind === 'both') && row.observedWeekly) {
      if (row.observedWeekly !== snap.weeklyCycleId) {
        warnings.push(
          `[GAME CYCLE] ${row.system} weekly="${row.observedWeekly}" ≠ canon="${snap.weeklyCycleId}"`,
        );
      }
    }
  }
  return warnings;
}
