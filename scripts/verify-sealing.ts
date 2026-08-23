/**
 * Verificação rápida das regras de selamento (RNG injetável).
 * Roda com: npx --yes tsx scripts/verify-sealing.ts
 */
import { SEALING_SCROLL_ITEM_ID } from '../src/constants/sealing';
import { helperStore } from '../src/stores/helper-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { teamStore } from '../src/stores/team-store';
import { trySealEnemy } from '../src/systems/sealing';
import type { EnemyDefinition } from '../src/types/enemy';
import { MAP_KEYS } from '../src/maps/map-registry';

function enemy(overrides: Partial<EnemyDefinition> = {}): EnemyDefinition {
  return {
    id: 'test-enemy',
    name: 'Sakura Haruno',
    hp: 10,
    level: 1,
    xp: 1,
    loot: [],
    spawn: { x: 0, y: 0 },
    speed: 40,
    chaseRadius: 80,
    sprite: 'x',
    mapKey: MAP_KEYS.forest,
    sealable: {
      characterId: 'wonsr-vocation-30',
      sourceId: 'wonsr-vocation-30',
      name: 'Sakura Haruno',
      lookType: 1423,
      quality: 'D',
    },
    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

inventoryStore.reset();
teamStore.reset('naruto-classic');

assert(teamStore.getSnapshot().collection.length === 1, 'starter na coleção');
assert(teamStore.getSnapshot().teamIds.length === 1, 'starter na equipe');

while (inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) > 0) {
  inventoryStore.removeItem(SEALING_SCROLL_ITEM_ID, inventoryStore.countItem(SEALING_SCROLL_ITEM_ID));
}

let result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'skipped' && result.reason === 'no-scroll', 'sem pergaminho');

inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 5);
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 5, '5 pergaminhos');

result = trySealEnemy(enemy(), () => 0.99);
assert(result.kind === 'failed', 'falha RNG');
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 4, 'consumiu 1 na falha');

const beforeCount = teamStore.getSnapshot().collection.length;
const sakuraEnemy = enemy({
  level: 40,
  sealable: {
    characterId: 'wonsr-vocation-30',
    sourceId: 'wonsr-vocation-30',
    name: 'Sakura Haruno',
    lookType: 1423,
    level: 40,
    quality: 'D',
  },
});
result = trySealEnemy(sakuraEnemy, () => 0);
assert(result.kind === 'success', 'sucesso');
assert(teamStore.getSnapshot().collection.length === beforeCount + 1, 'cópia na coleção');
const sealedId = result.kind === 'success' ? result.characterId : '';
const sealedSakura = teamStore.getSnapshot().collection.find((entry) => entry.id === sealedId);
assert(sealedSakura?.level === 1, `selado começa Nv.1, got ${sealedSakura?.level}`);
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 3, 'consumiu 1 no sucesso');

// Duplicatas permitidas (forja)
result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'success', 'segunda cópia permitida');
assert(teamStore.getSnapshot().collection.length === beforeCount + 2, '2 cópias na bag');
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 2, 'consumiu no 2º selo');

const sakuraIds = teamStore
  .getSnapshot()
  .collection.filter((entry) => entry.lookType === 1423)
  .map((entry) => entry.id);
assert(sakuraIds.length >= 2, 'pelo menos 2 sakura');
assert(teamStore.addToTeam(sakuraIds[0]), 'add team 2');

const second = {
  id: 'wonsr-vocation-80',
  name: 'Hinata Hyuga',
  lookType: 1485,
  sourceId: 'wonsr-vocation-80',
  starterId: null as null,
};
assert(teamStore.addToCollection(second), 'add collection 3');
assert(teamStore.addToTeam(second.id), 'add team 3');

const fourth = {
  id: 'wonsr-vocation-70',
  name: 'Shikamaru Nara',
  lookType: 1426,
  sourceId: 'wonsr-vocation-70',
  starterId: null as null,
};
assert(teamStore.addToCollection(fourth), 'add collection 4');
assert(!teamStore.addToTeam(fourth.id), 'limite 3');

assert(teamStore.setActive(sakuraIds[0]), 'troca ativo');
assert(teamStore.getActive()?.id === sakuraIds[0], 'ativo ok');
assert(!teamStore.removeFromTeam(sakuraIds[0]), 'não remove ativo');

helperStore.setAutoSeal(false);
result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'skipped' && result.reason === 'disabled', 'auto off bloqueia');
result = trySealEnemy(enemy(), () => 0, { manual: true });
assert(result.kind === 'success', 'manual ignora auto off');
helperStore.setAutoSeal(true);

console.log('verify-sealing: ok');
