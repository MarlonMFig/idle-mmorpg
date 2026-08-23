import { accountStore } from '../src/stores/account-store';
import { characterLabStore } from '../src/stores/character-lab-store';
import { DEFAULT_VITALS } from '../src/constants/hud';
import { vitalsStore } from '../src/stores/vitals-store';
import { getCharacterDefinition } from '../src/data/characters';
import { LINEAGE_REGISTRY } from '../src/data/lineages/registry';
import { isCharacterCompatibleWithLineage } from '../src/lib/lineage-compatibility';
import { migrateLegacyPlayerLineageId, normalizePlayerLineageProgress, getLineageIdProgress } from '../src/lib/lineage-progress';
import {
  validateLineageDefinition,
  validateLineageRegistry,
} from '../src/lib/lineage-validation';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL } from '../src/constants/lineage';
import type { LineageId } from '../src/types/character-meta';
import type { LineageDefinition } from '../src/types/lineage';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

assert('registry has 6 lineages', Object.keys(LINEAGE_REGISTRY).length === 6);
assert('validator clean', validateLineageRegistry().length === 0);

for (const id of Object.keys(LINEAGE_REGISTRY) as LineageId[]) {
  const def = LINEAGE_REGISTRY[id];
  assert(`${id} has 4 ranks`, def.ranks.length === 4);
  assert(`${id} has 3 specs`, def.specializations.length === 3);
  for (const spec of def.specializations) {
    assert(`${id} ${spec.id} has 4 levels`, spec.levels.length === 4);
  }
}

const badDef = {
  ...LINEAGE_REGISTRY.pirata,
  ranks: [...LINEAGE_REGISTRY.pirata.ranks, LINEAGE_REGISTRY.pirata.ranks[0]],
} as LineageDefinition;
assert('invalid 5 ranks detected', validateLineageDefinition(badDef).some((w) => w.includes('5 ranks')));

accountStore.reset();
vitalsStore.reset({ ...DEFAULT_VITALS, level: LINEAGE_SYSTEM_UNLOCK_LEVEL, hp: 100, hpMax: 100, xp: 0, xpMax: 100 });
accountStore.chooseLineage('ninja');
assert('choose ninja', accountStore.getPlayerLineageId() === 'ninja');
assert('starts rank I', getLineageIdProgress(accountStore.getLineageProgress(), 'ninja').rank === 1);
const saved = accountStore.getLineageProgress();
accountStore.reset();
accountStore.hydrate({ lineageProgress: saved });
assert('reload keeps ninja', accountStore.getPlayerLineageId() === 'ninja');

const migrated = migrateLegacyPlayerLineageId({ clanId: 'ninja' });
assert('clanId migrates', migrated === 'ninja');
const migrated2 = migrateLegacyPlayerLineageId({ playerClanId: 'shinigami' });
assert('playerClanId migrates', migrated2 === 'shinigami');
const progress = normalizePlayerLineageProgress({ lineageId: 'pirata', rank: 2 });
assert('progress parse', progress.lineageId === 'pirata' && getLineageIdProgress(progress, 'pirata').rank === 2);

const itachi = getCharacterDefinition('uchiha-itachi');
assert('itachi has lineage', itachi?.lineageId === 'ninja');
assert(
  'itachi compatible ninja player',
  isCharacterCompatibleWithLineage(itachi!, 'ninja'),
);

const gokuIds = ['goku-classic', 'goku', 'son-goku'] as const;
let gokuDef = null;
for (const id of gokuIds) {
  gokuDef = getCharacterDefinition(id);
  if (gokuDef) break;
}
if (gokuDef) {
  assert('goku lineage warrior', gokuDef.lineageId === 'guerreiro');
  assert('goku not compatible ninja', !isCharacterCompatibleWithLineage(gokuDef, 'ninja'));
} else {
  console.log('skip goku pack not in registry');
}

accountStore.hydrate({ lineageProgress: { lineageId: 'ninja', byLineage: { ninja: { rank: 1, onlineKills: 0, selectedSpecializationId: null, specializationLevel: 0 } } } });
const before = accountStore.getPlayerLineageId();
characterLabStore.setPreviewLineage('shinigami');
assert('preview does not change save', accountStore.getPlayerLineageId() === before);
characterLabStore.setPreviewLineage(null);

console.log('lineage foundation tests passed');

