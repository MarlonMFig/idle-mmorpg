/**
 * Kimimaro — pack lateral curado (alpha frames).
 * npm run kimimaro:all
 * Input: assets/naruto-source/nu/kimimaro/{idle,walk,combo,damage,jutsu}/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'kimimaro';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 6, walk: 6, combo: 11, damage: 6, jutsu: 17 },
  comboSplits: [4, 4, 3],
  jutsu: {
    file: 'tessenka-no-mai.png',
    metaKey: 'kimimaro-tessenka-no-mai',
    skillMetaKey: 'skill-tessenka-no-mai',
    frameRate: 12,
    // Peak bone sickle strike
    hitFrame1based: 12,
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
