/**
 * Game Cycle Service (Item 33) — fonte única de dia/semana/reset.
 * Timezone oficial: America/Sao_Paulo.
 *
 * Reaproveita a lógica de mission-cycle (Item 24+).
 * Timestamps absolutos (cooldown, offline elapsed, VIP expiresAt) continuam Date.now()/elapsed.
 *
 * Limitação client-side: relógio do dispositivo pode ser manipulado — sem anti-cheat neste item.
 * Futuro: TimeProvider pode receber serverNow sem reescrever consumidores.
 */

export const GAME_TIMEZONE = 'America/Sao_Paulo';

/** Início da semana oficial: segunda-feira (ISO). */
export const WEEK_STARTS_ON = 'monday' as const;

let nowOverrideMs: number | null = null;
let externalNowProvider: (() => number) | null = null;

/** Mutations de relógio DEV/test — bloqueadas em production build. */
function canMutateGameClock(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env?.NODE_ENV !== 'production';
}

/** TimeProvider — agora do jogo (override DEV ou provider futuro / Date.now). */
export const timeProvider = {
  now(): number {
    if (nowOverrideMs != null) return nowOverrideMs;
    if (externalNowProvider) return externalNowProvider();
    return Date.now();
  },

  /**
   * Override DEV único — todos os ciclos enxergam o mesmo relógio.
   * `null` sempre limpa (cleanup seguro). Non-null bloqueado em production.
   */
  setOverride(ms: number | null): void {
    if (ms != null && !canMutateGameClock()) return;
    nowOverrideMs = ms;
  },

  getOverride(): number | null {
    return nowOverrideMs;
  },

  /** Reserva para backend futuro (serverNow). */
  setExternalProvider(fn: (() => number) | null): void {
    if (fn != null && !canMutateGameClock()) return;
    externalNowProvider = fn;
  },
};

/** @deprecated Prefer timeProvider.now / gameNow. */
export function setMissionClockOverride(ms: number | null): void {
  timeProvider.setOverride(ms);
}

export function setGameClockOverride(ms: number | null): void {
  timeProvider.setOverride(ms);
}

export function missionNow(): number {
  return timeProvider.now();
}

export function gameNow(): number {
  return timeProvider.now();
}

function zonedYmd(ms: number, timeZone = GAME_TIMEZONE): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data civil oficial YYYY-MM-DD (America/Sao_Paulo). */
export function getCurrentGameDate(ms = gameNow(), timeZone = GAME_TIMEZONE): string {
  return getDailyCycleId(ms, timeZone);
}

