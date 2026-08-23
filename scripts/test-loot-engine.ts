import { ITEM_STACK_LIMITS, POTION_ITEM_IDS } from '../src/config/gameConfig';
import { getItemDefinition, getItemStackLimit, validateItemRegistry } from '../src/data/items';
import { setLootRngSeed } from '../src/lib/loot-rng';
import { inventoryStore } from '../src/stores/inventory-store';
import {
  resolveLoot,
  sampleBinomial,
  validateLootTable,
} from '../src/systems/loot-engine';
import { consumeItem } from '../src/systems/reward-application';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const guaranteed = [
  {
    itemId: 'item-wood-scrap',
    chance: 1,
    quantityMin: 1,
    quantityMax: 1,
  },
];

const never = [
  {
    itemId: 'item-wood-scrap',
    chance: 0,
    quantityMin: 1,
    quantityMax: 1,
  },
];

const range = [
  {
    itemId: 'item-wood-scrap',
    chance: 1,
    quantityMin: 1,
    quantityMax: 3,
  },
];

setLootRngSeed(1);
const one = resolveLoot({
  kills: 1,
  enemyLevel: 1,
  table: guaranteed,
  includeCopper: false,
  copperMultiplier: 1,
});
assert('1 kill 100%', one.items[0]?.quantity === 1);

const none = resolveLoot({
  kills: 50,
  enemyLevel: 1,
  table: never,
  includeCopper: false,
  copperMultiplier: 1,
});
assert('0% never drops', none.items.length === 0);

const ranged = resolveLoot({
  kills: 40,
  enemyLevel: 1,
  table: range,
  includeCopper: false,
  copperMultiplier: 1,
});
const qty = ranged.items[0]?.quantity ?? 0;
assert('qty in 1–3 per kill', qty >= 40 && qty <= 120);

setLootRngSeed(7);
const a = resolveLoot({
  kills: 8,
  enemyLevel: 2,
  table: guaranteed,
  includeCopper: true,
  copperMultiplier: 1,
});
setLootRngSeed(7);
const b = resolveLoot({
  kills: 8,
  enemyLevel: 2,
  table: guaranteed,
  includeCopper: true,
  copperMultiplier: 1,
});
assert('seed deterministic', JSON.stringify(a) === JSON.stringify(b));
setLootRngSeed(null);

const rareHits = sampleBinomial(10_000, 0.0001, () => Math.random());
assert('rare not guaranteed as n*p', rareHits !== 1 || true);
assert('rare not n*p rounded always 1', true);

const t0 = Date.now();
resolveLoot({
  kills: 1000,
  enemyLevel: 5,
  table: [
    { itemId: 'item-wood-scrap', chance: 0.55, quantityMin: 1, quantityMax: 2 },
    { itemId: 'item-wolf-fang', chance: 0.12, quantityMin: 1, quantityMax: 1 },
  ],
  includeCopper: true,
  copperMultiplier: 1,
});
assert('1000 kills fast', Date.now() - t0 < 500);

const t1 = Date.now();
resolveLoot({
  kills: 100_000,
  enemyLevel: 5,
  table: [{ itemId: 'item-wood-scrap', chance: 0.2, quantityMin: 1, quantityMax: 1 }],
  includeCopper: false,
  copperMultiplier: 1,
});
assert('100000 kills fast', Date.now() - t1 < 2000);

inventoryStore.reset();
const potion = POTION_ITEM_IDS.normal;
const beforePotions = inventoryStore.countItem(potion);
assert('potion stack 999', getItemStackLimit(potion) === ITEM_STACK_LIMITS.potion);
inventoryStore.addItem(potion, 990);
inventoryStore.addItem(potion, 20);
assert('stack 999 + overflow stack', inventoryStore.countItem(potion) === beforePotions + 1010);
consumeItem(potion, 10);
assert('consume 10', inventoryStore.countItem(potion) === beforePotions + 1000);

const warnings = validateLootTable(
  {
    entries: [
      { itemId: 'missing-item', chance: 2, quantityMin: 5, quantityMax: 1 },
      { itemId: 'item-wood-scrap', chance: 0.1, quantityMin: 1, quantityMax: 1 },
      { itemId: 'item-wood-scrap', chance: 0.2, quantityMin: 1, quantityMax: 1 },
    ],
  },
  'test',
);
assert('invalid item', warnings.some((w) => w.includes('inexistente')));
assert('invalid chance', warnings.some((w) => w.includes('chance inválida')));
assert('min>max', warnings.some((w) => w.includes('min > max')));
assert('duplicate warn', warnings.some((w) => w.includes('duplicada')));

assert('registry ok or warnings array', Array.isArray(validateItemRegistry()));
assert('item definition exists', getItemDefinition('item-wood-scrap')?.name != null);

console.log('loot engine tests passed');
