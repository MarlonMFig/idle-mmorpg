import {
  getTotalXpToReachLevel,
  getXpRemainingToLevel,
  getXpRequiredForLevel,
  XP_ACCUMULATION_LEVELS,
} from '@/lib/player-progression';

/** Cenários de análise (XP efetiva / h, no estilo Hunt Analyzer). */
export const XP_PER_HOUR_SCENARIOS = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export const TIME_TABLE_TARGET_LEVELS = [10, 50, 100, 200, 300, 500, 600] as const;

export interface AccumulatedXpRow {
  level: number;
  xpToNext: number;
  xpAccumulated: number;
}

export interface TimeEstimate {
  hours: number;
  days: number;
  label: string;
}

export function inspectAccumulatedXp(
  levels: readonly number[] = XP_ACCUMULATION_LEVELS,
): AccumulatedXpRow[] {
  return levels.map((level) => ({
    level,
    xpToNext: getXpRequiredForLevel(level),
    xpAccumulated: getTotalXpToReachLevel(level),
  }));
}

export function formatEta(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '—';
  if (hours === 0) return '0 min';
  const minutes = hours * 60;
  if (minutes < 1) return '< 1 min';
  if (hours < 1) return `${Math.round(minutes)} min`;
  if (hours < 48) {
    const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
    return `${rounded} h`;
  }
  const days = hours / 24;
  if (days < 365) {
    const rounded = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
    return `${rounded} d`;
  }
  const years = days / 365;
  if (years >= 1e6) return 'impossível';
  if (years >= 1000) return `${(years / 1000).toFixed(1)} mil anos`;
  const rounded = years >= 10 ? Math.round(years) : Math.round(years * 10) / 10;
  return `${rounded} anos`;
}

/**
 * Estima tempo para ir de (currentLevel, currentXp) até targetLevel
 * com uma taxa constante de XP/h (como o Analyzer).
 */
export function estimateTimeToLevel(
  currentLevel: number,
  currentXp: number,
  targetLevel: number,
  xpPerHour: number,
): TimeEstimate {
  if (xpPerHour <= 0) {
    return { hours: Number.POSITIVE_INFINITY, days: Number.POSITIVE_INFINITY, label: '—' };
  }
  const remaining = getXpRemainingToLevel(currentLevel, currentXp, targetLevel);
  if (!Number.isFinite(remaining)) {
    return { hours: Number.POSITIVE_INFINITY, days: Number.POSITIVE_INFINITY, label: 'impossível' };
  }
  const hours = remaining / xpPerHour;
  return {
    hours,
    days: hours / 24,
    label: formatEta(hours),
  };
}

export function simulateXpPerHourTable(
  xpPerHourList: readonly number[] = XP_PER_HOUR_SCENARIOS,
  targets: readonly number[] = TIME_TABLE_TARGET_LEVELS,
  currentLevel = 1,
  currentXp = 0,
): Array<{ xpPerHour: number; etas: Record<number, string> }> {
  return xpPerHourList.map((xpPerHour) => {
    const etas: Record<number, string> = {};
    for (const target of targets) {
      etas[target] = estimateTimeToLevel(currentLevel, currentXp, target, xpPerHour).label;
    }
    return { xpPerHour, etas };
  });
}
