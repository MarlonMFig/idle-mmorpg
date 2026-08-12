/**
 * Uchiha Shisui — pack lateral curado (alpha frames).
 * npm run shisui:all
 *
 * Import from Downloads first:
 *   node scripts/import-shisui-sources.js
 *
 * Input: assets/naruto-source/nu/shisui/{idle,walk,combo,damage}/
 * (damage = hurt 6f + death 6f)
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'shisui';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  // idle 6 · walk 8 · combo 17 · damage 12 (hurt 6 + death 6) · no jutsu yet
  expected: { idle: 6, walk: 8, combo: 17, damage: 12, jutsu: 0 },
  // 17 → 6+5+6 (prep / mid / finisher)
  comboSplits: [6, 5, 6],
  hurtFrameCount: 6,
  jutsu: null,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
