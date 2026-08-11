/**
 * Tsunade — pack lateral curado (alpha frames).
 * npm run tsunade:all
 * Input: assets/naruto-source/nu/tsunade/{idle,walk,combo,damage,jutsu}/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'tsunade';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 6, walk: 6, combo: 14, damage: 5, jutsu: 20 },
  comboSplits: [5, 5, 4],
  jutsu: {
    file: 'tsutenkyaku.png',
    metaKey: 'tsunade-tsutenkyaku',
    skillMetaKey: 'skill-tsutenkyaku',
    frameRate: 12,
    // Peak kick / punch around 45% of cast
    hitFrame1based: 9,
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
