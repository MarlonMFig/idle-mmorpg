/**
 * Gera sprite placeholder de monstro (32x32).
 * Uso: npx tsx scripts/generate-enemy-sprite.ts
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function setPx(rgba: Buffer, w: number, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || y < 0 || x >= w || y >= 32) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = 255;
}

const w = 32;
const h = 32;
const rgba = Buffer.alloc(w * h * 4);

// corpo slime
for (let y = 10; y < 28; y += 1) {
  for (let x = 4; x < 28; x += 1) {
    const dx = x - 16;
    const dy = y - 20;
    if ((dx * dx) / 90 + (dy * dy) / 55 <= 1) {
      setPx(rgba, w, x, y, 70, 170, 90);
    }
  }
}
// olhos
for (let y = 14; y < 18; y += 1) {
  for (let x = 11; x < 14; x += 1) setPx(rgba, w, x, y, 20, 30, 20);
  for (let x = 18; x < 21; x += 1) setPx(rgba, w, x, y, 20, 30, 20);
}
// brilho
setPx(rgba, w, 10, 12, 180, 230, 180);
setPx(rgba, w, 11, 12, 180, 230, 180);

const outDir = join(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'enemy.png'), encodePng(w, h, rgba));
console.log('wrote enemy.png');
