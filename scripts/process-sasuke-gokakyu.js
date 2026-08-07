/**
 * Katon Goukakyuu: personagem (selos) + fogo (efeito separado).
 * Cast sheet: assets/naruto-source/nu/sasuke-gokakyu-cast-sheet.png
 * Fogo: frames de assets-src/sasuke-skill2 (explosão, sem misturar no body)
 *
 * npm run sasuke:gokakyu
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CAST_SHEET = path.join(ROOT, 'assets/naruto-source/nu/sasuke-gokakyu-cast-sheet.png');
const FIRE_SRC = path.join(ROOT, 'assets-src/sasuke-skill2');
const OUT_DIR = path.join(ROOT, 'public/sprites/player/sasuke');
const TARGET_BODY_H = 48;
/** Frames de skill2 que são majoritariamente a bola de fogo (indices 1-based nos arquivos). */
const FIRE_FRAME_FILES = [
  'frame-27.png',
  'frame-28.png',
  'frame-29.png',
  'frame-30.png',
  'frame-31.png',
  'frame-32.png',
];

function isGreen(r, g, b) {
  return g > 80 && g > r + 20 && g > b + 20;
}

/** Mantém só pixels quentes (fogo); remove corpo/roupa/fundo. */
function keepFireOnly(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) {
      data[i + 3] = 0;
      continue;
    }
    if (isGreen(r, g, b) || (r <= 20 && g <= 20 && b <= 20)) {
      data[i + 3] = 0;
      continue;
    }
    const fire =
      r > 90 &&
      r + g > 140 &&
      b < r * 0.85 &&
      (r > g - 10 || g > 70) &&
      !(b > r + 15 && b > g + 15); // azul da roupa
    if (!fire) data[i + 3] = 0;
  }
}

function contentBox(data, w, h) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 };
  return { minX, minY, maxX, maxY };
}

function placeCentered(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const ox = Math.floor((dw - sw) / 2);
  const oy = Math.floor((dh - sh) / 2);
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      if (src[si + 3] < 1) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      src.copy(out, (dy * dw + dx) * 4, si, si + 4);
    }
  }
  return out;
}

