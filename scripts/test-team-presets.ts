/**
 * Item 43 — Presets de equipe.
 * Run: npx --yes tsx scripts/test-team-presets.ts
 */
import { MAX_TEAM_PRESETS } from '../src/constants/team-presets';
import { MEDIC_CONFIG } from '../src/constants/medic';
import { COMBAT_ENERGY } from '../src/constants/combat-energy';
import {
  createDefaultTeamPresets,
  hasDuplicateInstanceIds,
  parsePersistedTeamPresets,
  sanitizePresetSlots,
  slotsFromTeamIds,
} from '../src/lib/team-preset';
import {
  activateTeamPreset,
  clearTeamPreset,
  isActivePresetDirty,
  renameTeamPreset,
  resetTeamPresetBusyForTests,
  saveCurrentTeamToPreset,
} from '../src/lib/team-preset-service';
import { parsePersistedSession } from '../src/lib/session-persist';
import { locationStore } from '../src/stores/location-store';
import { teamPresetStore } from '../src/stores/team-preset-store';
import { teamStore } from '../src/stores/team-store';
import { vitalsStore } from '../src/stores/vitals-store';
import type { SealedCharacter } from '../src/types/team';
import { MAP_KEYS } from '../src/maps/map-registry';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function makeMember(id: string, name: string, lookType: number): SealedCharacter {
  return {
    id,
    characterId: `char-${lookType}`,
    characterKey: `look:${lookType}`,
    name,
    lookType,
    sourceId: null,
    starterId: null,
    previewUrl: '/sprites/npc.png',
    quality: 'D',
    stars: 0,
    lineageId: 'ninja',
    level: 1,
    xp: 0,
    masteryLevel: 0,
    masteryXp: 0,
    awakeningLevel: 0,
    isFavorite: false,
    isLocked: false,
  };
}

function seedCollection(ids: string[]): void {
  teamStore.reset('naruto-classic');
  // Replace with controlled instances
  const members = ids.map((id, i) => makeMember(id, `Hero${i + 1}`, 9000 + i));
  // hydrate with starter-like structure
  teamStore.hydrate({
    collection: members,
    teamIds: [members[0]!.id],
    activeId: members[0]!.id,
  });
  teamPresetStore.reset(teamStore.getSnapshot().teamIds);
  resetTeamPresetBusyForTests();
  locationStore.sync('hub', MAP_KEYS.leafVillage, null);
}

