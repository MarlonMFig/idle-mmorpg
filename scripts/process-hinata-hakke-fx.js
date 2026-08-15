/**
 * Hinata Hakke Shōhō — palm-spike VFX (4f alpha).
 *
 * npm run hinata:hakke-fx
 * Input:  assets/naruto-source/nu/hinata/jutsu-vfx/frame_*.png
 * Output: public/sprites/player/hinata/hakke-shou-fx.png
 *
 * playPackFx uses player.scale — native 162px spikes become a sand tower on
 * a ch=54 body. Fit max-side to the HQ FX ruler (legacy 56 × idle/48).
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
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'hinata', 'jutsu-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'hinata');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'hinata');
const EXPECTED = 4;
const LEGACY_FX_BODY_H = 56;
const PAD = 2;
const FRAME_RATE = 12;

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
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'hinata-idle', LEGACY_FX_BODY_H);
  console.log(`HQ FX targetBodyH=${TARGET_BODY_H} (legacy ${LEGACY_FX_BODY_H})`);
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Missing ${SRC_DIR}`);

  const keyed = await loadAlphaFrames(SRC_DIR, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 20) throw new Error(`hakke-fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`hakke-fx residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'hakke-shou-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'hakke-shou-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/hinata/hakke-shou-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'hinata/jutsu-vfx (VFX JUTSU.zip)',
  };
  updateMeta(META_JSON, 'hinata-hakke-shou-fx', entry);
  updateMeta(META_JSON, 'skill-hakke-shouhou-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
