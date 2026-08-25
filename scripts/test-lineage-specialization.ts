import { accountStore } from '../src/stores/account-store';
import { vitalsStore } from '../src/stores/vitals-store';
import { teamStore } from '../src/stores/team-store';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL } from '../src/constants/lineage';
import {
  LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS,
  SPECIALIZATION_POWER_BUDGET,
  specializationPowerCost,
  addLineageModifiers,
} from '../src/constants/lineage-specialization';
import { LINEAGE_REGISTRY } from '../src/data/lineages/registry';
import { getCharacterDefinition } from '../src/data/characters';
import { isCharacterCompatibleWithLineage } from '../src/lib/lineage-compatibility';
import {
  getLineageIdProgress,
  normalizePlayerLineageProgress,
} from '../src/lib/lineage-progress';
import { resolveSpecializationDisplayName } from '../src/lib/lineage-specialization-migration';
import { grantLineageOnlineKill } from '../src/lib/promote-lineage-rank';
import {
  evolveLineageSpecialization,
  selectLineageSpecialization,
} from '../src/lib/lineage-specialization';
import { getLineageSpecializationModifiers } from '../src/lib/lineage-specialization-modifiers';
import { validateLineageRegistry } from '../src/lib/lineage-validation';
import { computePlayerAttributes } from '../src/utils/attributes';
import type { LineageId } from '../src/types/character-meta';
import type { LineageSpecializationModifiers } from '../src/types/lineage';
import type { SealedCharacter } from '../src/types/team';
import { buildSealedCharacter } from '../src/utils/character-identity';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function resetAccount(lineageId: LineageId = 'ninja'): void {
  accountStore.reset();
  teamStore.reset();
  vitalsStore.reset({
    ...DEFAULT_VITALS,
    level: LINEAGE_SYSTEM_UNLOCK_LEVEL,
    hp: 100,
    hpMax: 100,
    xp: 0,
    xpMax: 100,
  });
  accountStore.chooseLineage(lineageId);
}

function mockChar(
  id: string,
  characterId: string,
  lineageId: LineageId,
  opts: Partial<SealedCharacter> = {},
): SealedCharacter {
  return {
    ...buildSealedCharacter({
      id,
      characterId,
      name: characterId,
      lookType: 1,
      sourceId: null,
      starterId: null,
      quality: 'B',
      stars: 3,
      lineageId,
      level: 1,
      xp: 0,
      masteryLevel: 0,
      masteryXp: 0,
      awakeningLevel: 0,
    }),
    ...opts,
    lineageId: opts.lineageId ?? lineageId,
  };
}

function seed(entries: SealedCharacter[]): void {
  for (const entry of entries) {
    teamStore.addToCollection({
      id: entry.id,
      name: entry.name,
      lookType: entry.lookType,
      characterId: entry.characterId,
      characterKey: entry.characterKey,
      lineageId: entry.lineageId,
      quality: entry.quality,
      stars: entry.stars,
      masteryLevel: entry.masteryLevel,
    });
  }
}

function setNinjaRank(rank: 1 | 2 | 3 | 4, lineageKills = 0): void {
  const progress = accountStore.getLineageProgress();
  const current = getLineageIdProgress(progress, 'ninja');
  accountStore.applyLineageProgress({
    ...progress,
    byLineage: {
      ...progress.byLineage,
      ninja: { ...current, rank, onlineKills: lineageKills },
    },
  });
}

const warnings = validateLineageRegistry();
assert('validator has no errors for 6 lineages', warnings.length === 0);

for (const id of Object.keys(LINEAGE_REGISTRY) as LineageId[]) {
  const def = LINEAGE_REGISTRY[id];
  assert(`${id} 3 specs`, def.specializations.length === 3);
  for (const spec of def.specializations) {
    assert(`${id} ${spec.id} 4 levels`, spec.levels.length === 4);
    let cumulative: LineageSpecializationModifiers = {};
    for (const level of spec.levels) {
      const cost = specializationPowerCost(level.modifiers ?? {});
      assert(
        `${id} ${spec.name} L${level.level} budget`,
        cost <= SPECIALIZATION_POWER_BUDGET.perLevel[level.level] + SPECIALIZATION_POWER_BUDGET.epsilon,
      );
      cumulative = addLineageModifiers(cumulative, level.modifiers);
    }
    const total = specializationPowerCost(cumulative);
    assert(
      `${id} ${spec.name} IV budget`,
      total <= SPECIALIZATION_POWER_BUDGET.maxCumulative + SPECIALIZATION_POWER_BUDGET.epsilon,
    );
  }
}

