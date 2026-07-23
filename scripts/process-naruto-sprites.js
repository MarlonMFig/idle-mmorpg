/**
 * Process Naruto sprite sheets for Phaser:
 * - Crop black title / next-section bars
 * - Chroma-key teal/green backgrounds + cyan separator lines
 * - Extract equal frames; trim 1px separator edges
 * - Write meta.json + verification stats
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "naruto-source");
const OUT = path.join(ROOT, "public", "sprites", "player");

const TOL = 40;

const JOBS = [
  {
    key: "naruto-walk",
    file: "walking.png",
    out: "naruto-walk.png",
    chroma: [50, 200, 150],
    cols: 6,
  },
  {
    key: "naruto-combo1",
    file: "combo1.png",
    out: "naruto-combo1.png",
    chroma: [50, 200, 150],
    cols: 4,
  },
  {
    key: "naruto-rasengan",
    file: "rasengan-full.png",
    out: "naruto-rasengan.png",
    chroma: [80, 150, 80],
    cols: 6,
    multiRow: true,
    // Row1: 6 cells; row2: 2 cells under first two of row1 (same cell width).
    rowCols: [6, 2],
  },
  {
    key: "naruto-rasengan2",
    file: "rasengan2.png",
    out: "naruto-rasengan2.png",
    chroma: [80, 150, 80],
    cols: 6,
    multiRow: true,
  },
  {
    key: "naruto-sexy-jutsu",
    file: "sexy-jutsu.png",
    out: "naruto-sexy-jutsu.png",
    chroma: [144, 176, 216],
    tol: 45,
    multiRow: true,
    irregular: true,
    // Row1/3: content islands; row2: equal 10-col (clearest grid). 10+10+3=23
    rowModes: [
      { mode: "cells", gap: 8, minW: 18 },
      { mode: "equal", cols: 10 },
      { mode: "cells", gap: 12, minW: 20 },
    ],
  },
];

/** Primary chroma key (teal or green screen). */
function isChroma(r, g, b, chroma, tol) {
  return (
    Math.abs(r - chroma[0]) <= tol &&
    Math.abs(g - chroma[1]) <= tol &&
    Math.abs(b - chroma[2]) <= tol
  );
}

/**
 * Near-cyan UI separator / chrome: high G and B, low R, G≈B.
 * Catches (0,128,128) grid lines without eating character blues.
 */
function isCyanSeparator(r, g, b) {
  return (
    r < 100 &&
    g > 95 &&
    b > 95 &&
    Math.abs(g - b) <= 40 &&
    (g + b) / 2 > r + 50
  );
}

function isKeyable(r, g, b, chroma, tol) {
  return isChroma(r, g, b, chroma, tol) || isCyanSeparator(r, g, b);
}

function isNearBlack(r, g, b) {
  return r < 40 && g < 40 && b < 40;
}

function rowStats(data, w, h, ch, y, chroma, tol) {
  let black = 0,
    chrom = 0,
    other = 0;
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (isNearBlack(r, g, b)) black++;
    else if (isKeyable(r, g, b, chroma, tol)) chrom++;
    else other++;
  }
  return { black, chrom, other };
}

function findContentBounds(data, w, h, ch, chroma, tol) {
  let first = -1,
    last = -1;
  for (let y = 0; y < h; y++) {
    const s = rowStats(data, w, h, ch, y, chroma, tol);
    // Prefer rows dominated by the primary screen color (not just cyan chrome).
    let primary = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (isChroma(data[i], data[i + 1], data[i + 2], chroma, tol)) primary++;
    }
    if (primary / w >= 0.15 || (s.chrom / w >= 0.35 && primary / w >= 0.05)) {
      if (first < 0) first = y;
      last = y;
    }
  }
  if (first < 0) {
    // Fallback: any keyable density
    for (let y = 0; y < h; y++) {
      const s = rowStats(data, w, h, ch, y, chroma, tol);
      if (s.chrom / w >= 0.2) {
        if (first < 0) first = y;
        last = y;
      }
    }
  }
  if (first < 0) throw new Error("No chroma content rows found");

  // Trim trailing cyan-only / next-section chrome: walk back while primary is scarce.
  while (last > first) {
    let primary = 0;
    for (let x = 0; x < w; x++) {
      const i = (last * w + x) * ch;
      if (isChroma(data[i], data[i + 1], data[i + 2], chroma, tol)) primary++;
    }
    if (primary / w >= 0.08) break;
    last--;
  }
  return { top: first, bottom: last + 1 };
}

