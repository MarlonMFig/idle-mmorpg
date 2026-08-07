/**
 * Gaara Jutsu 1 — Sand Slash.
 * npm run gaara:jutsu1
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
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara-jutsu1-sand-slash.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const META = path.join(OUT_DIR, 'meta.json');
const FRAME_RATE = 12;

async function main() {
  const { data, width, height } = await loadKeyed(INPUT);
  const band = findBand(data, width, height, 8);
  let cells = cellsInBand(data, width, band, 12, 7);
  console.log(`band ${band.t}-${band.b} cells=${cells.length}`, cells.map((c) => c.r - c.l).join(','));

  // sand FX se funde: split por vales se < 7
  if (cells.length < 6) {
    const dens = new Array(width).fill(0);
    for (let x = 0; x < width; x += 1) {
      for (let y = band.t; y < band.b; y += 1) {
        if (data[(y * width + x) * 4 + 3] >= 16) dens[x] += 1;
      }
    }
    const sm = dens.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let k = -3; k <= 3; k += 1) {
        if (dens[i + k] != null) {
          s += dens[i + k];
          n += 1;
        }
      }
      return s / n;
    });
    let L = 0;
    let R = width - 1;
    while (L < width && sm[L] < 2) L += 1;
    while (R > 0 && sm[R] < 2) R -= 1;
    const gaps = [];
    for (let x = L + 8; x < R - 8; x += 1) {
      if (sm[x] <= sm[x - 1] && sm[x] <= sm[x + 1] && sm[x] < 8) {
        if (!gaps.length || x - gaps[gaps.length - 1] > 20) gaps.push(x);
      }
    }
    // keep 6 strongest relative valleys
    const ranked = gaps
      .map((x) => ({ x, v: sm[x] }))
      .sort((a, b) => a.v - b.v)
      .slice(0, 6)
      .map((g) => g.x)
      .sort((a, b) => a - b);
    if (ranked.length >= 5) {
      const bounds = [L, ...ranked, R + 1];
      cells = [];
      for (let i = 0; i < bounds.length - 1; i += 1) {
        if (bounds[i + 1] - bounds[i] >= 12) {
          cells.push({ l: bounds[i], r: bounds[i + 1], t: band.t, b: band.b });
        }
      }
      console.log('valley-split cells', cells.length, cells.map((c) => c.r - c.l).join(','));
    }
  }

  if (cells.length < 4) throw new Error(`Poucos frames: ${cells.length}`);

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
  await writePng(path.join(OUT_DIR, 'sand-slash.png'), sheet.data, sheet.width, sheet.height);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/gaara/sand-slash.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    source: 'gaara-jutsu1-sand-slash.png',
    frameRate: FRAME_RATE,
    scale: scaled.scale,
    durationMs,
    hitDelayMs: Math.round(durationMs * 0.55),
    note: 'Jutsu 1 Gaara — Sand Slash',
  };
  updateMeta(META, 'gaara-sand-slash', entry);
  updateMeta(META, 'skill-sand-slash', entry);
  console.log(
    `-> sand-slash n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} durationMs=${durationMs}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
