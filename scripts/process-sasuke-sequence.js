/**
 * Sequência PNG do Sasuke (fundo verde 0,128,0) → sheets em
 * public/sprites/player/sasuke/ (walk + idle).
 *
 * Uso: node scripts/process-sasuke-sequence.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets-src', 'sasuke-sequence');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'sasuke');
const TARGET_BODY_H = 96;

function isChroma(r, g, b) {
  // Primary #008000 and soft fringes.
  if (g < 70) return false;
  if (r > 55 || b > 55) return false;
  return g >= r + 28 && g >= b + 28;
}

function isNearBlackBar(r, g, b) {
  return r < 18 && g < 18 && b < 18;
}

function keyFrame(data, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    const a = data[si + 3];
    if (a < 8 || isChroma(r, g, b) || isNearBlackBar(r, g, b)) {
      out[si + 3] = 0;
      continue;
    }
    out[si] = r;
    out[si + 1] = g;
    out[si + 2] = b;
    out[si + 3] = 255;
  }
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

async function writeSheet(name, frames, fw, fh, contentHeight, source, extra = {}) {
  const sheet = stitchRow(frames, fw, fh);
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
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    contentHeight,
    source,
    ...extra,
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    `-> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`,
    `fw=${fw} fh=${fh} count=${frames.length} contentH=${contentHeight}`,
  );
  return meta[`sasuke-${name}`];
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Pasta não encontrada: ${INPUT_DIR}`);
  }
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (files.length === 0) throw new Error('nenhum PNG na sequência');

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
  const scaled = await scaleFrames(
    normalized.frames,
    normalized.frameWidth,
    normalized.frameHeight,
    normalized.contentHeight,
    TARGET_BODY_H,
  );
  console.log(`scale=${scaled.scale.toFixed(3)}`);

  // Walk = sequência completa; idle = primeiro frame (estático) + mini loop de 2.
  await writeSheet(
    'walk',
    scaled.frames,
    scaled.frameWidth,
    scaled.frameHeight,
    scaled.contentHeight,
    'png-sequence.zip',
    { frameRate: 8 },
  );
  await writeSheet(
    'idle',
    [scaled.frames[0], scaled.frames[Math.min(1, scaled.frames.length - 1)]],
    scaled.frameWidth,
    scaled.frameHeight,
    scaled.contentHeight,
    'png-sequence.zip',
    { frameRate: 3 },
  );
  // Ataque provisório: reutiliza a sequência (até haver combos).
  await writeSheet(
    'attack',
    scaled.frames,
    scaled.frameWidth,
    scaled.frameHeight,
    scaled.contentHeight,
    'png-sequence.zip',
    { frameRate: 12, hitDelayMs: Math.round((scaled.frames.length * 1000) / 12 / 2) },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
