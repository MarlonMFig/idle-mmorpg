/**
 * Gaara Jutsu 2 — Sand Coffin.
 * npm run gaara:jutsu2
 */
const path = require('path');
const {
  loadKeyed,
  findBand,
  cellsInBand,
  extractCell,
  normalize,
  scaleFrames,
  stitch,
  writePng,
  updateMeta,
} = require('./lib/gaara-pipeline');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara-jutsu2-sand-coffin.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const META = path.join(OUT_DIR, 'meta.json');
const FRAME_RATE = 12;

async function main() {
  const { data, width, height } = await loadKeyed(INPUT);
  const band = findBand(data, width, height, 8);
  const cells = cellsInBand(data, width, band, 12, 9);
  console.log(`band ${band.t}-${band.b} cells=${cells.length}`, cells.map((c) => c.r - c.l).join(','));
  if (cells.length < 5) throw new Error(`Poucos frames: ${cells.length}`);

  const cut = cells.map((c) => extractCell(data, width, c));
  const standingH = Math.round(cut.slice(0, 2).reduce((s, c) => s + c.bh, 0) / 2);
  const norm = normalize(cut);
  const scaled = await scaleFrames(
    norm.frames,
    norm.cellW,
    norm.cellH,
    standingH || norm.contentHeight,
  );
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  await writePng(path.join(OUT_DIR, 'sand-coffin.png'), sheet.data, sheet.width, sheet.height);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/gaara/sand-coffin.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    source: 'gaara-jutsu2-sand-coffin.png',
    frameRate: FRAME_RATE,
    scale: scaled.scale,
    durationMs,
    hitDelayMs: Math.round(durationMs * 0.62),
    note: 'Jutsu 2 Gaara — Sand Coffin',
  };
  updateMeta(META, 'gaara-sand-coffin', entry);
  updateMeta(META, 'skill-sand-coffin', entry);
  console.log(
    `-> sand-coffin n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} durationMs=${durationMs}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
