import {
  computeEffectiveOfflineDuration,
  getMaxOfflineHours,
  type OfflineDurationResult,
} from '@/constants/offline';
import { vipStore } from '@/stores/vip-store';

/** Fonte VIP oficial da conta (expirado = inativo). */
export function isVipActiveForOffline(): boolean {
  return vipStore.isActive();
}

export function getMaxOfflineHoursForPlayer(): number {
  return getMaxOfflineHours(isVipActiveForOffline());
}

export function computeOfflineDurationForPlayer(actualDurationMs: number): OfflineDurationResult {
  return computeEffectiveOfflineDuration(actualDurationMs, isVipActiveForOffline());
}
