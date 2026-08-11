/**
 * Deidara combo/jutsu were equal-width sliced across a multi-row green sheet
 * (and uneven cells), so packed strips looked "picotadas" (chopped bodies).
 *
 * Re-slice COMBO ATACK.png + JUTSU.png via per-row content islands, then
 * re-pack the curated alpha pack.
 *
 *   node scripts/process-deidara-reslice.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { keyGreenBackground, isContent } = require('./lib/chroma-green-bg');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'deidara');

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isScreenGreen(r, g, b) {
  return (
    (g >= 90 && g >= r + 40 && g >= b + 40) ||
    (g >= 70 && g >= r + 25 && g >= b + 25 && r <= 100 && b <= 100)
  );
}

function findBands(data, w, h, minH = 40) {
  const rd = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isScreenGreen(data[i], data[i + 1], data[i + 2])) continue;
      rd[y] += 1;
    }
  }
  const bands = [];
  let s = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && rd[y] > 8;
    if (filled && s < 0) s = y;
    if (!filled && s >= 0) {
      if (y - s >= minH) bands.push({ t: s, b: y });
      s = -1;
    }
  }
  return bands;
}

/**
 * Density runs in a row band. Merge near-touching strokes (limb / blur).
 * Split only true double-width islands with a deep valley.
 *
 * Optional `effectMergeGap`: after tight island detect, attach nearby right-side
 * debris / smoke islands (common on clay explosion rows) without gluing whole
 * consecutive body poses (those sit ~14px apart on Deidara row1).
 */
function cellsFromBand(
  data,
  w,
  band,
  { gapX = 3, minW = 18, thrRatio = 0.025, effectMergeGap = 0 } = {},
) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isScreenGreen(data[i], data[i + 1], data[i + 2])) continue;
      dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * thrRatio));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 6) raw.push({ l: xs, r: x });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= gapX) prev.r = c.r;
    else merged.push({ ...c });
  }

  const widths = merged.map((c) => c.r - c.l);
  const medW =
    widths.slice().sort((a, b) => a - b)[Math.floor(widths.length / 2)] || 40;

  let runs = [];
  for (const c of merged) {
    const cw = c.r - c.l;
    if (cw < minW) continue;
    if (cw < medW * 2.1) {
      runs.push({ l: c.l, r: c.r, t: band.t, b: band.b });
      continue;
    }
    const mid = Math.floor((c.l + c.r) / 2);
    let best = mid;
    let bestD = dens[mid] ?? 999;
    const lo = c.l + Math.floor(cw * 0.28);
    const hi = c.r - Math.floor(cw * 0.28);
    for (let x = lo; x <= hi; x += 1) {
      if (dens[x] < bestD) {
        bestD = dens[x];
        best = x;
      }
    }
    const peakLeft = Math.max(...dens.slice(c.l, best), 1);
    const peakRight = Math.max(...dens.slice(best, c.r), 1);
    const isValley = bestD <= Math.min(peakLeft, peakRight) * 0.32;
    if (!isValley) {
      runs.push({ l: c.l, r: c.r, t: band.t, b: band.b });
    } else {
      runs.push({ l: c.l, r: best, t: band.t, b: band.b });
      runs.push({ l: best, r: c.r, t: band.t, b: band.b });
    }
  }

  if (effectMergeGap > 0 && runs.length > 1) {
    const next = [];
    for (let i = 0; i < runs.length; i += 1) {
      const cur = { ...runs[i] };
      while (i + 1 < runs.length) {
        const cand = runs[i + 1];
        const gap = cand.l - cur.r;
        if (gap <= 0 || gap > effectMergeGap) break;
        const curW = cur.r - cur.l;
        const candW = cand.r - cand.l;
        // Attach side effects / smoke (often wide+sparse later) — never glue two medium body poses.
        const curIsBody = curW >= medW * 0.7 && curW <= medW * 1.55;
        const candIsBody = candW >= medW * 0.7 && candW <= medW * 1.55;
        const candLooksEffect = candW > medW * 1.4 || candW < medW * 0.55;
        if (curIsBody && candIsBody) break;
        if (!(curIsBody && candLooksEffect) && !(candLooksEffect && curW > medW * 0.5)) break;
        cur.r = cand.r;
        i += 1;
      }
      next.push(cur);
    }
    runs = next;
  }

  return runs
    .map((c) => ({
      l: Math.max(0, c.l - 1),
      r: Math.min(w, c.r + 1),
      t: band.t,
      b: band.b,
    }))
    .filter((c) => c.r - c.l >= minW);
}

