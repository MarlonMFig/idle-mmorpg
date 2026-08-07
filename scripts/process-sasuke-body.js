/**
 * Walk + Combo Attack do Sasuke (fundo preto + contorno verde) →
 * public/sprites/player/sasuke/{walk,idle,combo1,combo2,combo3}.png
 *
 * Uso: node scripts/process-sasuke-body.js
 *
 * Importante: o stroke preto do personagem NÃO é flood-key com o fundo —
 * senão o outline desliga tronco/pernas e o walk fica “falhado”.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const WALK_DIR = path.join(ROOT, 'assets-src', 'sasuke-walk');
const COMBO_DIR = path.join(ROOT, 'assets-src', 'sasuke-combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sasuke');
const TARGET_BODY_H = 90;
const EDGE_PEEL_PASSES = 2;

function isGreen(r, g, b) {
  if (g >= 55 && r <= 70 && b <= 70 && g >= r + 18 && g >= b + 18) return true;
  if (g >= 40 && r <= 50 && b <= 50 && g > r + 10 && g > b + 10) return true;
  return false;
}

function isBgBlack(r, g, b) {
  if (r > 22 || g > 22 || b > 22) return false;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8;
}

/** Qualquer cor do personagem (não fundo / não verde). */
function isBodyColor(r, g, b) {
  return !isGreen(r, g, b) && !isBgBlack(r, g, b);
}

/**
 * Preto de fundo: neutro e sem vizinhos do corpo.
 * Não propaga no stroke preto colado a azul/pele/cabelo.
 */
function isFreeBackgroundBlack(data, w, h, x, y) {
  const si = (y * w + x) * 4;
  if (!isBgBlack(data[si], data[si + 1], data[si + 2])) return false;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = (ny * w + nx) * 4;
      if (data[ni + 3] < 12) continue;
      if (isBodyColor(data[ni], data[ni + 1], data[ni + 2])) return false;
    }
  }
  return true;
}

function isFloodKey(data, w, h, x, y) {
  const si = (y * w + x) * 4;
  const a = data[si + 3];
  if (a < 12) return true;
  if (isGreen(data[si], data[si + 1], data[si + 2])) return true;
  return isFreeBackgroundBlack(data, w, h, x, y);
}

function floodKeyMask(data, w, h) {
  const n = w * h;
  const marked = new Uint8Array(n);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (marked[i]) return;
    if (!isFloodKey(data, w, h, x, y)) return;
    marked[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return marked;
}

function peelFringe(frame, w, h, passes) {
  let cur = frame;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = Buffer.from(cur);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (cur[i + 3] < 16) continue;
        const r = cur[i];
        const g = cur[i + 1];
        const b = cur[i + 2];
        const green = isGreen(r, g, b);
        const black = isBgBlack(r, g, b);
        if (!green && !black) continue;

        let emptyN = 0;
        let bodyN = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              emptyN += 1;
              continue;
            }
            const ni = (ny * w + nx) * 4;
            if (cur[ni + 3] < 16) emptyN += 1;
            else if (isBodyColor(cur[ni], cur[ni + 1], cur[ni + 2])) bodyN += 1;
          }
        }

        // Verde residual some se toca o vazio.
        if (green && emptyN >= 1) {
          next[i + 3] = 0;
          continue;
        }
        // Preto solto (sem miolo do corpo) some na orla.
        if (black && emptyN >= 3 && bodyN <= 1) next[i + 3] = 0;
      }
    }
    cur = next;
  }
  return cur;
}

function keepSignificantComponents(frame, w, h, minRatio = 0.015, minAbs = 60) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const components = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let start = 0; start < n; start += 1) {
    if (seen[start] || frame[start * 4 + 3] < 16) continue;
    const stack = [start];
    const component = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      component.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < 16) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    components.push(component);
  }

  if (components.length === 0) return frame;

  const largest = Math.max(...components.map((c) => c.length));
  const threshold = Math.max(minAbs, Math.floor(largest * minRatio));
  const out = Buffer.alloc(n * 4);
  for (const component of components) {
    if (component.length < threshold) continue;
    for (const i of component) {
      const si = i * 4;
      out[si] = frame[si];
      out[si + 1] = frame[si + 1];
      out[si + 2] = frame[si + 2];
      out[si + 3] = frame[si + 3];
    }
  }
  return out;
}

function keyFrame(data, w, h) {
  const marked = floodKeyMask(data, w, h);
  const n = w * h;
  let out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (marked[i] || isGreen(r, g, b)) {
      out[si + 3] = 0;
      continue;
    }
    out[si] = r;
    out[si + 1] = g;
    out[si + 2] = b;
    out[si + 3] = 255;
  }
  // Fecha buracos de 1–2 px no miolo (liga tronco/pernas partidos pelo stroke).
  out = fillInteriorHoles(out, w, h, 2);
  out = peelFringe(out, w, h, EDGE_PEEL_PASSES);
  out = keepSignificantComponents(out, w, h, 0.02, 80);
  out = peelFringe(out, w, h, 1);
  return out;
}

