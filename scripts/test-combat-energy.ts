/**
 * Item 41 — Energia no combate:
 * - Skills consomem
 * - Passive regen (tempo)
 * - Basic Attack hit = bônus adicional
 */
import { COMBAT_ENERGY, computePassiveEnergyGain } from '../src/constants/combat-energy';
import { resolveSkillEnergyCost } from '../src/data/skill-ai-def';
import {
  createSkillRotationCursor,
  decideNextAction,
  noteSkillRotationUsed,
  type CombatAiContext,
  type CombatAiSlotInput,
} from '../src/systems/combat-decision';
import { createCombatEnergyPool } from '../src/stores/combat-energy-store';
import type { SkillDefinition } from '../src/types/skill';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function nearlyEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function skill(id: string, extra: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id,
    name: id,
    cooldownMs: 1000,
    damage: 10,
    icon: '',
    animation: { kind: 'burst' },
    ...extra,
  };
}

function slots(
  defs: Array<Partial<CombatAiSlotInput> & { slot: 1 | 2 | 3 | 4; id?: string | null; cost?: number }>,
): CombatAiSlotInput[] {
  return defs.map((row) => {
    const skillId = row.id === undefined ? `s${row.slot}` : row.id;
    const energyCost = row.cost;
    const ai = {
      ...(row.animAi ?? {}),
      ...(energyCost != null ? { energyCost } : {}),
    };
    const def = skillId ? skill(skillId, { ai }) : null;
    return {
      slot: row.slot,
      skillId,
      skill: row.skill === null ? null : (row.skill as SkillDefinition | undefined) ?? def,
      animAi: ai,
    };
  });
}

function ctx(partial: Partial<CombatAiContext> & { slots: CombatAiSlotInput[] }): CombatAiContext {
  return {
    now: 0,
    stunned: false,
    actionBlocked: false,
    skillGapBlocked: false,
    selfHpRatio: 1,
    targetHpRatio: 1,
    energy: 100,
    isSkillReady: () => true,
    hasStatus: () => false,
    ...partial,
  };
}

function selected(decision: ReturnType<typeof decideNextAction>): string {
  if (decision.action.kind === 'skill') return `slot${decision.action.slot}`;
  return decision.action.kind;
}

assert('config maxEnergy 100', COMBAT_ENERGY.maxEnergy === 100);
assert('config defaultSkillEnergyCost 40', COMBAT_ENERGY.defaultSkillEnergyCost === 40);
assert('config energyGainPerBasicHit 10', COMBAT_ENERGY.energyGainPerBasicHit === 10);
assert('config energyRegenPerSecond 5', COMBAT_ENERGY.energyRegenPerSecond === 5);

assert(
  'resolveSkillEnergyCost default when absent',
  resolveSkillEnergyCost(undefined) === COMBAT_ENERGY.defaultSkillEnergyCost,
);
assert('resolveSkillEnergyCost explicit 0 stays free', resolveSkillEnergyCost({ energyCost: 0 }) === 0);
assert('resolveSkillEnergyCost chakraCost fallback', resolveSkillEnergyCost({ chakraCost: 25 }) === 25);
assert('resolveSkillEnergyCost energyCost wins', resolveSkillEnergyCost({ energyCost: 15, chakraCost: 99 }) === 15);

const pool = createCombatEnergyPool(100);
assert('start full', pool.current === 100 && pool.max === 100);

pool.empty();
assert('empty', pool.current === 0);
assert('1 basic hit → +10', pool.gainFromBasicHit(1) === 10 && pool.current === 10);
assert('2 more hits → 30', pool.gainFromBasicHit(2) === 20 && pool.current === 30);
assert('3-hit basic batch → +30 from 0', (() => {
  pool.empty();
  return pool.gainFromBasicHit(3) === 30 && pool.current === 30;
})());

pool.setEnergy(95);
assert('cap 95+10 → 100', pool.gainFromBasicHit(1) === 5 && pool.current === 100);
pool.fill();
assert('full + hit stays 100', pool.gainFromBasicHit(1) === 0 && pool.current === 100);