function writeHorizontalStrip(frames, fw, fh, outPath) {
  const sheetW = fw * frames.length;
  const sheet = Buffer.alloc(sheetW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(sheet, (y * sheetW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return sharp(sheet, { raw: { width: sheetW, height: fh, channels: 4 } })
    .png()
    .toFile(outPath)
    .then(() => ({ sheetW, fh, fw, count: frames.length }));
}

/**
 * A folha de cast NÃO é grid uniforme (frames de soltura são mais largos).
 * Detecta ilhas de conteúdo por coluna (green ≈ vazio) para não misturar frames.
 */
function findContentSegments(data, W, H, minColPx = 3) {
  const dens = new Array(W).fill(0);
  for (let x = 0; x < W; x += 1) {
    let c = 0;
    for (let y = 0; y < H; y += 1) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue;
      if (isGreen(r, g, b)) continue;
      c += 1;
    }
    dens[x] = c;
  }
  const segs = [];
  let st = null;
  for (let x = 0; x < W; x += 1) {
    if (dens[x] >= minColPx) {
      if (st === null) st = x;
    } else if (st !== null) {
      segs.push([st, x - 1]);
      st = null;
    }
  }
  if (st !== null) segs.push([st, W - 1]);
  return segs;
}

async function processCastBody() {
  const { data, info } = await sharp(CAST_SHEET).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const segs = findContentSegments(data, W, H, 3);
  console.log(
    `cast sheet ${W}x${H} -> ${segs.length} frames (gap-detect):`,
    segs.map(([a, b]) => `${a}-${b}(${b - a + 1})`).join(' '),
  );
  if (segs.length < 2) throw new Error('Cast sheet: could not segment frames');

  const cells = [];
  let maxBodyH = 0;
  let maxBodyW = 0;
  for (const [left, right] of segs) {
    const cellW = right - left + 1;
    const canvas = Buffer.alloc(cellW * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < cellW; x += 1) {
        const si = (y * W + left + x) * 4;
        const di = (y * cellW + x) * 4;
        const r = data[si];
        const g = data[si + 1];
        const b = data[si + 2];
        if (isGreen(r, g, b)) continue;
        canvas[di] = r;
        canvas[di + 1] = g;
        canvas[di + 2] = b;
        canvas[di + 3] = data[si + 3];
      }
    }
    const box = contentBox(canvas, cellW, H);
    maxBodyH = Math.max(maxBodyH, box.maxY - box.minY + 1);
    maxBodyW = Math.max(maxBodyW, box.maxX - box.minX + 1);
    cells.push({ canvas, box, cellW });
  }

  const pad = 2;
  const cellBoxes = cells.map((c) => c.box);
  const maxW = maxBodyW + pad * 2;
  const maxH = maxBodyH + pad * 2;
  // Alinha pelos pés (maxY) — poses largas de soltura não centralizam o corpo “flutuante”.
  const bottoms = cellBoxes.map((b) => b.maxY);
  const avgBottom = Math.round(bottoms.reduce((a, b) => a + b, 0) / bottoms.length);

  const normalized = cells.map(({ canvas, box, cellW }) => {
    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;
    const crop = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y += 1) {
      canvas.copy(
        crop,
        y * bw * 4,
        ((box.minY + y) * cellW + box.minX) * 4,
        ((box.minY + y) * cellW + box.minX + bw) * 4,
      );
    }
    const frame = Buffer.alloc(maxW * maxH * 4);
    const ox = Math.floor((maxW - bw) / 2);
    const oy = avgBottom - box.maxY + pad;
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        const si = (y * bw + x) * 4;
        if (crop[si + 3] < 1) continue;
        const dx = x + ox;
        const dy = y + oy;
        if (dx < 0 || dy < 0 || dx >= maxW || dy >= maxH) continue;
        crop.copy(frame, (dy * maxW + dx) * 4, si, si + 4);
      }
    }
    return frame;
  });

  const contentH0 = maxBodyH;
  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentH0));
  const outW = Math.max(1, Math.round(maxW * scale));
  const outH = Math.max(1, Math.round(maxH * scale));
  const contentHeight = Math.max(1, Math.round(contentH0 * scale));

  const frames = [];
  for (const frame of normalized) {
    const { data: d } = await sharp(frame, {
      raw: { width: maxW, height: maxH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    frames.push(d);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writeHorizontalStrip(frames, outW, outH, path.join(OUT_DIR, 'sasuke-gokakyu.png'));
  console.log(`body sasuke-gokakyu.png fw=${outW} fh=${outH} n=${frames.length} contentH=${contentHeight}`);
  return { frameWidth: outW, frameHeight: outH, frameCount: frames.length, contentHeight };
}

async function processFireFx() {
  const cropped = [];
  let maxW = 0;
  let maxH = 0;

  for (const name of FIRE_FRAME_FILES) {
    const fp = path.join(FIRE_SRC, name);
    if (!fs.existsSync(fp)) {
      console.warn('missing fire frame', name);
      continue;
    }
    const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    keepFireOnly(data);
    const box = contentBox(data, info.width, info.height);
    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;
    const crop = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        const si = ((box.minY + y) * info.width + box.minX + x) * 4;
        data.copy(crop, (y * bw + x) * 4, si, si + 4);
      }
    }
    maxW = Math.max(maxW, bw);
    maxH = Math.max(maxH, bh);
    cropped.push({ crop, bw, bh });
  }

  if (!cropped.length) throw new Error('No fire frames');

  const cellW = maxW + 4;
  const cellH = maxH + 4;
  const frames = cropped.map(({ crop, bw, bh }) => placeCentered(crop, bw, bh, cellW, cellH));

  // Escala visual generosa pro fogo no chão
  const targetMax = 96;
  const scale = Math.min(1, targetMax / Math.max(cellW, cellH));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));

  const resized = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    resized.push(d);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writeHorizontalStrip(resized, outW, outH, path.join(OUT_DIR, 'sasuke-gokakyu-fx.png'));
  console.log(`fx sasuke-gokakyu-fx.png fw=${outW} fh=${outH} n=${resized.length}`);
  return { frameWidth: outW, frameHeight: outH, frameCount: resized.length, contentHeight: outH };
}

async function main() {
  if (!fs.existsSync(CAST_SHEET)) {
    console.error('Missing cast sheet:', CAST_SHEET);
    process.exit(1);
  }
  const body = await processCastBody();
  const fx = await processFireFx();

  const metaPath = path.join(OUT_DIR, 'meta.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/\\n\s*$/, '').trim());
    } catch {
      meta = {};
    }
  }
  meta['sasuke-gokakyu'] = {
    image: '/sprites/player/sasuke/sasuke-gokakyu.png',
    ...body,
    frameRate: 10,
    note: 'body/cast only — fire is separate FX',
  };
  meta['sasuke-gokakyu-fx'] = {
    image: '/sprites/player/sasuke/sasuke-gokakyu-fx.png',
    ...fx,
    frameRate: 12,
    note: 'fire VFX only',
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(JSON.stringify({ body, fx }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
