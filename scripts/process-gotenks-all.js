/**
 * Gotenks pack — lateral curated alpha (flight + ESPECIAL).
 *
 *   node scripts/import-gotenks-sources.js
 *   node scripts/process-gotenks-all.js
 *   node scripts/qa-gotenks-sprites.js
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'gotenks';

processCuratedAlphaPack({
  id: ID,
  srcDir: path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', ID),
  outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
  qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
  expected: { idle: 4, walk: 4, combo: 20, damage: 4, jutsu: 18 },
  comboSplits: [7, 7, 6],
  hurtFrameCount: 2,
  walkAlignX: 'feet',
  scaleRef: 'idle',
  jutsu: {
    file: 'especial.png',
    metaKey: 'gotenks-especial',
    skillMetaKey: 'skill-gotenks-especial',
    // Body only f1–16 (charge → ghost → point). f17–18 = ghost projectile → ghost-fx.png
    bodyFrameCount: 16,
    frameRate: 10,
    hitFrame1based: 14,
    bodyMatchN: 6,
    alignX: 'feet',
    pad: 16,
  },
})
  .then(async (wire) => {
    console.log('GOTENKS_WIRE', JSON.stringify(wire, null, 2));
    const { spawnSync } = require('child_process');
    const r = spawnSync('node', [path.join(__dirname, 'process-gotenks-ghost-fx.js')], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
