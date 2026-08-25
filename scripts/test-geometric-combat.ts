/**
 * Curvas geométricas HP/força: TTK ~2s em Δ=0, lv 1–200.
 * Run: npx --yes tsx scripts/test-geometric-combat.ts
 */
import { BALANCE, XP_PER_HP } from '../src/anime-idle/balance';
import { combatGrowth } from '../src/anime-idle/formulas';
import { PLAYER_ATTACK_COOLDOWN_MS } from '../src/constants/combat';
import { BASE_ATTRIBUTES, LEVEL_ATTRIBUTE_GROWTH } from '../src/constants/attributes';
import { huntEnemyAtkForLevel, huntEnemyHpForLevel } from '../src/lib/hunt-enemy-xp';
import { getXpRequiredForLevel } from '../src/lib/player-progression';
import { levelModifiersFor } from '../src/utils/attributes';
import { d } from '../src/lib/decimal';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

assert('XP_BASE intacto', BALANCE.XP_BASE === 360);
assert('XP_GROWTH intacto', BALANCE.XP_GROWTH === 1.11);
assert('HP_GROWTH === DPS_GROWTH', BALANCE.HP_GROWTH === BALANCE.DPS_GROWTH);
assert('DPS_GROWTH === RATE_GROWTH', BALANCE.DPS_GROWTH === BALANCE.RATE_GROWTH);
assert('XP_POR_HP 0.9', Math.abs(XP_PER_HP - 0.9) < 1e-9);
assert('HP lv1 = 63', huntEnemyHpForLevel(1).eq(63));
assert('HP lv2 = 63×1.09', huntEnemyHpForLevel(2).eq(d(63).mul(1.09)));
assert('XP exigido lv1 = 360', getXpRequiredForLevel(1).eq(360));

const grown = levelModifiersFor(2, BASE_ATTRIBUTES).strength ?? 0;
assert(
  'força lv2 / lv1 ≈ 1.09',
  Math.abs((BASE_ATTRIBUTES.strength + grown) / BASE_ATTRIBUTES.strength - BALANCE.DPS_GROWTH) < 1e-9,
);

for (let n = 1; n <= 200; n += 1) {
  const hp = huntEnemyHpForLevel(n);
  const str = d(BASE_ATTRIBUTES.strength).mul(combatGrowth(n));
  const hits = Math.max(1, Math.ceil(hp.div(str).toNumber()));
  const ttkSec = (hits * PLAYER_ATTACK_COOLDOWN_MS) / 1000;
  if (ttkSec < 1.5 || ttkSec > 3) {
    throw new Error(`FAIL TTK lv${n} = ${ttkSec}s (esperado ~2s)`);
  }
  const atk = huntEnemyAtkForLevel(n);
  const expectedAtk = d(BALANCE.ENEMY_ATK_BASE)
    .mul(BASE_ATTRIBUTES.hp + LEVEL_ATTRIBUTE_GROWTH.hp * (n - 1))
    .div(BASE_ATTRIBUTES.hp);
  if (!atk.eq(expectedAtk)) {
    throw new Error(`FAIL atk lv${n} ${atk.toString()}`);
  }
}
assert('TTK ~2s em lv 1–200 (Δ=0, sem quality)', true);
assert(
  'atk inimigo escala com HP linear',
  huntEnemyAtkForLevel(2).eq(d(6).mul(110).div(100)),
);

const hpLv2 = levelModifiersFor(2, BASE_ATTRIBUTES).hp ?? 0;
assert('HP lv2 = lv1 + 10', hpLv2 === LEVEL_ATTRIBUTE_GROWTH.hp);

for (let n = 1; n <= 200; n += 1) {
  const playerHp = d(BASE_ATTRIBUTES.hp + LEVEL_ATTRIBUTE_GROWTH.hp * (n - 1));
  const atk = huntEnemyAtkForLevel(n);
  const hitsToDie = Math.max(1, Math.ceil(playerHp.div(atk).toNumber()));
  if (hitsToDie < 8 || hitsToDie > 25) {
    throw new Error(`FAIL hits-to-die lv${n} = ${hitsToDie} (esperado ~17 em Δ=0 sem quality)`);
  }
}
assert('sobrevivência ~estável em lv 1–200 (Δ=0, sem quality)', true);

console.log('PASS test-geometric-combat');
