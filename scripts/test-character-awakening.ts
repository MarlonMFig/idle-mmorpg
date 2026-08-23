import {
  AWAKENING_MATERIAL_ITEM_ID,
  AWAKENING_REQUIREMENTS,
  MAX_AWAKENING_LEVEL,
  getEffectiveStarRequirement,
} from '../src/constants/character-awakening';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { awakenCharacter, canAwakenCharacter } from '../src/lib/awaken-character';
import { onCharacterAwakened } from '../src/lib/awakening-events';
import {
  evaluateAwakening,
  getEffectiveStarRequirement as effectiveStars,
  resolveAwakeningDefinition,
} from '../src/lib/character-awakening';
import { narutoFragmentItemId } from '../src/data/naruto-loot-tiers';
import { inventoryStore } from '../src/stores/inventory-store';
import { teamStore } from '../src/stores/team-store';
import { planForgeStar } from '../src/systems/forge';
import { normalizeSealedCharacter } from '../src/utils/character-identity';
import type { SealedCharacter } from '../src/types/team';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function unit(
  partial: Pick<SealedCharacter, 'id'> & Partial<SealedCharacter>,
): SealedCharacter {
  const built = normalizeSealedCharacter({
    id: partial.id,
    name: partial.name ?? 'Itachi',
    lookType: partial.lookType ?? 90,
    sourceId: partial.sourceId ?? 'uchiha-itachi',
    characterId: partial.characterId ?? 'uchiha-itachi',
    characterKey: partial.characterKey ?? 'look:90',
    quality: partial.quality ?? 'A',
    stars: partial.stars ?? 4,
    clanId: partial.clanId ?? 'ninja',
    level: partial.level ?? 100,
    xp: partial.xp ?? 0,
    masteryLevel: partial.masteryLevel ?? 100,
    masteryXp: partial.masteryXp ?? 0,
    awakeningLevel: partial.awakeningLevel ?? 0,
    isFavorite: partial.isFavorite ?? false,
    isLocked: partial.isLocked ?? false,
    starterId: partial.starterId ?? null,
    previewUrl: partial.previewUrl ?? '',
  });
  if (!built) throw new Error('failed to build unit');
  return built;
}

function hydrate(members: SealedCharacter[], activeId = members[0]?.id): void {
  teamStore.reset('naruto-classic');
  teamStore.hydrate({
    collection: members,
    teamIds: [activeId ?? members[0].id],
    activeId: activeId ?? members[0].id,
  });
}

function fillAwaken1Costs(): void {
  inventoryStore.reset();
  inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, 1_000);
  inventoryStore.addItem(AWAKENING_MATERIAL_ITEM_ID, 1);
}

const req1 = AWAKENING_REQUIREMENTS[1];

assert('max is 3', MAX_AWAKENING_LEVEL === 3);
assert('no 4th level in requirements', (AWAKENING_REQUIREMENTS as Record<number, unknown>)[4] == null);
assert('D never requires more than 2★', getEffectiveStarRequirement(4, 'D') === 2);
assert('A can require 4★', getEffectiveStarRequirement(4, 'A') === 4);
assert('effective export matches', effectiveStars(4, 'D') === 2);
assert('disabled config = unavailable', resolveAwakeningDefinition('any', { enabled: false }) == null);
assert('missing config still available (DEV)', resolveAwakeningDefinition('unknown-character') != null);

const a = unit({
  id: 'itachi-a',
  level: 10,
  stars: 4,
  masteryLevel: 100,
  quality: 'A',
});
hydrate([a]);
fillAwaken1Costs();
assert('level too low blocks', canAwakenCharacter('itachi-a').eligible === false);
assert(
  'level missing message',
  canAwakenCharacter('itachi-a').missing.some((row) => row.includes('Level')),
);

const b = unit({
  id: 'itachi-stars',
  level: 100,
  stars: 0,
  masteryLevel: 100,
  quality: 'A',
});
hydrate([b]);
fillAwaken1Costs();
assert('stars too low blocks', canAwakenCharacter('itachi-stars').eligible === false);
assert(
  'stars missing message',
  canAwakenCharacter('itachi-stars').missing.some((row) => row.includes('★')),
);

const c = unit({
  id: 'itachi-mastery',
  level: 100,
  stars: 4,
  masteryLevel: 10,
  quality: 'A',
});
hydrate([c]);
fillAwaken1Costs();
assert('mastery too low blocks', canAwakenCharacter('itachi-mastery').eligible === false);
assert(
  'mastery missing message',
  canAwakenCharacter('itachi-mastery').missing.some((row) => row.includes('Mastery')),
);

const copperCase = unit({ id: 'itachi-copper', quality: 'A', stars: 4, level: 100, masteryLevel: 100 });
hydrate([copperCase]);
inventoryStore.reset();
inventoryStore.addItem(AWAKENING_MATERIAL_ITEM_ID, 1);
const copperBefore = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
const itemBefore = inventoryStore.countItem(AWAKENING_MATERIAL_ITEM_ID);
const copperAttempt = awakenCharacter('itachi-copper', 0);
assert('copper insufficient blocks', copperAttempt.ok === false);
assert('copper not consumed', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === copperBefore);
assert('item not consumed on copper fail', inventoryStore.countItem(AWAKENING_MATERIAL_ITEM_ID) === itemBefore);
assert('level untouched on copper fail', teamStore.getCharacterInstance('itachi-copper')?.level === 100);
assert('mastery untouched on copper fail', teamStore.getCharacterInstance('itachi-copper')?.masteryLevel === 100);

