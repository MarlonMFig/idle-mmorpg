/**
 * Kimimaro Tessenka no Mai — impact bone VFX (alpha sequence).
 *
 * npm run kimimaro:tessenka-fx
 * Input:  assets/naruto-source/nu/kimimaro/jutsu-vfx/frame_*.png  (vfx.zip)
 * Output: public/sprites/player/kimimaro/tessenka-no-mai-fx.png
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
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kimimaro', 'jutsu-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kimimaro');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'kimimaro');
const EXPECTED = 6;
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
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'kimimaro-idle', LEGACY_FX_BODY_H);
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
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 30) throw new Error(`tessenka-fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`tessenka-fx residualGreen=${residualGreen}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'tessenka-no-mai-fx.png'),
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
    'tessenka-no-mai-fx',
    3,
  );

  // Body hit @ frame 12 / 12fps = 917ms — FX starts a beat earlier so peak covers hit.
  const entry = {
    image: '/sprites/player/kimimaro/tessenka-no-mai-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'kimimaro/jutsu-vfx (vfx.zip, 6f bone impact)',
  };
  updateMeta(META_JSON, 'kimimaro-tessenka-no-mai-fx', entry);
  updateMeta(META_JSON, 'skill-tessenka-no-mai-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log(
    'Suggest wire: fxReleaseMs≈750 fxAttach=target (body hitDelay≈917)',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
