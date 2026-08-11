/**
 * Itachi Amaterasu black-flame VFX — green-screen sheet → target FX strip.
 *
 * Exterior chroma green only (NOT black-key — navy/black flames stay).
 * Content-island frame detect (row bands; uneven spacing OK).
 * Centered cells; process max side ~52 so on-screen ~1.2–1.4× char
 * (playPackFx uses player.scaleX * 1.15).
 *
 * npm run itachi:amaterasu-fx
 * Input:  assets/naruto-source/nu/itachi/amaterasu-fx-source.(png|jpg) or Cursor asset
 * Output: public/sprites/player/itachi/amaterasu-fx.png
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
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'itachi');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.png'),
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.jpg'),
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.jpeg'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-be43f902-2382-4053-a168-d30d437f5219.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'itachi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'itachi');
const FRAME_RATE = 12;
/** Max side after packing (~shikamaru reduced FX / char-ish height). */
const TARGET_MAX_SIDE = 52;
const PAD = 2;
const HINT_EXPECTED = 18;

function resolveSource() {
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(
    `Missing Amaterasu FX sheet. Expected one of:\n  ${LOCAL_CANDIDATES.join('\n  ')}\n  or ${CURSOR_SRC}`,
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

/** Navy / near-black flame core (not pure chroma green). */
function isFlamePixel(r, g, b) {
  if (isGreenBg(r, g, b) || isChromaGreen(r, g, b)) return false;
  // dark navy / black fire body
  if (r <= 60 && g <= 70 && b <= 110) return true;
  // mid blue highlight strokes
  if (b >= 50 && b > r + 10 && b >= g && r <= 90 && g <= 100) return true;
  // any non-green content after key
  return true;
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
    const filled = y < h && dens[y] > 6;
    if (filled && s < 0) s = y;
    if (!filled && s >= 0) {
      if (y - s >= 5) bands.push({ t: s, b: y, h: y - s });
      s = -1;
    }
  }
  return bands;
}

/**
 * Density runs in a row band → content-tight boxes.
 * mergeGap / minSz tuned per band height (ground flecks vs pillars).
 */
function cellsInBand(data, w, band) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  // Ground fires: short band → low thr; tall pillars: relative thr
  const thr = Math.max(1, Math.floor(band.h * (band.h < 40 ? 0.02 : 0.025)));
  const minRun = band.h < 40 ? 3 : 8;
  // Keep ground-fire lobules separate when gulfs exist; merge only 1–2px fleck bridges
  const mergeGap = band.h < 40 ? 4 : 12;

  const runs = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= minRun) runs.push({ l: xs, r: x });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of runs) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= mergeGap) prev.r = c.r;
    else merged.push({ ...c });
  }

  // No valley-split on this sheet: ground lobules are uneven but
  // intentional fire stages; over-split fills the strip with tiny crumbs.
  const splitRuns = merged;

  const minSz = band.h < 40 ? 20 : band.h < 120 ? 100 : 400;
  const out = [];
  for (const c of splitRuns) {
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
    if (sz < minSz || maxX < 0) continue;
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
  return out;
}

/**
 * Merge tiny satellite islands into nearest neighbor (stray embers beside
 * a main ground-fire lobe). Does not bridge pillars (size threshold).
 */
