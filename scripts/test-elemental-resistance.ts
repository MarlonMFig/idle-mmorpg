import {
  applyElementalResistance,
  clampElementResistance,
  MAX_ELEMENT_RESISTANCE,
  MIN_ELEMENT_RESISTANCE,
} from '../src/systems/elemental-resistance';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const fire = { resistances: { fire: 0 }, immunities: [] as const };

assert('fire 0% = raw', applyElementalResistance(1000, 'fire', fire).finalDamage === 1000);

const resist = { resistances: { fire: 0.25 }, immunities: [] as const };
assert('fire 25% = 750', applyElementalResistance(1000, 'fire', resist).finalDamage === 750);
assert('resist tag', applyElementalResistance(1000, 'fire', resist).tag === 'RESIST');

const weak = { resistances: { fire: -0.25 }, immunities: [] as const };
assert('fire -25% = 1250', applyElementalResistance(1000, 'fire', weak).finalDamage === 1250);
assert('weak tag', applyElementalResistance(1000, 'fire', weak).tag === 'WEAK');

const immune = { resistances: { fire: 0.9 }, immunities: ['fire'] as const };
assert('immune = 0', applyElementalResistance(1000, 'fire', immune).finalDamage === 0);
assert('immune tag', applyElementalResistance(1000, 'fire', immune).tag === 'IMMUNE');

assert(
  'neutral ignores fire resist',
  applyElementalResistance(1000, 'neutral', resist).finalDamage === 1000,
);

assert('no negative', applyElementalResistance(-50, 'fire', fire).finalDamage === 0);
assert('clamp high', clampElementResistance(5) === MAX_ELEMENT_RESISTANCE);
assert('clamp low', clampElementResistance(-50) === MIN_ELEMENT_RESISTANCE);

const eachHit = [0.2, 0.2, 0.2, 0.4].map(
  (mult) => applyElementalResistance(1000 * mult, 'fire', resist).finalDamage,
);
assert(
  'multi-hit each impact',
  JSON.stringify(eachHit) === JSON.stringify([150, 150, 150, 300]),
);

console.log('elemental resistance tests passed');
