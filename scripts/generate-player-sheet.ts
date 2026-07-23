/**
 * Gera spritesheet do player (8 direções × idle/walk).
 * Uso: npx tsx scripts/generate-player-sheet.ts
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FRAME_W = 32;
const FRAME_H = 48;
/** down, down-right, right, up-right, up, up-left, left, down-left */
const DIRS = 8;
/** idle0, idle1, walk0, walk1, walk2, walk3 */
const FRAMES = 6;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPx(rgba: Buffer, sheetW: number, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= sheetW) return;
  const i = (y * sheetW + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fillRect(
  rgba: Buffer,
  sheetW: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      setPx(rgba, sheetW, x0 + x, y0 + y, r, g, b);
    }
  }
}

/** Desenha um boneco simples; bob = deslocamento vertical dos pés/corpo para walk. */
function drawCharacter(
  rgba: Buffer,
  sheetW: number,
  ox: number,
  oy: number,
  dir: number,
  bob: number,
  step: number,
) {
  // centro do frame
  const cx = ox + 16;
  const cy = oy + 28 + bob;

  // sombra
  fillRect(rgba, sheetW, cx - 8, oy + 42, 16, 4, 20, 20, 20);

  // pernas (step alterna)
  const legSpread = step === 0 ? -2 : step === 1 ? 2 : step === 2 ? -3 : 3;
  fillRect(rgba, sheetW, cx - 5 + Math.min(0, legSpread), cy + 8, 4, 10, 40, 55, 120);
  fillRect(rgba, sheetW, cx + 1 + Math.max(0, legSpread), cy + 8, 4, 10, 40, 55, 120);

  // corpo (laranja shinobi)
  fillRect(rgba, sheetW, cx - 7, cy - 6, 14, 14, 220, 110, 40);

  // cabeça
  fillRect(rgba, sheetW, cx - 6, cy - 18, 12, 12, 240, 200, 160);

  // cabelo (direção altera “frentinho”)
  const hairY = cy - 22;
  fillRect(rgba, sheetW, cx - 7, hairY, 14, 6, 245, 170, 40);
  if (dir === 0 || dir === 1 || dir === 7) {
    // olhando pra baixo: franja
    fillRect(rgba, sheetW, cx - 5, hairY + 5, 10, 3, 245, 170, 40);
  } else if (dir === 4 || dir === 3 || dir === 5) {
    // pra cima: volume
    fillRect(rgba, sheetW, cx - 8, hairY - 2, 16, 5, 245, 170, 40);
  } else if (dir === 2) {
    // direita
    fillRect(rgba, sheetW, cx + 2, hairY, 8, 8, 245, 170, 40);
  } else {
    // esquerda
    fillRect(rgba, sheetW, cx - 10, hairY, 8, 8, 245, 170, 40);
  }

  // olho simples
  if (dir !== 4) {
    const eyeX = dir === 2 ? cx + 2 : dir === 6 ? cx - 4 : cx - 1;
    fillRect(rgba, sheetW, eyeX, cy - 14, 3, 3, 30, 30, 30);
  }
}

const sheetW = FRAME_W * FRAMES;
const sheetH = FRAME_H * DIRS;
const rgba = Buffer.alloc(sheetW * sheetH * 4);

for (let dir = 0; dir < DIRS; dir += 1) {
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const ox = frame * FRAME_W;
    const oy = dir * FRAME_H;
    const isWalk = frame >= 2;
    const walkIndex = frame - 2;
    const bob = isWalk ? (walkIndex % 2 === 0 ? -1 : 1) : frame === 1 ? -1 : 0;
    const step = isWalk ? walkIndex : 0;
    drawCharacter(rgba, sheetW, ox, oy, dir, bob, step);
  }
}

const outDir = join(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'player.png'), encodePng(sheetW, sheetH, rgba));
writeFileSync(
  join(outDir, 'player.json'),
  JSON.stringify(
    {
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
      directions: [
        'down',
        'down-right',
        'right',
        'up-right',
        'up',
        'up-left',
        'left',
        'down-left',
      ],
      framesPerDirection: FRAMES,
      idle: [0, 1],
      walk: [2, 3, 4, 5],
    },
    null,
    2,
  ),
);
console.log(`wrote player.png ${sheetW}x${sheetH}`);
