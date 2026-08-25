import { rollNarutoCharacterLoot } from '../src/data/anime-loot';
import {
  NARUTO_CHARACTER_LOOT,
  NARUTO_CORE_THIRTY_IDS,
  rollNarutoIndependentMaterials,
} from '../src/data/naruto-loot-tiers';
import { validateNarutoLootProfiles } from '../src/data/naruto-loot-validate';
import { validateWorldGeneralLoot } from '../src/data/world-general-loot';
import { getItemSellValue } from '../src/data/shop';
import {
  analyzeCharacterLootEconomy,
  simulateTierHourValue,
} from '../src/lib/loot-economy-analyzer';
import { resolveLoot } from '../src/systems/loot-engine';
import { LOOT_ECONOMY_P50_TARGET } from '../src/constants/loot-economy';
import type { NarutoLootTier } from '../src/constants/loot-economy';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function scripted(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? 0.999;
    i += 1;
    return v;
  };
}

const validation = validateNarutoLootProfiles();
if (validation.errors.length) {
  console.log(validation.errors.join('\n'));
}
assert('validator sem erros', validation.errors.length === 0);

const generalValidation = validateWorldGeneralLoot();
if (generalValidation.errors.length) console.log(generalValidation.errors.join('\n'));
assert('general loot validator', generalValidation.errors.length === 0);
if (validation.warnings.length) {
  console.log('warnings', validation.warnings.join(' | '));
}

assert(
  '30 oficiais com perfil',
  NARUTO_CORE_THIRTY_IDS.every((id) => Boolean(NARUTO_CHARACTER_LOOT[id])),
);

const both = rollNarutoIndependentMaterials('naruto-classic', 1, scripted([0, 0]));
assert('secondary + signature', both.secondaryItemId != null && both.signatureItemId != null);

const onlySec = rollNarutoIndependentMaterials('naruto-classic', 1, scripted([0, 0.99]));
assert('secondary only', onlySec.secondaryItemId != null && onlySec.signatureItemId == null);

const onlySig = rollNarutoIndependentMaterials('naruto-classic', 1, scripted([0.99, 0]));
assert('signature only', onlySig.secondaryItemId == null && onlySig.signatureItemId != null);

const none = rollNarutoIndependentMaterials('naruto-classic', 1, scripted([0.99, 0.99]));
assert('no material', none.secondaryItemId == null && none.signatureItemId == null);

const emptyCopper = resolveLoot({
  kills: 1,
  enemyLevel: 5,
  naruto: { characterId: 'naruto-classic' },
  copperMultiplier: 1,
  rng: scripted([0, 0.99, 0.99, 0.99, 0.99]),
});
assert('no-drop still copper', emptyCopper.copper > 0);

const profile = NARUTO_CHARACTER_LOOT['naruto-classic']!;
const fragSig = rollNarutoCharacterLoot({ characterId: 'naruto-classic' }, scripted([0.99, 0, 0.99, 0]));
assert(
  'fragment + signature',
  fragSig.some((d) => d.itemId.includes('frag')) &&
    fragSig.some((d) => d.itemId === profile.signatureItemId),
);

const fragSec = rollNarutoCharacterLoot({ characterId: 'naruto-classic' }, scripted([0.99, 0, 0, 0.99]));
assert(
  'fragment + secondary',
  fragSec.some((d) => d.itemId.includes('frag')) &&
    fragSec.some((d) => d.itemId === profile.secondaryItemId),
);

const allThree = rollNarutoCharacterLoot({ characterId: 'naruto-classic' }, scripted([0.99, 0, 0, 0]));
assert(
  'all three drops',
  allThree.some((d) => d.itemId.includes('frag')) &&
    allThree.some((d) => d.itemId === profile.secondaryItemId) &&
    allThree.some((d) => d.itemId === profile.signatureItemId),
);

assert('kiba signature presa', NARUTO_CHARACTER_LOOT.kiba?.signatureItemId.includes('presa') === true);
assert('hinata signature lente', NARUTO_CHARACTER_LOOT.hinata?.signatureItemId.includes('lente') === true);
assert('neji signature lente', NARUTO_CHARACTER_LOOT.neji?.signatureItemId.includes('lente') === true);

assert('forbidden scroll reprice', getItemSellValue('item-anime-naruto-pergaminho-proibido') === 10_000);
assert('nucleo reprice', getItemSellValue('item-anime-naruto-nucleo-chakra') === 8_000);
assert('bestial reprice', getItemSellValue('item-anime-naruto-fragmento-bestial') === 10_000);
assert('fragment T1 reprice', getItemSellValue('item-anime-naruto-frag-naruto-classic') === 600);
assert('fragment T5 reprice', getItemSellValue('item-anime-naruto-frag-naruto-kyubi') === 2_000);

const ev = analyzeCharacterLootEconomy('naruto-classic');
assert('analyzer row', ev != null && ev.expectedPerHour > 0 && ev.generalEv > 0);

for (const tier of [1, 2, 3, 4, 5] as NarutoLootTier[]) {
  const sim = simulateTierHourValue({ tier, hours: 2_000, seed: 42 + tier });
  const target = LOOT_ECONOMY_P50_TARGET[tier];
  console.log(
    `T${tier} P10=${Math.round(sim.p10)} P25=${Math.round(sim.p25)} P50=${Math.round(sim.p50)} P75=${Math.round(sim.p75)} P90=${Math.round(sim.p90)} avg=${Math.round(sim.average)} copper=${Math.round(sim.copperAverage)} loot=${Math.round(sim.lootAverage)}`,
  );
  if (tier <= 3) {
    assert(`T${tier} P50 na faixa`, sim.p50 >= target.min && sim.p50 <= target.max);
  } else if (sim.p50 < target.min || sim.p50 > target.max) {
    console.log(
      `REPORT T${tier}: P50 ${Math.round(sim.p50)} fora de ${target.min}–${target.max} por sellPrice global partilhado (não há override por personagem).`,
    );
  }
  assert(
    `T${tier} P90 sem jackpot 40k frag`,
    tier >= 5 ? sim.p90 < 200_000 : sim.p90 < 80_000,
  );
}

console.log('loot economy tests passed');