function main(): void {
  // —— Defaults ——
  seedCollection(['a', 'b', 'c', 'd', 'e', 'f']);
  assert('max presets = 5', MAX_TEAM_PRESETS === 5);
  assert('5 presets after reset', teamPresetStore.getSnapshot().presets.length === 5);
  const p1 = teamPresetStore.getPreset('preset-1');
  assert('preset1 has current team', p1?.slots[0] === 'a' && p1.slots[1] === null);
  assert(
    'presets 2-5 empty',
    teamPresetStore
      .getSnapshot()
      .presets.slice(1)
      .every((p) => p.slots.every((s) => s == null)),
  );
  assert('activePresetId preset-1', teamPresetStore.getSnapshot().activePresetId === 'preset-1');

  // —— Save preset 2 ——
  teamStore.applyFormation(['a', 'b', 'c'], 'a');
  assert('save preset2 ok', saveCurrentTeamToPreset('preset-2').ok);
  const p2 = teamPresetStore.getPreset('preset-2');
  assert(
    'preset2 = abc',
    p2?.slots[0] === 'a' && p2.slots[1] === 'b' && p2.slots[2] === 'c',
  );

  // —— Manual change does not autosave ——
  teamStore.applyFormation(['d', 'e', 'f'], 'd');
  const p2After = teamPresetStore.getPreset('preset-2');
  assert(
    'preset2 still abc',
    p2After?.slots[0] === 'a' && p2After.slots[1] === 'b' && p2After.slots[2] === 'c',
  );

  // —— Activate ——
  assert('activate preset2', activateTeamPreset('preset-2').ok);
  assert(
    'team abc',
    JSON.stringify(teamStore.getSnapshot().teamIds) === JSON.stringify(['a', 'b', 'c']),
  );

  // —— Dirty ——
  teamStore.applyFormation(['a', 'b', 'd'], 'a');
  assert('dirty true', isActivePresetDirty() === true);
  assert(
    'preset2 still abc while dirty',
    teamPresetStore.getPreset('preset-2')!.slots[2] === 'c',
  );

  // —— Save changes ——
  assert('save changes', saveCurrentTeamToPreset('preset-2').ok);
  assert(
    'preset2 abd',
    JSON.stringify(teamPresetStore.getPreset('preset-2')!.slots) ===
      JSON.stringify(['a', 'b', 'd']),
  );
  assert('dirty false', isActivePresetDirty() === false);

  // —— Duplicate instance blocked ——
  assert(
    'sanitize drops duplicate',
    JSON.stringify(sanitizePresetSlots(['x', 'x', 'y'])) === JSON.stringify(['x', null, 'y']),
  );
  assert('hasDuplicate true', hasDuplicateInstanceIds(['x', 'x', null]));
  assert('hasDuplicate false', !hasDuplicateInstanceIds(['x', 'y', null]));

  // —— Same definition different instances OK ——
  seedCollection(['naruto-a', 'naruto-b', 'sasuke-1']);
  teamStore.hydrate({
    collection: [
      makeMember('naruto-a', 'Naruto', 100),
      makeMember('naruto-b', 'Naruto', 100),
      makeMember('sasuke-1', 'Sasuke', 101),
    ],
    teamIds: ['naruto-a', 'naruto-b', 'sasuke-1'],
    activeId: 'naruto-a',
  });
  teamPresetStore.reset(['naruto-a', 'naruto-b', 'sasuke-1']);
  assert(
    'duplicate definition allowed in team',
    saveCurrentTeamToPreset('preset-2').ok &&
      JSON.stringify(teamPresetStore.getPreset('preset-2')!.slots) ===
        JSON.stringify(['naruto-a', 'naruto-b', 'sasuke-1']),
  );

  // —— Removed instance ——
  teamPresetStore.writeSlots('preset-3', ['naruto-a', 'gone', 'sasuke-1']);
  teamPresetStore.repairAgainstCollection(['naruto-a', 'naruto-b', 'sasuke-1']);
  assert(
    'removed → empty slot',
    JSON.stringify(teamPresetStore.getPreset('preset-3')!.slots) ===
      JSON.stringify(['naruto-a', null, 'sasuke-1']),
  );
  assert('activate repaired', activateTeamPreset('preset-3').ok);
  assert(
    'team without gone',
    JSON.stringify(teamStore.getSnapshot().teamIds) ===
      JSON.stringify(['naruto-a', 'sasuke-1']),
  );

  // —— Empty preset ——
  clearTeamPreset('preset-4');
  assert('empty activate blocked', activateTeamPreset('preset-4').ok === false);

  // —— Hunt block ——
  locationStore.sync('combat', MAP_KEYS.forest, 'hunt-test');
  teamStore.applyFormation(['naruto-a', 'naruto-b'], 'naruto-a');
  saveCurrentTeamToPreset('preset-5');
  teamStore.applyFormation(['sasuke-1'], 'sasuke-1');
  const huntResult = activateTeamPreset('preset-5');
  assert('hunt blocks activate', huntResult.ok === false && huntResult.reason === 'in-hunt');
  assert('team unchanged in hunt', teamStore.getSnapshot().teamIds[0] === 'sasuke-1');

  // —— Hub allow ——
  locationStore.sync('hub', MAP_KEYS.leafVillage, null);
  assert('hub activate ok', activateTeamPreset('preset-5').ok);

  // —— Energy not in preset ——
  const persisted = teamPresetStore.getPersisted();
  const blob = JSON.stringify(persisted);
  assert('no energy in preset blob', !blob.includes('Energy') && !blob.includes('energy'));
  assert('no hp in preset blob', !blob.includes('"hp"') && !blob.includes('currentHp'));
  assert('item41 energy defaults intact', COMBAT_ENERGY.maxEnergy === 100);

  // —— Medic untouched ——
  assert('medic config intact', MEDIC_CONFIG.minimumCost === 25);

  // —— HP unchanged by preset ——
  vitalsStore.reset({ level: 1, xp: 0, xpMax: 100, hp: 40, hpMax: 100 });
  activateTeamPreset('preset-2');
  assert('hp unchanged by preset', vitalsStore.getSnapshot().hp === 40);

  // —— Rename ——
  assert('rename ok', renameTeamPreset('preset-1', '  Farm  ').ok);
  assert('name trimmed', teamPresetStore.getPreset('preset-1')!.name === 'Farm');

  // —— Migration / parse session v11 without presets ——
  const migrated = parsePersistedSession({
    version: 11,
    player: {
      nickname: 'Tester',
      villageId: 'konoha',
      starterCharacterId: 'naruto-classic',
    },
    location: { mode: 'hub', mapKey: MAP_KEYS.leafVillage, huntId: null },
    team: {
      collection: [makeMember('inst-1', 'N', 1)],
      teamIds: ['inst-1'],
      activeId: 'inst-1',
    },
    vitals: { level: 1, xp: 0 },
    account: { lineageProgress: null },
    guild: { playerId: null, guildId: null },
  });
  assert('migration parses', migrated != null);
  assert('migration has 5 presets', migrated!.teamPresets?.presets.length === 5);
  assert(
    'migration preset1 = team',
    migrated!.teamPresets?.presets[0]?.slots[0] === 'inst-1',
  );
  assert('session version bumped in parse', migrated!.version === 12);

  // —— Reload round-trip ×10 ——
  seedCollection(['r1', 'r2', 'r3']);
  teamStore.applyFormation(['r1', 'r2', 'r3'], 'r1');
  saveCurrentTeamToPreset('preset-2');
  renameTeamPreset('preset-2', 'Boss');
  for (let i = 0; i < 10; i += 1) {
    const snap = teamPresetStore.getPersisted();
    const ids = teamStore.getSnapshot().collection.map((c) => c.id);
    teamPresetStore.hydrate(snap, ids, teamStore.getSnapshot().teamIds);
  }
  assert('10 reloads name', teamPresetStore.getPreset('preset-2')!.name === 'Boss');
  assert(
    '10 reloads slots',
    JSON.stringify(teamPresetStore.getPreset('preset-2')!.slots) ===
      JSON.stringify(['r1', 'r2', 'r3']),
  );
  assert('still 5 presets', teamPresetStore.getSnapshot().presets.length === 5);

  // —— New game defaults ——
  const fresh = createDefaultTeamPresets(['starter']);
  assert('new game 5', fresh.presets.length === 5);
  assert('new game p1', fresh.presets[0]!.slots[0] === 'starter');
  assert(
    'new game p2 empty',
    fresh.presets[1]!.slots.every((s) => s == null),
  );

  // —— slotsFromTeamIds ——
  assert(
    'slots from ids',
    JSON.stringify(slotsFromTeamIds(['a', 'b'])) === JSON.stringify(['a', 'b', null]),
  );

  console.log('test-team-presets: all passed');
}

main();