function extractCell(data, w, cell, pad = 1) {
  const rawW = cell.r - cell.l;
  const rawH = cell.b - cell.t;
  const tmp = Buffer.alloc(rawW * rawH * 4);
  for (let y = 0; y < rawH; y += 1) {
    for (let x = 0; x < rawW; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * rawW + x) * 4;
      tmp[di] = data[si];
      tmp[di + 1] = data[si + 1];
      tmp[di + 2] = data[si + 2];
      tmp[di + 3] = data[si + 3];
    }
  }
  // Exterior green flood only (keep outlines / blondes)
  keyGreenBackground(tmp, rawW, rawH, { stripLabels: false });

  let minX = rawW;
  let maxX = -1;
  let minY = rawH;
  let maxY = -1;
  let op = 0;
  for (let y = 0; y < rawH; y += 1) {
    for (let x = 0; x < rawW; x += 1) {
      if (!isContent(tmp, (y * rawW + x) * 4)) continue;
      // leftover pure screen green after key
      const i = (y * rawW + x) * 4;
      if (isScreenGreen(tmp[i], tmp[i + 1], tmp[i + 2]) && greenness(tmp[i], tmp[i + 1], tmp[i + 2]) >= 40) {
        continue;
      }
      op += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || op < 80) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const fw = bw + pad * 2;
  const fh = bh + pad * 2;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const si = ((minY + y) * rawW + (minX + x)) * 4;
      if (!isContent(tmp, si)) continue;
      if (isScreenGreen(tmp[si], tmp[si + 1], tmp[si + 2]) && greenness(tmp[si], tmp[si + 1], tmp[si + 2]) >= 40) {
        continue;
      }
      const di = ((y + pad) * fw + (x + pad)) * 4;
      frame[di] = tmp[si];
      frame[di + 1] = tmp[si + 1];
      frame[di + 2] = tmp[si + 2];
      frame[di + 3] = 255;
    }
  }
  return { frame, fw, fh, op, bw, bh };
}

async function writeFrames(outDir, frames) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(outDir, f));
  }
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
    await sharp(f.frame, { raw: { width: f.fw, height: f.fh, channels: 4 } })
      .png()
      .toFile(path.join(outDir, name));
  }
}

function splitThirds(n) {
  const a = Math.floor(n / 3);
  const b = Math.floor(n / 3);
  const c = n - a - b;
  return [a, b, c];
}

