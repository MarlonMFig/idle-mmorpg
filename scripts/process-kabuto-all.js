/**
 * Yakushi Kabuto — pack lateral curado (alpha frames).
 * npm run kabuto:all
 * Input: assets/naruto-source/nu/kabuto/{idle,walk,combo,damage,jutsu}/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'kabuto';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 13, walk: 5, combo: 13, damage: 5, jutsu: 54 },
  comboSplits: [4, 4, 5],
  jutsu: {
    file: 'senpo-hakugeki.png',
    metaKey: 'kabuto-senpo-hakugeki',
    skillMetaKey: 'skill-senpo-hakugeki',
    frameRate: 14,
    // Peak wide VFX ~f45–50
    hitFrame1based: 45,
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
