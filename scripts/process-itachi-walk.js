/**
 * Uchiha Itachi walk — horizontal 6-frame strip (side-view RIGHT).
 * Solid black bg keyed via exterior flood-fill only (cloak interior stays).
 * Game flipX covers LEFT.
 *
 * Input (preferred):
 *   assets/naruto-source/nu/itachi-walk-sheet.png
 *   Single row, equal cells (fixed 6 or auto-detect).
 *
 * npm run itachi:walk
 * Saída: public/sprites/player/itachi/walk.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  isGreenBg,
  isLabelPixel,
  fillInteriorHoles,
} = require('./lib/chroma-green-bg');

const ROOT = path.resolve(__dirname, '..');
const SHEET = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'itachi-walk-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'itachi');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'itachi.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const TARGET_BODY_H = 48;
const FRAME_RATE = 10;
/** Default equal cell count when width divides cleanly. */
const EXPECTED_FRAMES = 6;

function isNearBlack(r, g, b) {
  return Math.max(r, g, b) <= 28;
}

/**
 * Exterior flood-fill: pure black bg + green outline.
 * Interior black cloak is never reached from edges.
 */
function keyBlackAndGreen(data, w, h) {
  const out = Buffer.from(data);
  const N = w * h;
  const exterior = new Uint8Array(N);
  const stack = [];

  const isKillable = (r, g, b, a) => {
    if (a < 16) return true;
    if (isGreenBg(r, g, b)) return true;
    if (isLabelPixel(r, g, b)) return true;
    // Neon green outline only (not cloak grey / clothing).
    if (g >= 80 && g - Math.max(r, b) >= 40) return true;
    if (isNearBlack(r, g, b)) return true;
    return false;
  };

  const tryExterior = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (exterior[idx]) return;
    const i = idx * 4;
    if (isKillable(out[i], out[i + 1], out[i + 2], out[i + 3])) {
      exterior[idx] = 1;
      stack.push(idx);
    }
  };

  for (let x = 0; x < w; x += 1) {
    tryExterior(x, 0);
    tryExterior(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryExterior(0, y);
    tryExterior(w - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    tryExterior(x + 1, y);
    tryExterior(x - 1, y);
    tryExterior(x, y + 1);
    tryExterior(x, y - 1);
  }

  for (let idx = 0; idx < N; idx += 1) {
    const i = idx * 4;
    if (exterior[idx]) {
      out[i + 3] = 0;
      continue;
    }
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (isGreenBg(r, g, b) || (g >= 80 && g - Math.max(r, b) >= 40)) {
      out[i + 3] = 0;
      continue;
    }
    if (g > Math.max(r, b) + 10 && g - Math.max(r, b) < 28) {
      out[i + 1] = Math.max(r, b);
    }
  }
  return out;
}

function detectEqualCellCount(w, h) {
  const candidates = [];
  for (let n = 2; n <= 16; n += 1) {
    if (w % n === 0) {
      const cellW = w / n;
      // Prefer roughly square-ish cells for walk strips.
      const aspect = Math.abs(cellW - h) / Math.max(cellW, h);
      candidates.push({ n, cellW, aspect });
    }
  }
  if (!candidates.length) return EXPECTED_FRAMES;
  const preferred = candidates.find((c) => c.n === EXPECTED_FRAMES);
  if (preferred) return preferred.n;
  candidates.sort((a, b) => a.aspect - b.aspect || b.n - a.n);
  return candidates[0].n;
}

function contentBBox(data, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, bw: 1, bh: 1 };
  return {
    minX,
    maxX,
    minY,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
  };
}

function cropToBBox(data, w, box) {
  const frame = Buffer.alloc(box.bw * box.bh * 4);
  for (let y = 0; y < box.bh; y += 1) {
    for (let x = 0; x < box.bw; x += 1) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * box.bw + x) * 4;
      frame[di] = data[si];
      frame[di + 1] = data[si + 1];
      frame[di + 2] = data[si + 2];
      frame[di + 3] = data[si + 3];
    }
  }
  return {
    frame,
    fw: box.bw,
    fh: box.bh,
    minX: 0,
    maxX: box.bw - 1,
    minY: 0,
    maxY: box.bh - 1,
    bw: box.bw,
    bh: box.bh,
  };
}

function extractEqualCells(keyed, w, h, frameCount) {
  const cuts = [];
  for (let i = 0; i < frameCount; i += 1) {
    const l = Math.round((i * w) / frameCount);
    const r = Math.round(((i + 1) * w) / frameCount);
    const fw = r - l;
    const cell = Buffer.alloc(fw * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const si = (y * w + l + x) * 4;
        const di = (y * fw + x) * 4;
        cell[di] = keyed[si];
        cell[di + 1] = keyed[si + 1];
        cell[di + 2] = keyed[si + 2];
        cell[di + 3] = keyed[si + 3];
      }
    }
    const box = contentBBox(cell, fw, h);
    if (box.bw < 4 || box.bh < 8) {
      throw new Error(`Empty content after keying: frame ${i}`);
    }
    cuts.push(cropToBBox(cell, fw, box));
  }
  return cuts;
}

function normalize(cut, pad = 2) {
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const contentH0 = Math.round(
    cut.slice(0, 2).reduce((s, c) => s + c.bh, 0) / Math.min(2, cut.length),
  );
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

async function scaleFrames(frames, cellW, cellH, contentHeight) {
  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentHeight));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isLabelPixel(r, g, b) || isGreenBg(r, g, b) || (g >= 80 && g - Math.max(r, b) >= 40)) {
        d[i + 3] = 0;
        continue;
      }
      if (g > Math.max(r, b) + 10 && g - Math.max(r, b) < 28) {
        d[i + 1] = Math.max(r, b);
      }
    }
    fillInteriorHoles(d, outW, outH, Math.max(24, Math.floor(outW * outH * 0.08)));
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
}

function stitch(frames, fw, fh) {
  const sheetW = fw * frames.length;
  const sheet = Buffer.alloc(sheetW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(sheet, (y * sheetW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: sheet, width: sheetW, height: fh };
}

async function main() {
  if (!fs.existsSync(SHEET)) {
    throw new Error(`Sheet not found: ${SHEET}`);
  }

  const { data: raw, info } = await sharp(SHEET).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameCount = detectEqualCellCount(info.width, info.height);
  console.log(
    `source: itachi-walk-sheet.png ${info.width}x${info.height} cells=${frameCount} cellW=${Math.round(info.width / frameCount)}`,
  );

  const keyed = keyBlackAndGreen(raw, info.width, info.height);
  const cuts = extractEqualCells(keyed, info.width, info.height, frameCount);

  const opaqueCounts = cuts.map((c) => {
    let n = 0;
    for (let i = 3; i < c.frame.length; i += 4) if (c.frame[i] >= 16) n += 1;
    return n;
  });
  console.log('opaque px/frame:', opaqueCounts.join(','));
  if (opaqueCounts.some((n) => n < 40)) {
    throw new Error('Frame vazio ou chroma agressivo demais');
  }

  const norm = normalize(cuts);
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'walk.png'));

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await sharp(scaled.frames[0], {
    raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  const entry = {
    image: '/sprites/player/itachi/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'itachi-walk-sheet.png',
    frameRate: FRAME_RATE,
    direction: 'right',
    note: '6-frame horizontal strip; exterior black (+ green) key; RIGHT only',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['itachi-walk'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