function attachSatellites(cells, maxMainRatio = 0.12) {
  if (cells.length < 2) return cells.slice();
  const maxSz = Math.max(...cells.map((c) => c.sz));
  // Absolute ceiling so mid/top "medium" lobules stay independent of biggest pillar
  const thr = Math.min(80, Math.max(28, maxSz * maxMainRatio));
  let list = cells
    .slice()
    .sort((a, b) => a.minX - b.minX)
    .map((c) => ({ ...c }));

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].sz >= thr) continue;
      // nearest main neighbor by gap
      let best = -1;
      let bestGap = Infinity;
      const c = list[i];
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue;
        if (list[j].sz < thr) continue;
        const gap =
          c.maxX < list[j].minX
            ? list[j].minX - c.maxX
            : list[j].maxX < c.minX
              ? c.minX - list[j].maxX
              : 0;
        if (gap < bestGap) {
          bestGap = gap;
          best = j;
        }
      }
      if (best < 0 || bestGap > 18) continue;
      const m = list[best];
      const merged = {
        minX: Math.min(c.minX, m.minX),
        maxX: Math.max(c.maxX, m.maxX),
        minY: Math.min(c.minY, m.minY),
        maxY: Math.max(c.maxY, m.maxY),
        sz: c.sz + m.sz,
      };
      merged.width = merged.maxX - merged.minX + 1;
      merged.height = merged.maxY - merged.minY + 1;
      list[best] = merged;
      list.splice(i, 1);
      changed = true;
      break;
    }
  }
  return list.sort((a, b) => a.minX - b.minX);
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
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (!isFlamePixel(r, g, b)) continue;
      crop[di] = r;
      crop[di + 1] = g;
      crop[di + 2] = b;
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

  // Exterior green only — interior navy/black flames kept.
  let data = keyGreenBackground(raw, w, h, { stripLabels: true });
  const scrubbed = scrubResidualGreen(data);
  console.log(`keyed ${w}x${h}; residual green scrubbed=${scrubbed}`);

  const bands = findBands(data, w, h);
  if (!bands.length) throw new Error('No content bands found after keying');
  console.log(
    'bands',
    bands.map((b) => `${b.t}-${b.b}(h=${b.h})`).join(', '),
  );

  const cells = [];
  for (const band of bands) {
    let row = cellsInBand(data, w, band);
    // Attach only micro flecks (absolute + relative) — never glue two main lobes
    row = attachSatellites(row, band.h < 50 ? 0.12 : 0.05);
    console.log(
      `  band ${band.t}-${band.b}: ${row.length} islands ` +
        row.map((c) => `${c.width}x${c.height}@${c.minX}`).join(' | '),
    );
    cells.push(...row);
  }

  // Reading order = top→bottom, LTR (already band order + x sort)
  if (cells.length < 6) {
    throw new Error(`Too few flame islands: ${cells.length}`);
  }
  if (cells.length !== HINT_EXPECTED) {
    console.log(
      `NOTE: detected ${cells.length} islands (hint ~${HINT_EXPECTED}); exporting content islands as-is.`,
    );
  }

  const crops = [];
  let maxW = 0;
  let maxH = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const { crop, bw, bh } = extractCrop(data, w, cells[i]);
    const box = bbox(crop, bw, bh);
    // re-crop to opaque bbox (drop empty padding from cell run)
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

  // Prefer pillar height ≈ TARGET_MAX_SIDE (char-ish / 1.2–1.4×). Cap width similarly
  // if a cell is super-wide ground flame, but don't let a wide top lobe dwarf height.
  const scale = Math.min(
    1,
    TARGET_MAX_SIDE / Math.max(1, maxH + PAD * 2),
    (TARGET_MAX_SIDE * 1.35) / Math.max(1, maxW + PAD * 2),
  );
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

  // QA
  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let navy = 0;
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
        if (r <= 12 && g <= 12 && b <= 12) pureBlack += 1;
        // navy flame (dark blue-leaning)
        if (r <= 50 && g <= 55 && b <= 100 && (b >= r || r <= 20)) navy += 1;
      }
    }
    frameOpaque.push(pix);
    if (pix < 4) {
      throw new Error(`Frame ${f} too empty (${pix}px)`);
    }
  }

  console.log(
    `QA residualGreen=${residualGreen} opaque=${opaque} pureBlack=${pureBlack} navy=${navy} frameOpaque=[${frameOpaque.join(',')}]`,
  );
  if (residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${residualGreen}`);
  }
  if (pureBlack + navy < 80) {
    throw new Error(
      `QA fail: black/navy flame nearly gone (pureBlack=${pureBlack} navy=${navy})`,
    );
  }

  // Copy source into workspace for reproducibility
  fs.mkdirSync(LOCAL_SRC_DIR, { recursive: true });
  const localSrc = path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.png');
  if (path.resolve(srcPath) !== path.resolve(localSrc)) {
    await sharp(srcPath).png().toFile(localSrc);
    console.log('cached source →', localSrc);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'amaterasu-fx.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );

  const scaledMeta = {
    frames,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outH,
    scale,
  };
  await writeFrameCrops(sheet, scaledMeta, QA_DIR, 'amaterasu-fx', 3);

  const durationMs = Math.round((frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/itachi/amaterasu-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight: outH,
    scale,
    frameRate: FRAME_RATE,
    durationMs,
    source: 'assets/naruto-source/nu/itachi/amaterasu-fx-source.png',
    residualGreen,
    residualExteriorBlack: 0,
    pureBlack,
    navy,
    note: `${frames.length}f Amaterasu black-flame VFX only — exterior green key, centered cells`,
  };
  updateMeta(META_JSON, 'itachi-amaterasu-fx', entry);
  updateMeta(META_JSON, 'skill-amaterasu-fx', {
    ...entry,
    note: 'skill-amaterasu FX — black flames on target (hitDelay−80)',
  });

  console.log(
    `-> amaterasu-fx.png ${sheet.width}x${sheet.height} fw=${outW} fh=${outH} n=${frames.length} scale=${scale.toFixed(4)} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire fx:',
    JSON.stringify({
      key: 'itachi-amaterasu-fx',
      url: '/sprites/player/itachi/amaterasu-fx.png',
      frameWidth: outW,
      frameHeight: outH,
      frameCount: frames.length,
      contentHeight: outH,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
