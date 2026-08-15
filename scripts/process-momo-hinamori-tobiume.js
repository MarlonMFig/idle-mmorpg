/**
 * Momo Hinamori — Tobiume (fire beam).
 *
 * Source frames share a fixed canvas (body left, fire grows right).
 * Center-packing each tight bbox slides her backward as the beam widens.
 * Shared source crop keeps her X/Y locked; only the flame expands.
 *
 * npm run momo-hinamori:tobiume
 * (also called from process-momo-hinamori.js)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
  bbox,
} = require('./lib/alpha-frame-pack');
const { preferNativeScale, readIdleContentHeight } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'momo-hinamori', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'momo-hinamori');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'momo-hinamori');
const EXPECTED = 12;
const TARGET_BODY_H = 48;
const PAD = 2;
const FRAME_RATE = 12;
/** Early cast poses drive body scale (before beam fills the canvas). */
const BODY_MATCH_N = 2;
const HIT_FRAME_1BASED = 7;

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

function countBlack(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12) n += 1;
  }
  return n;
}

/** Union bbox across all frames (shared crop so source X stays locked). */
function unionBBox(frames, widths, heights) {
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  for (let i = 0; i < frames.length; i += 1) {
    const b = bbox(frames[i], widths[i], heights[i]);
    if (b.maxX < 0) continue;
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }
  if (maxX < 0) throw new Error('Tobiume: empty union bbox');
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function cropShared(frame, srcW, rect) {
  const { minX, minY, width, height } = rect;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = minX + x;
      const sy = minY + y;
      if (sx < 0 || sy < 0 || sx >= srcW) continue;
      const si = (sy * srcW + sx) * 4;
      const di = (y * width + x) * 4;
      out[di] = frame[si];
      out[di + 1] = frame[si + 1];
      out[di + 2] = frame[si + 2];
      out[di + 3] = frame[si + 3];
    }
  }
  return out;
}

async function packTobiume(frames, widths, heights) {
  const union = unionBBox(frames, widths, heights);
  console.log(
    `shared crop ${union.width}x${union.height} @(${union.minX},${union.minY})–(${union.maxX},${union.maxY})`,
  );

  // Scale from early body-only heights (beam frames stay same source scale).
  let sumH = 0;
  const n = Math.min(BODY_MATCH_N, frames.length);
  for (let i = 0; i < n; i += 1) {
    sumH += bbox(frames[i], widths[i], heights[i]).height;
  }
  const refH = Math.max(1, Math.round(sumH / n));
  const idleH = readIdleContentHeight(META_JSON, 'momo-hinamori-idle') || TARGET_BODY_H;
  const scale = preferNativeScale(idleH / refH);
  const cropW = Math.max(1, Math.round(union.width * scale));
  const cropH = Math.max(1, Math.round(union.height * scale));
  const fw = cropW + PAD * 2;
  const fh = cropH + PAD * 2;
  console.log(`scale=${scale.toFixed(4)} refH=${refH} → idleH=${idleH} cell=${fw}x${fh}`);

  const packed = [];
  for (let i = 0; i < frames.length; i += 1) {
    const crop = cropShared(frames[i], widths[i], union);
    const { data: resized } = await sharp(crop, {
      raw: { width: union.width, height: union.height, channels: 4 },
    })
      .resize(cropW, cropH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let p = 0; p < resized.length; p += 4) {
      if (resized[p + 3] < 128) {
        resized[p] = 0;
        resized[p + 1] = 0;
        resized[p + 2] = 0;
        resized[p + 3] = 0;
      } else {
        resized[p + 3] = 255;
        if (isChromaGreen(resized[p], resized[p + 1], resized[p + 2])) {
          resized[p] = 0;
          resized[p + 1] = 0;
          resized[p + 2] = 0;
          resized[p + 3] = 0;
        }
      }
    }

    // Same rect every frame → same dest; fire only fills more of the right side.
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = PAD;
    const destY = fh - cropH - PAD;
    for (let y = 0; y < cropH; y += 1) {
      for (let x = 0; x < cropW; x += 1) {
        const si = (y * cropW + x) * 4;
        if (resized[si + 3] < ALPHA_KEEP) continue;
        const di = ((destY + y) * fw + destX + x) * 4;
        resized.copy(canvas, di, si, si + 4);
      }
    }
    packed.push(canvas);
  }

  return { frames: packed, frameWidth: fw, frameHeight: fh, scale, refH, contentHeight: idleH };
}

async function processTobiume() {
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Missing ${SRC_DIR}`);

  const keyed = await loadAlphaFrames(SRC_DIR, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packTobiume(frames, widths, heights);

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 50) throw new Error(`tobiume f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`tobiume residualGreen=${residualGreen}`);
  const pureBlack = countBlack(sheet.data);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'tobiume.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'tobiume',
    3,
  );

  const hitIdx = Math.max(0, Math.min(EXPECTED - 1, HIT_FRAME_1BASED - 1));
  const entry = {
    image: '/sprites/player/momo-hinamori/tobiume.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: EXPECTED,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    hitDelayMs: Math.round((hitIdx / FRAME_RATE) * 1000),
    residualGreen: 0,
    pureBlack,
    source: 'momo-hinamori/jutsu shared-source-crop body-lock (fire expands right)',
  };
  updateMeta(META_JSON, 'momo-hinamori-tobiume', entry);
  updateMeta(META_JSON, 'skill-tobiume', entry);
  console.log('PACK_WIRE_TOBIUME', JSON.stringify(entry, null, 2));
  return entry;
}

if (require.main === module) {
  processTobiume().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { processTobiume };
