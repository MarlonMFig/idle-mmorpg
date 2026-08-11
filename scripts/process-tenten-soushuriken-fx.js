/**
 * Tenten — Sōshuriken weapon flight VFX (multi-row cyan sheet).
 *
 * Layout: 2 bands → equal-split 16 + 5 = 21 frames (kunai/shuriken spin+fly).
 * Center-align so the projectile path stays stable frame-to-frame.
 *
 * npm run tenten:soushuriken-fx
 * Input:  assets/naruto-source/nu/tenten/jutsu-fx-source.png
 * Output: public/sprites/player/tenten/soushuriken-fx.png
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
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'tenten', 'jutsu-fx-source.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'tenten');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'tenten');
const FRAME_RATE = 14;
const EXPECTED = 21;
const ROW_COUNTS = [16, 5];
/** Scale so peak weapon silhouette ~ body scale (contentH 48). */
const TARGET_BODY_H = 40;
const PAD = 2;

/** Pure / near cyan screen (#00FFFF family) + softer JPEG cyan bleed. */
function isCyanBg(r, g, b) {
  // Saturated cyan: high G+B, low R
  if (g >= 140 && b >= 140 && r <= 90 && Math.min(g, b) >= r + 50) return true;
  if (g >= 100 && b >= 100 && r <= 70 && Math.abs(g - b) <= 50 && (g + b) / 2 > r + 60) return true;
  // Mid cyan jpeg blur
  if (g >= 160 && b >= 160 && r <= 120 && Math.min(g, b) - r >= 40) return true;
  return false;
}

function isContent(data, i) {
  if (data[i + 3] < ALPHA_KEEP) return false;
  return !isCyanBg(data[i], data[i + 1], data[i + 2]);
}

function keyCyanBackground(raw, w, h) {
  const data = Buffer.from(raw);
  for (let i = 0; i < data.length; i += 4) {
    if (isCyanBg(data[i], data[i + 1], data[i + 2])) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else if (data[i + 3] >= ALPHA_KEEP) {
      data[i + 3] = 255;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
  // Second pass: light cyan fringes next to transparent (jpeg halos).
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < ALPHA_KEEP) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Soft cyan-ish edge: skip pure greys (weapons)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isGrey = max - min <= 28;
      if (isGrey) continue;
      if (g >= r + 20 && b >= r + 20 && r <= 140 && (g + b) / 2 >= 150) {
        // Only drop if a neighbor is empty (edge)
        let edge = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            edge = true;
            break;
          }
          if (data[(ny * w + nx) * 4 + 3] < ALPHA_KEEP) {
            edge = true;
            break;
          }
        }
        if (edge) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }
  }
  return data;
}

function scrubResidualCyan(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isCyanBg(data[i], data[i + 1], data[i + 2])) {
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
  const raw = [];
  let s = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dens[y] > 2;
    if (filled && s < 0) s = y;
    if (!filled && s >= 0) {
      if (y - s >= 4) raw.push({ t: s, b: y });
      s = -1;
    }
  }
  // Merge shuriken band sitting above kunai band (same animation row).
  const bands = [];
  for (const b of raw) {
    const prev = bands[bands.length - 1];
    if (prev && b.t - prev.b < 30) prev.b = b.b;
    else bands.push({ ...b });
  }
  return bands;
}

/**
 * Force n equal cells across the content span of a band.
 * Each cell may hold kunai+shuriken as separate islands — never drop empties mid-grid;
 * use geometric box when a cell has almost no ink (should not happen on a real pack).
 */
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
    const r = Math.max(l + 1, Math.floor(L + (i + 1) * cellW));
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
    if (sz < 4 || maxX < 0) {
      // Keep slot so grid stays aligned (rare empty equal slice).
      minX = l;
      maxX = r - 1;
      minY = band.t;
      maxY = band.b - 1;
      sz = 0;
    }
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

/** Center weapons in cell so spin/flight stays anchored. */
function placeCenter(src, sw, sh, dw, dh) {
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

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Missing source: ${SRC}`);

  const { data: raw, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let data = keyCyanBackground(raw, w, h);
  const scrubbed = scrubResidualCyan(data);
  console.log(`keyed cyan ${w}x${h}; residual cyan scrubbed=${scrubbed}`);

  const rows = findBands(data, w, h);
  console.log(
    'rows',
    rows.map((r) => `${r.t}-${r.b}`).join(', '),
  );
  if (rows.length < 2) {
    throw new Error(`Expected 2 content rows, got ${rows.length}`);
  }

  const cells = [];
  for (let ri = 0; ri < Math.min(2, rows.length); ri += 1) {
    const n = ROW_COUNTS[ri];
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
  const cellsBuf = crops.map(({ crop, bw, bh }) => placeCenter(crop, bw, bh, cellW, cellH));

  // Scale by tallest weapon span to ~TARGET_BODY_H.
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
        if (isCyanBg(resized[i], resized[i + 1], resized[i + 2])) {
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
  let residualCyan = 0;
  for (let i = 0; i < sheet.data.length; i += 4) {
    if (sheet.data[i + 3] < ALPHA_KEEP) continue;
    if (isCyanBg(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) residualCyan += 1;
  }
  if (residualCyan > 0) throw new Error(`residualCyan=${residualCyan}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'soushuriken-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames, frameWidth: outW, frameHeight: outH },
    QA_DIR,
    'soushuriken-fx',
    3,
  );

  const entry = {
    image: '/sprites/player/tenten/soushuriken-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: EXPECTED,
    contentHeight: TARGET_BODY_H,
    scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((EXPECTED / FRAME_RATE) * 1000),
    residualCyan: 0,
    source: 'tenten/jutsu-fx-source.png (21f weapons 16+5)',
  };
  updateMeta(META_JSON, 'tenten-soushuriken-fx', entry);
  updateMeta(META_JSON, 'skill-soushuriken-fx', entry);
  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
  console.log('Suggest: fxReleaseMs≈1200 fxAttach=target (hitDelayMs≈1583)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
