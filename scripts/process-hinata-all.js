/**
 * Hinata Hyuga — pack lateral curado (alpha frames).
 * Fontes: Downloads/SPRITES JOGO/HINATA → assets/naruto-source/nu/hinata/
 * HQ nativePixels: idle scale=1; walk/combo/damage/jutsu match idle contentHeight.
 *
 * npm run hinata:all
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'hinata';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 5, walk: 6, combo: 15, damage: 5, jutsu: 27 },
  comboSplits: [5, 5, 5],
  hurtFrameCount: 2,
  jutsu: {
    file: 'hakke-shou.png',
    metaKey: 'hinata-hakke-shou',
    skillMetaKey: 'skill-hakke-shouhou',
    frameRate: 12,
    // Peak palm extension after smear (f20–21); not the handstand end (f26–27)
    hitFrame1based: 22,
    bodyMatchN: 4,
    alignX: 'feet',
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
