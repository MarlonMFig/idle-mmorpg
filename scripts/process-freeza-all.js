/**
 * Freeza pack — lateral curated alpha (flight + Death Ball + target VFX).
 *
 *   node scripts/import-freeza-sources.js
 *   node scripts/process-freeza-all.js
 *   node scripts/qa-freeza-sprites.js
 *
 * Input:  assets/dragon-ball-source/nu/freeza/
 * Output: public/sprites/player/freeza/
 */
const fs = require('fs');
const path = require('path');
const {
  processCuratedAlphaPack,
  TARGET_BODY_H,
} = require('./lib/curated-alpha-pack');
const {
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
  ALPHA_KEEP,
  bbox,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const ID = 'freeza';
const SRC = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const META = path.join(OUT, 'meta.json');

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

/**
 * Death Ball FX strip:
 *   flight  — charged orb loop (vfx f8, f10, f12)
 *   impact  — contact burst (vfx f19–f23)
 * Same travel→hit pattern as Gotenks ghost-fx.
 */
async function packTargetVfx() {
  const vfxDir = path.join(SRC, 'vfx');
  const n = fs
    .readdirSync(vfxDir)
    .filter((f) => /^frame_\d+\.png$/i.test(f)).length;
  if (n < 23) throw new Error(`freeza-vfx: need ≥23 frames, got ${n}`);

  const keyed = await loadAlphaFrames(vfxDir, n);
  // 0-based indices into vfx/frame_*.png
  const flightIdx = [7, 9, 11]; // f8, f10, f12 — solid charged orb
  const impactIdx = [18, 19, 20, 21, 22]; // f19–f23 — contact burst
  const pick = [...flightIdx, ...impactIdx].map((i) => keyed[i]);
  const frames = pick.map((k) => scrub(k.frame));
  const widths = pick.map((k) => k.width);
  const heights = pick.map((k) => k.height);
  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: 2,
    absoluteScale: 1,
    alignX: 'bbox',
    allowOversizedFrames: true,
  });
  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 8) throw new Error(`freeza-vfx f${i + 1} too empty (${op}px)`);
  }
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`freeza-vfx residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(path.join(OUT, 'death-ball-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    'death-ball-fx',
    5,
  );
  const flightFrameCount = flightIdx.length;
  const entry = {
    image: '/sprites/player/freeza/death-ball-fx.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.frameHeight,
    scale: packed.scale,
    residualGreen: 0,
    flightFrameCount,
    note: `${flightFrameCount}f orb flight (vfx f8/10/12) + ${impactIdx.length}f impact (f19–f23); native scale=1`,
  };
  updateMeta(META, 'freeza-death-ball-fx', entry);
  updateMeta(META, 'skill-death-ball-fx', entry);
  console.log(
    `-> death-ball-fx.png n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} flight=${flightFrameCount} scale=${packed.scale.toFixed(4)}`,
  );
  return entry;
}

processCuratedAlphaPack({
  id: ID,
  srcDir: SRC,
  outDir: OUT,
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: META,
  qaDir: QA,
  expected: { idle: 6, walk: 4, combo: 23, damage: 4, jutsu: 10 },
  comboSplits: [8, 8, 7],
  hurtFrameCount: 2,
  walkAlignX: 'feet',
  // Flight pack: walk bbox height is thin axis — idle sets body density.
  scaleRef: 'idle',
  nativePixels: true,
  jutsu: {
    file: 'death-ball.png',
    metaKey: 'freeza-death-ball',
    skillMetaKey: 'skill-death-ball',
    frameRate: 12,
    // Especial Death Ball.zip — 10f charge→throw→point (body only).
    // Orb flight + impact stay in death-ball-fx.png.
    bodyFrameCount: 10,
    // Throw / arm forward ~f8 @ 12fps → release FX.
    hitFrame1based: 8,
    bodyMatchN: 6,
    alignX: 'feet',
  },
})
  .then(async (wire) => {
    const fx = await packTargetVfx();
    const out = { ...wire, fx };
    console.log('FREEZA_WIRE', JSON.stringify(out, null, 2));
    return out;
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
