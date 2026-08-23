import { AWAKENING_TEST_CHARACTER_ID } from '../src/data/awakening/character-awakening-configs';
import { getCharacterPackById } from '../src/data/character-packs';
import { getSkill } from '../src/data/skills';
import {
  getActiveAwakeningRewards,
  getAwakeningModifiers,
  getAwakeningStatPercents,
} from '../src/lib/awakening-rewards';
import { validateAwakeningConfigs } from '../src/lib/awakening-validation';
import { resolveEffectiveSkill, resolveEffectiveSkillAnim } from '../src/lib/resolve-effective-skill';
import { normalizeSealedCharacter } from '../src/utils/character-identity';
import { computePlayerAttributes } from '../src/utils/attributes';

const TEST_ID = AWAKENING_TEST_CHARACTER_ID;
const TEST_SKILL = 'skill-itachi-tsukuyomi';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function ctx(level: number) {
  return { characterId: TEST_ID, awakeningLevel: level, preview: false as const };
}

const warnings = validateAwakeningConfigs();
assert('configs valid', warnings.length === 0);

const none = getActiveAwakeningRewards(TEST_ID, 0);
assert('awakening 0 has no rewards', none.length === 0);

const one = getActiveAwakeningRewards(TEST_ID, 1);
assert('awakening I has 1 reward', one.length === 1 && one[0].level === 1);
assert('awakening I is attack', one[0].reward.stats?.attackPercent === 0.05);

const two = getActiveAwakeningRewards(TEST_ID, 2);
assert('awakening II keeps I', two.some((row) => row.level === 1));
assert('awakening II adds HP + passive', two.some((row) => row.level === 2 && row.reward.passiveId === 'awakening-test-focus'));

const three = getActiveAwakeningRewards(TEST_ID, 3);
assert('awakening III accumulates I+II+III', three.map((row) => row.level).join(',') === '1,2,3');

const p0 = getAwakeningStatPercents(TEST_ID, 0);
const p1 = getAwakeningStatPercents(TEST_ID, 1);
const p3 = getAwakeningStatPercents(TEST_ID, 3);
assert('level 0 no attack%', p0.attackPercent === 0 && p0.hpPercent === 0 && p0.defensePercent === 0);
assert('level I +5% attack only', p1.attackPercent === 0.05 && p1.hpPercent === 0);
assert('level III keeps I and adds II+III', p3.attackPercent === 0.05 && p3.hpPercent === 0.05 && p3.defensePercent === 0.05);

const stats0 = computePlayerAttributes({
  level: 50,
  stars: 2,
  characterId: TEST_ID,
  awakeningLevel: 0,
});
const stats1 = computePlayerAttributes({
  level: 50,
  stars: 2,
  characterId: TEST_ID,
  awakeningLevel: 1,
});
const stats3 = computePlayerAttributes({
  level: 50,
  stars: 2,
  characterId: TEST_ID,
  awakeningLevel: 3,
});
assert('awakening does not mutate base attack', stats0.base.strength === stats1.base.strength);
assert('awakening does not mutate base hp', stats0.base.hp === stats3.base.hp);
assert('awakening I increases attack via derived layer', stats1.totals.strength > stats0.totals.strength);
assert('awakening I derived layer exists', (stats1.awakening.strength ?? 0) > 0);
assert('awakening III keeps I attack bonus', stats3.totals.strength === stats1.totals.strength);
assert('awakening III also increases hp', stats3.totals.hp > stats1.totals.hp);
assert('offline/analyzer use the same totals', stats3.totals.strength > stats0.totals.strength);

const copyA = getAwakeningStatPercents(TEST_ID, 3);
const copyB = getAwakeningStatPercents(TEST_ID, 0);
assert('duplicate A at III has rewards', copyA.attackPercent === 0.05 && copyA.hpPercent === 0.05);
assert('duplicate B at 0 has none', copyB.attackPercent === 0 && copyB.hpPercent === 0);

const captured = normalizeSealedCharacter({
  id: 'new-itachi',
  name: 'Itachi',
  lookType: 90,
  sourceId: TEST_ID,
  characterId: TEST_ID,
});
assert('capture starts at awakening 0', captured?.awakeningLevel === 0);

const baseSkill = getSkill(TEST_SKILL);
const effective0 = resolveEffectiveSkill(TEST_SKILL, ctx(0));
const effective2 = resolveEffectiveSkill(TEST_SKILL, ctx(2));
const effective3 = resolveEffectiveSkill(TEST_SKILL, ctx(3));
assert('base skill exists', Boolean(baseSkill));
assert('awakening 0 = catalog skill', effective0?.damage === baseSkill?.damage);
assert('awakening II still catalog skill', effective2?.damage === baseSkill?.damage);
assert('awakening III applies damage multiplier', effective3 != null && baseSkill != null && effective3.damage === Math.floor(baseSkill.damage * 1.1));
assert('catalog skill file not rewritten', getSkill(TEST_SKILL)?.damage === baseSkill?.damage);

const pack = getCharacterPackById(TEST_ID);
const anim = pack?.skillAnims[TEST_SKILL];
assert('test skill anim exists', Boolean(anim));
const vfx0 = resolveEffectiveSkillAnim(anim, TEST_SKILL, ctx(0));
const vfx2 = resolveEffectiveSkillAnim(anim, TEST_SKILL, ctx(2));
const vfx3 = resolveEffectiveSkillAnim(anim, TEST_SKILL, ctx(3));
assert('base vfx stays until III', vfx0?.vfxId === anim?.vfxId && vfx2?.vfxId === anim?.vfxId);
assert('awakening III swaps vfx only', vfx3?.vfxId === 'kamui');

const mods3 = getAwakeningModifiers(TEST_ID, 3);
assert('override keyed by skillId', mods3.skillOverrides[0]?.skillId === TEST_SKILL);
assert('slot is lookup only', mods3.skillOverrides[0]?.slot === 3);
assert('passive unlocks at II and stays at III', mods3.passives.includes('awakening-test-focus'));
assert('passive absent at I', !getAwakeningModifiers(TEST_ID, 1).passives.includes('awakening-test-focus'));

console.log('character awakening reward tests passed');
