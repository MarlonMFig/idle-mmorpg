/**
 * Spec de captura v1: selar por tier do inimigo × cartão; qualidade só após sucesso.
 */
import {
  appearancePercents,
  computeCaptureChance,
  CAPTURE_CHANCE_CAP,
  CAPTURE_CHANCE_FLOOR,
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
import type { CaptureEnemyTier } from '../src/constants/capture-system';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function enemy(opts: { captureTier: CaptureEnemyTier; lookType?: number; characterId?: string }): EnemyDefinition {
  return {
    id: `cap-${opts.captureTier}`,
    name: 'Alvo',
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
      characterId: opts.characterId ?? 'test-unit',
      sourceId: opts.characterId ?? 'test-unit',
      name: 'Alvo',
      lookType: opts.lookType ?? 1,
      captureTier: opts.captureTier,
    },
  };
}

const common = getSealingScrollConfig(SEALING_SCROLL_ITEM_ID)!;
const rare = SEALING_SCROLL_TIERS.find((t) => t.itemId.endsWith('rare'))!;
const mestre = getSealingScrollConfig('item-sealing-scroll-legendary')!;

assert('teto 95%', CAPTURE_CHANCE_CAP === 0.95);
assert('piso 2%', CAPTURE_CHANCE_FLOOR === 0.02);
assert('comum + básico 60%', Math.abs(computeCaptureChance('comum', common.itemId) - 0.6) < 1e-9);
assert('elite + básico 35%', Math.abs(computeCaptureChance('elite', common.itemId) - 0.35) < 1e-9);
assert('raro + básico 28%', Math.abs(computeCaptureChance('raro', common.itemId) - 0.28) < 1e-9);
assert('chefe + básico 12%', Math.abs(computeCaptureChance('chefe', common.itemId) - 0.12) < 1e-9);
assert('comum + raro 81%', Math.abs(computeCaptureChance('comum', rare.itemId) - 0.81) < 1e-9);
assert('comum + mestre teto 95%', computeCaptureChance('comum', mestre.itemId) === 0.95);
assert('chefe + mestre 28.8%', Math.abs(computeCaptureChance('chefe', mestre.itemId) - 0.288) < 1e-9);
assert('craft 7', SCROLL_CRAFT_PER_STEP === 7);

const percents = appearancePercents();
assert('qualidade D > C (etapa 2)', percents.D > percents.C);
assert('qualidade SSS < S (etapa 2)', percents.SSS < percents.S);

assert(
  'engine ignora quality no selar',
  getCaptureChance(enemy({ captureTier: 'chefe' }), common).finalChance === 0.12,
);
assert('engine usa tier', getCaptureChance(enemy({ captureTier: 'comum' }), common).captureTier === 'comum');

const profile = NARUTO_CHARACTER_LOOT['uchiha-itachi'];
assert('itachi tem perfil', Boolean(profile));

helperStore.setAutoSeal(true);
helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
inventoryStore.reset();
teamStore.reset('naruto-classic');
clearCaptureResolved();
inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 10);

const fail1 = attemptCapture({
  target: enemy({ captureTier: 'chefe' }),
  source: 'manual',
  attemptKey: 'flee-chefe',
  rng: () => 0.999,
});
assert('1ª falha encerra', fail1.reason === 'failed' && fail1.scrollConsumed === true);
const fail2 = attemptCapture({
  target: enemy({ captureTier: 'chefe' }),
  source: 'manual',
  attemptKey: 'flee-chefe',
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
