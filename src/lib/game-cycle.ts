/**
 * Alias estável do Game Cycle Service (Item 33).
 * Implementação: `mission-cycle.ts` (não criar segundo serviço).
 */
export {
  GAME_TIMEZONE,
  WEEK_STARTS_ON,
  timeProvider,
  gameCycleService,
  gameNow,
  missionNow,
  setGameClockOverride,
  setMissionClockOverride,
  getCurrentGameDate,
  getDailyCycleId,
  getGameDailyCycleId,
  getWeeklyCycleId,
  isSameDailyCycle,
  isSameWeeklyCycle,
  getNextDailyReset,
  getNextWeeklyReset,
  getNextDailyResetMs,
  getNextWeeklyResetMs,
  formatResetCountdown,
  addDaysToCycleId,
  advanceDevToNextDay,
  advanceDevToNextWeek,
  clearDevClockOverride,
  getGameCycleDebugSnapshot,
} from '@/lib/mission-cycle';