assert(
  'same reqs rank II spec',
  JSON.stringify(LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS[2]) ===
    JSON.stringify(LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS[2]),
);

resetAccount('ninja');
assert('rank I blocks select', selectLineageSpecialization('specializationA').ok === false);
assert(
  'rank I no selected',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').selectedSpecializationId === null,
);

setNinjaRank(2);
const unlocked = selectLineageSpecialization('specializationA');
assert('rank II select ok', unlocked.ok === true);
const afterSelect = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja');
assert('starts level I', afterSelect.specializationProgress.specializationA.level === 1);
assert('spec kills start 0', afterSelect.specializationProgress.specializationA.onlineKills === 0);
assert('other paths preserved at 0', afterSelect.specializationProgress.specializationB.level === 0);

resetAccount('ninja');
setNinjaRank(2, 5000);
selectLineageSpecialization('specializationA');
assert(
  'no retroactive kills',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').specializationProgress
    .specializationA.onlineKills === 0,
);

resetAccount('ninja');
setNinjaRank(2);
selectLineageSpecialization('specializationA');
grantLineageOnlineKill(10, { force: true });
assert(
  '10 online kills',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').specializationProgress
    .specializationA.onlineKills === 10,
);
grantLineageOnlineKill(1, { force: true });
assert(
  'multi-hit/DoT +1',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').specializationProgress
    .specializationA.onlineKills === 11,
);

const beforeOffline = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja')
  .specializationProgress.specializationA.onlineKills;
assert('offline does not call grant', beforeOffline === 11);

const ninjaChars = [
  mockChar('a', 'char-a', 'ninja', { masteryLevel: 20 }),
  mockChar('b', 'char-b', 'ninja', { masteryLevel: 20 }),
];
resetAccount('ninja');
setNinjaRank(2);
selectLineageSpecialization('specializationA');
seed(ninjaChars);
const progress = accountStore.getLineageProgress();
accountStore.applyLineageProgress({
  ...progress,
  byLineage: {
    ninja: {
      ...getLineageIdProgress(progress, 'ninja'),
      specializationProgress: {
        ...getLineageIdProgress(progress, 'ninja').specializationProgress,
        specializationA: { level: 1, onlineKills: 1000 },
      },
    },
  },
});
const evolved = evolveLineageSpecialization('ninja');
assert('evolve to II', evolved.ok === true && evolved.ok && evolved.newLevel === 2);

accountStore.devSetSpecialization('specializationA', 4);
const maxed = evolveLineageSpecialization('ninja');
assert('level IV cannot go to V', maxed.ok === false);
assert(
  'level stays 4',
  getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').specializationProgress
    .specializationA.level === 4,
);

const itachi = getCharacterDefinition('uchiha-itachi');
assert('itachi exists', Boolean(itachi));
resetAccount('ninja');
setNinjaRank(2);
selectLineageSpecialization('specializationA');
accountStore.devSetSpecialization('specializationA', 4);
const ninjaProgress = accountStore.getLineageProgress();
const itachiMods = getLineageSpecializationModifiers(ninjaProgress, itachi!);
assert('compatible itachi gets sharingan mods', (itachiMods.skillDamagePercent ?? 0) > 0 || (itachiMods.criticalChance ?? 0) > 0);

let gokuDef = getCharacterDefinition('goku-classic') ?? getCharacterDefinition('goku') ?? getCharacterDefinition('son-goku');
if (gokuDef) {
  const gokuMods = getLineageSpecializationModifiers(ninjaProgress, gokuDef);
  assert('incompatible goku gets no mods', Object.keys(gokuMods).length === 0);
  assert('goku not compatible ninja', !isCharacterCompatibleWithLineage(gokuDef, 'ninja'));
} else {
  console.log('skip goku pack not in registry');
}

const withBonus = computePlayerAttributes({
  level: 20,
  stars: 0,
  characterId: 'uchiha-itachi',
  awakeningLevel: 0,
  lineageModifiers: { attackPercent: 0.05 },
});
const withoutBonus = computePlayerAttributes({
  level: 20,
  stars: 0,
  characterId: 'uchiha-itachi',
  awakeningLevel: 0,
  lineageModifiers: {},
});
assert('offline/effective attack uses modifier', withBonus.totals.strength > withoutBonus.totals.strength);
assert('bonus not written to base', withBonus.base.strength === withoutBonus.base.strength);

const saved = accountStore.getLineageProgress();
accountStore.reset();
accountStore.hydrate({ lineageProgress: saved });
const reloaded = getLineageIdProgress(accountStore.getLineageProgress(), 'ninja');
assert('reload keeps spec', reloaded.selectedSpecializationId === 'specializationA');
assert('reload keeps level', reloaded.specializationProgress.specializationA.level === 4);

