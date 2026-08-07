/**
 * Processa a folha multi-linha do Rasengan (fundo verde + label preta)
 * → public/sprites/player/naruto/rasengan.png, com pés no bottom-center.
 *
 * Uso: node scripts/process-naruto-rasengan.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rasengan-full.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');
const OUT_FILE = 'rasengan.png';

// Amostra dominante da folha: 80,152,80
const CHROMA = [80, 152, 80];
const TOL = 38;

function isBlack(r, g, b) {
  return r < 35 && g < 35 && b < 35;
}

function isCyan(r, g, b) {
  return r < 100 && g > 95 && b > 95 && Math.abs(g - b) <= 40 && (g + b) / 2 > r + 50;
}

function isChroma(r, g, b) {
  return (
    Math.abs(r - CHROMA[0]) <= TOL &&
    Math.abs(g - CHROMA[1]) <= TOL &&
    Math.abs(b - CHROMA[2]) <= TOL
  );
}

function isKeyable(r, g, b) {
  return isChroma(r, g, b) || isCyan(r, g, b);
}

function findContentBounds(data, w, h, ch) {
  let first = -1;
  let last = -1;
  for (let y = 0; y < h; y += 1) {
    let chroma = 0;
    let black = 0;
    let other = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBlack(r, g, b)) {
        black += 1;
        continue;
      }
      if (isChroma(r, g, b)) chroma += 1;
      else if (!isCyan(r, g, b)) other += 1;
    }
    if (black / w >= 0.35) continue;
    if (chroma / w >= 0.12 || (other > 20 && chroma / w >= 0.05)) {
      if (first < 0) first = y;
      last = y;
    }
  }
  if (first < 0) throw new Error('sem conteúdo verde');
  return { top: first, bottom: last + 1 };
}

function findRowBands(data, w, y0, y1, ch) {
  const dens = [];
  for (let y = y0; y < y1; y += 1) {
    let other = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      if (!isKeyable(data[i], data[i + 1], data[i + 2]) && !isBlack(data[i], data[i + 1], data[i + 2])) {
        other += 1;
      }
    }
    dens.push(other);
  }
  const thr = Math.max(8, Math.floor(w * 0.01));
  const bands = [];
  let inBand = false;
  let start = 0;
  for (let i = 0; i <= dens.length; i += 1) {
    const filled = i < dens.length && dens[i] > thr;
    if (filled && !inBand) {
      inBand = true;
      start = i;
    } else if (!filled && inBand) {
      if (i - start >= 28) bands.push({ top: start + y0, bottom: i + y0 });
      inBand = false;
    }
  }
  return bands.length ? bands : [{ top: y0, bottom: y1 }];
}

function extractCells(data, w, h, ch, gapMax, minWidth) {
  const colHits = new Array(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      if (isKeyable(data[i], data[i + 1], data[i + 2]) || isBlack(data[i], data[i + 1], data[i + 2])) {
        continue;
      }
      colHits[x] += 1;
    }
  }
  const thr = Math.max(3, Math.floor(h * 0.08));
  const raw = [];
  let start = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && colHits[x] > thr;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      raw.push({ left: start, right: x });
      start = -1;
    }
  }
  const merged = [];
  for (const run of raw) {
    const prev = merged[merged.length - 1];
    if (prev && run.left - prev.right <= gapMax) prev.right = run.right;
    else merged.push({ ...run });
  }
  return merged.filter((c) => c.right - c.left >= minWidth);
}

function cutFrame(data, w, h, ch, cell) {
  const left = Math.max(0, cell.left - 1);
  const right = Math.min(w, cell.right + 1);
  const fw = right - left;
  const frame = Buffer.alloc(fw * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = (y * w + left + x) * ch;
      const di = (y * fw + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (isKeyable(r, g, b) || isBlack(r, g, b)) {
        frame[di + 3] = 0;
      } else {
        frame[di] = r;
        frame[di + 1] = g;
        frame[di + 2] = b;
        frame[di + 3] = 255;
      }
    }
  }
  return { frame, width: fw, height: h };
}

function bbox(frame, fw, fh) {
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
  if (maxX < 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const pad = 1;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - pad;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * srcW + (box.minX + x)) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = frame[si + 3];
      }
    }
    return canvas;
  });
  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: boxes[0].height,
  };
}

function stitch(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh };
}

async function main() {
  const { data, info } = await sharp(INPUT).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bounds = findContentBounds(data, w, h, ch);
  const bands = findRowBands(data, w, bounds.top, bounds.bottom, ch);
  console.log(`rasengan: ${w}x${h} bands=${bands.length}`);

  const cut = [];
  for (let bi = 0; bi < bands.length; bi += 1) {
    const band = bands[bi];
    const rowH = band.bottom - band.top;
    const slice = Buffer.alloc(w * rowH * ch);
    for (let y = 0; y < rowH; y += 1) {
      data.copy(
        slice,
        y * w * ch,
        (band.top + y) * w * ch,
        (band.top + y + 1) * w * ch,
      );
    }
    const cells = extractCells(slice, w, rowH, ch, 10, 22);
    console.log(`  band${bi} y=${band.top}..${band.bottom - 1} cells=${cells.length}`);
    for (const cell of cells) {
      cut.push(cutFrame(slice, w, rowH, ch, cell));
    }
  }

  if (cut.length === 0) throw new Error('nenhum frame');

  const normalized = normalize(
    cut.map((c) => c.frame),
    cut.map((c) => c.width),
    cut.map((c) => c.height),
  );
  const sheet = stitch(normalized.frames, normalized.frameWidth, normalized.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, OUT_FILE);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  meta['naruto-rasengan'] = {
    image: `/sprites/player/naruto/${OUT_FILE}`,
    frameWidth: normalized.frameWidth,
    frameHeight: normalized.frameHeight,
    frameCount: normalized.frames.length,
    contentHeight: normalized.contentHeight,
    source: 'rasengan-full.png',
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `fw=${normalized.frameWidth} fh=${normalized.frameHeight}`,
    `count=${normalized.frames.length} contentH=${normalized.contentHeight}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