/** Preenche pixels transparentes cercados de corpo (fecha rachaduras). */
function fillInteriorHoles(frame, w, h, passes) {
  let cur = frame;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = Buffer.from(cur);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4;
        if (cur[i + 3] >= 16) continue;

        let count = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const ni = ((y + dy) * w + (x + dx)) * 4;
            if (cur[ni + 3] < 16) continue;
            // Não usar verde residual no fill.
            if (isGreen(cur[ni], cur[ni + 1], cur[ni + 2])) continue;
            count += 1;
            rSum += cur[ni];
            gSum += cur[ni + 1];
            bSum += cur[ni + 2];
          }
        }
        // ≥5 vizinhos opacos → buraco interno.
        if (count >= 5) {
          next[i] = Math.round(rSum / count);
          next[i + 1] = Math.round(gSum / count);
          next[i + 2] = Math.round(bSum / count);
          next[i + 3] = 255;
        }
      }
    }
    cur = next;
  }
  return cur;
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
  if (maxX < 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  }
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
  const pad = 2;
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
  return { data: out, width: outW, height: fh };
}

function stitchGrid(frames, fw, fh, maxCols = 8) {
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

async function loadSequence(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Pasta não encontrada: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (files.length === 0) throw new Error(`Sem PNGs em ${dir}`);

  const cut = [];
  for (const file of files) {
    const { data, info } = await sharp(path.join(dir, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const keyed = keyFrame(data, info.width, info.height);
    const box = bbox(keyed, info.width, info.height);
    console.log(`  ${file}: content=${box.width}x${box.height}`);
    cut.push({ data: keyed, width: info.width, height: info.height });
  }
  return cut;
}

async function prepare(cut) {
  const normalized = normalize(
    cut.map((c) => c.data),
    cut.map((c) => c.width),
    cut.map((c) => c.height),
  );
  const scaled = await scaleFrames(
    normalized.frames,
    normalized.frameWidth,
    normalized.frameHeight,
    normalized.contentHeight,
    TARGET_BODY_H,
  );
  const cleaned = scaled.frames.map((frame) => {
    let f = peelFringe(frame, scaled.frameWidth, scaled.frameHeight, 1);
    f = keepSignificantComponents(f, scaled.frameWidth, scaled.frameHeight, 0.03, 12);
    return f;
  });
  return { ...scaled, frames: cleaned };
}

async function writeSheet(name, prepared, opts = {}) {
  const useGrid = prepared.frames.length > 10;
  const sheet = useGrid
    ? stitchGrid(prepared.frames, prepared.frameWidth, prepared.frameHeight, 8)
    : stitchRow(prepared.frames, prepared.frameWidth, prepared.frameHeight);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = `${name}.png`;
  const outPath = path.join(OUT_DIR, file);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  meta[`sasuke-${name}`] = {
    image: `/sprites/player/sasuke/${file}`,
    frameWidth: prepared.frameWidth,
    frameHeight: prepared.frameHeight,
    frameCount: prepared.frames.length,
    contentHeight: prepared.contentHeight,
    scale: prepared.scale,
    ...(sheet.cols ? { sheetCols: sheet.cols, sheetRows: sheet.rows } : {}),
    ...opts,
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `fw=${prepared.frameWidth} fh=${prepared.frameHeight}`,
    `count=${prepared.frames.length} contentH=${prepared.contentHeight}`,
  );
  return meta[`sasuke-${name}`];
}

async function main() {
  console.log('walk:');
  const walkCut = await loadSequence(WALK_DIR);
  const walk = await prepare(walkCut);
  console.log(`  scale=${walk.scale.toFixed(3)}`);
  await writeSheet('walk', walk, { source: 'png-sequence (1).zip', frameRate: 8 });
  // Idle vem do GIF (npm run sasuke:idle-gif) — não sobrescrever com frames de walk.

  console.log('combo:');
  const comboCut = await loadSequence(COMBO_DIR);
  const comboFull = await prepare(comboCut);
  console.log(`  scale=${comboFull.scale.toFixed(3)}`);

  const ranges = [
    { name: 'combo1', start: 0, end: 5 },
    { name: 'combo2', start: 5, end: 10 },
    { name: 'combo3', start: 10, end: 16 },
  ];

  for (const range of ranges) {
    const slice = comboFull.frames.slice(range.start, range.end);
    await writeSheet(
      range.name,
      {
        frames: slice,
        frameWidth: comboFull.frameWidth,
        frameHeight: comboFull.frameHeight,
        contentHeight: comboFull.contentHeight,
        scale: comboFull.scale,
      },
      {
        source: 'png-sequence (3).zip',
        frameRate: 12,
        hitDelayMs: Math.round((slice.length * 1000) / 12 / 2),
      },
    );
  }

  await writeSheet(
    'attack',
    {
      frames: comboFull.frames.slice(0, 5),
      frameWidth: comboFull.frameWidth,
      frameHeight: comboFull.frameHeight,
      contentHeight: comboFull.contentHeight,
      scale: comboFull.scale,
    },
    { source: 'png-sequence (3).zip', frameRate: 12 },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
