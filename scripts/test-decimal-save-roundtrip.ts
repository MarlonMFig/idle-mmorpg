/**
 * Save Decimal round-trip. Obrigatório: 10^16 e 10^20.
 * Run: npx --yes tsx scripts/test-decimal-save-roundtrip.ts
 */
import { d } from '../src/lib/decimal';
import {
  decimalFromSave,
  decimalToSave,
  jsonRoundTripDecimal,
} from '../src/lib/decimal-persist';
import { parsePersistedSession } from '../src/lib/session-persist';
import { MAP_KEYS } from '../src/maps/map-registry';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

const e16 = d('1e16');
const e20 = d('1e20');

{
  assert('toSave 1e16 é string', typeof decimalToSave(e16) === 'string');
  assert('toSave 1e20 é string', typeof decimalToSave(e20) === 'string');
  assert('fromSave 1e16', decimalFromSave(decimalToSave(e16)).eq(e16));
  assert('fromSave 1e20', decimalFromSave(decimalToSave(e20)).eq(e20));
  assert('1e16 ≠ 1e20', !e16.eq(e20));
}

{
  const back16 = jsonRoundTripDecimal(e16);
  const back20 = jsonRoundTripDecimal(e20);
  assert('JSON round-trip 1e16', back16.eq(e16), String(back16));
  assert('JSON round-trip 1e20', back20.eq(e20), String(back20));
  assert('JSON 1e16 ≠ 1e20', !back16.eq(back20));
}

{
  const small = d(54);
  assert('JSON round-trip 54', jsonRoundTripDecimal(small).eq(54));
  assert('legado number 54', decimalFromSave(54).eq(54));
}

function characterBlob(id: string, xp: unknown) {
  return {
    id,
    name: 'Guy',
    lookType: 1,
    characterId: 'might-guy',
    characterKey: 'look:1',
    sourceId: null,
    starterId: 'naruto-classic',
    previewUrl: '/x.png',
    quality: 'C',
    qualityStatMultiplier: 1,
    stars: 1,
    lineageId: 'ninja',
    level: 4,
    xp,
    masteryLevel: 0,
    masteryXp: 0,
    awakeningLevel: 0,
    isFavorite: false,
    isLocked: false,
  };
}

function sessionBlob(vitalsXp: unknown, charXp: unknown, version = 13) {
  return {
    version,
    player: {
      nickname: 'Tester',
      villageId: 'konoha',
      starterCharacterId: 'naruto-classic',
    },
    location: { mode: 'hub', mapKey: MAP_KEYS.leafVillage, huntId: null },
    team: {
      collection: [characterBlob('inst-1', charXp)],
      teamIds: ['inst-1'],
      activeId: 'inst-1',
    },
    vitals: { level: 90, xp: vitalsXp },
    account: { lineageProgress: null },
    guild: { playerId: null, guildId: null },
  };
}

{
  const raw = sessionBlob(decimalToSave(e20), decimalToSave(e16));
  const json = JSON.stringify(raw);
  assert('JSON do save não embute mantissa/exponent', !json.includes('mantissa') && !json.includes('"m":'));
  const parsed = parsePersistedSession(JSON.parse(json));
  assert('parse v13', parsed != null);
  assert('vitals 1e20', decimalFromSave(parsed!.vitals.xp).eq(e20), String(parsed!.vitals.xp));
  assert('personagem 1e16', parsed!.team.collection[0]!.xp.eq(e16), String(parsed!.team.collection[0]!.xp));
}

{
  const parsed = parsePersistedSession(sessionBlob(12345, 99, 12));
  assert('legado number na conta', parsed != null && decimalFromSave(parsed.vitals.xp).eq(12345));
  assert('legado number no personagem', parsed!.team.collection[0]!.xp.eq(99));
}

console.log('PASS test-decimal-save-roundtrip');
