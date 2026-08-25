import {
  MAX_STARS_BY_RARITY,
  formatMaxStarsReachedMessage,
  getMaxStarsForRarity,
  starAttributeMultiplier,
} from '../src/config/gameConfig';
import { CHARACTER_QUALITIES, type CharacterQuality } from '../src/types/character-meta';
import { clampStars } from '../src/constants/character-progression';
import { planForgeStar } from '../src/systems/forge';
import { teamStore } from '../src/stores/team-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { FRAGMENTS_PER_STAR } from '../src/constants/aiw-quality';
import { narutoFragmentItemId } from '../src/data/naruto-loot-tiers';
import { buildSealedCharacter } from '../src/utils/character-identity';
import type { SealedCharacter } from '../src/types/team';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const EXPECTED: Record<CharacterQuality, number> = {
  D: 2,
  C: 2,
  B: 3,
  A: 4,
  S: 4,
  SS: 5,
  SSS: 5,
};

function unit(
  partial: Pick<SealedCharacter, 'id' | 'quality' | 'stars'> & Partial<SealedCharacter>,
): SealedCharacter {
  return {
    ...buildSealedCharacter({
      id: partial.id,
      name: partial.name ?? 'Itachi',
      lookType: partial.lookType ?? 90,
      sourceId: partial.sourceId ?? 'itachi',
      starterId: partial.starterId ?? null,
      characterId: partial.characterId ?? 'itachi',
      characterKey: partial.characterKey ?? 'look:90',
      quality: partial.quality,
      stars: partial.stars,
      lineageId: partial.clanId ?? 'ninja',
      level: partial.level ?? 1,
      xp: partial.xp ?? 0,
      masteryLevel: partial.masteryLevel ?? 0,
      masteryXp: partial.masteryXp ?? 0,
      awakeningLevel: partial.awakeningLevel ?? 0,
      isFavorite: partial.isFavorite ?? false,
      isLocked: partial.isLocked ?? false,
      previewUrl: partial.previewUrl ?? '',
    }),
    previewUrl: partial.previewUrl ?? '',
  };
}

for (const rarity of CHARACTER_QUALITIES) {
  assert(`${rarity} teto ${EXPECTED[rarity]}`, getMaxStarsForRarity(rarity) === EXPECTED[rarity]);
  assert(`${rarity} config central`, MAX_STARS_BY_RARITY[rarity] === EXPECTED[rarity]);
}

assert('+0% em 0★', starAttributeMultiplier(0) === 1);
assert('+2% em 1★', starAttributeMultiplier(1) === 1.02);
assert('+4% em 2★', starAttributeMultiplier(2) === 1.04);
assert('+6% em 3★', starAttributeMultiplier(3) === 1.06);
assert('+8% em 4★', starAttributeMultiplier(4) === 1.08);
assert('+10% em 5★', starAttributeMultiplier(5) === 1.1);

const cases: Array<{ quality: CharacterQuality; from: number; to: number }> = [
  { quality: 'D', from: 0, to: 1 },
  { quality: 'D', from: 1, to: 2 },
  { quality: 'C', from: 0, to: 1 },
  { quality: 'C', from: 1, to: 2 },
  { quality: 'B', from: 0, to: 1 },
  { quality: 'B', from: 1, to: 2 },
  { quality: 'B', from: 2, to: 3 },
  { quality: 'A', from: 3, to: 4 },
  { quality: 'S', from: 3, to: 4 },
  { quality: 'SS', from: 4, to: 5 },
  { quality: 'SSS', from: 4, to: 5 },
];

for (const { quality, from, to } of cases) {
  const next = clampStars(from + 1, quality);
  assert(`${quality} ${from}★ → ${to}★`, next === to);
}

const blocked: Array<{ quality: CharacterQuality; stars: number }> = [
  { quality: 'D', stars: 2 },
  { quality: 'C', stars: 2 },
  { quality: 'B', stars: 3 },
  { quality: 'A', stars: 4 },
  { quality: 'S', stars: 4 },
  { quality: 'SS', stars: 5 },
  { quality: 'SSS', stars: 5 },
];

for (const { quality, stars } of blocked) {
  assert(
    `${quality} ${stars}★ clamp não passa`,
    clampStars(stars + 1, quality) === stars,
  );
  const target = unit({ id: 'target', quality, stars });
  const extras = Array.from({ length: 25 }, (_, i) =>
    unit({ id: `mat-${i}`, quality, stars: 0 }),
  );
  const plan = planForgeStar({
    targetInstanceId: 'target',
    collection: [target, ...extras],
    teamIds: [],
  });
  assert(`${quality} ${stars}★ forja bloqueada`, plan.reason === 'max-stars');
}

assert(
  'mensagem usa teto da raridade B',
  formatMaxStarsReachedMessage('B') ===
    'Este personagem alcançou o máximo de 3★ para a raridade Raro.',
);
assert(
  'mensagem usa teto da raridade S',
  formatMaxStarsReachedMessage('S') ===
    'Este personagem alcançou o máximo de 4★ para a raridade Lendário.',
);

const over = normalizeSealedCharacter({
  id: 'legacy-d-4',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
  quality: 'D',
  stars: 4,
  level: 8,
  xp: 10,
});
assert('save D 4★ migra para 2★', over?.stars === 2);

const overB = normalizeSealedCharacter({
  id: 'legacy-b-5',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
  quality: 'B',
  stars: 5,
  level: 8,
  xp: 10,
});
assert('save B 5★ migra para 3★', overB?.stars === 3);

const overS = normalizeSealedCharacter({
  id: 'legacy-s-5',
  name: 'Itachi',
  lookType: 90,
  sourceId: 'itachi',
  starterId: null,
  quality: 'S',
  stars: 5,
  level: 8,
  xp: 10,
});
assert('save S 5★ migra para 4★', overS?.stars === 4);

teamStore.reset('naruto-classic');
inventoryStore.reset();
const capD = unit({ id: 'frag-d', quality: 'D', stars: 2, sourceId: 'itachi' });
teamStore.hydrate({
  collection: [capD],
  teamIds: [capD.id],
  activeId: capD.id,
});
inventoryStore.addItem(narutoFragmentItemId('itachi'), FRAGMENTS_PER_STAR * 2);
const fragBefore = inventoryStore.countItem(narutoFragmentItemId('itachi'));
const fragBlocked = teamStore.upgradeStarWithFragments(capD.id);
assert('fragmentos não passam do teto D', fragBlocked === false);
assert(
  'fragmentos não consumidos no teto',
  inventoryStore.countItem(narutoFragmentItemId('itachi')) === fragBefore,
);

const added = teamStore.addToCollection({
  id: 'frag-d0',
  name: 'Genin',
  lookType: 99999,
  sourceId: null,
  quality: 'D',
  stars: 0,
});
assert('instância D 0★ criada', added);
inventoryStore.addItem('item-anime-naruto-fragmento-personagem', FRAGMENTS_PER_STAR);
const fragOk = teamStore.upgradeStarWithFragments('frag-d0');
assert('D 0★ → 1★ por fragmentos', fragOk === true);
assert('D agora 1★', teamStore.getCharacterInstance('frag-d0')?.stars === 1);

console.log('star cap tests passed');