function findRowBands(data, w, y0, y1, ch, chroma, tol) {
  const dens = [];
  for (let y = y0; y < y1; y++) {
    let other = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!isKeyable(r, g, b, chroma, tol) && !isNearBlack(r, g, b)) other++;
    }
    dens.push(other);
  }
  const thr = Math.max(8, Math.floor(w * 0.015));
  const bands = [];
  let inBand = false,
    start = 0;
  for (let i = 0; i < dens.length; i++) {
    if (dens[i] > thr) {
      if (!inBand) {
        inBand = true;
        start = i;
      }
    } else if (inBand) {
      const hgt = i - start;
      if (hgt >= 40) bands.push({ top: start + y0, bottom: i + y0 });
      inBand = false;
    }
  }
  if (inBand) {
    const hgt = dens.length - start;
    if (hgt >= 40) bands.push({ top: start + y0, bottom: dens.length + y0 });
  }
  if (bands.length === 0) return [{ top: y0, bottom: y1 }];

  const nominal = Math.min(...bands.map((b) => b.bottom - b.top));
  const split = [];
  for (const b of bands) {
    const hgt = b.bottom - b.top;
    const n = Math.max(1, Math.floor(hgt / nominal));
    if (n === 1) {
      split.push(b);
    } else {
      const rowH = Math.floor(hgt / n);
      for (let i = 0; i < n; i++) {
        const top = b.top + i * rowH;
        const bottom = i === n - 1 ? b.bottom : b.top + (i + 1) * rowH;
        split.push({ top, bottom });
      }
    }
  }
  return split;
}

function chromaKeyRaw(data, w, h, ch, chroma, tol) {
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    const r = out[o],
      g = out[o + 1],
      b = out[o + 2];
    if (isKeyable(r, g, b, chroma, tol)) {
      out[o + 3] = 0;
    }
  }
  return out;
}

function columnIsMostlySeparator(frame, fw, fh, ch, x, chroma, tol) {
  let key = 0;
  let opaque = 0;
  for (let y = 0; y < fh; y++) {
    const o = (y * fw + x) * ch;
    const r = frame[o],
      g = frame[o + 1],
      b = frame[o + 2],
      a = frame[o + 3];
    if (a < 16) {
      key++;
      continue;
    }
    opaque++;
    if (isKeyable(r, g, b, chroma, tol)) key++;
  }
  // Mostly separator / already transparent, or opaque pixels are mostly keyable
  return key / fh >= 0.55 || (opaque > 0 && key >= opaque * 0.7);
}

function trimFrameSeparators(frame, fw, fh, ch, chroma, tol) {
  let x0 = 0;
  let x1 = fw;
  if (fw > 2 && columnIsMostlySeparator(frame, fw, fh, ch, 0, chroma, tol)) {
    x0 = 1;
  }
  if (
    fw - x0 > 2 &&
    columnIsMostlySeparator(frame, fw, fh, ch, fw - 1, chroma, tol)
  ) {
    x1 = fw - 1;
  }
  if (x0 === 0 && x1 === fw) return { frame, frameWidth: fw };

  const nw = x1 - x0;
  const out = Buffer.alloc(nw * fh * ch);
  for (let y = 0; y < fh; y++) {
    const srcOff = (y * fw + x0) * ch;
    const dstOff = y * nw * ch;
    frame.copy(out, dstOff, srcOff, srcOff + nw * ch);
  }
  return { frame: out, frameWidth: nw };
}