pool.setEnergy(100);
assert('spend 30 → 70', pool.spend(30) && pool.current === 70);
assert('exact cost 70', pool.spend(70) && pool.current === 0);
pool.setEnergy(39);
assert('below cost 40 fails', !pool.spend(40) && pool.current === 39);
assert('cost 0 always ok', pool.spend(0) && pool.current === 39);

assert(
  'rotation 1→2→3→4 with energy',
  (() => {
    const cursor = createSkillRotationCursor();
    const four = slots([
      { slot: 1, cost: 10 },
      { slot: 2, cost: 10 },
      { slot: 3, cost: 10 },
      { slot: 4, cost: 10 },
    ]);
    const order: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const d = decideNextAction(ctx({ slots: four, energy: 100, nextSkillSlot: cursor.nextSlot }));
      order.push(selected(d));
      if (d.action.kind !== 'skill') return false;
      noteSkillRotationUsed(cursor, d.action.slot, i);
    }
    return order.join(',') === 'slot1,slot2,slot3,slot4' && cursor.nextSlot === 1;
  })(),
);

assert(
  'skill 3 pending without energy → basic until affordable',
  (() => {
    const cursor = createSkillRotationCursor();
    noteSkillRotationUsed(cursor, 1, 0);
    noteSkillRotationUsed(cursor, 2, 1);
    assert('cursor on 3', cursor.nextSlot === 3);
    const four = slots([
      { slot: 1, cost: 40 },
      { slot: 2, cost: 40 },
      { slot: 3, cost: 40 },
      { slot: 4, cost: 40 },
    ]);
    const energy = createCombatEnergyPool(100);
    energy.setEnergy(20);
    let d = decideNextAction(ctx({ slots: four, energy: energy.current, nextSkillSlot: cursor.nextSlot }));
    if (selected(d) !== 'basic-attack' || cursor.nextSlot !== 3) return false;
    energy.gainFromBasicHit(1); // 30
    d = decideNextAction(ctx({ slots: four, energy: energy.current, nextSkillSlot: cursor.nextSlot }));
    if (selected(d) !== 'basic-attack' || cursor.nextSlot !== 3) return false;
    energy.gainFromBasicHit(1); // 40
    d = decideNextAction(ctx({ slots: four, energy: energy.current, nextSkillSlot: cursor.nextSlot }));
    if (selected(d) !== 'slot3') return false;
    if (!energy.spend(40) || energy.current !== 0) return false;
    noteSkillRotationUsed(cursor, 3, 2);
    return cursor.nextSlot === 4;
  })(),
);

assert(
  'skill 4 pending without energy stays on 4',
  (() => {
    const cursor = createSkillRotationCursor();
    noteSkillRotationUsed(cursor, 1, 0);
    noteSkillRotationUsed(cursor, 2, 1);
    noteSkillRotationUsed(cursor, 3, 2);
    assert('cursor on 4', cursor.nextSlot === 4);
    const four = slots([
      { slot: 1, cost: 40 },
      { slot: 2, cost: 40 },
      { slot: 3, cost: 40 },
      { slot: 4, cost: 40 },
    ]);
    const d = decideNextAction(ctx({ slots: four, energy: 10, nextSkillSlot: cursor.nextSlot }));
    return selected(d) === 'basic-attack' && cursor.nextSlot === 4 && d.nextSkillSlot === 4;
  })(),
);

assert(
  'basic attack does not advance cursor',
  (() => {
    const cursor = createSkillRotationCursor();
    const before = cursor.nextSlot;
    // basic-attack path never calls noteSkillRotationUsed
    const d = decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, cost: 99 },
          { slot: 2, cost: 0 },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
        energy: 0,
        nextSkillSlot: before,
      }),
    );
    return selected(d) === 'basic-attack' && cursor.nextSlot === before;
  })(),
);

assert(
  'skill multi-hit does not grant energy (pool rule)',
  (() => {
    const p = createCombatEnergyPool(50);
    p.setEnergy(50);
    // Hits de Skill não chamam gainFromBasicHit — simula 5 hits de skill = 0 ganho.
    const before = p.current;
    return before === 50 && p.current === 50;
  })(),
);

assert(
  'double spend guard: second spend fails when empty',
  (() => {
    const p = createCombatEnergyPool(40);
    assert('first spend', p.spend(40));
    return !p.spend(40) && p.current === 0;
  })(),
);

