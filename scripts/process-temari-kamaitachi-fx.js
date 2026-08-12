/**
 * Temari Kamaitachi wind slash VFX — alpha frames from VFX JUTSU.zip.
 * 26 frames in zip = two near-identical 13f loops; pack first 13 only.
 * Preserve white/grey wind (no black-key). Transparent BG already in source.
 *
 * npm run temari:kamaitachi-fx
 * Input:  assets/naruto-source/nu/temari/jutsu-vfx/frame_*.png
 * Output: public/sprites/player/temari/kamaitachi-fx.png
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
const { resolveHqFxTargetMaxSide } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'temari', 'jutsu-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'temari');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'temari');
/** First half of looped sequence (full zip has 26 ≈ 13×2). */
const EXPECTED = 13;
const LEGACY_FX_BODY_H = 48;
const PAD = 2;
const FRAME_RATE = 14;

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
    if (isChromaGreen(d[i], d[i + 1], d[i + 2])) {
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

function countGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

async function main() {
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'temari-idle', LEGACY_FX_BODY_H);
  console.log('HQ FX targetBodyH=' + TARGET_BODY_H + ' (legacy ' + LEGACY_FX_BODY_H + ')');
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Missing VFX source dir: ${SRC_DIR}`);
  }

  const all = await loadAlphaFrames(SRC_DIR, null);
  if (all.length < EXPECTED) {
    throw new Error(`Need ≥${EXPECTED} frames, got ${all.length}`);
  }
  // Zip carries two passes (op counts match f01–13 ≈ f14–26); only one cycle.
  const keyed = all.slice(0, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  // Wind slash is wider than tall — scale by height, allow wide cells.
  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    allowOversizedFrames: true,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    // Sparse dissipating wind frames are tiny.
    if (op < 8) throw new Error(`kamaitachi-fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`kamaitachi-fx residualGreen=${residualGreen}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'kamaitachi-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'kamaitachi-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/temari/kamaitachi-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'temari/jutsu-vfx (VFX JUTSU.zip, 13f wind slash; 26=loop×2)',
  };
  updateMeta(META_JSON, 'temari-kamaitachi-fx', entry);
  updateMeta(META_JSON, 'skill-kamaitachi-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log('Suggest: fxReleaseMs≈550 fxAttach=target (hitDelayMs≈750)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