function extractEqualFrames(raw, w, h, ch, cols, chroma, tol) {
  const fw = Math.floor(w / cols);
  const frames = [];
  let frameWidth = fw;
  for (let c = 0; c < cols; c++) {
    const frame = Buffer.alloc(fw * h * ch);
    for (let y = 0; y < h; y++) {
      const srcOff = (y * w + c * fw) * ch;
      const dstOff = y * fw * ch;
      raw.copy(frame, dstOff, srcOff, srcOff + fw * ch);
    }
    const trimmed = trimFrameSeparators(frame, fw, h, ch, chroma, tol);
    frames.push(trimmed.frame);
    frameWidth = trimmed.frameWidth;
  }

  // Normalize all frames to the same width (min after trim, pad transparent if needed)
  const minW = Math.min(...frames.map((_, i) => {
    // recompute: all should share frameWidth if trim was consistent
    return frames[i].length / (h * ch);
  }));
  const normW = Math.floor(minW);
  const normalized = frames.map((fr) => {
    const curW = fr.length / (h * ch);
    if (curW === normW) return fr;
    const out = Buffer.alloc(normW * h * ch);
    for (let i = 0; i < normW * h; i++) out[i * ch + 3] = 0;
    const copyW = Math.min(curW, normW);
    for (let y = 0; y < h; y++) {
      fr.copy(out, y * normW * ch, y * curW * ch, y * curW * ch + copyW * ch);
    }
    return out;
  });

  return { frames: normalized, frameWidth: normW, frameHeight: h };
}

function padFrameVertical(frame, fw, fh, ch, targetFh) {
  if (fh === targetFh) return frame;
  const out = Buffer.alloc(fw * targetFh * ch);
  for (let i = 0; i < fw * targetFh; i++) {
    out[i * ch + 3] = 0;
  }
  const yOff = Math.floor((targetFh - fh) / 2);
  for (let y = 0; y < fh; y++) {
    frame.copy(out, (yOff + y) * fw * ch, y * fw * ch, (y + 1) * fw * ch);
  }
  return out;
}

function stitchHorizontal(frames, fw, fh, ch) {
  const n = frames.length;
  const outW = fw * n;
  const out = Buffer.alloc(outW * fh * ch);
  for (let f = 0; f < n; f++) {
    for (let y = 0; y < fh; y++) {
      const srcOff = y * fw * ch;
      const dstOff = (y * outW + f * fw) * ch;
      frames[f].copy(out, dstOff, srcOff, srcOff + fw * ch);
    }
  }
  return { data: out, width: outW, height: fh };
}

function verifySheet(data, w, h, ch, label) {
  const total = w * h;
  let a0 = 0;
  let cyanOpaque = 0;
  let chromaOpaque = 0;
  for (let i = 0; i < total; i++) {
    const o = i * ch;
    const r = data[o],
      g = data[o + 1],
      b = data[o + 2],
      a = data[o + 3];
    if (a === 0) a0++;
    else {
      if (isCyanSeparator(r, g, b)) cyanOpaque++;
      // leftover primary-ish screens
      if (
        (Math.abs(r - 50) <= 40 && Math.abs(g - 200) <= 40 && Math.abs(b - 150) <= 40) ||
        (Math.abs(r - 80) <= 40 && Math.abs(g - 150) <= 40 && Math.abs(b - 80) <= 40)
      ) {
        chromaOpaque++;
      }
    }
  }
  const a0pct = (100 * a0) / total;
  console.log(
    "  verify " + label + ":",
    "alpha0=" + a0 + " (" + a0pct.toFixed(1) + "%)",
    "cyanOpaque=" + cyanOpaque,
    "chromaOpaque=" + chromaOpaque,
    a0pct > 20 && cyanOpaque === 0 ? "OK" : "CHECK"
  );
  return { a0, a0pct, cyanOpaque, chromaOpaque };
}


