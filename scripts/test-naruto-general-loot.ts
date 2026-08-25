/**
 * Loot geral do mundo Naruto: roll único, um item, independente do personagem.
 */
import { resolveWorldId } from '../src/data/anime';
import { rollNarutoCharacterLoot } from '../src/data/anime-loot';
import { NARUTO_CHARACTER_LOOT } from '../src/data/naruto-loot-tiers';
import {
  getWorldGeneralDropChance,
  getWorldGeneralLootPool,
  NARUTO_GENERAL_EXCLUDED_ITEM_IDS,
  pickWeightedGeneralItem,
  poolWeightTotal,
  rollWorldGeneralLoot,
  validateWorldGeneralLoot,
} from '../src/data/world-general-loot';
import {
  analyzeCharacterLootEconomy,
  inspectWorldGeneralLoot,
  simulateTierHourValue,
} from '../src/lib/loot-economy-analyzer';
import { getItemSellValue } from '../src/data/shop';
import { LOOT_ECONOMY_P50_TARGET } from '../src/constants/loot-economy';
import type { NarutoLootTier } from '../src/constants/loot-economy';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function scripted(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i];
    i += 1;
    if (v === undefined) throw new Error('RNG esgotado');
    return v;
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const validation = validateWorldGeneralLoot();
if (validation.errors.length) console.log(validation.errors.join('\n'));
assert('validator sem erros', validation.errors.length === 0);
if (validation.warnings.length) console.log('warnings', validation.warnings.join(' | '));

assert(
  'world naruto por token delimitado',
  resolveWorldId({ sourceId: 'wonsr-character-uzumaki-naruto' }) === 'naruto',
);
assert(
  'world não cai em jujutsu por maki',
  resolveWorldId({ sourceId: 'wonsr-character-uzumaki-naruto' }) !== 'jujutsu',
);
assert('pack id shikamaru resolve world', resolveWorldId({ sourceId: 'shikamaru' }) === 'naruto');

for (const id of NARUTO_GENERAL_EXCLUDED_ITEM_IDS) {
  for (const tier of [1, 2, 3, 4, 5] as const) {
    const pool = getWorldGeneralLootPool('naruto', tier);
    assert(`T${tier} sem exclusivo ${id}`, !pool.some((e) => e.itemId === id));
  }
}

assert('T1 chance 3%', getWorldGeneralDropChance('naruto', 1) === 0.03);
assert('T2 chance 7%', getWorldGeneralDropChance('naruto', 2) === 0.07);
assert('T3 chance 12%', getWorldGeneralDropChance('naruto', 3) === 0.12);
assert('T4 chance 11%', getWorldGeneralDropChance('naruto', 4) === 0.11);
assert('T5 chance 9%', getWorldGeneralDropChance('naruto', 5) === 0.09);

const miss = rollWorldGeneralLoot('naruto', 1, scripted([0.99]));
assert('general fail = null', miss == null);

const hit = rollWorldGeneralLoot('naruto', 1, scripted([0, 0]));
assert('general success 1 item', hit?.itemId === 'item-anime-naruto-racao-militar');

const t1 = inspectWorldGeneralLoot('naruto', 1);
assert('T1 5 itens', t1.rows.length === 5);
assert(
  'T1 racao 25%',
  Math.abs((t1.rows.find((r) => r.itemId.endsWith('racao-militar'))?.normalized ?? 0) - 0.25) < 1e-9,
);

const profile = NARUTO_CHARACTER_LOOT['naruto-classic']!;
const failG = 0.999;
const failRest = 0.999;

const onlyGeneral = rollNarutoCharacterLoot(
  { characterId: 'naruto-classic' },
  scripted([0, 0, failRest, failRest, failRest]),
);
assert(
  'só general',
  onlyGeneral.length === 1 &&
    onlyGeneral[0]?.lootSource === 'general' &&
    onlyGeneral[0]?.quantity === 1,
);

const genSec = rollNarutoCharacterLoot(
  { characterId: 'naruto-classic' },
  scripted([0, 0, failRest, 0, failRest]),
);
assert(
  'general + secondary',
  genSec.some((d) => d.lootSource === 'general') &&
    genSec.some((d) => d.itemId === profile.secondaryItemId && d.lootSource === 'secondary'),
);

const genSig = rollNarutoCharacterLoot(
  { characterId: 'naruto-classic' },
  scripted([0, 0, failRest, failRest, 0]),
);
assert(
  'general + signature',
  genSig.some((d) => d.lootSource === 'general') &&
    genSig.some((d) => d.itemId === profile.signatureItemId && d.lootSource === 'signature'),
);

const genFrag = rollNarutoCharacterLoot(
  { characterId: 'naruto-classic' },
  scripted([0, 0, 0, failRest, failRest]),
);
assert(
  'general + fragment',
  genFrag.some((d) => d.lootSource === 'general') && genFrag.some((d) => d.lootSource === 'fragment'),
);

