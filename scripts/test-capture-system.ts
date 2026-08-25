/**
 * Spec de captura: aparição, chance × pergaminho, teto 90%, tentativas, craft 7:1.
 */
import {
  appearancePercents,
  computeCaptureChance,
  CAPTURE_CHANCE_CAP,
  SCROLL_CRAFT_PER_STEP,
} from '../src/constants/capture-system';
import { SEALING_SCROLL_ITEM_ID, SEALING_SCROLL_TIERS } from '../src/constants/sealing';
import { NARUTO_CHARACTER_LOOT } from '../src/data/naruto-loot-tiers';
import { inventoryStore } from '../src/stores/inventory-store';
import { helperStore } from '../src/stores/helper-store';
import { teamStore } from '../src/stores/team-store';
import {
  attemptCapture,
  clearCaptureResolved,
  getCaptureChance,
  getSealingScrollConfig,
} from '../src/systems/capture-engine';
import { craftSealingScroll } from '../src/systems/sealing-scroll-craft';
import { MAP_KEYS } from '../src/maps/map-registry';
import type { EnemyDefinition } from '../src/types/enemy';
import type { CharacterQuality } from '../src/types/character-meta';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function enemy(quality: CharacterQuality): EnemyDefinition {
  return {
    id: `cap-${quality}`,
    name: 'Itachi',
    hp: 1,
    level: 1,
    xp: 0,
    loot: [],
    spawn: { x: 0, y: 0 },
    speed: 0,
    chaseRadius: 0,
    sprite: 'enemy',
    mapKey: MAP_KEYS.leafVillage,
    sealable: {
      characterId: 'uchiha-itachi',
      sourceId: 'uchiha-itachi',
      name: 'Itachi',
      lookType: 9002,
      quality,
    },
  };
}

const common = getSealingScrollConfig(SEALING_SCROLL_ITEM_ID)!;
const legendary = SEALING_SCROLL_TIERS.find((t) => t.itemId.endsWith('legendary'))!;

assert('teto 90%', CAPTURE_CHANCE_CAP === 0.9);
assert('D comum 90%', Math.abs(computeCaptureChance('D', common.itemId) - 0.9) < 1e-9);
assert('D raro cap 90%', computeCaptureChance('D', legendary.itemId) === 0.9);
assert('SSS comum 5%', Math.abs(computeCaptureChance('SSS', common.itemId) - 0.05) < 1e-9);
assert('SSS lendário 21%', Math.abs(computeCaptureChance('SSS', legendary.itemId) - 0.21) < 1e-9);
assert('épico raro 51%', Math.abs(computeCaptureChance('A', 'item-sealing-scroll-rare') - 0.51) < 1e-9);
assert('craft 7', SCROLL_CRAFT_PER_STEP === 7);

const percents = appearancePercents();
assert('aparência D > C', percents.D > percents.C);
assert('aparência SSS < S', percents.SSS < percents.S);

assert('engine usa quality do alvo', getCaptureChance(enemy('SSS'), common).quality === 'SSS');
assert(
  'engine base SSS 5%',
  Math.abs(getCaptureChance(enemy('SSS'), common).baseChance - 0.05) < 1e-9,
);

const profile = NARUTO_CHARACTER_LOOT['uchiha-itachi'];
assert('itachi tem perfil', Boolean(profile));

helperStore.setAutoSeal(true);
helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
inventoryStore.reset();
teamStore.reset('naruto-classic');
clearCaptureResolved();
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 10);

const fail1 = attemptCapture({
  target: enemy('SSS'),
  source: 'manual',
  attemptKey: 'flee-sss',
  rng: () => 0.999,
});
assert('1ª falha encerra', fail1.reason === 'failed' && fail1.scrollConsumed === true);
assert('sem consolo', (fail1.consolationFragments ?? 0) === 0);
const fail2 = attemptCapture({
  target: enemy('SSS'),
  source: 'manual',
  attemptKey: 'flee-sss',
  rng: () => 0.999,
});
assert('2ª no mesmo inimigo recusada', fail2.reason === 'already-resolved');
assert('2ª não consome', fail2.scrollConsumed === false);

clearCaptureResolved();
inventoryStore.reset();
inventoryStore.addItem('item-sealing-scroll', 14);
const crafted = craftSealingScroll('item-sealing-scroll');
assert('craft 7 comuns → raro', crafted.ok && crafted.toId === 'item-sealing-scroll-rare');
assert('ganhou 1 raro', inventoryStore.countItem('item-sealing-scroll-rare') === 1);

console.log('PASS test-capture-system');