function findContentCells(data, w, y0, y1, ch, chroma, tol, gapMax, minW) {
  const rh = y1 - y0;
  const cd = new Array(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (!isKeyable(data[i], data[i + 1], data[i + 2], chroma, tol)) cd[x]++;
    }
  }
  const cthr = Math.max(4, Math.floor(rh * 0.1));
  const raw = [];
  let inC = false,
    start = 0;
  for (let x = 0; x < w; x++) {
    if (cd[x] > cthr) {
      if (!inC) {
        inC = true;
        start = x;
      }
    } else if (inC) {
      raw.push({ l: start, r: x });
      inC = false;
    }
  }
  if (inC) raw.push({ l: start, r: w });
  const merged = [];
  for (const c of raw) {
    if (!merged.length) {
      merged.push({ ...c });
      continue;
    }
    const prev = merged[merged.length - 1];
    if (c.l - prev.r <= gapMax) prev.r = c.r;
    else merged.push({ ...c });
  }
  return merged
    .filter((c) => c.r - c.l >= minW)
    .map((c) => ({ left: c.l, right: c.r, width: c.r - c.l }));
}

function extractIrregularFrames(data, w, h, ch, bands, rowModes, chroma, tol) {
  const rects = [];
  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi];
    const rowH = band.bottom - band.top;
    const mode = rowModes[bi] || { mode: "equal", cols: 10 };
    if (mode.mode === "equal") {
      const cols = mode.cols;
      const fw = Math.floor(w / cols);
      for (let c = 0; c < cols; c++) {
        rects.push({ left: c * fw, top: band.top, width: fw, height: rowH });
      }
    } else {
      const cells = findContentCells(
        data,
        w,
        band.top,
        band.bottom,
        ch,
        chroma,
        tol,
        mode.gap || 8,
        mode.minW || 18
      );
      const pad = 2;
      for (const c of cells) {
        const left = Math.max(0, c.left - pad);
        const right = Math.min(w, c.right + pad);
        rects.push({
          left,
          top: band.top,
          width: right - left,
          height: rowH,
        });
      }
    }
  }
  const frameWidth = Math.max(...rects.map((r) => r.width));
  const frameHeight = Math.max(...rects.map((r) => r.height));
  const frames = rects.map((rect) => {
    const frame = Buffer.alloc(frameWidth * frameHeight * ch);
    for (let i = 0; i < frameWidth * frameHeight; i++) frame[i * ch + 3] = 0;
    const xOff = Math.floor((frameWidth - rect.width) / 2);
    const yOff = Math.floor((frameHeight - rect.height) / 2);
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const si = ((rect.top + y) * w + (rect.left + x)) * ch;
        const r = data[si],
          g = data[si + 1],
          b = data[si + 2];
        const di = ((yOff + y) * frameWidth + (xOff + x)) * ch;
        if (isKeyable(r, g, b, chroma, tol)) {
          frame[di + 3] = 0;
        } else {
          frame[di] = r;
          frame[di + 1] = g;
          frame[di + 2] = b;
          frame[di + 3] = 255;
        }
      }
    }
    return frame;
  });
  return { frames, frameWidth, frameHeight };
}

