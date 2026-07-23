/**
 * One-shot: process sasuke-classic chidori-full.png → classic/chidori.png
 * Light blue/cyan chroma, bottom-align frames, update meta.json.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_IN =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || "",
    ".cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets",
    "c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-e01b9ba1-21b5-42bb-b555-963c77ff9966.png"
  );
const SRC_DIR = path.join(ROOT, "assets", "naruto-source", "sasuke-classic");
const SRC = path.join(SRC_DIR, "chidori-full.png");
const OUT = path.join(ROOT, "public", "sprites", "player", "sasuke", "classic");
const OUT_PNG = path.join(OUT, "chidori.png");
const META_PATH = path.join(OUT, "meta.json");

const TOL = 40;

function isClearlyCyanBg(r, g, b) {
  // high B and G, blue-green/cyan-ish screen (not navy clothes)
  return (
    g >= 90 &&
    b >= 100 &&
    b >= r + 20 &&
    g >= r + 10 &&
    (g + b) / 2 > r + 25 &&
    Math.abs(g - b) <= 60
  );
}

function isNearChroma(r, g, b, chroma, tol) {
  return (
    Math.abs(r - chroma[0]) <= tol &&
    Math.abs(g - chroma[1]) <= tol &&
    Math.abs(b - chroma[2]) <= tol
  );
}

function isKeyable(r, g, b, chroma, tol) {
  const lum = (r + g + b) / 3;
  // Preserve dark hair / navy clothes unless clearly cyan/blue-green bg
  if (lum < 45 && !isClearlyCyanBg(r, g, b)) return false;

  if (isNearChroma(r, g, b, chroma, tol)) return true;

  // Broader light-blue / cyan screen (AA fringes)
  if (
    lum >= 45 &&
    r >= 70 &&
    r <= 200 &&
    g >= 120 &&
    g <= 230 &&
    b >= 140 &&
    b <= 240 &&
    b > r + 15 &&
    g > r + 5 &&
    Math.abs(g - b) <= 55
  ) {
    return true;
  }

  return false;
}

function isNearBlack(r, g, b) {
  return r < 40 && g < 40 && b < 40;
}

function findRowBands(data, w, h, ch, chroma, tol) {
  const dens = [];
  for (let y = 0; y < h; y++) {
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
  const thr = Math.max(8, Math.floor(w * 0.012));
  const bands = [];
  let inB = false,
    start = 0;
  for (let y = 0; y < h; y++) {
    if (dens[y] > thr) {
      if (!inB) {
        inB = true;
        start = y;
      }
    } else if (inB) {
      if (y - start >= 28) bands.push({ top: start, bottom: y });
      inB = false;
    }
  }
  if (inB && h - start >= 28) bands.push({ top: start, bottom: h });
  return { bands, dens, thr };
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

/** Tight content bbox inside a rect (after keying conceptually). */
function contentBBoxInRect(data, w, ch, rect, chroma, tol) {
  let minX = rect.width,
    minY = rect.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const si = ((rect.top + y) * w + (rect.left + x)) * ch;
      const r = data[si],
        g = data[si + 1],
        b = data[si + 2];
      if (!isKeyable(r, g, b, chroma, tol)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, cw: maxX - minX + 1, chh: maxY - minY + 1 };
}

