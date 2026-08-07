/**
 * 2ª skill do Sasuke — Katon / fogo (frames character + blast).
 * assets-src/sasuke-skill2 → public/sprites/player/sasuke/sasuke-gokakyu.png
 *
 * Uso: node scripts/process-sasuke-skill2.js
 *      npm run sasuke:skill2
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets-src', 'sasuke-skill2');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sasuke');
const OUT_NAME = 'sasuke-gokakyu';
const TARGET_BODY_H = 48;
const EDGE_PEEL_PASSES = 2;
const MAX_SHEET_W = 4096;

function isGreen(r, g, b) {
  if (g >= 55 && r <= 70 && b <= 70 && g >= r + 18 && g >= b + 18) return true;
  if (g >= 40 && r <= 50 && b <= 50 && g > r + 10 && g > b + 10) return true;
  if (g >= 100 && r <= 55 && b <= 60 && g >= r + 40 && g >= b + 40) return true;
  // Outline limão em VFX fogo (g alto, r/b médios mas g domina).
  if (g >= 90 && r <= 80 && b <= 80 && g >= r + 25 && g >= b + 25) return true;
  return false;
}

function isBgBlack(r, g, b) {
  if (r > 22 || g > 22 || b > 22) return false;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8;
}

function isBodyColor(r, g, b) {
  return !isGreen(r, g, b) && !isBgBlack(r, g, b);
}

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
  if (data[si + 3] < 12) return true;
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

        if (green && emptyN >= 1) {
          next[i + 3] = 0;
          continue;
        }
        if (black && emptyN >= 3 && bodyN <= 1) next[i + 3] = 0;
      }
    }
    cur = next;
  }
  return cur;
}

function keepSignificantComponents(frame, w, h, minRatio = 0.004, minAbs = 20) {
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
            if (isGreen(cur[ni], cur[ni + 1], cur[ni + 2])) continue;
            count += 1;
            rSum += cur[ni];
            gSum += cur[ni + 1];
            bSum += cur[ni + 2];
          }
        }
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
  out = fillInteriorHoles(out, w, h, 2);
  out = peelFringe(out, w, h, EDGE_PEEL_PASSES);
  out = keepSignificantComponents(out, w, h, 0.003, 24);
  out = peelFringe(out, w, h, 1);
  return out;
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

/** Altura do corpo nos primeiros frames (antes do fogo dominar). */
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
      // Fogo: ignora na medida do corpo.
      if (r > 150 && g > 80 && b < 120 && r > b + 40) continue;
      if (r > 180 && g > 160 && b < 100) continue;
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
  // Amostra frames 0..7 (carga/dash) para altura de personagem.
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
  if (fw * frames.length <= MAX_SHEET_W) {
    return stitchRow(frames, fw, fh);
  }
  const maxCols = Math.max(1, Math.floor(MAX_SHEET_W / fw));
  return stitchGrid(frames, fw, fh, maxCols);
}

async function loadSequence(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Pasta não encontrada: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? '0', 10);
      return na - nb;
    });
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

async function main() {
  console.log('skill2 gokakyu:');
  const cut = await loadSequence(INPUT_DIR);
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
  console.log(`  scale=${scaled.scale.toFixed(3)} → ${scaled.frameWidth}x${scaled.frameHeight}`);

  // Cap largura de célula se VFX deixar o frame absurdamente largo.
  let frames = scaled.frames;
  let fw = scaled.frameWidth;
  let fh = scaled.frameHeight;
  let contentH = scaled.contentHeight;
  if (fw > 220) {
    const s = 220 / fw;
    const outW = 220;
    const outH = Math.max(1, Math.round(fh * s));
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
    frames = out;
    contentH = Math.max(1, Math.round(contentH * s));
    fw = outW;
    fh = outH;
    console.log(`  width-cap → ${fw}x${fh} contentH=${contentH}`);
  }

  frames = frames.map((frame) => {
    let f = peelFringe(frame, fw, fh, 1);
    f = keepSignificantComponents(f, fw, fh, 0.005, 14);
    return f;
  });

  const frameRate = 12;
  const frameCount = frames.length;
  const durationMs = Math.round((frameCount / frameRate) * 1000);
  // Fogo se intensifica ~metade da sequ (após carga/dash).
  const hitDelayMs = Math.round(durationMs * 0.5);

  const sheet = stitchAuto(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_NAME}.png`;
  const outPath = path.join(OUT_DIR, file);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const previewPath = path.join(ROOT, 'assets-src', 'sasuke-skill2-preview.png');
  const prev = stitchGrid(frames, fw, fh, Math.min(8, frameCount));
  await sharp(prev.data, {
    raw: { width: prev.width, height: prev.height, channels: 4 },
  })
    .png()
    .toFile(previewPath);

  const metaPath = path.join(OUT_DIR, 'meta.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }
  const entry = {
    image: file,
    frameWidth: fw,
    frameHeight: fh,
    frameCount,
    contentHeight: contentH,
    scale: scaled.scale,
    frameRate,
    durationMs,
    hitDelayMs,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    source: 'assets-src/sasuke-skill2',
    slot: 2,
  };
  meta[OUT_NAME] = entry;
  meta['skill-katon-gokakyu'] = { ...entry, note: '2ª skill Sasuke' };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `fw=${fw} fh=${fh} count=${frameCount} contentH=${contentH}`,
    `fps=${frameRate} dur=${durationMs}ms hit@${hitDelayMs}ms`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: fw,
      frameHeight: fh,
      frameCount,
      contentHeight: contentH,
      frameRate,
      durationMs,
      hitDelayMs,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