async function processJob(job) {
  const input = path.join(SRC, job.file);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height,
    ch = info.channels;
  const chroma = job.chroma;
  const tol = job.tol || TOL;

  const bounds = findContentBounds(data, w, h, ch, chroma, tol);
  console.log(
    job.key + ":",
    w + "x" + h,
    "content y=" + bounds.top + ".." + (bounds.bottom - 1),
    "chroma RGB(" + chroma.join(",") + ") tol=" + tol
  );

  const bands = job.multiRow
    ? findRowBands(data, w, bounds.top, bounds.bottom, ch, chroma, tol)
    : [{ top: bounds.top, bottom: bounds.bottom }];

  console.log(
    "  bands:",
    bands.map((b) => b.top + "-" + (b.bottom - 1) + " h=" + (b.bottom - b.top))
  );


  if (job.irregular && Array.isArray(job.rowModes)) {
    const extracted = extractIrregularFrames(
      data,
      w,
      h,
      ch,
      bands,
      job.rowModes,
      chroma,
      tol
    );
    const sheet = stitchHorizontal(
      extracted.frames,
      extracted.frameWidth,
      extracted.frameHeight,
      ch
    );
    const outPath = path.join(OUT, job.out);
    await sharp(sheet.data, {
      raw: { width: sheet.width, height: sheet.height, channels: 4 },
    })
      .png()
      .toFile(outPath);
    verifySheet(sheet.data, sheet.width, sheet.height, ch, job.out);
    const rowLayout = job.rowModes.map((m, i) =>
      m.mode === "equal"
        ? m.cols
        : findContentCells(
            data,
            w,
            bands[i].top,
            bands[i].bottom,
            ch,
            chroma,
            tol,
            m.gap || 8,
            m.minW || 18
          ).length
    );
    const meta = {
      frameWidth: extracted.frameWidth,
      frameHeight: extracted.frameHeight,
      frameCount: extracted.frames.length,
      image: job.out,
      chroma: { r: chroma[0], g: chroma[1], b: chroma[2], tolerance: tol },
      sourceSize: { width: w, height: h },
      contentCrop: { top: bounds.top, bottom: bounds.bottom },
      outputSize: { width: sheet.width, height: sheet.height },
      rowLayout,
    };
    console.log(
      "  ->",
      job.out,
      sheet.width + "x" + sheet.height,
      "fw=" + extracted.frameWidth,
      "fh=" + extracted.frameHeight,
      "count=" + extracted.frames.length
    );
    return meta;
  }

  const targetFh = Math.max(...bands.map((b) => b.bottom - b.top));

  const allFrames = [];
  let frameWidth = 0;

  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi];
    const rowH = band.bottom - band.top;
    const slice = Buffer.alloc(w * rowH * ch);
    for (let y = 0; y < rowH; y++) {
      const srcOff = (band.top + y) * w * ch;
      data.copy(slice, y * w * ch, srcOff, srcOff + w * ch);
    }
    const keyed = chromaKeyRaw(slice, w, rowH, ch, chroma, tol);
    // Always slice on the full grid (job.cols); rowCols limits how many cells to keep.
    const extracted = extractEqualFrames(
      keyed,
      w,
      rowH,
      ch,
      job.cols,
      chroma,
      tol
    );
    frameWidth = extracted.frameWidth;
    const take =
      Array.isArray(job.rowCols) && job.rowCols[bi] != null
        ? job.rowCols[bi]
        : extracted.frames.length;
    for (let fi = 0; fi < take; fi++) {
      allFrames.push(
        padFrameVertical(extracted.frames[fi], frameWidth, rowH, ch, targetFh)
      );
    }
  }

  const sheet = stitchHorizontal(allFrames, frameWidth, targetFh, ch);
  const outPath = path.join(OUT, job.out);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  verifySheet(sheet.data, sheet.width, sheet.height, ch, job.out);

  const meta = {
    frameWidth,
    frameHeight: targetFh,
    frameCount: allFrames.length,
    image: job.out,
    chroma: { r: chroma[0], g: chroma[1], b: chroma[2], tolerance: tol },
    sourceSize: { width: w, height: h },
    contentCrop: { top: bounds.top, bottom: bounds.bottom },
    outputSize: { width: sheet.width, height: sheet.height },
  };
  console.log(
    "  ->",
    job.out,
    sheet.width + "x" + sheet.height,
    "fw=" + frameWidth,
    "fh=" + targetFh,
    "count=" + allFrames.length
  );
  return meta;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  for (const job of JOBS) {
    meta[job.key] = await processJob(job);
  }
  const metaPath = path.join(OUT, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log("\nWrote", metaPath);
  console.log(
    "\nSummary:",
    Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [
        k,
        {
          frameWidth: v.frameWidth,
          frameHeight: v.frameHeight,
          frameCount: v.frameCount,
        },
      ])
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
