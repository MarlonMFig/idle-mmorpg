import { MASTERY_MAX_LEVEL, OFFLINE_MASTERY_XP } from '../src/constants/character-mastery';
import { computeEffectiveOfflineDuration, MS_PER_OFFLINE_HOUR } from '../src/constants/offline';
import {
  applyMasteryXp,
  getMasteryXpPerKill,
  getMasteryXpRequired,
  getTotalMasteryXpToReach,
  masteryXpFromKills,
} from '../src/lib/character-mastery';
import { normalizeSealedCharacter } from '../src/utils/character-identity';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

/** Uma morte oficial = uma concessão. Hits/ticks extras não chamam de novo. */
function claimOfficialKill(enemy: { rewardClaimed: boolean }, huntLevel: number): number {
  if (enemy.rewardClaimed) return 0;
  enemy.rewardClaimed = true;
  return getMasteryXpPerKill(huntLevel);
}

assert('max is 100', MASTERY_MAX_LEVEL === 100);

assert('perKill(1)=1', getMasteryXpPerKill(1) === 1);
assert('perKill(9)=1', getMasteryXpPerKill(9) === 1);
assert('perKill(10)=2', getMasteryXpPerKill(10) === 2);
assert('perKill(19)=2', getMasteryXpPerKill(19) === 2);
assert('perKill(20)=3', getMasteryXpPerKill(20) === 3);
assert('perKill(50)=6', getMasteryXpPerKill(50) === 6);
assert('perKill(90)=10', getMasteryXpPerKill(90) === 10);

assert('10 kills Hunt Lv1 = +10', masteryXpFromKills(10, 1) === 10);
assert('10 kills Hunt Lv10 = +20', masteryXpFromKills(10, 10) === 20);
assert('10 kills Hunt Lv50 = +60', masteryXpFromKills(10, 50) === 60);
assert('10 kills Hunt Lv90 = +100', masteryXpFromKills(10, 90) === 100);

assert('no XP multiplier on mastery', getMasteryXpPerKill(50) === 6);

assert('required 0→1 = 100', getMasteryXpRequired(0) === 100);
assert('required 10→11 = 300', getMasteryXpRequired(10) === 300);
assert('required 25→26 = 600', getMasteryXpRequired(25) === 600);
assert('required 50→51 = 1100', getMasteryXpRequired(50) === 1100);
assert('required 75→76 = 1600', getMasteryXpRequired(75) === 1600);
assert('required 99→100 = 2080', getMasteryXpRequired(99) === 2080);
assert('required(100) = 0', getMasteryXpRequired(100) === 0);

const leftover = applyMasteryXp({ masteryLevel: 10, masteryXp: 290 }, 20);
assert('10 @ 290/300 +20 → 11 with 10 leftover', leftover.newLevel === 11 && leftover.masteryXp === 10);

const hopped = applyMasteryXp({ masteryLevel: 0, masteryXp: 0 }, 5000);
assert('multi level-up from grant 5000', hopped.newLevel > 1 && hopped.newLevel <= 100);
assert(
  'remainder after hop is below next required or maxed',
  hopped.masteryLevel === 100
    ? hopped.masteryXp === 0
    : hopped.masteryXp < getMasteryXpRequired(hopped.masteryLevel),
);

const to100 = applyMasteryXp({ masteryLevel: 99, masteryXp: 0 }, 2080);
assert('99 → 100 exact', to100.masteryLevel === 100 && to100.masteryXp === 0);

const overCap = applyMasteryXp({ masteryLevel: 99, masteryXp: 2079 }, 50_000);
assert('99 near-cap still stops at 100', overCap.masteryLevel === 100 && overCap.masteryXp === 0);

const atMax = applyMasteryXp({ masteryLevel: 100, masteryXp: 0 }, 999);
assert('kills after 100 stay 100', atMax.masteryLevel === 100 && atMax.xpGranted === 0);

const multiHit = { rewardClaimed: false };
const persistent = { rewardClaimed: false };
const dot = { rewardClaimed: false };
assert('multi-hit kill = one grant', claimOfficialKill(multiHit, 50) === 6 && claimOfficialKill(multiHit, 50) === 0);
assert('persistent kill = one grant', claimOfficialKill(persistent, 10) === 2 && claimOfficialKill(persistent, 10) === 0);
assert('DoT kill = one grant', claimOfficialKill(dot, 1) === 1 && claimOfficialKill(dot, 1) === 0);

const f2p8h = computeEffectiveOfflineDuration(8 * MS_PER_OFFLINE_HOUR, false);
const vip10h = computeEffectiveOfflineDuration(10 * MS_PER_OFFLINE_HOUR, true);
const kph = 300;
const f2pKills = Math.round(kph * (f2p8h.effectiveOfflineDuration / MS_PER_OFFLINE_HOUR));
const vipKills = Math.round(kph * (vip10h.effectiveOfflineDuration / MS_PER_OFFLINE_HOUR));
assert('f2p 8h counts 4h estimated kills', f2pKills === 300 * 4);
assert('vip 10h counts 8h estimated kills', vipKills === 300 * 8);
assert('offline F2P estimated kills grant 0 mastery', OFFLINE_MASTERY_XP === 0 && f2pKills > 0);
assert('offline VIP estimated kills grant 0 mastery', OFFLINE_MASTERY_XP === 0 && vipKills > 0);
assert('2000 offline kills = 0 Mastery XP', OFFLINE_MASTERY_XP * 2000 === 0);

const legacy = normalizeSealedCharacter({
  id: 'legacy-1',
  name: 'Itachi',
  lookType: 1,
});
assert('legacy default 0/0', legacy?.masteryLevel === 0 && legacy?.masteryXp === 0);

console.log(`total XP 0→100: ${getTotalMasteryXpToReach(100)}`);
console.log('character mastery tests passed');
