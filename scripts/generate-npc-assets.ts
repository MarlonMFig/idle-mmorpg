/**
 * Gera sprite de NPC + ícone de interação.
 * Uso: npx tsx scripts/generate-npc-assets.ts
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

function setPx(
  rgba: Buffer,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  if (x < 0 || y < 0 || x >= w || y >= rgba.length / (w * 4)) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fill(
  rgba: Buffer,
  w: number,
  x0: number,
  y0: number,
  bw: number,
  bh: number,
  r: number,
  g: number,
  b: number,
) {
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) setPx(rgba, w, x0 + x, y0 + y, r, g, b);
  }
}

const outDir = join(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });

// NPC 32x48
{
  const w = 32;
  const h = 48;
  const rgba = Buffer.alloc(w * h * 4);
  fill(rgba, w, 8, 42, 16, 4, 20, 20, 20);
  fill(rgba, w, 11, 34, 4, 10, 55, 55, 70);
  fill(rgba, w, 17, 34, 4, 10, 55, 55, 70);
  fill(rgba, w, 9, 18, 14, 16, 70, 110, 160);
  fill(rgba, w, 10, 6, 12, 12, 235, 195, 155);
  fill(rgba, w, 9, 3, 14, 6, 50, 50, 55);
  fill(rgba, w, 13, 10, 3, 3, 30, 30, 30);
  writeFileSync(join(outDir, 'npc.png'), encodePng(w, h, rgba));
}

// Interaction icon 16x16 — "!"
{
  const w = 16;
  const h = 16;
  const rgba = Buffer.alloc(w * h * 4);
  // balloon
  for (let y = 1; y < 13; y += 1) {
    for (let x = 2; x < 14; x += 1) {
      const dx = x - 7.5;
      const dy = y - 6.5;
      if (dx * dx + dy * dy < 36) setPx(rgba, w, x, y, 245, 210, 70);
    }
  }
  fill(rgba, w, 7, 3, 2, 6, 40, 30, 10);
  fill(rgba, w, 7, 10, 2, 2, 40, 30, 10);
  writeFileSync(join(outDir, 'npc-interact.png'), encodePng(w, h, rgba));
}

console.log('wrote npc.png + npc-interact.png');