const all = rollNarutoCharacterLoot({ characterId: 'naruto-classic' }, scripted([0, 0, 0, 0, 0]));
assert(
  'todos simultâneos',
  all.some((d) => d.lootSource === 'general') &&
    all.some((d) => d.lootSource === 'fragment') &&
    all.some((d) => d.lootSource === 'secondary') &&
    all.some((d) => d.lootSource === 'signature'),
);

const onlyChar = rollNarutoCharacterLoot(
  { characterId: 'naruto-classic' },
  scripted([failG, failRest, 0, failRest]),
);
assert(
  'general fail, secondary ok',
  !onlyChar.some((d) => d.lootSource === 'general') &&
    onlyChar.some((d) => d.itemId === profile.secondaryItemId),
);

const oneRoll = rollWorldGeneralLoot('naruto', 5, scripted([0, 0.5]));
assert('um item no roll T5', oneRoll != null);

const gaara = rollNarutoCharacterLoot({ characterId: 'gaara' }, scripted([0, 0, failRest, failRest, failRest]));
assert(
  'cabaça não sai no general',
  !gaara.some((d) => d.itemId.includes('cabaca')),
);

for (const tier of [1, 2, 3, 4, 5] as NarutoLootTier[]) {
  const chance = getWorldGeneralDropChance('naruto', tier);
  const pool = getWorldGeneralLootPool('naruto', tier);
  const total = poolWeightTotal(pool);
  const rng = mulberry32(1000 + tier);
  const n = 10_000;
  let hits = 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i += 1) {
    const rolled = rollWorldGeneralLoot('naruto', tier, rng);
    if (!rolled) continue;
    hits += 1;
    counts.set(rolled.itemId, (counts.get(rolled.itemId) ?? 0) + 1);
  }
  const rate = hits / n;
  assert(`T${tier} chance ~${chance} got ${rate.toFixed(4)}`, Math.abs(rate - chance) < 0.02);
  assert(`T${tier} nunca 2 itens`, hits <= n);
  for (const entry of pool) {
    const expected = chance * (entry.weight / total);
    const got = (counts.get(entry.itemId) ?? 0) / n;
    assert(
      `T${tier} ${entry.itemId} peso ~${expected.toFixed(4)} got ${got.toFixed(4)}`,
      Math.abs(got - expected) < 0.02,
    );
  }
  const inspect = inspectWorldGeneralLoot('naruto', tier);
  console.log(
    `T${tier} general EV/kill=${inspect.expectedEvPerKill.toFixed(2)} chance=${chance} items=${pool.length}`,
  );
}

assert('bleach sem pool', getWorldGeneralLootPool('bleach', 1).length === 0);
assert('pick vazio', pickWeightedGeneralItem([], () => 0) == null);

const firstHour = analyzeCharacterLootEconomy('naruto-classic');
if (firstHour) {
  const copperH = firstHour.copperPerKill * firstHour.killsPerHour;
  const generalH = firstHour.generalEv * firstHour.killsPerHour;
  const characterH = (firstHour.secondaryEv + firstHour.signatureEv) * firstHour.killsPerHour;
  const fragmentH = firstHour.fragmentEv * firstHour.killsPerHour;
  console.log(
    `primeira hora T1 (naruto-classic): copper=${copperH.toFixed(0)} generalSell=${generalH.toFixed(0)} charLoot=${characterH.toFixed(0)} frag=${fragmentH.toFixed(0)} combined=${firstHour.expectedPerHour.toFixed(0)}`,
  );
}

for (const tier of [1, 2, 3, 4, 5] as NarutoLootTier[]) {
  const inspect = inspectWorldGeneralLoot('naruto', tier);
  const forbidden = inspect.rows.find((r) => r.itemId.endsWith('pergaminho-proibido'));
  const nucleo = inspect.rows.find((r) => r.itemId.endsWith('nucleo-chakra'));
  if (forbidden) {
    console.log(
      `T${tier} pergaminho-proibido sell=${getItemSellValue(forbidden.itemId)} w=${forbidden.weight} norm=${(forbidden.normalized * 100).toFixed(2)}% ev/kill=${forbidden.evPerKill.toFixed(3)}`,
    );
  }
  if (nucleo) {
    console.log(
      `T${tier} nucleo-chakra sell=${getItemSellValue(nucleo.itemId)} w=${nucleo.weight} norm=${(nucleo.normalized * 100).toFixed(2)}% ev/kill=${nucleo.evPerKill.toFixed(3)}`,
    );
  }
  const sim = simulateTierHourValue({ tier, hours: 10_000, seed: 20260823 + tier });
  const target = LOOT_ECONOMY_P50_TARGET[tier];
  console.log(
    `T${tier} 10k h P10=${Math.round(sim.p10)} P25=${Math.round(sim.p25)} P50=${Math.round(sim.p50)} P75=${Math.round(sim.p75)} P90=${Math.round(sim.p90)} avg=${Math.round(sim.average)} target=${target.min}-${target.max}`,
  );
}

console.log('PASS test-naruto-general-loot');
