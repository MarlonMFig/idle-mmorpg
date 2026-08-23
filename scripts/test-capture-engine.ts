import { DEV_FLAGS } from '../src/config/devConfig';
import { clampCaptureChance, CAPTURE_INITIAL_LEVEL, CAPTURE_INITIAL_STARS, CAPTURE_INITIAL_XP } from '../src/constants/capture';
import { SEALING_SCROLL_ITEM_ID, SEALING_SCROLL_TIERS, SEAL_SUCCESS_CHANCE } from '../src/constants/sealing';
import { MAP_KEYS } from '../src/maps/map-registry';
import { onCharacterCaptured } from '../src/lib/capture-events';
import { inventoryStore } from '../src/stores/inventory-store';
import { helperStore } from '../src/stores/helper-store';
import { teamStore } from '../src/stores/team-store';
import { huntAnalyzerStore } from '../src/stores/hunt-analyzer-store';
import {
  attemptCapture,
  clearCaptureResolved,
  getCaptureChance,
  getSealingScrollConfig,
  simulateCaptureBatch,
} from '../src/systems/capture-engine';
import { planForgeStar } from '../src/systems/forge';
import { normalizeSealedCharacter } from '../src/utils/character-identity';
import type { EnemyDefinition } from '../src/types/enemy';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const TARGET: EnemyDefinition = {
  id: 'test-itachi-def',
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
    characterId: 'test-common-unit',
    sourceId: 'test-common-unit',
    name: 'Itachi',
    lookType: 1,
    level: 1,
    quality: 'D',
  },
};

const NOT_SEALABLE: EnemyDefinition = {
  ...TARGET,
  id: 'test-boss',
  name: 'Boss',
  sealable: undefined,
};

function withOfficialProgress<T>(fn: () => T): T {
  const prev = DEV_FLAGS.enabled;
  DEV_FLAGS.enabled = false;
  try {
    return fn();
  } finally {
    DEV_FLAGS.enabled = prev;
  }
}

function setup(scrolls = 10): void {
  clearCaptureResolved();
  inventoryStore.reset();
  for (const tier of SEALING_SCROLL_TIERS) {
    const qty = inventoryStore.countItem(tier.itemId);
    if (qty > 0) inventoryStore.removeItem(tier.itemId, qty);
  }
  teamStore.reset('naruto-classic');
  huntAnalyzerStore.resetSession();
  helperStore.setAutoSeal(true);
  helperStore.setScrollItemId(SEALING_SCROLL_ITEM_ID);
  inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, scrolls);
}

assert('clamp 0–100', clampCaptureChance(-0.2) === 0 && clampCaptureChance(1.4) === 1);
assert('clamp 0.9', clampCaptureChance(0.9) === 0.9);

const scroll = getSealingScrollConfig(SEALING_SCROLL_ITEM_ID);
const chance = getCaptureChance(TARGET, scroll);
assert('alvo common usa raridade D', chance.quality === 'D');
assert('chance common = pergaminho 90%', chance.finalChance === SEAL_SUCCESS_CHANCE);
assert('base = scroll', chance.baseChance === SEAL_SUCCESS_CHANCE);
assert('rarity modifier 1 no common', chance.rarityModifier === 1);

setup(0);
const noScroll = attemptCapture({ target: TARGET, source: 'manual', attemptKey: 'k-empty' });
assert('sem pergaminho não tenta', noScroll.reason === 'no-scroll' && !noScroll.scrollConsumed);
assert('inventário não negativo', inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 0);

setup(5);
const notSeal = attemptCapture({ target: NOT_SEALABLE, source: 'manual', attemptKey: 'k-boss' });
assert('não selável', notSeal.reason === 'not-sealable' && !notSeal.scrollConsumed);
assert('não consome em não-selável', inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 5);

