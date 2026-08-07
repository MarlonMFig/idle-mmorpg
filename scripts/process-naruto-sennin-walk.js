/**
 * Naruto Sage Mode (Sennin) walk — 2×7 sheet (#00FF00), top row RIGHT only.
 * Game flipX covers LEFT.
 *
 * npm run naruto-sennin:walk
 * Fonte: assets/naruto-source/nu/naruto-sennin-walk-sheet.png
 * Saída: public/sprites/player/naruto-sennin/walk.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyGreenBackground,
  isContent,
  isGreenBg,
  isLabelPixel,
  fillInteriorHoles,
} = require('./lib/chroma-green-bg');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'naruto-sennin-walk-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto-sennin');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'naruto-sennin.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const TARGET_BODY_H = 48;
const COLS = 7;
const FRAME_RATE = 10;

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
      if (isLabelPixel(r, g, b)) {
        d[i + 3] = 0;
        continue;
      }
      if (isGreenBg(r, g, b)) {
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
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);

  const { data: raw, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const data = keyGreenBackground(raw, w, h);

  // Grelha 2×7: só a linha de cima (walk right).
  const rowH = Math.floor(h / 2);
  const cells = [];
  for (let i = 0; i < COLS; i += 1) {
    const l = Math.round((i * w) / COLS);
    const r = Math.round(((i + 1) * w) / COLS);
    cells.push({ l, r, t: 0, b: rowH });
  }
  console.log(
    `source ${w}x${h} top-row cells=${cells.length}`,
    cells.map((c) => `${c.r - c.l}x${c.b - c.t}`).join(','),
  );

  const cut = cells.map((c) => extractCell(data, w, c));
  const opaqueCounts = cut.map((c) => {
    let n = 0;
    for (let i = 3; i < c.frame.length; i += 4) if (c.frame[i] >= 16) n += 1;
    return n;
  });
  console.log('opaque px/frame:', opaqueCounts.join(','));
  if (opaqueCounts.some((n) => n < 40)) {
    throw new Error('Frame vazio ou chroma agressivo demais — revise a sheet');
  }

  const norm = normalize(cut);
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
    image: '/sprites/player/naruto-sennin/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'naruto-sennin-walk-sheet.png',
    frameRate: FRAME_RATE,
    direction: 'right',
    note: 'Bottom row left discarded; game uses flipX',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['naruto-sennin-walk'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight}`,
  );
  console.log('Pack wire:', JSON.stringify({
    frameWidth: entry.frameWidth,
    frameHeight: entry.frameHeight,
    frameCount: entry.frameCount,
    contentHeight: entry.contentHeight,
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
