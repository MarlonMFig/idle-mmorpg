/**
 * HP/dano Decimal: 1e16 e 1e20 sobrevivem a golpe, cura e mitigação.
 * Run: npx --yes tsx scripts/test-decimal-hp-combat.ts
 */
import { d } from '../src/lib/decimal';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { vitalsStore } from '../src/stores/vitals-store';
import { getEffectiveCombatStats, mitigateIncomingDamage, PLAYER_STATUS_UNIT_ID } from '../src/systems/combat-stats';
import { applyElementalResistance } from '../src/systems/elemental-resistance';
import { DEFAULT_SKILL_ELEMENT } from '../src/data/damage-elements';
import { scaleOutgoingDamage } from '../src/config/devConfig';
import { enemyMaxHpForDefinition, scaleEnemyLevelDamage } from '../src/lib/enemy-quality-stats';
import { huntEnemyStatsForLevel } from '../src/constants/combat';
import type { EnemyDefinition } from '../src/types/enemy';
import { MAP_KEYS } from '../src/maps/map-registry';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

vitalsStore.reset({ ...DEFAULT_VITALS, hp: d('1e16'), hpMax: d('1e16') });
const hit = vitalsStore.applyHpLoss(1);
assert('1e16 - 1 não arredonda a 1e16', vitalsStore.getSnapshot().hp.eq(d('1e16').sub(1)));
assert('golpe 1 registrou 1', hit.damage.eq(1));
assert('ainda vivo', hit.died === false);

vitalsStore.reset({ ...DEFAULT_VITALS, hp: d('1e20'), hpMax: d('1e20') });
vitalsStore.applyHpLoss(d('1e16'));
assert('1e20 - 1e16', vitalsStore.getSnapshot().hp.eq(d('1e20').sub(d('1e16'))));

const healed = vitalsStore.heal(d('1e16'));
assert('cura 1e16', healed.eq(d('1e16')));
assert('voltou a 1e20', vitalsStore.getSnapshot().hp.eq(d('1e20')));

const mitigated = mitigateIncomingDamage(d('1e16'), {
  ...getEffectiveCombatStats(PLAYER_STATUS_UNIT_ID),
  defense: d(0),
  defenseMultiplier: 1,
});
assert('mitigar sem defesa preserva 1e16', mitigated.eq(d('1e16')));

const elemental = applyElementalResistance(d('1e20'), DEFAULT_SKILL_ELEMENT, {
  resistances: {},
  immunities: [],
});
assert('elemento skipped preserva 1e20', elemental.finalDamage.eq(d('1e20')));

assert('DEV scale 1e16', scaleOutgoingDamage(d('1e16')).eq(d('1e16')));

const dummy: EnemyDefinition = {
  id: 'hp-test',
  name: 'T',
  hp: 63,
  level: 1,
  xp: 1,
  loot: [],
  spawn: { x: 0, y: 0 },
  speed: 0,
  chaseRadius: 0,
  sprite: 'e',
  mapKey: MAP_KEYS.leafVillage,
};
assert('catalog hp Decimal', enemyMaxHpForDefinition(dummy).eq(63));
assert('atk Decimal min 2', scaleEnemyLevelDamage(1).eq(2));
assert('curva lv1 != lv2', !huntEnemyStatsForLevel(1).hp.eq(huntEnemyStatsForLevel(2).hp));

console.log('PASS test-decimal-hp-combat');
