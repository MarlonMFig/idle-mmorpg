/**
 * Hitsugaya Daiguren Hyōrinmaru ice-burst VFX (alpha frames).
 *
 * Source: VFX especial.zip — 5f jagged ice fan (already transparent).
 * Preserve ice cyan/blue/white (no black-key, no sash-style wipe of costume greens —
 * these frames have no body, only ice).
 *
 * npm run hitsugaya:daiguren-fx
 * Input:  assets/naruto-source/nu/hitsugaya/especial-vfx/frame_*.png
 * Output: public/sprites/player/hitsugaya/daiguren-hyorinmaru-fx.png
 */
const fs = require('fs');
const path = require('path');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'hitsugaya', 'especial-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'hitsugaya');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'hitsugaya');
const EXPECTED = 5;
/** Tall ice fan — match combat scale but allow taller than body. */
const TARGET_BODY_H = 64;
const PAD = 2;
const FRAME_RATE = 12;

/** True pure screen green only (never cyan ice). */
function isTrueScreenGreen(r, g, b) {
  if (g >= 200 && r <= 40 && b <= 40 && g >= r + 120 && g >= b + 120) return true;
  if (g >= 180 && r <= 25 && b <= 25) return true;
  // saturated green keys, not cyan (b stays high on ice)
  if (isChromaGreen(r, g, b) && b <= 70 && r <= 90 && g >= b + 50) return true;
  return false;
}

function scrub(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isTrueScreenGreen(d[i], d[i + 1], d[i + 2])) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  return d;
}

function countScreenGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isTrueScreenGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

function countIce(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // cyan / blue ice or white highlight
    if ((b >= 100 && g >= 80 && b >= r) || r + g + b > 520) n += 1;
  }
  return n;
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Missing VFX source dir: ${SRC_DIR}`);
  }

  // loadAlphaFrames runs preserveFrame (screen green only; ice cyan is safe).
  const keyed = await loadAlphaFrames(SRC_DIR, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    allowOversizedFrames: true,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    const ice = countIce(packed.frames[i]);
    if (op < 40) throw new Error(`daiguren-fx f${i + 1} too empty (${op}px)`);
    if (ice < 20) throw new Error(`daiguren-fx f${i + 1} ice wiped (ice=${ice})`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countScreenGreen(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`daiguren-fx residualScreenGreen=${residualGreen}`);
  }
  const iceTotal = countIce(sheet.data);
  if (iceTotal < 200) throw new Error(`daiguren-fx ice too low (${iceTotal})`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'daiguren-hyorinmaru-fx.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'daiguren-hyorinmaru-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/hitsugaya/daiguren-hyorinmaru-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    icePixels: iceTotal,
    source: 'hitsugaya/especial-vfx (vfx especial.zip, 5f ice fan)',
  };
  updateMeta(META_JSON, 'hitsugaya-daiguren-hyorinmaru-fx', entry);
  updateMeta(META_JSON, 'skill-daiguren-hyorinmaru-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log('Suggest: fxReleaseMs≈320 fxAttach=target (cast hitDelayMs≈400)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
