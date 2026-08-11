/**
 * Rock Lee Omote Renge — ground impact VFX (frame 16).
 * Horizontal 5-frame blue-screen strip → alpha sheet.
 *
 * npm run rock-lee:omote-impact-fx
 * Input:  assets/.../omote-renge-impact-fx-source.png (or Cursor drop)
 * Output: public/sprites/player/rock-lee/omote-renge-impact-fx.png
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
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rock-lee');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'omote-renge-impact-fx-source.png'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-ce033041-e64b-407d-8e1d-cf5ca0e657b3.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'rock-lee');
const EXPECTED = 5;
/** Tall dust plume — taller than body content (~48) for read. */
const TARGET_H = 72;
const PAD = 2;

function resolveSource() {
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(
    `Missing impact FX. Expected:\n  ${LOCAL_CANDIDATES.join('\n  ')}\n  or ${CURSOR_SRC}`,
  );
}

function isBlueScreen(r, g, b) {
  // Author navy (~#124062 / 18,64,98) + near neighbors after JPEG
  if (b >= 55 && b <= 130 && r <= 55 && g <= 95 && b >= r + 25 && b >= g + 8) return true;
  if (b >= 40 && b >= r + 15 && b >= g + 10 && r <= 90 && g <= 110) return true;
  if (b > g + 25 && b > r + 25 && b < 160 && r < 80 && g < 100) return true;
  if (b <= 90 && r <= 40 && g <= 55 && b >= Math.max(r, g) + 8) return true;
  // Flat mid navy residual from soft edges
  if (Math.abs(r - 18) <= 12 && Math.abs(g - 64) <= 14 && Math.abs(b - 98) <= 18) return true;
  return false;
}

function keyBlue(data) {
  const out = Buffer.from(data);
  let keyed = 0;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (out[i + 3] < ALPHA_KEEP || isBlueScreen(r, g, b)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      keyed += 1;
      continue;
    }
    out[i + 3] = 255;
  }
  return { data: out, keyed };
}

function colDensity(data, w, h) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h; y += 1) {
      if (data[(y * w + x) * 4 + 3] >= ALPHA_KEEP) dens[x] += 1;
    }
  }
  return dens;
}

/** Split horizontal multi-frame: gap columns or equal slices. */
function findHorizontalCells(data, w, h, expected) {
  const dens = colDensity(data, w, h);
  const minGap = Math.max(2, Math.floor(w / (expected * 20)));
  const segments = [];
  let s = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > 2;
    if (filled && s < 0) s = x;
    if (!filled && s >= 0) {
      if (x - s >= 8) segments.push({ l: s, r: x });
      s = -1;
    }
  }
  if (segments.length === expected) {
    return segments.map((seg) => ({
      minX: seg.l,
      maxX: seg.r - 1,
      minY: 0,
      maxY: h - 1,
    }));
  }

  // Equal width fallback (5 panels in one row)
  const cellW = Math.floor(w / expected);
  return Array.from({ length: expected }, (_, i) => ({
    minX: i * cellW,
    maxX: i === expected - 1 ? w - 1 : (i + 1) * cellW - 1,
    minY: 0,
    maxY: h - 1,
  }));
}

function cropCell(data, w, cell) {
  const cw = cell.maxX - cell.minX + 1;
  const ch = cell.maxY - cell.minY + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((cell.minY + y) * w + (cell.minX + x)) * 4;
      const di = (y * cw + x) * 4;
      data.copy(out, di, si, si + 4);
    }
  }
  return { data: out, width: cw, height: ch };
}

function placeFloor(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const ox = Math.floor((dw - sw) / 2);
  const oy = dh - sh - PAD;
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
  const localKeep = path.join(LOCAL_SRC_DIR, 'omote-renge-impact-fx-source.png');
  if (path.resolve(srcPath) !== path.resolve(localKeep)) {
    fs.copyFileSync(srcPath, localKeep);
    console.log('copied →', localKeep);
  }

  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const { data: keyed, keyed: nKeyed } = keyBlue(data);
  console.log(`keyed blue=${nKeyed} size=${w}x${h}`);

  const rawCells = findHorizontalCells(keyed, w, h, EXPECTED);
  console.log(`cells found=${rawCells.length}`);
  if (rawCells.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} cells, got ${rawCells.length}`);
  }

  // Tighten each cell to its own alpha bbox
  const crops = rawCells.map((cell) => {
    const full = cropCell(keyed, w, cell);
    const box = bbox(full.data, full.width, full.height);
    return cropCell(full.data, full.width, {
      minX: box.minX,
      maxX: box.maxX,
      minY: box.minY,
      maxY: box.maxY,
    });
  });

  const maxContentH = Math.max(...crops.map((c) => c.height));
  const scale = Math.min(1, TARGET_H / maxContentH);
  const scaled = crops.map((c) => nearestScale(c.data, c.width, c.height, scale));
  const fw = Math.max(...scaled.map((s) => s.width)) + PAD * 2;
  const fh = Math.max(...scaled.map((s) => s.height)) + PAD * 2;

  const frames = scaled.map((s) => placeFloor(s.data, s.width, s.height, fw, fh));
  for (let i = 0; i < frames.length; i += 1) {
    const op = countOpaque(frames[i]);
    if (op < 40) throw new Error(`impact f${i + 1} too empty (${op}px)`);
  }

  // Final residual blue scrub (JPEG fringe after resize)
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 4) {
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (isBlueScreen(frame[i], frame[i + 1], frame[i + 2])) {
        frame[i] = 0;
        frame[i + 1] = 0;
        frame[i + 2] = 0;
        frame[i + 3] = 0;
      }
    }
  }

  const sheet = stitch(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'omote-renge-impact-fx.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    { frames, frameWidth: fw, frameHeight: fh },
    QA_DIR,
    'omote-renge-impact-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/rock-lee/omote-renge-impact-fx.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount: EXPECTED,
    contentHeight: fh - PAD * 2,
    scale,
    frameRate: 14,
    durationMs: Math.round((EXPECTED / 14) * 1000),
    source: 'omote-renge-impact-fx-source.png (5f ground impact @ f16)',
  };
  updateMeta(META_JSON, 'rock-lee-omote-renge-impact-fx', entry);
  updateMeta(META_JSON, 'skill-omote-renge-impact-fx', entry);
  console.log('PACK_WIRE_IMPACT_FX', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
