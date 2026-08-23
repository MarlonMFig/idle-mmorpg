/**
 * Regra oficial de teto de progressão offline.
 * Não espalhar 4 / 8 em UI ou simulador — usar estes helpers.
 */

export const OFFLINE_LIMITS = {
  nonVipHours: 4,
  vipHours: 8,
} as const;

export const MS_PER_OFFLINE_HOUR = 60 * 60 * 1000;

/** Ausência mínima para abrir o relatório real (DEV ignora). */
export const MIN_OFFLINE_REPORT_MS = 60 * 1000;

export function getMaxOfflineHours(isVip: boolean): number {
  return isVip ? OFFLINE_LIMITS.vipHours : OFFLINE_LIMITS.nonVipHours;
}

export function getMaxOfflineDurationMs(isVip: boolean): number {
  return getMaxOfflineHours(isVip) * MS_PER_OFFLINE_HOUR;
}

export interface OfflineDurationResult {
  actualOfflineDuration: number;
  effectiveOfflineDuration: number;
  offlineLimitUsed: number;
  vipStatusUsed: boolean;
}

/**
 * Tempo válido = min(tempo real, teto do VIP naquele cálculo).
 * Durações em milissegundos.
 */
export function computeEffectiveOfflineDuration(
  actualDurationMs: number,
  isVip: boolean,
): OfflineDurationResult {
  const vipStatusUsed = isVip === true;
  const actualOfflineDuration = Math.max(0, actualDurationMs);
  const offlineLimitUsed = getMaxOfflineDurationMs(vipStatusUsed);
  const effectiveOfflineDuration = Math.min(actualOfflineDuration, offlineLimitUsed);
  return {
    actualOfflineDuration,
    effectiveOfflineDuration,
    offlineLimitUsed,
    vipStatusUsed,
  };
}

export function formatOfflineDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalMin = Math.floor(clamped / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '0m';
}

export function formatOfflineHoursLabel(hours: number): string {
  return `${hours}h`;
}
