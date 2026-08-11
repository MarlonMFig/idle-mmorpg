/**
 * Kiba Inuzuka — pack lateral curado (alpha frames).
 * npm run kiba:all
 * Input: assets/naruto-source/nu/kiba/{idle,walk,combo,damage,jutsu}/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'kiba';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 6, walk: 6, combo: 13, damage: 5, jutsu: 32 },
  comboSplits: [4, 4, 5],
  jutsu: {
    file: 'gatsuuga.png',
    metaKey: 'kiba-gatsuuga',
    skillMetaKey: 'skill-gatsuuga',
    frameRate: 12,
    // Peak contact ~ mid-late charge
    hitFrame1based: 22,
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