async function sliceSheet(sheetPath, outDir, opts = {}) {
  const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const bands = findBands(data, w, h, opts.minBandH ?? 30);
  if (!bands.length) throw new Error(`No row bands in ${sheetPath}`);

  /** Optional per-row cell option overrides (effectMergeGap on explosion row). */
  const rowCellOpts = opts.rowCellOpts || null;
  const baseCell = opts.cell || {};

  const cells = [];
  for (let bi = 0; bi < bands.length; bi += 1) {
    const band = bands[bi];
    const cellOpts = rowCellOpts && rowCellOpts[bi] ? { ...baseCell, ...rowCellOpts[bi] } : { ...baseCell };
    const row = cellsFromBand(data, w, band, cellOpts);
    console.log(
      `  band y=${band.t}..${band.b - 1} gapX=${cellOpts.gapX ?? 3} effectMerge=${
        cellOpts.effectMergeGap ?? 0
      } cells=${row.length} w=[${row.map((c) => c.r - c.l).join(',')}]`,
    );
    cells.push(...row);
  }

  const frames = [];
  for (const cell of cells) {
    const cut = extractCell(data, w, cell);
    if (!cut) continue;
    // Drop flecks / half-pixel noise left after valley split
    if (cut.op < (opts.minOp ?? 200) || cut.bw < (opts.minW ?? 16) || cut.bh < (opts.minH ?? 18)) {
      continue;
    }
    frames.push(cut);
  }

  // Drop smoke/debris-only islands (short height vs body poses).
  if (opts.bodyHeightRatio != null && frames.length >= 4) {
    const heights = frames.map((f) => f.bh).sort((a, b) => a - b);
    const medH = heights[Math.floor(heights.length / 2)] || 1;
    const minBodyH = Math.floor(medH * opts.bodyHeightRatio);
    const before = frames.length;
    const kept = frames.filter((f) => f.bh >= minBodyH);
    console.log(
      `  bodyHeight filter medH=${medH} min=${minBodyH} kept ${kept.length}/${before}`,
    );
    frames.length = 0;
    frames.push(...kept);
  }

  console.log(`  kept ${frames.length} frames -> ${path.relative(ROOT, outDir)}`);
  await writeFrames(outDir, frames);
  return frames.length;
}

async function main() {
  console.log('=== Reslice Deidara combo (2-row content islands) ===');
  const comboN = await sliceSheet(
    path.join(SRC, 'combo', 'COMBO ATACK.png'),
    path.join(SRC, 'combo'),
    {
      minBandH: 40,
      // Drop flecks between motion trails (noise islands ~200–500px).
      minOp: 700,
      minW: 28,
      minH: 40,
      // Smoke/debris pockets are ~half body height on the explosion row.
      bodyHeightRatio: 0.7,
      // Two-row combo sheet: per-pose content islands only (do not glue
      // consecutive bodies — they sit ~14px apart on the explosion row).
      cell: { gapX: 3, minW: 26, thrRatio: 0.02, effectMergeGap: 0 },
      rowCellOpts: null,
    },
  );

  console.log('=== Reslice Deidara jutsu (content islands) ===');
  // Only the solid cast poses (+ bird). Source ends include shredded streaks.
  const jutsuN = await sliceSheet(path.join(SRC, 'jutsu', 'JUTSU.png'), path.join(SRC, 'jutsu'), {
    minBandH: 20,
    minOp: 200,
    minW: 14,
    minH: 28,
    bodyHeightRatio: 0.55,
    cell: { gapX: 4, minW: 12, thrRatio: 0.02 },
  });

  const comboSplits = splitThirds(comboN);
  console.log(`\n=== Pack curated deidara (combo=${comboN} splits=${comboSplits} jutsu=${jutsuN}) ===`);

  const result = await processCuratedAlphaPack({
    id: 'deidara',
    srcDir: SRC,
    outDir: path.join(ROOT, 'public', 'sprites', 'player', 'deidara'),
    previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'deidara.png'),
    metaJson: path.join(ROOT, 'public', 'sprites', 'player', 'deidara', 'meta.json'),
    qaDir: path.join(ROOT, 'assets-src', '_qa', 'deidara'),
    expected: { idle: 4, walk: 6, combo: comboN, damage: 5, jutsu: jutsuN },
    comboSplits,
    jutsu: {
      file: 'kijutsu.png',
      metaKey: 'deidara-kijutsu',
      skillMetaKey: 'skill-c2-dragon',
      frameRate: 12,
      hitFrame1based: Math.max(1, Math.round(jutsuN * 0.75)),
    },
  });

  console.log('\nwire hint:', JSON.stringify(result, null, 2));
  console.log('\nDONE. Update character-packs.ts frame sizes from meta.json if needed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
