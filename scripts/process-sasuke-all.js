/**
 * Uchiha Sasuke — pack lateral curado (SPRITES JOGO/SASUKE zips).
 * npm run sasuke:all
 * Input: assets/naruto-source/nu/sasuke/{idle,walk,combo,damage,jutsu}/
 *
 * Combo 13 → 4+4+5 · Damage 5 → 2 hurt + 3 death
 * Jutsu 17f → Katon: Goukakyuu cast (gokakyu.png); VFX via sasuke:gokakyu-fx
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'sasuke';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 6, walk: 6, combo: 13, damage: 5, jutsu: 17 },
  comboSplits: [4, 4, 5],
  jutsu: {
    file: 'sasuke-gokakyu.png',
    metaKey: 'sasuke-gokakyu',
    skillMetaKey: 'skill-katon-gokakyu',
    frameRate: 12,
    // Blow / release fire near end of cast (f12 of 17)
    hitFrame1based: 12,
  },
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