/** Daily cycle: YYYY-MM-DD no timezone oficial. */
export function getDailyCycleId(ms = gameNow(), timeZone = GAME_TIMEZONE): string {
  const { year, month, day } = zonedYmd(ms, timeZone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export const getGameDailyCycleId = getDailyCycleId;

/**
 * Segunda-feira como início da semana (ISO).
 * Weekly cycle: YYYY-Www
 */
export function getWeeklyCycleId(ms = gameNow(), timeZone = GAME_TIMEZONE): string {
  const { year, month, day } = zonedYmd(ms, timeZone);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${pad2(week)}`;
}

export function isSameDailyCycle(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}

export function isSameWeeklyCycle(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}

function nextMidnightInZone(ms: number, timeZone: string): number {
  const { year, month, day } = zonedYmd(ms, timeZone);
  const guess = Date.UTC(year, month - 1, day + 1, 3, 0, 0);
  for (let offset = -36; offset <= 36; offset += 1) {
    const candidate = guess + offset * 3600000;
    const ymd = getDailyCycleId(candidate, timeZone);
    const prev = getDailyCycleId(candidate - 1, timeZone);
    if (ymd !== prev && prev === getDailyCycleId(ms, timeZone)) {
      return candidate;
    }
  }
  return guess;
}

export function getNextDailyResetMs(ms = gameNow(), timeZone = GAME_TIMEZONE): number {
  return nextMidnightInZone(ms, timeZone);
}

export function getNextDailyReset(ms = gameNow(), timeZone = GAME_TIMEZONE): number {
  return getNextDailyResetMs(ms, timeZone);
}

export function getNextWeeklyResetMs(ms = gameNow(), timeZone = GAME_TIMEZONE): number {
  const { year, month, day } = zonedYmd(ms, timeZone);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  const weekday = date.getUTCDay() || 7;
  const daysUntilMonday = weekday === 1 ? 7 : 8 - weekday;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  const mondayYmd = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  const currentWeekly = getWeeklyCycleId(ms, timeZone);
  for (let hour = 0; hour < 48; hour += 1) {
    const candidate = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      0,
      0,
    );
    if (getWeeklyCycleId(candidate, timeZone) !== currentWeekly) {
      const idAt = getDailyCycleId(candidate, timeZone);
      if (idAt === mondayYmd || getWeeklyCycleId(candidate - 1, timeZone) === currentWeekly) {
        return candidate;
      }
    }
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 3, 0, 0);
}

export function getNextWeeklyReset(ms = gameNow(), timeZone = GAME_TIMEZONE): number {
  return getNextWeeklyResetMs(ms, timeZone);
}

export function formatResetCountdown(targetMs: number, nowMs = gameNow()): string {
  const delta = Math.max(0, targetMs - nowMs);
  const hours = Math.floor(delta / 3600000);
  const minutes = Math.floor((delta % 3600000) / 60000);
  return `${hours}h ${pad2(minutes)}m`;
}

/** Soma dias civis a um cycleId YYYY-MM-DD (calendário, não timezone local do browser). */
export function addDaysToCycleId(cycleId: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cycleId);
  if (!match) return cycleId;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** DEV: avança o relógio do jogo para o próximo reset diário (São Paulo). */
export function advanceDevToNextDay(): string {
  const next = getNextDailyResetMs();
  timeProvider.setOverride(next);
  return getDailyCycleId();
}

/** DEV: avança para o próximo reset semanal. */
export function advanceDevToNextWeek(): string {
  const next = getNextWeeklyResetMs();
  timeProvider.setOverride(next);
  return getWeeklyCycleId();
}

export function clearDevClockOverride(): void {
  timeProvider.setOverride(null);
}

/** Alias explícito para testes — limpa override + provider externo. */
export function resetDevTime(): void {
  nowOverrideMs = null;
  externalNowProvider = null;
}

/**
 * TestTimeProvider — relógio determinístico (development/test only).
 * Não depende do horário wall-clock do CI.
 */
export const testTimeProvider = {
  now(): number {
    return gameNow();
  },

  setNow(ms: number): void {
    timeProvider.setOverride(ms);
  },

  /** Avança N midnights America/Sao_Paulo via a mesma fonte de getDailyCycleId. */
  advanceDays(days = 1): string {
    const n = Math.max(0, Math.floor(days));
    for (let i = 0; i < n; i += 1) {
      advanceDevToNextDay();
    }
    return getDailyCycleId();
  },

  advanceWeeks(weeks = 1): string {
    const n = Math.max(0, Math.floor(weeks));
    for (let i = 0; i < n; i += 1) {
      advanceDevToNextWeek();
    }
    return getWeeklyCycleId();
  },

  reset(): void {
    resetDevTime();
  },
};

/** Snapshot DEV — consumidores devem concordar nestes IDs. */
export function getGameCycleDebugSnapshot(): {
  timezone: string;
  nowMs: number;
  overrideActive: boolean;
  dailyCycleId: string;
  weeklyCycleId: string;
  nextDailyResetMs: number;
  nextWeeklyResetMs: number;
  weekStartsOn: typeof WEEK_STARTS_ON;
} {
  const nowMs = gameNow();
  return {
    timezone: GAME_TIMEZONE,
    nowMs,
    overrideActive: timeProvider.getOverride() != null,
    dailyCycleId: getDailyCycleId(nowMs),
    weeklyCycleId: getWeeklyCycleId(nowMs),
    nextDailyResetMs: getNextDailyResetMs(nowMs),
    nextWeeklyResetMs: getNextWeeklyResetMs(nowMs),
    weekStartsOn: WEEK_STARTS_ON,
  };
}

/**
 * Fachada GameCycleService — mesma implementação das funções exportadas.
 */
export const gameCycleService = {
  timezone: GAME_TIMEZONE,
  weekStartsOn: WEEK_STARTS_ON,
  now: gameNow,
  getCurrentGameDate,
  getDailyCycleId,
  getWeeklyCycleId,
  getNextDailyReset,
  getNextWeeklyReset,
  getNextDailyResetMs,
  getNextWeeklyResetMs,
  isSameDailyCycle,
  isSameWeeklyCycle,
  formatResetCountdown,
  addDaysToCycleId,
  advanceDevToNextDay,
  advanceDevToNextWeek,
  clearDevClockOverride,
  resetDevTime,
  testTimeProvider,
  getDebugSnapshot: getGameCycleDebugSnapshot,
  setOverride: setGameClockOverride,
};
