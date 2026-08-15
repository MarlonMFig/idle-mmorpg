/**
 * Tayuya Magen: Mateki — pink musical-note / genjutsu spirit VFX.
 * Alpha frame sequence from VFX JUTSU.zip (4f note spin).
 *
 * npm run tayuya:magen-mateki-fx
 * Input:  assets/naruto-source/nu/tayuya/jutsu-vfx/frame_*.png
 * Output: public/sprites/player/tayuya/magen-mateki-fx.png
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
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'tayuya', 'jutsu-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'tayuya');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'tayuya');
const EXPECTED = 4;
/** Small 26×35 source notes → readable combat size. */
const LEGACY_FX_BODY_H = 40;
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
    // Only pure chroma green — keep magenta notes + dark outlines.
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
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'tayuya-idle', LEGACY_FX_BODY_H);
  console.log('HQ FX targetBodyH=' + TARGET_BODY_H + ' (legacy ' + LEGACY_FX_BODY_H + ')');
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Missing VFX source dir: ${SRC_DIR}`);
  }

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
    if (op < 20) throw new Error(`magen-mateki-fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`magen-mateki-fx residualGreen=${residualGreen}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'magen-mateki-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'magen-mateki-fx',
    4,
  );

  const entry = {
    image: '/sprites/player/tayuya/magen-mateki-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'tayuya/jutsu-vfx (VFX JUTSU.zip, 4f music notes)',
  };
  updateMeta(META_JSON, 'tayuya-magen-mateki-fx', entry);
  updateMeta(META_JSON, 'skill-magen-mateki-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log('Suggest: fxFlightFrameCount=4 fxReleaseMs≈660 (hitDelayMs≈917)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
