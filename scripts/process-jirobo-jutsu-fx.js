/**
 * Jirobo Doton rock-throw VFX — green-screen 2×6 sheet → FX strip.
 *
 * Sheet layout (as authored):
 *   f0–f1  solid rock (loop while flying)
 *   f2–f5  mid-air crumble
 *   f6–f11 impact shatter / settle
 *
 * Exterior chroma green only. Labels ("Repeat until…") stripped as white.
 *
 * npm run jirobo:jutsu-fx
 * Input:  assets/.../jirobo/jutsu-fx-source.png or Cursor asset
 * Output: public/sprites/player/jirobo/doryuheki-fx.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyGreenBackground,
  isContent,
  isGreenBg,
} = require('./lib/chroma-green-bg');
const {
  ALPHA_KEEP,
  isChromaGreen,
  bbox,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jirobo');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'jutsu-fx-source.png'),
  path.join(LOCAL_SRC_DIR, 'jutsu-fx-source.jpg'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-4e8b1606-be65-4a8f-a849-451ba68f2b6a.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'jirobo');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'jirobo');
const FRAME_RATE = 12;
/** Flight frames (loop while rock is mid-air). */
const FLIGHT_FRAME_COUNT = 2;
const EXPECTED = 12;
const TARGET_MAX_SIDE = 48;
const PAD = 2;

function resolveSource() {
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(
    `Missing Jirobo rock FX sheet. Expected one of:\n  ${LOCAL_CANDIDATES.join('\n  ')}\n  or ${CURSOR_SRC}`,
  );
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

function scrubResidualGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isGreenBg(r, g, b) || isChromaGreen(r, g, b)) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      n += 1;
    }
  }
  return n;
}