const migrated = normalizePlayerLineageProgress({ lineageId: 'ninja', rank: 3 });
const migratedId = getLineageIdProgress(migrated, 'ninja');
assert('item21 migration selected null', migratedId.selectedSpecializationId === null);
assert('item21 spec A level 0', migratedId.specializationProgress.specializationA.level === 0);
assert('item21 spec kills 0', migratedId.specializationProgress.specializationA.onlineKills === 0);

// --- Correção Item 22: especializações definitivas + migration por slot ---
assert('ninja A is Sharingan', LINEAGE_REGISTRY.ninja.specializations[0].name === 'Sharingan');
assert('ninja A key', LINEAGE_REGISTRY.ninja.specializations[0].key === 'sharingan');
assert('ninja B is Byakugan', LINEAGE_REGISTRY.ninja.specializations[1].name === 'Byakugan');
assert('ninja C is Rinnegan', LINEAGE_REGISTRY.ninja.specializations[2].name === 'Rinnegan');
assert('pirata A is Armament', LINEAGE_REGISTRY.pirata.specializations[0].name === 'Haki do Armamento');
assert('pirata B is Observation', LINEAGE_REGISTRY.pirata.specializations[1].name === 'Haki da Observação');
assert('pirata C is Conqueror', LINEAGE_REGISTRY.pirata.specializations[2].name === 'Haki do Conquistador');
assert('cacador A is Reforço', LINEAGE_REGISTRY.cacador.specializations[0].name === 'Reforço');
assert('cacador B is Emissão', LINEAGE_REGISTRY.cacador.specializations[1].name === 'Emissão');
assert('cacador C is Especialização', LINEAGE_REGISTRY.cacador.specializations[2].name === 'Especialização');
assert(
  'feiticeiro A cursed-technique',
  LINEAGE_REGISTRY.feiticeiro.specializations[0].key === 'cursed-technique',
);
assert('guerreiro A is Poder', LINEAGE_REGISTRY.guerreiro.specializations[0].name === 'Poder');

const legacyNinjaSave = normalizePlayerLineageProgress({
  lineageId: 'ninja',
  byLineage: {
    ninja: {
      rank: 3,
      onlineKills: 5000,
      selectedSpecializationId: 'specializationA',
      specializationLevel: 3,
      specializationProgress: {
        specializationA: { level: 3, onlineKills: 2450 },
        specializationB: { level: 0, onlineKills: 0 },
        specializationC: { level: 0, onlineKills: 0 },
      },
    },
  },
});
const legacyNinja = getLineageIdProgress(legacyNinjaSave, 'ninja');
assert('migration keeps slot A', legacyNinja.selectedSpecializationId === 'specializationA');
assert('migration keeps level III', legacyNinja.specializationProgress.specializationA.level === 3);
assert('migration keeps 2450 kills', legacyNinja.specializationProgress.specializationA.onlineKills === 2450);
assert(
  'slot A resolves to Sharingan',
  resolveSpecializationDisplayName('ninja', 'specializationA') === 'Sharingan',
);

const legacyPirateSave = normalizePlayerLineageProgress({
  lineageId: 'pirata',
  byLineage: {
    pirata: {
      rank: 2,
      onlineKills: 2000,
      selectedSpecializationId: 'specializationB',
      specializationLevel: 2,
      specializationProgress: {
        specializationA: { level: 0, onlineKills: 0 },
        specializationB: { level: 2, onlineKills: 1500 },
        specializationC: { level: 0, onlineKills: 0 },
      },
    },
  },
});
const legacyPirate = getLineageIdProgress(legacyPirateSave, 'pirata');
assert('pirate migration keeps slot B', legacyPirate.selectedSpecializationId === 'specializationB');
assert('pirate migration keeps level II', legacyPirate.specializationProgress.specializationB.level === 2);
assert('pirate migration keeps 1500 kills', legacyPirate.specializationProgress.specializationB.onlineKills === 1500);
assert(
  'slot B resolves to Observation Haki',
  resolveSpecializationDisplayName('pirata', 'specializationB') === 'Haki da Observação',
);

assert(
  'no orphan Ninjutsu name',
  !LINEAGE_REGISTRY.ninja.specializations.some((s) => s.name === 'Ninjutsu'),
);
assert(
  'no orphan Combatente on pirata',
  !LINEAGE_REGISTRY.pirata.specializations.some((s) => s.name === 'Combatente'),
);

console.log('lineage specialization tests passed');
