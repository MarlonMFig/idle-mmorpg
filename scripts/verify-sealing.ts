/**
 * Verificação rápida das regras de selamento (RNG injetável).
 * Roda com: npx --yes tsx scripts/verify-sealing.ts
 */
import { SEALING_SCROLL_ITEM_ID } from '../src/constants/sealing';
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

let result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'skipped' && result.reason === 'no-scroll', 'sem pergaminho');

inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 5);
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 5, '5 pergaminhos');

result = trySealEnemy(enemy(), () => 0.99);
assert(result.kind === 'failed', 'falha 10%');
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 4, 'consumiu 1 na falha');

result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'success', 'sucesso');
assert(teamStore.hasCharacter('wonsr-vocation-30'), 'na coleção');
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 3, 'consumiu 1 no sucesso');

result = trySealEnemy(enemy(), () => 0);
assert(result.kind === 'skipped' && result.reason === 'already-owned', 'duplicata');
assert(inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) === 3, 'não consumiu em duplicata');

assert(teamStore.addToTeam('wonsr-vocation-30'), 'add team 2');
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

assert(teamStore.setActive('wonsr-vocation-30'), 'troca ativo');
assert(teamStore.getActive()?.id === 'wonsr-vocation-30', 'ativo ok');
assert(!teamStore.removeFromTeam('wonsr-vocation-30'), 'não remove ativo');

console.log('verify-sealing: ok');
