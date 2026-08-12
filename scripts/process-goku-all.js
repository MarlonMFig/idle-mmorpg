/**
 * Goku pack - lateral curated alpha frames (Dragon Ball).
 *
 *   node scripts/import-goku-sources.js
 *   node scripts/process-goku-all.js
 *
 * Input:  assets/dragon-ball-source/nu/goku/{idle,walk,combo,damage,jutsu}/
 * Output: public/sprites/player/goku/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'goku';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 4, walk: 4, combo: 32, damage: 5, jutsu: 18 },
  comboSplits: [11, 11, 10],
  hurtFrameCount: 2,
  walkAlignX: 'feet',
  // Flight pack: walk bbox height is the thin axis — idle sets body density.
  scaleRef: 'idle',
  jutsu: {
    file: 'kamehameha.png',
    metaKey: 'goku-kamehameha',
    skillMetaKey: 'skill-kamehameha',
    frameRate: 12,
    // mid-late of 18; adjust after pack if opaque peaks later
    hitFrame1based: 14,
    // Early charge poses (pre-beam) set body size; feet lock keeps caster fixed.
    bodyMatchN: 8,
    alignX: 'feet',
  },
})
  .then((wire) => {
    console.log('GOKU_WIRE', JSON.stringify(wire, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
