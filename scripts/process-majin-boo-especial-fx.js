/**
 * Majin Boo ESPECIAL projectile FX (flight + impact on target).
 *
 * From vfx.zip (13f):
 *   f1–6   — charge orb (composited onto body in especial.png, not here)
 *   flight — charged orb + trail (f7, f9, f11)
 *   impact — contact burst (f12–f13)
 *
 * Same travel→hit pattern as Freeza death-ball-fx / Gotenks ghost-fx.
 *
 * npm run majin-boo:especial-fx
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
const LEGACY_FX_BODY_H = 48;

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'majin-boo', 'vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'majin-boo');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'majin-boo');

/** 0-based indices into vfx/frame_*.png */
const FLIGHT_IDX = [6, 8, 10]; // f7, f9, f11 — orb + trail
const IMPACT_IDX = [11, 12]; // f12–f13 — contact burst
const PAD = 2;
const FRAME_RATE = 10;

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
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'majin-boo-idle', LEGACY_FX_BODY_H);
  console.log('HQ FX targetBodyH=' + TARGET_BODY_H + ' (legacy ' + LEGACY_FX_BODY_H + ')');
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Missing ${SRC_DIR}`);
  const n = fs.readdirSync(SRC_DIR).filter((f) => /^frame_\d+\.png$/i.test(f)).length;
  if (n < 13) throw new Error(`majin-boo-vfx: need ≥13 frames, got ${n}`);

  const keyed = await loadAlphaFrames(SRC_DIR, n);
  const pick = [...FLIGHT_IDX, ...IMPACT_IDX].map((i) => {
    if (!keyed[i]) throw new Error(`Missing vfx frame index ${i}`);
    return keyed[i];
  });
  const frames = pick.map((k) => scrub(k.frame));
  const widths = pick.map((k) => k.width);
  const heights = pick.map((k) => k.height);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    absoluteScale: 1,
    alignX: 'bbox',
    allowOversizedFrames: true,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 20) throw new Error(`especial-fx f${i} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`especial-fx residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'especial-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'especial-fx',
    3,
  );

  const flightFrameCount = FLIGHT_IDX.length;
  const frameCount = packed.frames.length;
  const entry = {
    image: '/sprites/player/majin-boo/especial-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount,
    contentHeight: packed.frameHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((frameCount / FRAME_RATE) * 1000),
    flightFrameCount,
    residualGreen: 0,
    note: `${flightFrameCount}f orb flight (vfx f7/9/11) + ${IMPACT_IDX.length}f impact (f12–f13); native scale=1`,
  };
  updateMeta(META_JSON, 'majin-boo-especial-fx', entry);

  console.log(
    `-> especial-fx.png ${sheet.width}x${sheet.height} fw=${packed.frameWidth} fh=${packed.frameHeight} n=${frameCount} flight=${flightFrameCount} scale=${packed.scale.toFixed(4)}`,
  );
  console.log(
    'FX_WIRE',
    JSON.stringify({
      key: 'majin-boo-especial-fx',
      url: '/sprites/player/majin-boo/especial-fx.png',
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
      frameCount,
      flightFrameCount,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
