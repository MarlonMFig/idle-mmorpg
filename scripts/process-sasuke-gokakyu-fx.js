/**
 * Sasuke Katon Goukakyuu — fire VFX strip (green screen).
 * Main fireball sequence (flight loop + impact); ignores labeled “Fire Effect 2” row.
 *
 * npm run sasuke:gokakyu-fx
 * Input:  assets/.../sasuke/gokakyu-fx-source.(png|jpg) or Cursor drop
 * Output: public/sprites/player/sasuke/sasuke-gokakyu-fx.png
 *
 * Layout as authored:
 *   f0–f6  flight / spinning fireball (loop)
 *   f7–f11 impact / break-apart
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  bbox,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'sasuke');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'gokakyu-fx-source.png'),
  path.join(LOCAL_SRC_DIR, 'gokakyu-fx-source.jpg'),
  path.join(LOCAL_SRC_DIR, 'gokakyu-fx-source.jpeg'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-b998f364-424f-458f-affc-0bac9cb98197.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sasuke');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'sasuke');
const FLIGHT_FRAME_COUNT = 7;
const TARGET_MAX_SIDE = 72;
const PAD = 2;
/** Take first N fire blobs from top rows (ignore ember strip under black label). */
const MAX_FRAMES = 12;

function resolveSource() {
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(
    `Missing Gokakyu FX sheet. Expected:\n  ${LOCAL_CANDIDATES.join('\n  ')}\n  or ${CURSOR_SRC}`,
  );
}

function isGreenBg(r, g, b) {
  if (isChromaGreen(r, g, b)) return true;
  // Solid green-screen (dull or bright)
  if (g >= 70 && g >= r + 25 && g >= b + 25 && r <= 120 && b <= 120) return true;
  if (g >= 90 && g > r * 1.4 && g > b * 1.4 && r < 140) return true;
  return false;
}

function isFirePixel(r, g, b, a) {
  if (a < ALPHA_KEEP) return false;
  if (isGreenBg(r, g, b)) return false;
  // White/yellow core + orange/red flames
  if (r > 200 && g > 180 && b > 140) return true;
  if (r > 90 && r + g > 140 && b < r * 0.9 && r >= g - 30) return true;
  if (r > 120 && g > 40 && g < r && b < g) return true;
  return false;
}

function keyFireSheet(data) {
  const out = Buffer.from(data);
  let kept = 0;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (!isFirePixel(r, g, b, a)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    out[i + 3] = 255;
    kept += 1;
  }
  return { data: out, kept };
}

function findBands(data, w, h, densMin) {
  const dens = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] >= ALPHA_KEEP) dens[y] += 1;
    }
  }
  const bands = [];
  let s = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dens[y] > densMin;
    if (filled && s < 0) s = y;
    if (!filled && s >= 0) {
      if (y - s >= 12) bands.push({ t: s, b: y, h: y - s });
      s = -1;
    }
  }
  return bands;
}

function cellsInBand(data, w, band) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (data[(y * w + x) * 4 + 3] >= ALPHA_KEEP) dens[x] += 1;
    }
  }
  const cells = [];
  let s = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > 4;
    if (filled && s < 0) s = x;
    if (!filled && s >= 0) {
      if (x - s >= 8) cells.push({ l: s, r: x, t: band.t, b: band.b });
      s = -1;
    }
  }
  return cells;
}

function crop(data, w, cell) {
  const cw = cell.r - cell.l;
  const ch = cell.b - cell.t;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((cell.t + y) * w + (cell.l + x)) * 4;
      data.copy(out, (y * cw + x) * 4, si, si + 4);
    }
  }
  return { data: out, width: cw, height: ch };
}

function placeCentered(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const ox = Math.floor((dw - sw) / 2);
  const oy = Math.floor((dh - sh) / 2);
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      if (src[si + 3] < ALPHA_KEEP) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      src.copy(out, (dy * dw + dx) * 4, si, si + 4);
    }
  }
  return out;
}

function nearestScale(src, sw, sh, scale) {
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor(x / scale));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { data: out, width: dw, height: dh };
}

async function main() {
  const srcPath = resolveSource();
  console.log('source', srcPath);
  fs.mkdirSync(LOCAL_SRC_DIR, { recursive: true });
  const keep = path.join(LOCAL_SRC_DIR, 'gokakyu-fx-source.png');
  if (path.resolve(srcPath) !== path.resolve(keep)) {
    await sharp(srcPath).png().toFile(keep);
    console.log('saved →', keep);
  }

  const { data, info } = await sharp(keep).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const { data: keyed, kept } = keyFireSheet(data);
  console.log(`fire pixels=${kept} size=${w}x${h}`);

  // Drop bottom ~28% (label + Fire Effect 2 embers) before detection
  const activeH = Math.floor(h * 0.72);
  const bands = findBands(keyed, w, activeH, 8);
  let cells = [];
  for (const band of bands) {
    cells.push(...cellsInBand(keyed, w, band));
  }
  // Sort reading order: top→bottom, left→right
  cells.sort((a, b) => a.t - b.t || a.l - b.l);
  cells = cells.slice(0, MAX_FRAMES);
  console.log(`cells=${cells.length} bands=${bands.length}`);
  if (cells.length < 6) {
    throw new Error(`Too few fire cells (${cells.length}); retune keying`);
  }

  const crops = cells.map((c) => {
    const raw = crop(keyed, w, c);
    const box = bbox(raw.data, raw.width, raw.height);
    const tight = crop(raw.data, raw.width, {
      l: box.minX,
      r: box.maxX + 1,
      t: box.minY,
      b: box.maxY + 1,
    });
    return tight;
  }).filter((c) => countOpaque(c.data) >= 50);

  if (crops.length < 6) {
    throw new Error(`Too few solid fire cells after filter (${crops.length})`);
  }
  console.log(`usable crops=${crops.length} (dropped tiny blobs)`);

  const maxSide = Math.max(...crops.map((c) => Math.max(c.width, c.height)));
  const scale = Math.min(1, TARGET_MAX_SIDE / maxSide);
  const scaled = crops.map((c) => nearestScale(c.data, c.width, c.height, scale));
  const fw = Math.max(...scaled.map((s) => s.width)) + PAD * 2;
  const fh = Math.max(...scaled.map((s) => s.height)) + PAD * 2;
  const frames = scaled.map((s) => placeCentered(s.data, s.width, s.height, fw, fh));
  for (let i = 0; i < frames.length; i += 1) {
    const op = countOpaque(frames[i]);
    if (op < 25) throw new Error(`fx f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'sasuke-gokakyu-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames, frameWidth: fw, frameHeight: fh },
    QA_DIR,
    'gokakyu-fx',
    3,
  );

  const flightN = Math.min(FLIGHT_FRAME_COUNT, frames.length);
  const entry = {
    image: '/sprites/player/sasuke/sasuke-gokakyu-fx.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    contentHeight: fh - PAD * 2,
    scale,
    flightFrameCount: flightN,
    residualGreen: 0,
    source: 'gokakyu-fx-source.png (main fireball strip)',
  };
  updateMeta(META_JSON, 'sasuke-gokakyu-fx', entry);
  updateMeta(META_JSON, 'skill-katon-gokakyu-fx', entry);
  console.log('PACK_WIRE_GOKakyu_FX', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
