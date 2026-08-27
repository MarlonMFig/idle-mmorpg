/**
 * Naruto clássico (kid) — body only from SPRITES JOGO/naruto.
 * Preserves existing jutsus (rasengan / kyuubi / henge sheets untouched).
 *
 * Fontes:
 *   IDLE/idle_*.png
 *   WALK/walk_*.png
 *   combo atack/combo_*.png (12 → 4+4+4)
 *   hurt and death/hurt and death_*.png (5 → 2 hurt + 3 death)
 *
 * HQ: nativePixels + sameRipZoom (sem upsample NN / sem blur).
 * Uso: node scripts/process-naruto-classic-body.js
 */
const fs = require('fs');
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'naruto';
const DOWNLOAD = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'SPRITES JOGO',
  'naruto',
);
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', ID);

function naturalNum(name) {
  const m = name.match(/(\d+)(?=\D*$)/);
  return m ? +m[1] : 0;
}

function stageDir(srcFolder, destName, expected) {
  const from = path.join(DOWNLOAD, srcFolder);
  const to = path.join(SRC, destName);
  if (!fs.existsSync(from)) throw new Error(`Missing source: ${from}`);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(to)) {
    if (f.toLowerCase().endsWith('.png')) fs.unlinkSync(path.join(to, f));
  }
  const files = fs
    .readdirSync(from)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => naturalNum(a) - naturalNum(b) || a.localeCompare(b));
  if (files.length !== expected) {
    throw new Error(`${srcFolder}: expected ${expected} pngs, got ${files.length}`);
  }
  files.forEach((file, i) => {
    const dest = path.join(to, `frame_${String(i + 1).padStart(3, '0')}.png`);
    fs.copyFileSync(path.join(from, file), dest);
  });
  console.log(`staged ${destName}: ${files.length} ← ${srcFolder}`);
}

async function main() {
  stageDir('IDLE', 'idle', 6);
  stageDir('WALK', 'walk', 6);
  stageDir('combo atack', 'combo', 12);
  stageDir('hurt and death', 'damage', 5);

  const wire = await processCuratedAlphaPack({
    id: ID,
    srcDir: SRC,
    outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
    previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
    metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
    qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
    expected: { idle: 6, walk: 6, combo: 12, damage: 5, jutsu: 0 },
    comboSplits: [4, 4, 4],
    hurtFrameCount: 2,
    walkAlignX: 'feet',
    nativePixels: true,
    // Walk/combo shorter by pose (crouch/run), not different zoom.
    sameRipZoom: true,
    jutsu: null,
  });

  console.log('DONE naruto-classic body', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
