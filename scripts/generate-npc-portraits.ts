/**
 * Gera retratos placeholder dos NPCs.
 * Uso: npx tsx scripts/generate-npc-portraits.ts
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
    for (let x = 0; x < bw; x += 1) {
      const px = x0 + x;
      const py = y0 + y;
      if (px < 0 || py < 0 || px >= w) continue;
      const i = (py * w + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
}

function portrait(bg: [number, number, number], shirt: [number, number, number], hair: [number, number, number]) {
  const w = 96;
  const h = 96;
  const rgba = Buffer.alloc(w * h * 4);
  fill(rgba, w, 0, 0, w, h, bg[0], bg[1], bg[2]);
  fill(rgba, w, 18, 58, 60, 38, shirt[0], shirt[1], shirt[2]);
  fill(rgba, w, 28, 28, 40, 40, 235, 195, 155);
  fill(rgba, w, 24, 18, 48, 18, hair[0], hair[1], hair[2]);
  fill(rgba, w, 38, 42, 6, 6, 30, 30, 30);
  fill(rgba, w, 52, 42, 6, 6, 30, 30, 30);
  return encodePng(w, h, rgba);
}

const dir = join(process.cwd(), 'public/sprites/portraits');
mkdirSync(dir, { recursive: true });

writeFileSync(join(dir, 'default.png'), portrait([40, 48, 42], [70, 110, 160], [50, 50, 55]));
writeFileSync(join(dir, 'iruka.png'), portrait([36, 52, 40], [90, 70, 50], [40, 35, 30]));
writeFileSync(join(dir, 'teuchi.png'), portrait([48, 40, 32], [200, 80, 50], [245, 245, 245]));
writeFileSync(join(dir, 'scout.png'), portrait([28, 28, 34], [30, 30, 36], [20, 20, 24]));
writeFileSync(join(dir, 'sensei.png'), portrait([42, 46, 38], [55, 85, 55], [60, 50, 40]));

console.log('wrote portraits');