function findBands(data, w, h) {
  const dens = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[y] += 1;
    }
  }
  const bands = [];
  let s = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dens[y] > 8;
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
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor(band.h * 0.03));
  const runs = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 6) runs.push({ l: xs, r: x });
      xs = -1;
    }
  }
  // Merge tiny gaps (AA cracks), keep 6-ish rocks separate
  const merged = [];
  for (const c of runs) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 6) prev.r = c.r;
    else merged.push({ ...c });
  }

  const out = [];
  for (const c of merged) {
    let minX = w;
    let maxX = -1;
    let minY = Infinity;
    let maxY = -1;
    let sz = 0;
    for (let y = band.t; y < band.b; y += 1) {
      for (let x = c.l; x < c.r; x += 1) {
        if (!isContent(data, (y * w + x) * 4)) continue;
        sz += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (sz < 40 || maxX < 0) continue;
    // Drop thin label bands (almost monochrome horizontal runs without rock brown)
    const boxH = maxY - minY + 1;
    if (boxH < 14) continue;
    out.push({
      minX,
      maxX,
      minY,
      maxY,
      sz,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }
  return out.sort((a, b) => a.minX - b.minX);
}

/**
 * Fallback: forced 2×6 grid over the two densest horizontal row bands.
 */
function cellsFromGrid(data, w, h, bands) {
  const top = bands[0];
  const bot = bands[Math.min(1, bands.length - 1)];
  const rows = bands.length >= 2 ? [top, bot] : [top];
  const cells = [];
  for (const band of rows) {
    const colW = Math.floor(w / 6);
    for (let col = 0; col < 6; col += 1) {
      const l = col * colW;
      const r = col === 5 ? w : (col + 1) * colW;
      let minX = w;
      let maxX = -1;
      let minY = h;
      let maxY = -1;
      let sz = 0;
      for (let y = band.t; y < band.b; y += 1) {
        for (let x = l; x < r; x += 1) {
          if (!isContent(data, (y * w + x) * 4)) continue;
          sz += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (sz < 30 || maxX < 0) continue;
      cells.push({
        minX,
        maxX,
        minY,
        maxY,
        sz,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }
  return cells;
}

function extractCrop(data, w, cell) {
  const bw = cell.width;
  const bh = cell.height;
  const crop = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const si = ((cell.minY + y) * w + (cell.minX + x)) * 4;
      const di = (y * bw + x) * 4;
      if (!isContent(data, si)) continue;
      crop[di] = data[si];
      crop[di + 1] = data[si + 1];
      crop[di + 2] = data[si + 2];
      crop[di + 3] = 255;
    }
  }
  return { crop, bw, bh };
}

async function main() {
  const srcPath = resolveSource();
  console.log('source', srcPath);

  const { data: raw, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  let data = keyGreenBackground(raw, w, h, { stripLabels: true });
  const scrubbed = scrubResidualGreen(data);
  console.log(`keyed ${w}x${h}; residual green scrubbed=${scrubbed}`);

  const bands = findBands(data, w, h);
  if (!bands.length) throw new Error('No content bands after keying');
  console.log(
    'bands',
    bands.map((b) => `${b.t}-${b.b}(h=${b.h})`).join(', '),
  );

  // Use rock-sized bands only (drop text-thin bands between rows).
  const rockBands = bands
    .filter((b) => b.h >= 40)
    .sort((a, b) => a.t - b.t);
  if (rockBands.length < 1) throw new Error('No rock-sized bands');

  let cells = [];
  for (const band of rockBands.slice(0, 2)) {
    const row = cellsInBand(data, w, band);
    console.log(
      `  band ${band.t}-${band.b}: ${row.length} islands ` +
        row.map((c) => `${c.width}x${c.height}@${c.minX}`).join(' | '),
    );
    cells.push(...row);
  }

  if (cells.length !== EXPECTED) {
    console.log(
      `NOTE: island detect got ${cells.length} (want ${EXPECTED}); trying 2×6 grid fallback.`,
    );
    cells = cellsFromGrid(data, w, h, rockBands);
    console.log(`grid fallback: ${cells.length} cells`);
  }
  if (cells.length < 6) {
    throw new Error(`Too few rock frames: ${cells.length}`);
  }
  // Truncate/pad to 12 if grid overshot: keep first 12
  if (cells.length > EXPECTED) {
    console.log(`keeping first ${EXPECTED} of ${cells.length}`);
    cells = cells.slice(0, EXPECTED);
  }
  if (cells.length < EXPECTED) {
    throw new Error(`Need ${EXPECTED} frames, got ${cells.length}`);
  }

  const crops = [];
  let maxW = 0;
  let maxH = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const { crop, bw, bh } = extractCrop(data, w, cells[i]);
    const box = bbox(crop, bw, bh);
    const tw = box.width;
    const th = box.height;
    const tight = Buffer.alloc(tw * th * 4);
    for (let y = 0; y < th; y += 1) {
      for (let x = 0; x < tw; x += 1) {
        const si = ((box.minY + y) * bw + (box.minX + x)) * 4;
        const di = (y * tw + x) * 4;
        tight[di] = crop[si];
        tight[di + 1] = crop[si + 1];
        tight[di + 2] = crop[si + 2];
        tight[di + 3] = crop[si + 3];
      }
    }
    maxW = Math.max(maxW, tw);
    maxH = Math.max(maxH, th);
    crops.push({ crop: tight, bw: tw, bh: th });
    console.log(`  crop f${i} ${tw}x${th}`);
  }

  const cellW = maxW + PAD * 2;
  const cellH = maxH + PAD * 2;
  const cellsBuf = crops.map(({ crop, bw, bh }) =>
    placeCentered(crop, bw, bh, cellW, cellH),
  );

  const scale = Math.min(1, TARGET_MAX_SIDE / Math.max(cellW, cellH));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));

  const frames = [];
  for (const cell of cellsBuf) {
    const { data: resized } = await sharp(cell, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < resized.length; i += 4) {
      if (resized[i + 3] < 128) {
        resized[i] = 0;
        resized[i + 1] = 0;
        resized[i + 2] = 0;
        resized[i + 3] = 0;
      } else {
        resized[i + 3] = 255;
        if (
          isChromaGreen(resized[i], resized[i + 1], resized[i + 2]) ||
          isGreenBg(resized[i], resized[i + 1], resized[i + 2])
        ) {
          resized[i] = 0;
          resized[i + 1] = 0;
          resized[i + 2] = 0;
          resized[i + 3] = 0;
        }
      }
    }
    frames.push(resized);
  }

  const sheet = stitch(frames, outW, outH);

  let residualGreen = 0;
  let opaque = 0;
  let brown = 0;
  const frameOpaque = [];
  for (let f = 0; f < frames.length; f += 1) {
    let pix = 0;
    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        const i = (y * sheet.width + f * outW + x) * 4;
        if (sheet.data[i + 3] < ALPHA_KEEP) continue;
        pix += 1;
        opaque += 1;
        const r = sheet.data[i];
        const g = sheet.data[i + 1];
        const b = sheet.data[i + 2];
        if (isChromaGreen(r, g, b) || isGreenBg(r, g, b)) residualGreen += 1;
        // rock browns / dust gold
        if (r >= 60 && g >= 30 && b <= 100 && r >= b) brown += 1;
      }
    }
    frameOpaque.push(pix);
    if (pix < 3) throw new Error(`Frame ${f} empty (${pix}px)`);
  }

  console.log(
    `QA residualGreen=${residualGreen} opaque=${opaque} brown=${brown} frameOpaque=[${frameOpaque.join(',')}]`,
  );
  if (residualGreen > 0) throw new Error(`QA fail: residual green = ${residualGreen}`);
  if (brown < 40) throw new Error(`QA fail: rock browns nearly gone (${brown})`);

  fs.mkdirSync(LOCAL_SRC_DIR, { recursive: true });
  const localSrc = path.join(LOCAL_SRC_DIR, 'jutsu-fx-source.png');
  if (path.resolve(srcPath) !== path.resolve(localSrc)) {
    await sharp(srcPath).png().toFile(localSrc);
    console.log('cached source →', localSrc);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'doryuheki-fx.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );

  await writeFrameCrops(
    sheet,
    { frames, frameWidth: outW, frameHeight: outH, contentHeight: outH, scale },
    QA_DIR,
    'doryuheki-fx',
    3,
  );

  const durationMs = Math.round((frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/jirobo/doryuheki-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight: outH,
    scale,
    frameRate: FRAME_RATE,
    durationMs,
    flightFrameCount: FLIGHT_FRAME_COUNT,
    residualGreen,
    brown,
    source: 'assets/naruto-source/nu/jirobo/jutsu-fx-source.png',
    note: `${frames.length}f rock throw FX; f0–f1 flight loop, f2+ impact; green exterior only`,
  };
  updateMeta(META_JSON, 'jirobo-doryuheki-fx', entry);
  updateMeta(META_JSON, 'skill-doryuheki-fx', {
    ...entry,
    note: 'skill-doryuheki FX — pedra arremessada (flight 2f + impact)',
  });

  console.log(
    `-> doryuheki-fx.png ${sheet.width}x${sheet.height} fw=${outW} fh=${outH} n=${frames.length} flight=${FLIGHT_FRAME_COUNT} residualGreen=0`,
  );
  console.log(
    'Pack wire fx:',
    JSON.stringify({
      key: 'jirobo-doryuheki-fx',
      url: '/sprites/player/jirobo/doryuheki-fx.png',
      frameWidth: outW,
      frameHeight: outH,
      frameCount: frames.length,
      contentHeight: outH,
      flightFrameCount: FLIGHT_FRAME_COUNT,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
