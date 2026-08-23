/**
 * Decision Engine — prioridade, cooldown, energia, autoUse, condições, stun.
 * Não altera dano/cooldown reais do jogo.
 */
import type { SkillDefinition } from '../src/types/skill';
import {
  createSkillRotationCursor,
  decideNextAction,
  formatCombatAiDecision,
  nextSkillSlotAfter,
  noteSkillRotationUsed,
  type CombatAiContext,
  type CombatAiSlotInput,
} from '../src/systems/combat-decision';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
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
  defs: Array<Partial<CombatAiSlotInput> & { slot: 1 | 2 | 3 | 4; id?: string | null }>,
): CombatAiSlotInput[] {
  return defs.map((row) => {
    const skillId = row.id === undefined ? `s${row.slot}` : row.id;
    const def = skillId ? skill(skillId, { ai: row.animAi, ...(row.skill ?? {}) }) : null;
    return {
      slot: row.slot,
      skillId,
      skill: row.skill === null ? null : (row.skill as SkillDefinition | undefined) ?? def,
      animAi: row.animAi,
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
    energy: null,
    isSkillReady: () => true,
    hasStatus: () => false,
    ...partial,
  };
}

function selected(decision: ReturnType<typeof decideNextAction>): string {
  if (decision.action.kind === 'skill') return `slot${decision.action.slot}`;
  return decision.action.kind;
}

const four = slots([
  { slot: 1, animAi: { autoUse: true, priority: 4 } },
  { slot: 2, animAi: { autoUse: true, priority: 1 } },
  { slot: 3, animAi: { autoUse: true, priority: 2 } },
  { slot: 4, animAi: { autoUse: true, priority: 3 } },
]);

assert('rotation starts at slot 1 among four ready', selected(decideNextAction(ctx({ slots: four }))) === 'slot1');

assert(
  'aiPriority does not jump ahead of rotation',
  selected(decideNextAction(ctx({ slots: four, nextSkillSlot: 1 }))) !== 'slot2',
);

assert(
  'cursor 3 starts at slot 3',
  selected(decideNextAction(ctx({ slots: four, nextSkillSlot: 3 }))) === 'slot3',
);

assert(
  'cursor 3 skips cooldown and uses slot 4',
  selected(
    decideNextAction(
      ctx({
        slots: four,
        nextSkillSlot: 3,
        isSkillReady: (id) => id !== 's3',
      }),
    ),
  ) === 'slot4',
);

assert(
  'after using 4 next cursor is 1',
  (() => {
    const cursor = createSkillRotationCursor(3);
    const d = decideNextAction(
      ctx({
        slots: four,
        nextSkillSlot: cursor.nextSlot,
        isSkillReady: (id) => id !== 's3',
      }),
    );
    if (d.action.kind !== 'skill') return false;
    noteSkillRotationUsed(cursor, d.action.slot, 1);
    return d.action.slot === 4 && cursor.nextSlot === 1;
  })(),
);

assert(
  'basic attack does not advance cursor',
  (() => {
    const cursor = createSkillRotationCursor(3);
    const before = cursor.nextSlot;
    decideNextAction(
      ctx({
        slots: four,
        nextSkillSlot: before,
        isSkillReady: () => false,
      }),
    );
    return cursor.nextSlot === before && before === 3;
  })(),
);

assert(
  'full circle 1-2-3-4-1',
  (() => {
    const cursor = createSkillRotationCursor();
    const used: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = decideNextAction(ctx({ slots: four, nextSkillSlot: cursor.nextSlot }));
      if (d.action.kind !== 'skill') return false;
      used.push(d.action.slot);
      noteSkillRotationUsed(cursor, d.action.slot, i + 1);
    }
    return used.join(',') === '1,2,3,4,1';
  })(),
);

assert(
  'autoUse off is skipped in the circle',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { autoUse: true } },
          { slot: 2, animAi: { autoUse: false } },
          { slot: 3, animAi: { autoUse: true } },
          { slot: 4, animAi: { autoUse: true } },
        ]),
        nextSkillSlot: 2,
      }),
    ),
  ) === 'slot3',
);

