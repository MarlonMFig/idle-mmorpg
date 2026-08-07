/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Extrai Tibia.spr com suporte a sprites U32 (OTClient extended).
 * Formato 8.60+ custom: signature(u32) + count(u32) + offsets[count](u32) + RGB data.
 * Magenta (255,0,255) vira transparente.
 *
 * Uso:
 *   node scripts/extract-wonsr-spr.js
 *   node scripts/extract-wonsr-spr.js --limit=500 --start=1
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SPR_PATH =
  process.env.WONSR_SPR ||
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo/OtClient 1.7/data/things/860/Tibia.spr';
const OUT_DIR =
  process.env.WONSR_SPR_OUT ||
  path.join(__dirname, '..', 'assets-src', 'wonsr-sprites-png');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const START = Number.parseInt(args.start || '1', 10);
const LIMIT = args.limit ? Number.parseInt(args.limit, 10) : null;
const IDS = args.ids
  ? String(args.ids)
      .split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  : null;
// transparency=false no otfi WONSR → pixels coloridos usam 3 bytes (RGB).
const HAS_ALPHA = Boolean(args.alpha);
const SIZE = 32;

function readU32(buf, off) {
  return buf.readUInt32LE(off);
}

/**
 * Decodifica um sprite no formato Tibia .spr (igual ao OTClient):
 *   [3 bytes color-key] [u16 pixelDataSize]
 *   RLE: (u16 transparentPixels)(u16 coloredPixels)(coloredPixels * channels bytes)
 * channels = 4 se transparency=true, senão 3 (RGB).
 */
function decodeSprite(buf, offset) {
  if (!offset) return null; // sprite vazio
  if (offset + 5 > buf.length) return null;

  let pos = offset;
  pos += 3; // pula color-key (r,g,b)
  const pixelDataSize = buf.readUInt16LE(pos);
  pos += 2;
  const end = pos + pixelDataSize;
  if (end > buf.length) return null;

  const channels = HAS_ALPHA ? 4 : 3;
  const pixels = Buffer.alloc(SIZE * SIZE * 4, 0); // RGBA
  let write = 0;
  const total = SIZE * SIZE;

  while (pos + 4 <= end && write < total) {
    const transparent = buf.readUInt16LE(pos);
    pos += 2;
    const colored = buf.readUInt16LE(pos);
    pos += 2;

    write += transparent; // alpha já é 0

    for (let i = 0; i < colored && write < total; i++) {
      if (pos + channels > end) break;
      const r = buf[pos++];
      const g = buf[pos++];
      const b = buf[pos++];
      const a = HAS_ALPHA ? buf[pos++] : 255;
      const o = write * 4;
      pixels[o] = r;
      pixels[o + 1] = g;
      pixels[o + 2] = b;
      pixels[o + 3] = a;
      write++;
    }
  }

  // pula sprite totalmente vazio
  let any = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 0) {
      any = true;
      break;
    }
  }
  if (!any) return null;
  return pixels;
}

async function main() {
  console.log('Lendo', SPR_PATH);
  const buf = fs.readFileSync(SPR_PATH);
  const signature = readU32(buf, 0);
  const countU16 = buf.readUInt16LE(4);
  const countU32 = readU32(buf, 4);

  // Heurística: se countU32 é grande e cabe na tabela de offsets, usa U32
  const tableBytesU32 = countU32 * 4;
  const tableBytesU16 = countU16 * 4;
  const useU32 =
    countU32 > 10000 &&
    8 + tableBytesU32 < buf.length &&
    countU32 < 500000;
  const count = useU32 ? countU32 : countU16;
  const offsetBase = useU32 ? 8 : 6;

  console.log({
    signature: '0x' + signature.toString(16),
    countU16,
    countU32,
    useU32,
    count,
    fileMB: Math.round(buf.length / 1e6),
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let saved = 0;
  let empty = 0;

  const ids = IDS
    ? IDS
    : (() => {
        const endId = LIMIT ? Math.min(count, START + LIMIT - 1) : count;
        const arr = [];
        for (let id = START; id <= endId; id++) arr.push(id);
        return arr;
      })();

  for (const id of ids) {
    const offPos = offsetBase + (id - 1) * 4;
    if (offPos + 4 > buf.length) break;
    const spriteOff = readU32(buf, offPos);
    const pixels = decodeSprite(buf, spriteOff);
    if (!pixels) {
      empty++;
      continue;
    }
    const out = path.join(OUT_DIR, `${id}.png`);
    await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
      .png()
      .toFile(out);
    saved++;
    if (saved % 500 === 0) console.log(`  salvos ${saved} (id=${id})`);
  }

  console.log(`Pronto: ${saved} PNGs em ${OUT_DIR} (vazios: ${empty})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
