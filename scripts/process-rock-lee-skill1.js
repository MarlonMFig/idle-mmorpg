/**
 * Rock Lee — 1ª skill Konoha Senpu (frame_001…038, fundo verde + preto).
 * assets-src/rock-lee-skill1 → public/sprites/player/rock-lee/konoha-senpu.png
 *
 * npm run rock-lee:skill1
 *
 * Keying: chroma verde puro (NÃO macacão) + flood pretos da borda;
 * cabelo/contorno pretos só a ≤ HAIR_RADIUS do miolo colorido.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets-src', 'rock-lee-skill1');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee');
const OUT_NAME = 'konoha-senpu';
const TARGET_BODY_H = 48;
const MAX_SHEET_W = 4096;
const FRAME_RATE = 14;
const HAIR_RADIUS = 4;

function isChromaGreen(r, g, b) {
  if (g < 95) return false;
  if (r > 50 || b > 50) return false;
  return g >= r + 50 && g >= b + 50;
}

function isNearBlack(r, g, b) {
  return r <= 18 && g <= 18 && b <= 18 && Math.max(r, g, b) - Math.min(r, g, b) <= 6;
}

function keyFrame(data, w, h) {
  const n = w * h;
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    if (data[si + 3] < 12) continue;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (isChromaGreen(r, g, b)) continue;
    if (isNearBlack(r, g, b)) continue;
    core[i] = 1;
  }

  const dist = new Int16Array(n);
  dist.fill(32767);
  const dq = [];
  for (let i = 0; i < n; i += 1) {
    if (!core[i]) continue;
    dist[i] = 0;
    dq.push(i);
  }
  let head = 0;
  while (head < dq.length) {
    const i = dq[head++];
    const d = dist[i];
    if (d >= HAIR_RADIUS) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const nd = d + 1;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (dist[ni] <= nd) continue;
      dist[ni] = nd;
      dq.push(ni);
    }
  }

  const bg = new Uint8Array(n);
  const bq = [];
  const pushBg = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i] || core[i]) return;
    const si = i * 4;
    if (data[si + 3] < 12) {
      bg[i] = 1;
      bq.push(i);
      return;
    }
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (isChromaGreen(r, g, b) || isNearBlack(r, g, b)) {
      bg[i] = 1;
      bq.push(i);
    }
  };
  for (let x = 0; x < w; x += 1) {
    pushBg(x, 0);
    pushBg(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    pushBg(0, y);
    pushBg(w - 1, y);
  }
  while (bq.length) {
    const i = bq.pop();
    const x = i % w;
    const y = (i / w) | 0;
    pushBg(x - 1, y);
    pushBg(x + 1, y);
    pushBg(x, y - 1);
    pushBg(x, y + 1);
  }

  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    const a = data[si + 3];
    if (a < 12 || isChromaGreen(r, g, b)) continue;

    if (isNearBlack(r, g, b)) {
      if (bg[i] && dist[i] > HAIR_RADIUS) continue;
      out[si] = r;
      out[si + 1] = g;
      out[si + 2] = b;
      out[si + 3] = 255;
      continue;
    }

    if (core[i] || !bg[i]) {
      out[si] = r;
      out[si + 1] = g;
      out[si + 2] = b;
      out[si + 3] = 255;
    }
  }

  // Remove pretos isolados (sombra residual) sem cor a 2px.
  const cleaned = Buffer.from(out);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (out[i + 3] < 16) continue;
      if (!isNearBlack(out[i], out[i + 1], out[i + 2])) continue;
      let nearColor = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          if (out[ni + 3] < 16) continue;
          if (!isNearBlack(out[ni], out[ni + 1], out[ni + 2])) nearColor += 1;
        }
      }
      if (nearColor === 0) cleaned[i + 3] = 0;
    }
  }
  return cleaned;
}

function bbox(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
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

/** Altura do desenho "sólido" (ignora streaks brancas/cinza claras de vento no topo). */
function bodyContentHeight(frame, w, h, box) {
  let minY = h;
  let maxY = -1;
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < 16) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      // Vento branco/cinza quase puro: não define altura base.
      if (r > 160 && g > 160 && b > 160 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return box.height;
  return Math.max(1, maxY - minY + 1);
}