withOfficialProgress(() => {
  setup(8);
  const before = teamStore.getSnapshot().collection.length;
  const fail = attemptCapture({
    target: TARGET,
    source: 'manual',
    attemptKey: 'k-fail',
    rng: () => 0.999,
  });
  assert('falha consome 1', fail.reason === 'failed' && fail.scrollConsumed);
  assert('falha não cria instância', teamStore.getSnapshot().collection.length === before);
  assert('estoque -1 na falha', inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 7);

  const retry = attemptCapture({
    target: TARGET,
    source: 'manual',
    attemptKey: 'k-fail',
    rng: () => 0,
  });
  assert('mesmo cadáver já resolvido', retry.reason === 'already-resolved' && !retry.scrollConsumed);
  assert('não consome de novo', inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 7);

  let events = 0;
  const off = onCharacterCaptured(() => {
    events += 1;
  });
  const ok1 = attemptCapture({
    target: TARGET,
    source: 'manual',
    attemptKey: 'k-ok-1',
    rng: () => 0,
  });
  const ok2 = attemptCapture({
    target: TARGET,
    source: 'auto',
    attemptKey: 'k-ok-2',
    rng: () => 0,
  });
  off();

  assert('sucesso 1', ok1.success && ok1.capturedCharacter != null);
  assert('sucesso 2 (helper)', ok2.success && ok2.capturedCharacter != null);
  assert('nível inicial 1', ok1.capturedCharacter!.level === CAPTURE_INITIAL_LEVEL);
  assert('xp inicial 0', ok1.capturedCharacter!.xp === CAPTURE_INITIAL_XP);
  assert('estrelas iniciais 0', ok1.capturedCharacter!.stars === CAPTURE_INITIAL_STARS);
  assert('quality preservada D', ok1.capturedCharacter!.quality === 'D');
  assert('mesmo characterId', ok1.capturedCharacter!.characterId === ok2.capturedCharacter!.characterId);
  assert('instanceId diferente', ok1.capturedCharacter!.id !== ok2.capturedCharacter!.id);
  assert('eventos de captura', events === 2);
  assert('duas cópias na coleção', teamStore.countCopies(ok1.capturedCharacter!.characterId) >= 2);

  const a = ok1.capturedCharacter!;
  const b = ok2.capturedCharacter!;
  teamStore.setFavorite(a.id, true);
  teamStore.setLocked(b.id, true);
  assert(
    'favorite/lock independentes',
    teamStore.getCharacterInstance(a.id)?.isFavorite === true &&
      teamStore.getCharacterInstance(b.id)?.isFavorite === false &&
      teamStore.getCharacterInstance(a.id)?.isLocked === false &&
      teamStore.getCharacterInstance(b.id)?.isLocked === true,
  );

  const teamOk = teamStore.addToTeam(b.id);
  assert('equipe usa instanceId', teamOk && teamStore.getSnapshot().teamIds.includes(b.id));
  assert('cópia A permanece fora da equipe', !teamStore.getSnapshot().teamIds.includes(a.id));

  const dPlan = planForgeStar({
    targetInstanceId: a.id,
    collection: teamStore.getSnapshot().collection,
    teamIds: teamStore.getSnapshot().teamIds,
  });
  assert('D recém-capturado ainda pode evoluir estrelas', dPlan.reason !== 'stars-unavailable' && dPlan.reason !== 'max-stars');
});

setup(3);
const simScrolls = inventoryStore.countItem(SEALING_SCROLL_ITEM_ID);
const simSize = teamStore.getSnapshot().collection.length;
const batch = simulateCaptureBatch(TARGET, SEALING_SCROLL_ITEM_ID, 100, () => 0.5);
assert('simulação 100 não consome', inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === simScrolls);
assert('simulação 100 não altera coleção', teamStore.getSnapshot().collection.length === simSize);
assert('simulação conta tentativas', batch.success + batch.failure === 100);
assert('expected rate = 0.9', batch.expectedRate === SEAL_SUCCESS_CHANCE);

const legacy = normalizeSealedCharacter({
  id: 'stable-legacy-id',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
  quality: 'A',
  stars: 2,
  level: 12,
  xp: 40,
});
assert('migração preserva id', legacy?.id === 'stable-legacy-id');
assert('migração preenche characterId', legacy?.characterId === 'itachi');
assert('migração preserva level/stars', legacy?.level === 12 && legacy?.stars === 2);

teamStore.hydrate({
  collection: [
    legacy!,
    { ...legacy!, previewUrl: legacy!.previewUrl },
  ],
  teamIds: ['stable-legacy-id'],
  activeId: 'stable-legacy-id',
});
const afterHydrate = teamStore.getSnapshot().collection;
assert('hydrate duplicata de id reminta só a cópia', afterHydrate[0].id === 'stable-legacy-id');
assert('segunda instância ganha id novo uma vez', afterHydrate[1].id !== 'stable-legacy-id');
teamStore.hydrate({
  collection: afterHydrate,
  teamIds: teamStore.getSnapshot().teamIds,
  activeId: teamStore.getSnapshot().activeId,
});
assert(
  'segundo hydrate não reminta de novo',
  teamStore.getSnapshot().collection[0].id === 'stable-legacy-id' &&
    teamStore.getSnapshot().collection[1].id === afterHydrate[1].id,
);

console.log('capture engine tests passed');
