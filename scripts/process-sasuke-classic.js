/**
 * Process classic Sasuke (Part 1) sprite sheets for Phaser.
 * Matches Naruto pipeline: crop title bars, safe green/teal chroma,
 * horizontal strips, preserve dark hair/navy clothes.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "naruto-source", "sasuke-classic");
const OUT = path.join(ROOT, "public", "sprites", "player", "sasuke", "classic");
const SKILL_OUT = path.join(ROOT, "public", "sprites", "skills");

const TOL = 38;

/** Safe chroma: never eat dark hair/navy unless clearly green. */
function isClearlyGreen(r, g, b) {
  return g > r + 30 && g > b + 20;
}

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
  const lum = (r + g + b) / 3;
  if (lum < 45 && !isClearlyGreen(r, g, b)) return false;

  if (isCyanSeparator(r, g, b)) return true;

  // Primary chroma target (per-job)
  if (
    Math.abs(r - chroma[0]) <= tol &&
    Math.abs(g - chroma[1]) <= tol &&
    Math.abs(b - chroma[2]) <= tol
  ) {
    return true;
  }

  // Bright lime screen (#88F800 / similar), include AA fringes
  if (g >= 170 && r >= 70 && r <= 190 && b <= 90 && isClearlyGreen(r, g, b)) {
    return true;
  }

  // Classic dark green #007000 / #007800
  if (r <= 45 && g >= 85 && g <= 165 && b <= 50 && isClearlyGreen(r, g, b)) {
    return true;
  }

  // Teal / turquoise screen edges (phoenix sheets)
  if (
    r < 70 &&
    g > 85 &&
    b > 55 &&
    Math.abs(g - b) <= 75 &&
    (g + b) / 2 > r + 35
  ) {
    return true;
  }

  // Mid green-dominant screen (not navy: b must not dominate)
  if (
    isClearlyGreen(r, g, b) &&
    g >= 100 &&
    r < g - 25 &&
    b < g - 25 &&
    b < 100
  ) {
    return true;
  }

  return false;
}

function isNearBlack(r, g, b) {
  return r < 40 && g < 40 && b < 40;
}

function chromaKeyRaw(data, w, h, ch, chroma, tol) {
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    if (isKeyable(out[o], out[o + 1], out[o + 2], chroma, tol)) {
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
    frame.copy(out, y * nw * ch, (y * fw + x0) * ch, (y * fw + x0) * ch + nw * ch);
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
      raw.copy(frame, y * fw * ch, (y * w + c * fw) * ch, (y * w + c * fw) * ch + fw * ch);
    }
    const trimmed = trimFrameSeparators(frame, fw, h, ch, chroma, tol);
    frames.push(trimmed.frame);
    frameWidth = trimmed.frameWidth;
  }
  const minW = Math.min(...frames.map((fr) => fr.length / (h * ch)));
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

function padFrame(frame, fw, fh, ch, targetFw, targetFh) {
  if (fw === targetFw && fh === targetFh) return frame;
  const out = Buffer.alloc(targetFw * targetFh * ch);
  for (let i = 0; i < targetFw * targetFh; i++) out[i * ch + 3] = 0;
  const xOff = Math.floor((targetFw - fw) / 2);
  const yOff = Math.floor((targetFh - fh) / 2);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const si = (y * fw + x) * ch;
      const di = ((yOff + y) * targetFw + (xOff + x)) * ch;
      out[di] = frame[si];
      out[di + 1] = frame[si + 1];
      out[di + 2] = frame[si + 2];
      out[di + 3] = frame[si + 3];
    }
  }
  return out;
}

function stitchHorizontal(frames, fw, fh, ch) {
  const n = frames.length;
  const outW = fw * n;
  const out = Buffer.alloc(outW * fh * ch);
  for (let f = 0; f < n; f++) {
    for (let y = 0; y < fh; y++) {
      frames[f].copy(out, (y * outW + f * fw) * ch, y * fw * ch, y * fw * ch + fw * ch);
    }
  }
  return { data: out, width: outW, height: fh };
}

