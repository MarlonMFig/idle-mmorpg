/**
 * Gera ícone de loot no chão (16x16).
 * Uso: npx tsx scripts/generate-loot-sprite.ts
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
  if (x < 0 || y < 0 || x >= w || y >= 16) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = 255;
}

const w = 16;
const h = 16;
const rgba = Buffer.alloc(w * h * 4);

// saco / bolsa
for (let y = 4; y < 14; y += 1) {
  for (let x = 3; x < 13; x += 1) {
    setPx(rgba, w, x, y, 180, 140, 60);
  }
}
for (let y = 2; y < 5; y += 1) {
  for (let x = 5; x < 11; x += 1) setPx(rgba, w, x, y, 140, 100, 40);
}
// brilho
setPx(rgba, w, 5, 6, 230, 200, 120);
setPx(rgba, w, 6, 6, 230, 200, 120);

const outDir = join(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'loot.png'), encodePng(w, h, rgba));
console.log('wrote loot.png');