function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const pad = 2;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  // Base nos pés: alinha maxY.
  const bottoms = boxes.map((b) => b.maxY);
  const avgBottom =
    bottoms.reduce((a, b) => a + b, 0) / Math.max(1, bottoms.length);

  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    // Alinha a "sola" pelo maxY médio do conteúdo.
    let destY = Math.round(avgBottom - box.maxY) + pad;
    destY = Math.max(0, Math.min(fh - box.height, destY));
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

  // contentHeight: média dos primeiros frames com Lee de pé (corpo).
  const sampleN = Math.min(8, frames.length);
  let bodyH = 0;
  for (let i = 0; i < sampleN; i += 1) {
    bodyH += bodyContentHeight(frames[i], widths[i], heights[i], boxes[i]);
  }
  bodyH = Math.round(bodyH / sampleN);

  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: bodyH || boxes[0].height,
  };
}

async function scaleFrames(frames, fw, fh, contentHeight, targetBody) {
  const scale = Math.min(1, targetBody / Math.max(1, contentHeight));
  if (scale >= 0.99) {
    return { frames, frameWidth: fw, frameHeight: fh, contentHeight, scale: 1 };
  }
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    out.push(data);
  }
  return {
    frames: out,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outContent,
    scale,
  };
}

function stitchRow(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh, cols: frames.length, rows: 1 };
}

function stitchGrid(frames, fw, fh, maxCols) {
  const cols = Math.min(maxCols, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const outW = cols * fw;
  const outH = rows * fh;
  const out = Buffer.alloc(outW * outH * 4);
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let y = 0; y < fh; y += 1) {
      frame.copy(
        out,
        ((row * fh + y) * outW + col * fw) * 4,
        y * fw * 4,
        (y + 1) * fw * 4,
      );
    }
  });
  return { data: out, width: outW, height: outH, cols, rows };
}

function stitchAuto(frames, fw, fh) {
  if (fw * frames.length <= MAX_SHEET_W) return stitchRow(frames, fw, fh);
  const maxCols = Math.max(1, Math.floor(MAX_SHEET_W / fw));
  return stitchGrid(frames, fw, fh, maxCols);
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) throw new Error(`Pasta não encontrada: ${INPUT_DIR}`);
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (!files.length) throw new Error(`Sem PNGs em ${INPUT_DIR}`);

  console.log(`rock-lee skill1 (Konoha Senpu): ${files.length} frames`);
  const cut = [];
  for (const file of files) {
    const { data, info } = await sharp(path.join(INPUT_DIR, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const keyed = keyFrame(data, info.width, info.height);
    const box = bbox(keyed, info.width, info.height);
    console.log(`  ${file}: content=${box.width}x${box.height}`);
    cut.push({ data: keyed, width: info.width, height: info.height });
  }

  const normalized = normalize(
    cut.map((c) => c.data),
    cut.map((c) => c.width),
    cut.map((c) => c.height),
  );
  console.log(
    `  normalized fw=${normalized.frameWidth} fh=${normalized.frameHeight}`,
    `bodyH≈${normalized.contentHeight}`,
  );

  const scaled = await scaleFrames(
    normalized.frames,
    normalized.frameWidth,
    normalized.frameHeight,
    normalized.contentHeight,
    TARGET_BODY_H,
  );
  console.log(`  scale=${scaled.scale.toFixed(3)}`);

  const sheet = stitchAuto(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${OUT_NAME}.png`);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(durationMs * 0.45);
  const entry = {
    image: `/sprites/player/rock-lee/${OUT_NAME}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    durationMs,
    hitDelayMs,
    source: 'assets-src/rock-lee-skill1 (frame_001…038)',
  };

  const metaPath = path.join(OUT_DIR, 'meta.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['rock-lee-konoha-senpu'] = entry;
  meta['skill-konoha-senpu'] = { ...entry, note: '1ª skill Rock Lee' };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount}`,
    `contentH=${entry.contentHeight} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log('Pack wire:', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
