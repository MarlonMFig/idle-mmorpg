import {
  OFFLINE_LIMITS,
  computeEffectiveOfflineDuration,
  getMaxOfflineHours,
  MS_PER_OFFLINE_HOUR,
} from '../src/constants/offline';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function hours(n: number): number {
  return n * MS_PER_OFFLINE_HOUR;
}

function counted(actualH: number, vip: boolean): number {
  return computeEffectiveOfflineDuration(hours(actualH), vip).effectiveOfflineDuration / MS_PER_OFFLINE_HOUR;
}

assert('limits centralized', OFFLINE_LIMITS.nonVipHours === 4 && OFFLINE_LIMITS.vipHours === 8);
assert('getMaxOfflineHours F2P', getMaxOfflineHours(false) === 4);
assert('getMaxOfflineHours VIP', getMaxOfflineHours(true) === 8);

assert('f2p 1h → 1h', counted(1, false) === 1);
assert('f2p 4h → 4h', counted(4, false) === 4);
assert('f2p 5h → 4h', counted(5, false) === 4);
assert('f2p 12h → 4h', counted(12, false) === 4);

assert('vip 1h → 1h', counted(1, true) === 1);
assert('vip 4h → 4h', counted(4, true) === 4);
assert('vip 8h → 8h', counted(8, true) === 8);
assert('vip 12h → 8h', counted(12, true) === 8);

const frozen = computeEffectiveOfflineDuration(hours(6), false);
assert('pending snapshot f2p 6h actual', frozen.actualOfflineDuration === hours(6));
assert('pending snapshot f2p 6h effective 4h', frozen.effectiveOfflineDuration === hours(4));
assert('pending snapshot vip false', frozen.vipStatusUsed === false);
assert('pending snapshot limit 4h', frozen.offlineLimitUsed === hours(4));

const afterVipPurchase = computeEffectiveOfflineDuration(frozen.actualOfflineDuration, true);
assert('recompute would be 6h but pending must keep 4h', afterVipPurchase.effectiveOfflineDuration === hours(6));
assert('stored pending stays 4h', frozen.effectiveOfflineDuration === hours(4));

console.log('offline limit tests passed');