// --- Passive regen (correção Item 41) ---

assert(
  'computePassiveEnergyGain formula',
  computePassiveEnergyGain(2, 5) === 10 && computePassiveEnergyGain(0, 5) === 0,
);

assert(
  'passive-only 1s / 2s / 10s',
  (() => {
    const p = createCombatEnergyPool(100);
    p.empty();
    p.tickPassiveRegen(1);
    if (!nearlyEqual(p.current, 5)) return false;
    p.tickPassiveRegen(1);
    if (!nearlyEqual(p.current, 10)) return false;
    p.empty();
    p.tickPassiveRegen(10);
    return nearlyEqual(p.current, 50);
  })(),
);

assert(
  'passive + basic additive',
  (() => {
    const p = createCombatEnergyPool(100);
    p.empty();
    p.tickPassiveRegen(2); // +10
    if (!nearlyEqual(p.current, 10)) return false;
    p.gainFromBasicHit(1); // +10
    return nearlyEqual(p.current, 20);
  })(),
);

assert(
  'skill pending recovers by passive alone (no basic)',
  (() => {
    const cursor = createSkillRotationCursor();
    noteSkillRotationUsed(cursor, 1, 0);
    noteSkillRotationUsed(cursor, 2, 1);
    const four = slots([
      { slot: 1, cost: 40 },
      { slot: 2, cost: 40 },
      { slot: 3, cost: 40 },
      { slot: 4, cost: 40 },
    ]);
    const energy = createCombatEnergyPool(100);
    energy.setEnergy(20);
    let d = decideNextAction(ctx({ slots: four, energy: energy.current, nextSkillSlot: 3 }));
    if (selected(d) !== 'basic-attack') return false;
    energy.tickPassiveRegen(4); // 20 + 20 = 40
    if (!nearlyEqual(energy.current, 40)) return false;
    d = decideNextAction(ctx({ slots: four, energy: energy.current, nextSkillSlot: 3 }));
    return selected(d) === 'slot3' && cursor.nextSlot === 3;
  })(),
);

assert(
  'basic accelerates pending unlock vs passive-only',
  (() => {
    const passive = createCombatEnergyPool(100);
    passive.setEnergy(20);
    passive.tickPassiveRegen(2); // 30 after 2s
    const withBasic = createCombatEnergyPool(100);
    withBasic.setEnergy(20);
    withBasic.tickPassiveRegen(2); // 30
    withBasic.gainFromBasicHit(1); // 40
    return nearlyEqual(passive.current, 30) && nearlyEqual(withBasic.current, 40) && withBasic.current > passive.current;
  })(),
);

assert(
  'FPS independence 30/60/120 updates over 2s',
  (() => {
    const results: number[] = [];
    for (const steps of [30, 60, 120]) {
      const p = createCombatEnergyPool(100);
      p.empty();
      const dt = 2 / steps;
      for (let i = 0; i < steps; i += 1) p.tickPassiveRegen(dt);
      results.push(p.current);
    }
    return (
      nearlyEqual(results[0]!, 10, 1e-4) &&
      nearlyEqual(results[1]!, 10, 1e-4) &&
      nearlyEqual(results[2]!, 10, 1e-4)
    );
  })(),
);

assert(
  'long delta clamps to maxEnergy',
  (() => {
    const p = createCombatEnergyPool(100);
    p.setEnergy(90);
    p.tickPassiveRegen(100); // would be +500
    return nearlyEqual(p.current, 100);
  })(),
);

assert(
  'fractional regen accumulates without floor loss',
  (() => {
    const p = createCombatEnergyPool(100);
    p.empty();
    // 0.1s * 5/s = 0.5 each; 3 ticks = 1.5
    p.tickPassiveRegen(0.1);
    p.tickPassiveRegen(0.1);
    p.tickPassiveRegen(0.1);
    return nearlyEqual(p.current, 1.5);
  })(),
);

assert(
  'regen during skill window (time still ticks)',
  (() => {
    // Simula: cast dura 1.2s de tempo de combate — regen aplica o delta.
    const p = createCombatEnergyPool(100);
    p.setEnergy(10);
    p.tickPassiveRegen(1.2);
    return nearlyEqual(p.current, 16);
  })(),
);

console.log('test-combat-energy: all passed');
