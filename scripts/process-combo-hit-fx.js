/**
 * Combo hit-spark sheet — 7 frames (small pack + atq 2–4, skip composite atq_1).
 * node scripts/process-combo-hit-fx.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const FX_DIR = path.join(ROOT, 'assets', 'fx', 'combo-hit');
const OUT = path.join(ROOT, 'public', 'sprites', 'fx', 'combo-hit.png');
const CELL_W = 69;
const CELL_H = 85;
const ALPHA_KEEP = 16;

/** Ordem: sprite_1–4 depois sfx atq_2–4 (atq_1 é composite — não usar). */
const FRAME_SOURCES = [
  { dir: 'source-small', file: 'frame-01.png' },
  { dir: 'source-small', file: 'frame-02.png' },
  { dir: 'source-small', file: 'frame-03.png' },
  { dir: 'source-small', file: 'frame-04.png' },
  { dir: 'source-atq', file: 'frame-02.png' },
  { dir: 'source-atq', file: 'frame-03.png' },
  { dir: 'source-atq', file: 'frame-04.png' },
];

function isChromaGreen(r, g, b) {
  if (g >= 90 && g >= r + 40 && g >= b + 40 && r <= 70 && b <= 70) return true;
  if (g >= 120 && g >= r + 50 && g >= b + 50 && r <= 90 && b <= 90) return true;
  return false;
}

function keyFrame(data) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (a < ALPHA_KEEP || isChromaGreen(r, g, b) || (r <= 12 && g <= 12 && b <= 12)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    out[i + 3] = 255;
  }
  return out;
}

async function loadFrame({ dir, file }) {
  const filePath = path.join(FX_DIR, dir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing source frame: ${filePath}`);
  }
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = keyFrame(data);
  const padded = Buffer.alloc(CELL_W * CELL_H * 4);
  const offsetX = Math.floor((CELL_W - info.width) / 2);
  const offsetY = Math.floor((CELL_H - info.height) / 2);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const src = (y * info.width + x) * 4;
      const dst = ((y + offsetY) * CELL_W + (x + offsetX)) * 4;
      padded[dst] = keyed[src];
      padded[dst + 1] = keyed[src + 1];
      padded[dst + 2] = keyed[src + 2];
      padded[dst + 3] = keyed[src + 3];
    }
  }
  return padded;
}

async function main() {
  const frames = [];
  for (const source of FRAME_SOURCES) {
    frames.push(await loadFrame(source));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const sheet = Buffer.alloc(CELL_W * CELL_H * 4 * frames.length);
  for (let index = 0; index < frames.length; index += 1) {
    frames[index].copy(sheet, index * CELL_W * CELL_H * 4);
  }

  await sharp(sheet, {
    raw: { width: CELL_W * frames.length, height: CELL_H, channels: 4 },
  })
    .png()
    .toFile(OUT);

  console.log('wrote', OUT, `${frames.length}×${CELL_W}x${CELL_H}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
