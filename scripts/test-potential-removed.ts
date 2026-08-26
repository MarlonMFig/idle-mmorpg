import { SEAL_SUCCESS_CHANCE, SEALING_SCROLL_ITEM_ID } from '../src/constants/sealing';
import { MAP_KEYS } from '../src/maps/map-registry';
import { starAttributeMultiplier } from '../src/config/gameConfig';
import { getCaptureChance, getSealingScrollConfig } from '../src/systems/capture-engine';
import { buildSealedCharacter, normalizeSealedCharacter } from '../src/utils/character-identity';
import { applyStarBonusToBase } from '../src/utils/star-bonus';
import { BASE_ATTRIBUTES } from '../src/constants/attributes';
import type { EnemyDefinition } from '../src/types/enemy';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const migrated = normalizeSealedCharacter({
  id: 'legacy-with-potential',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
  quality: 'A',
  stars: 2,
  level: 12,
  xp: 40,
  potential: {
    poder: { value: 90, grade: 'SS' },
    sorte: { value: 80, grade: 'S' },
    fortuna: { value: 70, grade: 'A' },
  },
});

assert('migração carrega personagem', migrated != null);
assert('migração descarta potential', migrated != null && !('potential' in migrated));
assert('migração preserva id', migrated?.id === 'legacy-with-potential');
assert('migração preserva level', migrated?.level === 12);
assert('migração preserva stars', migrated?.stars === 2);

const created = buildSealedCharacter({
  id: 'new-capture',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
});
assert('nova instância sem potential', !('potential' in created));

const withStars = applyStarBonusToBase({ ...BASE_ATTRIBUTES }, 2);
assert('estrelas +16% sem potential', Math.abs(withStars.strength - BASE_ATTRIBUTES.strength * 1.16) < 1e-9);
assert('multiplicador 2★ = 1.16', starAttributeMultiplier(2) === 1.16);

const target: EnemyDefinition = {
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
    characterId: 'itachi',
    sourceId: 'itachi',
    name: 'Itachi',
    lookType: 90,
    level: 1,
    quality: 'D',
  },
};
const chance = getCaptureChance(target, getSealingScrollConfig(SEALING_SCROLL_ITEM_ID));
assert('capture sem modifier de potential', chance.otherModifiers === 0);
assert('capture chance oficial intacta', chance.finalChance === SEAL_SUCCESS_CHANCE);

console.log('potential removal tests passed');
