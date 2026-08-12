/**
 * Sakura Shippuden — Chō Tsūbō ground-impact VFX (multi-row green sheet).
 *
 * Layout: 3 bands → equal-split 5 + 4 + 4 = 13 frames (flash→rock burst→settle).
 * Floor-align so impact stays rooted on the ground.
 *
 * npm run sakura-shippuden:chou-tsubo-fx
 * Input:  assets/naruto-source/nu/sakura-shippuden/jutsu-fx-source.png
 * Output: public/sprites/player/sakura-shippuden/chou-tsubo-fx.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { keyGreenBackground, isContent, isGreenBg } = require('./lib/chroma-green-bg');
const {
  ALPHA_KEEP,
  isChromaGreen,
  bbox,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');
const { resolveHqFxTargetMaxSide } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'sakura-shippuden', 'jutsu-fx-source.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sakura-shippuden');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'sakura-shippuden');
const FRAME_RATE = 12;
const EXPECTED = 13;
const ROW_COUNTS = [5, 4, 4];
const LEGACY_FX_BODY_H = 56;
const PAD = 2;

function scrubResidualGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isGreenBg(data[i], data[i + 1], data[i + 2]) || isChromaGreen(data[i], data[i + 1], data[i + 2])) {
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
      if (y - s >= 10) bands.push({ t: s, b: y });
      s = -1;
    }
  }
  // Merge tight sub-rows (flash tip sitting above rock row).
  const merged = [];
  for (const b of bands) {
    const prev = merged[merged.length - 1];
    if (prev && b.t - prev.b < 12) prev.b = b.b;
    else merged.push({ ...b });
  }
  return merged;
}

function equalCells(data, w, band, n) {
  let L = w;
  let R = -1;
  for (let y = band.t; y < band.b; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!isContent(data, (y * w + x) * 4)) continue;
      if (x < L) L = x;
      if (x > R) R = x;
    }
  }
  if (R < 0) return [];
  const span = R - L + 1;
  const cellW = span / n;
  const cells = [];
  for (let i = 0; i < n; i += 1) {
    const l = Math.floor(L + i * cellW);
    const r = Math.floor(L + (i + 1) * cellW);
    let minX = w;
    let maxX = -1;
    let minY = band.b;
    let maxY = band.t;
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
    if (sz < 40 || maxX < 0) continue;
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
  return cells;
}

function extractCrop(data, w, cell) {
  const bw = cell.width;
  const bh = cell.height;
  const crop = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const si = ((cell.minY + y) * w + (cell.minX + x)) * 4;
      if (!isContent(data, si)) continue;
      const di = (y * bw + x) * 4;
      crop[di] = data[si];
      crop[di + 1] = data[si + 1];
      crop[di + 2] = data[si + 2];
      crop[di + 3] = 255;
    }
  }
  return { crop, bw, bh };
}

/** Place crop floor-aligned (ground impact) and centered on X. */
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

async function main() {
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'sakura-shippuden-idle', LEGACY_FX_BODY_H);
  console.log('HQ FX targetBodyH=' + TARGET_BODY_H + ' (legacy ' + LEGACY_FX_BODY_H + ')');
  if (!fs.existsSync(SRC)) throw new Error(`Missing source: ${SRC}`);

  const { data: raw, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let data = keyGreenBackground(Buffer.from(raw), w, h, { stripLabels: true });
  const scrubbed = scrubResidualGreen(data);
  console.log(`keyed ${w}x${h}; residual green scrubbed=${scrubbed}`);

  const rows = findBands(data, w, h);
  console.log(
    'rows',
    rows.map((r) => `${r.t}-${r.b}`).join(', '),
  );
  if (rows.length < 3) {
    throw new Error(`Expected 3 content rows, got ${rows.length}`);
  }

  const cells = [];
  for (let ri = 0; ri < Math.min(3, rows.length); ri += 1) {
    const n = ROW_COUNTS[ri] ?? 4;
    const rowCells = equalCells(data, w, rows[ri], n);
    console.log(
      `  row ${ri} n=${n} cells=${rowCells.length} ` +
        rowCells.map((c) => `${c.width}x${c.height}@${c.minX}`).join(' | '),
    );
    cells.push(...rowCells);
  }
  if (cells.length !== EXPECTED) {
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
  const cellsBuf = crops.map(({ crop, bw, bh }) => placeFloor(crop, bw, bh, cellW, cellH));

  // Scale by height so the peak rock burst matches combat body scale (~56).
  // Width may be larger than 56 — OK for ground slams (allowOversized).
  const scale = TARGET_BODY_H / Math.max(1, maxH);
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
  for (let i = 0; i < sheet.data.length; i += 4) {
    if (sheet.data[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) residualGreen += 1;
  }
  if (residualGreen > 0) throw new Error(`residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'chou-tsubo-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames, frameWidth: outW, frameHeight: outH },
    QA_DIR,
    'chou-tsubo-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/sakura-shippuden/chou-tsubo-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualGreen: 0,
    source: 'sakura-shippuden/jutsu-fx-source.png (13f ground slam 5+4+4)',
  };
  updateMeta(META_JSON, 'sakura-shippuden-chou-tsubo-fx', entry);
  updateMeta(META_JSON, 'skill-chou-tsubo-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  // Cast hits at ~1167ms — start ground FX a bit earlier so peak covers impact.
  console.log('Suggest: fxReleaseMs≈1000 fxAttach=target (hitDelayMs≈1167)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