assert(
  'empty slot skipped in the circle',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { autoUse: true } },
          { slot: 2, animAi: { autoUse: true } },
          { slot: 3, id: null },
          { slot: 4, animAi: { autoUse: true } },
        ]),
        nextSkillSlot: 3,
      }),
    ),
  ) === 'slot4',
);

assert('nextSkillSlotAfter wraps', nextSkillSlotAfter(4) === 1);

assert(
  'tie uses lower slot index',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 2 } },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'legacy slot order when ai absent',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: undefined },
          { slot: 2, animAi: undefined },
          { slot: 3, animAi: undefined },
          { slot: 4, animAi: undefined },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'cooldown skips current slot then continues circle',
  selected(
    decideNextAction(
      ctx({
        slots: four,
        nextSkillSlot: 1,
        isSkillReady: (id) => id !== 's1',
      }),
    ),
  ) === 'slot2',
);

assert(
  'energy shortage keeps pending skill (no skip to next)',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 1, energyCost: 50 } },
          { slot: 2, animAi: { priority: 2, energyCost: 10 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
        energy: 20,
        nextSkillSlot: 1,
      }),
    ),
  ) === 'basic-attack',
);

assert(
  'null energy ignores cost (Energia Infinita / DEV)',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 1, energyCost: 50 } },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
        energy: null,
      }),
    ),
  ) === 'slot1',
);

assert(
  'exact energy cost allows skill',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 1, energyCost: 40 } },
          { slot: 2, id: null },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
        energy: 40,
      }),
    ),
  ) === 'slot1',
);

assert(
  'below energy cost stays on pending slot',
  (() => {
    const decision = decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 1, energyCost: 40 } },
          { slot: 2, animAi: { priority: 2, energyCost: 0 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
        energy: 39,
        nextSkillSlot: 1,
      }),
    );
    return decision.action.kind === 'basic-attack' && decision.nextSkillSlot === 1;
  })(),
);