const itemCase = unit({ id: 'itachi-item', quality: 'A', stars: 4, level: 100, masteryLevel: 100 });
hydrate([itemCase]);
inventoryStore.reset();
inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, 5_000);
const itemAttempt = awakenCharacter('itachi-item', 0);
assert('item insufficient blocks', itemAttempt.ok === false);
assert(
  'copper not consumed on item fail',
  inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) >= 5_000,
);

const ready = unit({
  id: 'itachi-ready',
  quality: 'A',
  stars: 4,
  level: 100,
  xp: 33,
  masteryLevel: 75,
  masteryXp: 12,
});
hydrate([ready]);
fillAwaken1Costs();
let eventCount = 0;
const off = onCharacterAwakened((event) => {
  eventCount += 1;
  assert('event instance', event.instanceId === 'itachi-ready');
  assert('event 0→1', event.oldAwakening === 0 && event.newAwakening === 1);
});
const success = awakenCharacter('itachi-ready', 0);
off();
assert('success 0→1', success.ok === true && success.ok && success.newAwakening === 1);
assert('persisted 1', teamStore.getCharacterInstance('itachi-ready')?.awakeningLevel === 1);
assert('event emitted once', eventCount === 1);
assert('level not consumed', teamStore.getCharacterInstance('itachi-ready')?.level === 100);
assert('xp not consumed', teamStore.getCharacterInstance('itachi-ready')?.xp === 33);
assert('stars not consumed', teamStore.getCharacterInstance('itachi-ready')?.stars === 4);
assert('mastery not consumed', teamStore.getCharacterInstance('itachi-ready')?.masteryLevel === 75);
assert('mastery xp not consumed', teamStore.getCharacterInstance('itachi-ready')?.masteryXp === 12);
assert(
  'copper consumed',
  inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === 250 + 1_000 - (req1.copper ?? 0),
);
assert('material consumed', inventoryStore.countItem(AWAKENING_MATERIAL_ITEM_ID) === 0);

const dbl = unit({
  id: 'itachi-dbl',
  quality: 'A',
  stars: 4,
  level: 100,
  masteryLevel: 100,
});
hydrate([dbl]);
fillAwaken1Costs();
const first = awakenCharacter('itachi-dbl', 0);
const second = awakenCharacter('itachi-dbl', 0);
assert('double click first succeeds', first.ok === true && first.ok && first.newAwakening === 1);
assert('double click second rejected', second.ok === false);
assert('double click stayed at 1', teamStore.getCharacterInstance('itachi-dbl')?.awakeningLevel === 1);

const copyA = unit({ id: 'copy-a', quality: 'A', stars: 4, level: 100, masteryLevel: 100 });
const copyB = unit({ id: 'copy-b', quality: 'A', stars: 4, level: 100, masteryLevel: 100 });
hydrate([copyA, copyB], 'copy-a');
fillAwaken1Costs();
const onlyA = awakenCharacter('copy-a', 0);
assert('duplicate A awakens', onlyA.ok === true);
assert('duplicate B untouched', teamStore.getCharacterInstance('copy-b')?.awakeningLevel === 0);

const migrated = normalizeSealedCharacter({
  id: 'legacy-aw',
  name: 'Itachi',
  lookType: 90,
});
assert('legacy save → awakening 0', migrated?.awakeningLevel === 0);
const reloaded = normalizeSealedCharacter({
  ...copyA,
  awakeningLevel: 2,
});
assert('reload keeps awakening 2', reloaded?.awakeningLevel === 2);

const maxed = unit({
  id: 'itachi-max',
  quality: 'A',
  stars: 4,
  level: 100,
  masteryLevel: 100,
  awakeningLevel: 3,
});
hydrate([maxed]);
fillAwaken1Costs();
inventoryStore.addItem(AWAKENING_MATERIAL_ITEM_ID, 20);
inventoryStore.addItem(SHOP_CURRENCY_ITEM_ID, 50_000);
inventoryStore.addItem(narutoFragmentItemId('uchiha-itachi'), 20);
assert('max cannot awaken', canAwakenCharacter('itachi-max').maxed === true);
const maxAttempt = awakenCharacter('itachi-max', 3);
assert('cannot go to 4', maxAttempt.ok === false);
assert('stays 3', teamStore.getCharacterInstance('itachi-max')?.awakeningLevel === 3);

const dChar = unit({ id: 'd-stars', quality: 'D', stars: 2, level: 100, masteryLevel: 100, awakeningLevel: 2 });
const wallet = {
  copper: 0,
  countItem: () => 0,
};
const dEval = evaluateAwakening(dChar, wallet);
assert('D uses clamped star req', dEval.checks.some((row) => row.id === 'stars' && row.required === 2));

const forgeTarget = unit({ id: 'forge-t', quality: 'D', stars: 0, characterKey: 'look:90' });
const forgeMatAwake = unit({
  id: 'forge-aw',
  quality: 'D',
  stars: 0,
  characterKey: 'look:90',
  awakeningLevel: 2,
});
const forgeMatPlain = unit({
  id: 'forge-plain',
  quality: 'D',
  stars: 0,
  characterKey: 'look:90',
  awakeningLevel: 0,
});
const plan = planForgeStar({
  targetInstanceId: 'forge-t',
  collection: [forgeTarget, forgeMatAwake, forgeMatPlain],
  teamIds: ['forge-t'],
  materialInstanceIds: ['forge-aw', 'forge-plain'],
});
assert('awakened copy not forge material', !plan.materialIds.includes('forge-aw'));

console.log('character awakening tests passed');
