/**
 * Shino Kikaichū swarm VFX — alpha frame sequence from VFX JUTSU.zip.
 * Dense insect cloud: preserve pure black particles (no black-key, no island scrub).
 *
 * npm run shino:kikaichu-fx
 * Input:  assets/naruto-source/nu/shino/jutsu-vfx/frame_*.png
 * Output: public/sprites/player/shino/kikaichu-fx.png
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
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shino', 'jutsu-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shino');
const EXPECTED = 18;
/** Swarm max side ≈ display size (characters use contentH 48). */
const TARGET_BODY_H = 56;
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
    // Only pure chroma green — pure black insect dots must stay.
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
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Missing VFX source dir: ${SRC_DIR}`);
  }

  const keyed = await loadAlphaFrames(SRC_DIR, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  // Uniform scale from tallest swarm span; keep later dissipation frames smaller OK.
  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    allowOversizedFrames: true,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    // Late dissipate frames are sparse dots — lower floor than body packs.
    if (op < 8) throw new Error(`kikaichu-fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) {
    throw new Error(`kikaichu-fx residualGreen=${residualGreen}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'kikaichu-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'kikaichu-fx',
    3,
  );

  // Cast hitDelay≈667ms → swarm on target slightly before body hit.
  const entry = {
    image: '/sprites/player/shino/kikaichu-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'shino/jutsu-vfx (VFX JUTSU.zip, 18f insect swarm)',
  };
  updateMeta(META_JSON, 'shino-kikaichu-fx', entry);
  updateMeta(META_JSON, 'skill-kikaichu-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log('Suggest: fxReleaseMs≈500 fxAttach=target (hitDelayMs≈667)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