function extractBottomAligned(data, w, h, ch, rects, chroma, tol) {
  // Measure content sizes for uniform pad
  const boxes = rects.map((rect) => contentBBoxInRect(data, w, ch, rect, chroma, tol));
  const frameWidth = Math.max(
    ...boxes.map((b, i) => (b ? b.cw + 4 : rects[i].width))
  );
  const frameHeight = Math.max(
    ...boxes.map((b, i) => (b ? b.chh + 4 : rects[i].height))
  );

  const frames = rects.map((rect, i) => {
    const frame = Buffer.alloc(frameWidth * frameHeight * ch);
    for (let j = 0; j < frameWidth * frameHeight; j++) frame[j * ch + 3] = 0;
    const box = boxes[i];
    if (!box) return frame;

    const pad = 2;
    const srcLeft = rect.left + box.minX;
    const srcTop = rect.top + box.minY;
    const cw = box.cw;
    const chh = box.chh;
    const xOff = Math.floor((frameWidth - cw) / 2);
    const yOff = frameHeight - chh - pad; // bottom-align (2px pad under feet)

    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((srcTop + y) * w + (srcLeft + x)) * ch;
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

function stitchHorizontal(frames, fw, fh, ch) {
  const n = frames.length;
  const outW = fw * n;
  const out = Buffer.alloc(outW * fh * ch);
  for (let f = 0; f < n; f++) {
    for (let y = 0; y < fh; y++) {
      frames[f].copy(
        out,
        (y * outW + f * fw) * ch,
        y * fw * ch,
        y * fw * ch + fw * ch
      );
    }
  }
  return { data: out, width: outW, height: fh };
}

async function main() {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(SRC_IN, SRC);
  console.log("copied ->", SRC);

  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height,
    ch = info.channels;
  console.log("source size:", w + "x" + h);

  // Sample chroma from corners / top edge
  function px(x, y) {
    const i = (y * w + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  }
  // Corners are pure screen; avoid mid-edge samples that can hit sprites.
  const samples = [px(2, 2), px(w - 3, 2), px(Math.floor(w / 2), 2)];
  const chroma = [
    Math.round(samples.reduce((s, p) => s + p[0], 0) / samples.length),
    Math.round(samples.reduce((s, p) => s + p[1], 0) / samples.length),
    Math.round(samples.reduce((s, p) => s + p[2], 0) / samples.length),
  ];
  console.log("chroma samples", samples, "->", chroma, "tol", TOL);

  let { bands, dens, thr } = findRowBands(data, w, h, ch, chroma, TOL);
  console.log("row dens thr", thr);
  console.log(
    "raw bands",
    bands.map((b) => ({ ...b, h: b.bottom - b.top }))
  );

  // Drop credit-text band at bottom (short / low density relative to sprites)
  // Keep the 3 tallest sprite bands
  if (bands.length > 3) {
    const scored = bands
      .map((b, i) => {
        let sum = 0;
        for (let y = b.top; y < b.bottom; y++) sum += dens[y];
        return { b, i, h: b.bottom - b.top, dens: sum };
      })
      .sort((a, c) => c.dens - a.dens || c.h - a.h);
    bands = scored
      .slice(0, 3)
      .sort((a, c) => a.b.top - c.b.top)
      .map((s) => s.b);
    console.log(
      "kept 3 sprite bands",
      bands.map((b) => ({ ...b, h: b.bottom - b.top }))
    );
  }

  // Detect cells per row with gap tuning toward expected ~14, ~8, ~3
  const expected = [14, 8, 3];
  const gapCandidates = [4, 6, 8, 10, 12, 16, 20, 28, 36];
  const allRects = [];
  const rowLayout = [];

  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi];
    const rowH = band.bottom - band.top;
    let best = null;
    for (const gap of gapCandidates) {
      for (const minW of [12, 16, 20, 24, 28]) {
        const cells = findContentCells(
          data,
          w,
          band.top,
          band.bottom,
          ch,
          chroma,
          TOL,
          gap,
          minW
        );
        const err = Math.abs(cells.length - (expected[bi] || cells.length));
        const score = err * 1000 + Math.abs(gap) * 0.01 + minW * 0.001;
        if (
          !best ||
          err < best.err ||
          (err === best.err && score < best.score)
        ) {
          best = { cells, gap, minW, err, score, n: cells.length };
        }
      }
    }
    console.log(
      "row",
      bi,
      "best n=" + best.n,
      "gap",
      best.gap,
      "minW",
      best.minW,
      "err",
      best.err,
      best.cells.map((c) => c.left + "-" + c.right + "(" + c.width + ")").join(" | ")
    );
    rowLayout.push(best.n);
    const pad = 2;
    for (const c of best.cells) {
      const left = Math.max(0, c.left - pad);
      const right = Math.min(w, c.right + pad);
      allRects.push({
        left,
        top: band.top,
        width: right - left,
        height: rowH,
        row: bi,
      });
    }
  }

  console.log("rowLayout", rowLayout, "total", allRects.length);

  const extracted = extractBottomAligned(data, w, h, ch, allRects, chroma, TOL);
  const sheet = stitchHorizontal(
    extracted.frames,
    extracted.frameWidth,
    extracted.frameHeight,
    ch
  );

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(OUT_PNG);

  let a0 = 0,
    darkOpaque = 0,
    cyanOpaque = 0;
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
      if (isClearlyCyanBg(r, g, b) && lum >= 100) cyanOpaque++;
    }
  }

  console.log(
    "output",
    sheet.width + "x" + sheet.height,
    "fw=" + extracted.frameWidth,
    "fh=" + extracted.frameHeight,
    "count=" + extracted.frames.length,
    "alpha0=" + ((100 * a0) / total).toFixed(1) + "%",
    "darkOpaque=" + darkOpaque,
    "cyanOpaque=" + cyanOpaque
  );

  const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  meta.chidori = {
    frameWidth: extracted.frameWidth,
    frameHeight: extracted.frameHeight,
    frameCount: extracted.frames.length,
    image: "chidori.png",
    outputSize: { width: sheet.width, height: sheet.height },
    chroma: { r: chroma[0], g: chroma[1], b: chroma[2], tolerance: TOL },
    source: "chidori-full.png",
    sourceSize: { width: w, height: h },
    rowLayout,
    note:
      "Chidori full sheet flattened L->R top->bottom (" +
      extracted.frames.length +
      " frames), bottom-aligned",
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n", "utf8");

  console.log("\n=== RESULT ===");
  console.log("source size:", w + "x" + h);
  console.log("frameWidth:", extracted.frameWidth);
  console.log("frameHeight:", extracted.frameHeight);
  console.log("frameCount:", extracted.frames.length);
  console.log("output size:", sheet.width + "x" + sheet.height);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