assert(
  'autoUse OFF skipped',
  selected(
    decideNextAction(
      ctx({
        slots: slots([
          { slot: 1, animAi: { priority: 1, autoUse: false } },
          { slot: 2, animAi: { priority: 2, autoUse: true } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot2',
);

assert(
  'empty slot ignored',
  decideNextAction(
    ctx({
      slots: slots([
        { slot: 1, id: null },
        { slot: 2, animAi: { priority: 4 } },
        { slot: 3, id: null },
        { slot: 4, id: null },
      ]),
    }),
  ).rejects.some((row) => row.reason === 'empty'),
);

assert(
  'invalid skill warns and continues',
  (() => {
    const d = decideNextAction(
      ctx({
        slots: [
          { slot: 1, skillId: 'missing', skill: null, animAi: { priority: 1 } },
          ...slots([{ slot: 2, animAi: { priority: 2 } }]).slice(0, 1),
          { slot: 3, skillId: null, skill: null },
          { slot: 4, skillId: null, skill: null },
        ],
      }),
    );
    return d.warnings.some((w) => w.includes('unknown skill')) && selected(d) === 'slot2';
  })(),
);

assert(
  'self HP below',
  selected(
    decideNextAction(
      ctx({
        selfHpRatio: 0.3,
        slots: slots([
          {
            slot: 1,
            animAi: { priority: 1, conditions: [{ type: 'self-hp-below', value: 0.4 }] },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'self HP above threshold uses next',
  selected(
    decideNextAction(
      ctx({
        selfHpRatio: 0.9,
        slots: slots([
          {
            slot: 1,
            animAi: { priority: 1, conditions: [{ type: 'self-hp-below', value: 0.4 }] },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot2',
);

assert(
  'finisher only at low enemy HP',
  selected(
    decideNextAction(
      ctx({
        targetHpRatio: 0.15,
        slots: slots([
          {
            slot: 1,
            animAi: { priority: 1, conditions: [{ type: 'target-hp-below', value: 0.2 }] },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'finisher skipped when enemy healthy',
  selected(
    decideNextAction(
      ctx({
        targetHpRatio: 0.8,
        slots: slots([
          {
            slot: 1,
            animAi: { priority: 1, conditions: [{ type: 'target-hp-below', value: 0.2 }] },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot2',
);

assert(
  'opening buff when enemy HP high',
  selected(
    decideNextAction(
      ctx({
        targetHpRatio: 0.9,
        slots: slots([
          {
            slot: 1,
            animAi: { priority: 1, conditions: [{ type: 'target-hp-above', value: 0.7 }] },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'status-absent skips while buff active',
  selected(
    decideNextAction(
      ctx({
        hasStatus: (who, id) => who === 'self' && id === 'attack-up',
        slots: slots([
          {
            slot: 1,
            animAi: {
              priority: 1,
              conditions: [{ type: 'status-absent', statusId: 'attack-up' }],
            },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot2',
);

assert(
  'status-present combo gate',
  selected(
    decideNextAction(
      ctx({
        hasStatus: (who, id) => who === 'target' && id === 'burn',
        slots: slots([
          {
            slot: 1,
            animAi: {
              priority: 1,
              conditions: [{ type: 'status-present', statusId: 'burn' }],
            },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot1',
);

assert(
  'AND conditions both required',
  selected(
    decideNextAction(
      ctx({
        selfHpRatio: 0.2,
        targetHpRatio: 0.9,
        slots: slots([
          {
            slot: 1,
            animAi: {
              priority: 1,
              conditions: [
                { type: 'self-hp-below', value: 0.5 },
                { type: 'target-hp-below', value: 0.2 },
              ],
            },
          },
          { slot: 2, animAi: { priority: 2 } },
          { slot: 3, id: null },
          { slot: 4, id: null },
        ]),
      }),
    ),
  ) === 'slot2',
);

assert('stun waits', decideNextAction(ctx({ slots: four, stunned: true })).action.kind === 'wait');
assert(
  'busy waits',
  decideNextAction(ctx({ slots: four, actionBlocked: true })).action.kind === 'wait',
);

assert(
  'gap falls back to basic (legado)',
  decideNextAction(ctx({ slots: four, skillGapBlocked: true })).action.kind === 'basic-attack',
);

assert(
  'silence keeps basic',
  decideNextAction(ctx({ slots: four, skillsSilenced: true })).action.kind === 'basic-attack',
);

assert(
  'heal skipped at full HP without HP condition',
  selected(
    decideNextAction(
      ctx({
        selfHpRatio: 1,
        slots: [
          {
            slot: 1,
            skillId: 'heal',
            skill: skill('heal', { effect: 'heal', healPercent: 0.2, ai: { priority: 1 } }),
            animAi: { priority: 1 },
          },
          ...slots([{ slot: 2, animAi: { priority: 2 } }]),
          { slot: 3, skillId: null, skill: null },
          { slot: 4, skillId: null, skill: null },
        ],
      }),
    ),
  ) === 'slot2',
);

assert(
  'no random: same context same action',
  selected(decideNextAction(ctx({ slots: four }))) === selected(decideNextAction(ctx({ slots: four }))),
);

const preview = decideNextAction(
  ctx({
    targetHpRatio: 0.5,
    slots: slots([
      { slot: 1, animAi: { priority: 2 } },
      { slot: 2, animAi: { priority: 1, autoUse: false } },
      { slot: 3, animAi: { priority: 1, conditions: [{ type: 'target-hp-below', value: 0.2 }] } },
      { slot: 4, animAi: { priority: 3 } },
    ]),
  }),
);
console.log('--- rotation preview (t=0) ---');
for (const line of formatCombatAiDecision(preview)) console.log(line);

console.log('combat decision tests passed');
