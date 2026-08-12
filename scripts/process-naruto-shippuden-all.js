/**
 * Naruto Shippuden pack - lateral curated alpha frames (zero residual green).
 *
 *   node scripts/import-naruto-shippuden-sources.js
 *   node scripts/process-naruto-shippuden-all.js
 *   node scripts/qa-naruto-shippuden-sprites.js
 *
 * Input:  assets/naruto-source/nu/naruto-shippuden/{idle,walk,combo,damage,jutsu}/
 * Output: public/sprites/player/naruto-shippuden/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'naruto-shippuden';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  // From import: walk 6, idle 6, combo 12, damage 5, jutsu 38
  expected: { idle: 6, walk: 6, combo: 12, damage: 5, jutsu: 38 },
  comboSplits: [4, 4, 4],
  hurtFrameCount: 2,
  // Side walk has strong limb swing; feet-lock stops the body from sliding.
  walkAlignX: 'feet',
  jutsu: {
    file: 'rasengan-shippuden.png',
    metaKey: 'naruto-shippuden-rasengan',
    skillMetaKey: 'skill-oodama-rasengan',
    frameRate: 12,
    // Early seals -> charge -> impact mid/late strip
    hitFrame1based: 37,
    // Match walk on-screen body size (early seal poses are taller than charge).
    absoluteScaleFromWalk: true,
  },
})
  .then((wire) => {
    console.log('NARUTO_SHIPPUDEN_WIRE', JSON.stringify(wire, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });