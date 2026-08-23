/**
 * test-character-sprite-alignment
 * Run: npx --yes tsx scripts/test-character-sprite-alignment.ts
 *
 * Cobre: cálculo em memória + serialize/persist/load round-trip no Character Pack.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  alignmentsEqual,
  composeFinalVisualPosition,
  composeRenderOffsets,
  normalizeSpriteAlignment,
  resolveSpriteAlignment,
  type SpriteAlignmentConfig,
} from '../src/lib/sprite-alignment';
import { characterLateralOrigin, type CharacterPack, type SpriteSheetDef } from '../src/data/character-packs';
import { findCharacterSourceFile, resolveWritableCharacterId } from '../src/lib/dev/find-character-source';
import {
  patchCharacterSource,
  readSpriteAlignmentFromSource,
} from '../src/lib/dev/patch-character-source';

function fakePack(alignment?: SpriteAlignmentConfig): CharacterPack {
  const sheet: SpriteSheetDef = {
    key: 'test-idle',
    url: '/x.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 1,
    offsetX: 0,
    offsetY: 0,
  };
  return {
    id: 'test-char',
    walk: sheet,
    attack: sheet,
    idle: sheet,
    skillAnims: {},
    hotbarSkillIds: [null, null, null, null],
    spriteAlignment: alignment,
  };
}

function testMemoryComposition() {
  assert.deepEqual(resolveSpriteAlignment(undefined, 'hub'), { x: 0, y: 0 });
  assert.deepEqual(resolveSpriteAlignment(undefined, 'hunt'), { x: 0, y: 0 });

  const config = normalizeSpriteAlignment({
    hub: { x: -3, y: -3 },
    hunt: { x: 0, y: 6 },
  });
  assert.equal(config.hub.y, -3);
  assert.equal(config.hunt.y, 6);
  assert.equal(resolveSpriteAlignment(config, 'hub').y, -3);
  assert.equal(resolveSpriteAlignment(config, 'hunt').y, 6);

  assert.equal(resolveSpriteAlignment(config, 'hub').x, -3);
  assert.equal(resolveSpriteAlignment(config, 'hunt').x, 0);

  const composed = composeRenderOffsets({
    alignment: { x: 0, y: 6 },
    poseOffset: { x: 4, y: -10 },
  });
  assert.deepEqual(composed, { x: 4, y: -4 });

  const final = composeFinalVisualPosition({
    base: { x: 480, y: 620 },
    alignment: { x: 0, y: 6 },
    poseOffset: { x: 4, y: -10 },
  });
  assert.deepEqual(final, { x: 484, y: 616 });

  const pack = fakePack({ hunt: { x: 5, y: 6 } });
  const sheet: SpriteSheetDef = {
    ...pack.idle!,
    offsetX: 2,
    offsetY: -4,
  };
  const alignment = resolveSpriteAlignment(pack.spriteAlignment, 'hunt');
  const origin = characterLateralOrigin(pack, {
    ...sheet,
    offsetX: (sheet.offsetX ?? 0) + alignment.x,
    offsetY: (sheet.offsetY ?? 0) + alignment.y,
  });
  const originNoAlign = characterLateralOrigin(pack, sheet);
  assert.notEqual(origin.x, originNoAlign.x);
  assert.notEqual(origin.y, originNoAlign.y);

  const a = normalizeSpriteAlignment({ hunt: { x: 1, y: 6 } });
  const b = normalizeSpriteAlignment({ hunt: { x: 0, y: 0 } });
  assert.equal(alignmentsEqual(a, b), false);

  const copied = normalizeSpriteAlignment({
    hub: a.hub,
    hunt: a.hub,
  });
  assert.deepEqual(copied.hunt, a.hub);

  // Zero is valid (?? not ||)
  assert.deepEqual(resolveSpriteAlignment({ hub: { x: 0, y: 0 } }, 'hub'), { x: 0, y: 0 });
  assert.equal(normalizeSpriteAlignment({ hunt: { x: 0, y: -6 } }).hunt.y, -6);
}

function testSlugResolvesToPackId() {
  assert.equal(resolveWritableCharacterId('itachi'), 'uchiha-itachi');
  assert.ok(findCharacterSourceFile('itachi'), 'slug itachi must locate source');
  assert.ok(findCharacterSourceFile('uchiha-itachi'), 'canonical id must locate source');
}

function testPersistRoundTrip() {
  const characterId = 'uchiha-itachi';
  const hit = findCharacterSourceFile(characterId);
  assert.ok(hit);
  const original = fs.readFileSync(hit.absPath, 'utf8');
  const beforeSkills = /skill-itachi-tsukuyomi/.test(original);
  assert.ok(beforeSkills);

  const wanted = normalizeSpriteAlignment({
    hub: { x: -3, y: 5 },
    hunt: { x: 0, y: 8 },
  });

  try {
    // Slug path (root-cause repro): save as "itachi" must write uchiha-itachi pack.
    patchCharacterSource(
      { characterId: 'itachi', changes: { spriteAlignment: wanted } },
      { persist: true },
    );

    // Unload runtime: re-read file from disk
    const disk = fs.readFileSync(hit.absPath, 'utf8');
    const loaded = readSpriteAlignmentFromSource(disk, 'uchiha-itachi');
    assert.ok(loaded);
    assert.deepEqual(normalizeSpriteAlignment(loaded), wanted);
    assert.deepEqual(resolveSpriteAlignment(loaded, 'hunt'), { x: 0, y: 8 });
    assert.deepEqual(resolveSpriteAlignment(loaded, 'hub'), { x: -3, y: 5 });

    // Pack integrity
    assert.match(disk, /skill-itachi-tsukuyomi/);
    assert.match(disk, /skill-itachi-hosenka/);
    assert.match(disk, /UCHIHA_ITACHI_JUTSU_ANIMS/);

    // Independent merge: only hunt changes, hub preserved
    patchCharacterSource(
      { characterId: 'itachi', changes: { spriteAlignment: { hunt: { x: 0, y: -6 } } } },
      { persist: true },
    );
    const merged = normalizeSpriteAlignment(
      readSpriteAlignmentFromSource(fs.readFileSync(hit.absPath, 'utf8'), 'uchiha-itachi'),
    );
    assert.deepEqual(merged.hub, { x: -3, y: 5 });
    assert.deepEqual(merged.hunt, { x: 0, y: -6 });

    // Explicit zeros
    patchCharacterSource(
      {
        characterId: 'uchiha-itachi',
        changes: { spriteAlignment: { hub: { x: 0, y: 0 }, hunt: { x: 0, y: 0 } } },
      },
      { persist: true },
    );
    const zeroed = normalizeSpriteAlignment(
      readSpriteAlignmentFromSource(fs.readFileSync(hit.absPath, 'utf8'), 'uchiha-itachi'),
    );
    assert.deepEqual(zeroed.hub, { x: 0, y: 0 });
    assert.deepEqual(zeroed.hunt, { x: 0, y: 0 });
  } finally {
    fs.writeFileSync(hit.absPath, original, 'utf8');
  }
}

function main() {
  testMemoryComposition();
  testSlugResolvesToPackId();
  testPersistRoundTrip();
  console.log('test-character-sprite-alignment: PASS');
}

main();
