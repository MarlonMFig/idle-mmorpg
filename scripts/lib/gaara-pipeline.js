/**
 * Pipeline comum Gaara — flood-key + strip uniforme.
 * Usado pelos process-gaara-*.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { keyBackground, isContent } = require('./chroma-black-bg');
const { resolveHqScale, resolvePackContentHeight, NATIVE_PIXELS } = require('./strip-hq-scale');

const LEGACY_TARGET_BODY_H = 48;
/** @deprecated Prefer HQ via resolveHqScale; kept for callers reading TARGET_BODY_H. */
const TARGET_BODY_H = NATIVE_PIXELS ? LEGACY_TARGET_BODY_H : LEGACY_TARGET_BODY_H;

async function loadKeyed(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = keyBackground(data, info.width, info.height);
  return { data: keyed, width: info.width, height: info.height };
}

function findBand(data, w, h, minDy = 18) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dy[y] += 1;
    }
  }
  let t = 0;
  let b = h;
  for (let y = 0; y < h; y += 1) {
    if (dy[y] > minDy) {
      t = y;
      break;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    if (dy[y] > 6) {
      b = y + 1;
      break;
    }
  }
  return { t, b, dy };
}

function cellsInBand(data, w, band, minW = 14, expectedFrames = 0) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.05));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= minW) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  let merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 4) prev.r = c.r;
    else merged.push({ ...c });
  }

  // thin spar glue only
  const glued = [];
  for (const c of merged) {
    const prev = glued[glued.length - 1];
    const cw = c.r - c.l;
    if (prev && cw < 24 && c.l - prev.r <= 6) {
      prev.r = c.r;
      continue;
    }
    glued.push({ ...c });
  }

  // split cells that are too wide (merged animation frames)
  const out = [];
  for (const c of glued) {
    const cw = c.r - c.l;
    if (cw <= 85) {
      out.push(c);
      continue;
    }
    const local = dens.slice(c.l, c.r);
    const maxD = Math.max(...local, 1);
    const cutThr = maxD * 0.22;
    const sm = local.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k += 1) {
        if (local[i + k] != null) {
          s += local[i + k];
          n += 1;
        }
      }
      return s / n;
    });
    let x0 = 0;
    const subs = [];
    for (let i = 1; i < sm.length - 1; i += 1) {
      if (sm[i] < cutThr && sm[i] <= sm[i - 1] && sm[i] <= sm[i + 1]) {
        if (i - x0 >= minW) {
          subs.push({ l: c.l + x0, r: c.l + i, t: c.t, b: c.b });
          x0 = i + 1;
        }
      }
    }
    if (sm.length - x0 >= minW) {
      subs.push({ l: c.l + x0, r: c.r, t: c.t, b: c.b });
    }
    if (subs.length >= 2) out.push(...subs);
    else {
      // even split
      const n = Math.max(2, Math.round(cw / 62));
      const fw = Math.round(cw / n);
      for (let i = 0; i < n; i += 1) {
        const l = c.l + i * fw;
        const r = i === n - 1 ? c.r : c.l + (i + 1) * fw;
        if (r - l >= minW) out.push({ l, r, t: c.t, b: c.b });
      }
    }
  }

  if (expectedFrames > 0 && out.length > 0) {
    const L = out[0].l;
    const R = out[out.length - 1].r;
    const span = R - L;
    const average = span / expectedFrames;
    const needsForce =
      out.length !== expectedFrames || out.some((c) => c.r - c.l > average * 1.55 || c.r - c.l < average * 0.45);
    if (needsForce && average >= minW) {
      const forced = [];
      for (let i = 0; i < expectedFrames; i += 1) {
        const l = Math.round(L + (i * span) / expectedFrames);
        const r = Math.round(L + ((i + 1) * span) / expectedFrames);
        forced.push({ l, r, t: band.t, b: band.b });
      }
      return forced;
    }
  }
  return out;
}

function extractCell(data, w, cell) {
  const fw = cell.r - cell.l;
  const fh = cell.b - cell.t;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * fw + x) * 4;
      if (!isContent(data, si)) {
        frame[di + 3] = 0;
        continue;
      }
      frame[di] = data[si];
      frame[di + 1] = data[si + 1];
      frame[di + 2] = data[si + 2];
      frame[di + 3] = 255;
    }
  }
  let minX = fw;
  let maxX = -1;
  let minY = fh;
  let maxY = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { frame, fw, fh, minX: 0, maxX: 0, minY: 0, maxY: 0, bw: 1, bh: 1 };
  }
  return {
    frame,
    fw,
    fh,
    minX,
    maxX,
    minY,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
  };
}

function normalize(cut, pad = 2) {
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const contentH0 = Math.round(cut.reduce((s, c) => s + c.bh, 0) / Math.max(1, cut.length));
  const frames = cut.map((box) => {
    const canvas = Buffer.alloc(cellW * cellH * 4);
    const dx = Math.floor((cellW - box.bw) / 2);
    const dy = cellH - box.bh - pad;
    for (let y = 0; y < box.bh; y += 1) {
      for (let x = 0; x < box.bw; x += 1) {
        const si = ((box.minY + y) * box.fw + (box.minX + x)) * 4;
        const di = ((dy + y) * cellW + dx + x) * 4;
        canvas[di] = box.frame[si];
        canvas[di + 1] = box.frame[si + 1];
        canvas[di + 2] = box.frame[si + 2];
        canvas[di + 3] = box.frame[si + 3];
      }
    }
    return canvas;
  });
  return { frames, cellW, cellH, contentHeight: contentH0 || cut[0].bh };
}

async function scaleFrames(frames, cellW, cellH, contentHeight, scaleOpts = { mode: 'idle' }) {
  const scale = resolveHqScale(contentHeight, scaleOpts);
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = resolvePackContentHeight(contentHeight, scale, scaleOpts);
  if (NATIVE_PIXELS) {
    console.log(
      `HQ gaara-pipeline scale=${scale.toFixed(4)} contentH=${outContent} ${cellW}x${cellH}→${outW}x${outH}`,
    );
  }
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // re-key residual charcoal after scale
    const cleaned = keyBackground(d, outW, outH);
    out.push(cleaned);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
}

function stitch(frames, fw, fh) {
  const sheetW = fw * frames.length;
  const sheetH = fh;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(
        sheet,
        (y * sheetW + index * fw) * 4,
        y * fw * 4,
        (y + 1) * fw * 4,
      );
    }
  });
  return { data: sheet, width: sheetW, height: sheetH };
}

async function writePng(filePath, data, width, height) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
}

function updateMeta(metaPath, key, entry) {
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta[key] = entry;
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

module.exports = {
  TARGET_BODY_H,
  loadKeyed,
  findBand,
  cellsInBand,
  extractCell,
  normalize,
  scaleFrames,
  stitch,
  writePng,
  updateMeta,
};