function findContentCells(data, w, y0, y1, ch, chroma, tol, gapMax, minW) {
  const rh = y1 - y0;
  const cd = new Array(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!isKeyable(r, g, b, chroma, tol) && !isNearBlack(r, g, b)) cd[x]++;
    }
  }
  const cthr = Math.max(3, Math.floor(rh * 0.08));
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

function extractCellFrames(data, w, h, ch, bands, chroma, tol, opts) {
  const gapMax = opts.gapMax ?? 12;
  const minW = opts.minW ?? 20;
  const pad = opts.pad ?? 2;
  const rects = [];
  for (const band of bands) {
    const cells = findContentCells(
      data,
      w,
      band.top,
      band.bottom,
      ch,
      chroma,
      tol,
      gapMax,
      minW
    );
    const rowH = band.bottom - band.top;
    for (const c of cells) {
      const left = Math.max(0, c.left - pad);
      const right = Math.min(w, c.right + pad);
      rects.push({ left, top: band.top, width: right - left, height: rowH });
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

function extractGridFrames(data, w, h, ch, bands, cols, chroma, tol) {
  const targetFh = Math.max(...bands.map((b) => b.bottom - b.top));
  const allFrames = [];
  let frameWidth = 0;
  for (const band of bands) {
    const rowH = band.bottom - band.top;
    const slice = Buffer.alloc(w * rowH * ch);
    for (let y = 0; y < rowH; y++) {
      data.copy(slice, y * w * ch, (band.top + y) * w * ch, (band.top + y) * w * ch + w * ch);
    }
    const keyed = chromaKeyRaw(slice, w, rowH, ch, chroma, tol);
    const extracted = extractEqualFrames(keyed, w, rowH, ch, cols, chroma, tol);
    frameWidth = extracted.frameWidth;
    for (const fr of extracted.frames) {
      allFrames.push(padFrame(fr, frameWidth, rowH, ch, frameWidth, targetFh));
    }
  }
  return { frames: allFrames, frameWidth, frameHeight: targetFh };
}

async function writeSheet(frames, fw, fh, ch, outName) {
  const sheet = stitchHorizontal(frames, fw, fh, ch);
  const outPath = path.join(OUT, outName);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  let a0 = 0;
  let darkOpaque = 0;
  let greenOpaque = 0;
  const total = sheet.width * sheet.height;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const r = sheet.data[o],
      g = sheet.data[o + 1],
      b = sheet.data[o + 2],
      a = sheet.data[o + 3];
    if (a === 0) a0++;
    else {
      const lum = (r + g + b) / 3;
      if (lum < 45) darkOpaque++;
      if (isClearlyGreen(r, g, b) && g > 100 && lum >= 45) greenOpaque++;
    }
  }
  console.log(
    "  ->",
    outName,
    sheet.width + "x" + sheet.height,
    "fw=" + fw,
    "fh=" + fh,
    "count=" + frames.length,
    "alpha0=" + ((100 * a0) / total).toFixed(1) + "%",
    "darkOpaque=" + darkOpaque,
    "greenOpaque=" + greenOpaque
  );
  return {
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    image: outName,
    outputSize: { width: sheet.width, height: sheet.height },
  };
}

async function load(file) {
  const input = path.join(SRC, file);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

async function cropIconFromSheet(sheetPath, frameIndex, fw, fh, outPath, size) {
  const { data, info } = await sharp(sheetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const frame = Buffer.alloc(fw * fh * ch);
  for (let y = 0; y < fh; y++) {
    data.copy(
      frame,
      y * fw * ch,
      (y * info.width + frameIndex * fw) * ch,
      (y * info.width + frameIndex * fw) * ch + fw * ch
    );
  }
  // Tight crop opaque bounds
  let minX = fw,
    minY = fh,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (frame[(y * fw + x) * ch + 3] > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) {
    minX = 0;
    minY = 0;
    maxX = fw - 1;
    maxY = fh - 1;
  }
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(fw - 1, maxX + pad);
  maxY = Math.min(fh - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const chh = maxY - minY + 1;
  const cropped = Buffer.alloc(cw * chh * ch);
  for (let y = 0; y < chh; y++) {
    frame.copy(
      cropped,
      y * cw * ch,
      ((minY + y) * fw + minX) * ch,
      ((minY + y) * fw + minX) * ch + cw * ch
    );
  }
  await sharp(cropped, { raw: { width: cw, height: chh, channels: 4 } })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log("  icon", path.basename(outPath), size + "x" + size, "from frame", frameIndex);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SKILL_OUT, { recursive: true });
  const meta = {};

  // --- walk.png: 6 frames, crop title + partial next ---
  {
    const { data, w, h, ch } = await load("walking.png");
    const chroma = [0, 120, 0];
    const bands = [{ top: 27, bottom: 125 }];
    console.log("walk:", w + "x" + h, "bands", bands);
    const ex = extractGridFrames(data, w, h, ch, bands, 6, chroma, TOL);
    meta.walk = await writeSheet(ex.frames, ex.frameWidth, ex.frameHeight, ch, "walk.png");
    meta.walk.chroma = { r: 0, g: 120, b: 0, tolerance: TOL };
    meta.walk.source = "walking.png";
  }

  // --- combo1 / combo2 ---
  {
    const { data, w, h, ch } = await load("combos.png");
    const chroma = [0, 120, 0];
    console.log("combos:", w + "x" + h);
    const c1 = extractGridFrames(data, w, h, ch, [{ top: 12, bottom: 64 }], 4, chroma, TOL);
    meta.combo1 = await writeSheet(c1.frames, c1.frameWidth, c1.frameHeight, ch, "combo1.png");
    meta.combo1.chroma = { r: 0, g: 120, b: 0, tolerance: TOL };
    meta.combo1.source = "combos.png";

    const c2 = extractGridFrames(data, w, h, ch, [{ top: 78, bottom: 135 }], 4, chroma, TOL);
    meta.combo2 = await writeSheet(c2.frames, c2.frameWidth, c2.frameHeight, ch, "combo2.png");
    meta.combo2.chroma = { r: 0, g: 120, b: 0, tolerance: TOL };
    meta.combo2.source = "combos.png";
  }

  // --- Phoenix Flower (Hosenka) ---
  {
    const { data, w, h, ch } = await load("phoenix-flower.png");
    // Mixed lime + teal; primary lime
    const chroma = [136, 248, 0];
    console.log("phoenix-flower:", w + "x" + h);

    // Start: hand seals (9) + lunge (2) — tighter gap on lunge row
    const startSeals = extractCellFrames(
      data,
      w,
      h,
      ch,
      [{ top: 37, bottom: 124 }],
      chroma,
      TOL,
      { gapMax: 15, minW: 40, pad: 2 }
    );
    const startLunge = extractCellFrames(
      data,
      w,
      h,
      ch,
      [{ top: 147, bottom: 228 }],
      chroma,
      TOL,
      { gapMax: 8, minW: 40, pad: 2 }
    );
    const startFw = Math.max(startSeals.frameWidth, startLunge.frameWidth);
    const startFh = Math.max(startSeals.frameHeight, startLunge.frameHeight);
    const startFrames = [
      ...startSeals.frames.map((fr) =>
        padFrame(fr, startSeals.frameWidth, startSeals.frameHeight, ch, startFw, startFh)
      ),
      ...startLunge.frames.map((fr) =>
        padFrame(fr, startLunge.frameWidth, startLunge.frameHeight, ch, startFw, startFh)
      ),
    ];
    const start = { frames: startFrames, frameWidth: startFw, frameHeight: startFh };
    meta["hosenka-start"] = await writeSheet(
      start.frames,
      start.frameWidth,
      start.frameHeight,
      ch,
      "hosenka-start.png"
    );
    meta["hosenka-start"].chroma = { r: 136, g: 248, b: 0, tolerance: TOL };
    meta["hosenka-start"].source = "phoenix-flower.png";
    meta["hosenka-start"].note = "hand seals + lunge";

    // Loop: holding pose, 8 equal-ish cells
    const loop = extractCellFrames(
      data,
      w,
      h,
      ch,
      [{ top: 273, bottom: 353 }],
      chroma,
      TOL,
      { gapMax: 10, minW: 40, pad: 2 }
    );
    meta["hosenka-loop"] = await writeSheet(
      loop.frames,
      loop.frameWidth,
      loop.frameHeight,
      ch,
      "hosenka-loop.png"
    );
    meta["hosenka-loop"].chroma = { r: 136, g: 248, b: 0, tolerance: TOL };
    meta["hosenka-loop"].source = "phoenix-flower.png";

    // Fire Effect 1
    const fx = extractCellFrames(
      data,
      w,
      h,
      ch,
      [{ top: 486, bottom: 563 }],
      chroma,
      TOL,
      { gapMax: 8, minW: 50, pad: 2 }
    );
    meta["hosenka-fx"] = await writeSheet(
      fx.frames,
      fx.frameWidth,
      fx.frameHeight,
      ch,
      "hosenka-fx.png"
    );
    meta["hosenka-fx"].chroma = { r: 136, g: 248, b: 0, tolerance: TOL };
    meta["hosenka-fx"].source = "phoenix-flower.png";
    meta["hosenka-fx"].note = "Fire Effect 1";
  }

  // --- Chidori Hit as primary attack strip (18 frames, 6x3 L→R top→bottom) ---
  {
    const { data, w, h, ch } = await load("chidori-hit.png");
    const chroma = [136, 248, 0];
    const hitBands = [
      { top: 36, bottom: 74 },
      { top: 90, bottom: 133 },
      { top: 144, bottom: 191 },
      { top: 209, bottom: 249 },
      { top: 268, bottom: 309 },
      { top: 327, bottom: 368 },
    ];
    console.log("chidori-hit:", w + "x" + h, "6 rows x 3 cols");
    const hit = extractCellFrames(data, w, h, ch, hitBands, chroma, TOL, {
      gapMax: 20,
      minW: 40,
      pad: 2,
    });
    if (hit.frames.length !== 18) {
      console.warn("WARNING: expected 18 hit frames, got", hit.frames.length);
    }
    meta.chidori = await writeSheet(
      hit.frames,
      hit.frameWidth,
      hit.frameHeight,
      ch,
      "chidori.png"
    );
    meta.chidori.chroma = { r: 136, g: 248, b: 0, tolerance: TOL };
    meta.chidori.source = "chidori-hit.png";
    meta.chidori.note = "Chidori Hit grid flattened L->R top->bottom (18 frames)";

    // Same strip also as chidori-hit.png for explicit naming
    meta["chidori-hit"] = await writeSheet(
      hit.frames,
      hit.frameWidth,
      hit.frameHeight,
      ch,
      "chidori-hit.png"
    );
    meta["chidori-hit"].chroma = meta.chidori.chroma;
    meta["chidori-hit"].source = "chidori-hit.png";
    meta["chidori-hit"].note = "same strip as chidori.png";
  }

  // Icons
  await cropIconFromSheet(
    path.join(OUT, "chidori.png"),
    8,
    meta.chidori.frameWidth,
    meta.chidori.frameHeight,
    path.join(SKILL_OUT, "sasuke-chidori.png"),
    64
  );
  await cropIconFromSheet(
    path.join(OUT, "hosenka-fx.png"),
    2,
    meta["hosenka-fx"].frameWidth,
    meta["hosenka-fx"].frameHeight,
    path.join(SKILL_OUT, "sasuke-hosenka.png"),
    64
  );

  const metaPath = path.join(OUT, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log("\nWrote", metaPath);

  console.log("\n=== OUTPUT TABLE ===");
  console.log(
    "file".padEnd(22),
    "WxH".padEnd(12),
    "fw".padEnd(6),
    "fh".padEnd(6),
    "frames"
  );
  for (const [k, v] of Object.entries(meta)) {
    console.log(
      v.image.padEnd(22),
      (v.outputSize.width + "x" + v.outputSize.height).padEnd(12),
      String(v.frameWidth).padEnd(6),
      String(v.frameHeight).padEnd(6),
      v.frameCount
    );
  }
  console.log("sasuke-chidori.png".padEnd(22), "64x64 (skill icon)");
  console.log("sasuke-hosenka.png".padEnd(22), "64x64 (skill icon)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


