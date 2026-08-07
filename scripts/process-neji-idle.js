/**
 * Neji idle — 4-frame Gentle Fist stance (teal/cyan bg) → idle.png
 *
 * npm run neji:idle
 * Fonte: assets/naruto-source/nu/neji-idle-sheet.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { keyExteriorChroma, isContent, fillInteriorHoles } = require('./lib/neji-chroma');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji-idle-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'neji.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const TARGET_BODY_H = 48;
const FRAME_RATE = 8;
const EXPECTED = 4;

function cellsInBand(data, w, band, expected) {
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
      if (x - xs >= 8) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 4) prev.r = c.r;
    else merged.push({ ...c });
  }
  let out = merged.filter((c) => c.r - c.l >= 10);
  if (expected > 0 && out.length !== expected && out.length > 0) {
    const L = out[0].l;
    const R = out[out.length - 1].r;
    const span = R - L;
    out = [];
    for (let i = 0; i < expected; i += 1) {
      out.push({
        l: Math.round(L + (i * span) / expected),
        r: Math.round(L + ((i + 1) * span) / expected),
        t: band.t,
        b: band.b,
      });
    }
  }
  return out;
}

function findBand(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dy[y] += 1;
    }
  }
  let t = 0;
  let b = h;
  for (let y = 0; y < h; y += 1) {
    if (dy[y] > 8) {
      t = y;
      break;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    if (dy[y] > 4) {
      b = y + 1;
      break;
    }
  }
  return { t, b };
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
  const scale = TARGET_BODY_H / Math.max(1, contentHeight);
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
    fillInteriorHoles(d, outW, outH, 32);
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
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = keyExteriorChroma(raw, info.width, info.height, { magenta: false });
  const band = findBand(data, info.width, info.height);
  const cells = cellsInBand(data, info.width, band, EXPECTED);
  console.log(
    `neji idle band ${band.t}-${band.b} cells=${cells.length}`,
    cells.map((c) => c.r - c.l).join(','),
  );
  if (cells.length < 2) throw new Error('Poucos frames de idle');

  const cut = cells.map((c) => extractCell(data, info.width, c));
  for (const c of cut) {
    let n = 0;
    for (let i = 3; i < c.frame.length; i += 4) if (c.frame[i] >= 16) n += 1;
    if (n < 40) throw new Error('Frame idle vazio após chroma');
  }

  const norm = normalize(cut);
  const scaled = await scaleFrames(norm.frames, norm.cellW, norm.cellH, norm.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'idle.png'));

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await sharp(scaled.frames[0], {
    raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  const entry = {
    image: '/sprites/player/neji/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'neji-idle-sheet.png',
    frameRate: FRAME_RATE,
    note: '4-frame Gentle Fist idle; teal exterior key',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['neji-idle'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight}`,
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
