/**
 * Kenshin Himura — idle, walk, combo, hurt/death, Battōjutsu.
 * npm run kenshin:all
 * Input: assets/kenshin-source/nu/kenshin/{idle,walk,combo,damage,jutsu}/
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'kenshin';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'kenshin-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 4, walk: 8, combo: 27, damage: 4, jutsu: 24 },
  comboSplits: [9, 9, 9],
  comboAlignX: 'feet',
  comboBodyMatchN: 1,
  comboFullFrame: true,
  walkAlignX: 'bbox',
  walkFullFrame: true,
  hurtFrameCount: 1,
  jutsu: {
    file: 'ryusuisen.png',
    metaKey: 'kenshin-ryusuisen',
    skillMetaKey: 'skill-ryusuisen',
    frameRate: 12,
    hitFrame1based: 12,
    bodyMatchN: 3,
    fullFrame: true,
    alignX: 'feet',
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
