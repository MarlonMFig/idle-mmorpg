/**
 * Elecbyte SFF v1 (MUGEN 1.0) — PCX 8bpp, index 0 = transparent.
 */
const fs = require('fs');

function decodePcx(pcx, width, height) {
  const planes = pcx[65] || 1;
  const bpl = pcx.readUInt16LE(66) || width;
  const need = width * height;
  const indexed = Buffer.alloc(need, 0);
  let src = 128;
  let dst = 0;
  const rowBytes = bpl * planes;
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    const rowBuf = Buffer.alloc(rowBytes, 0);
    while (row < rowBytes && src < pcx.length) {
      let byte = pcx[src];
      src += 1;
      let count = 1;
      if ((byte & 0xc0) === 0xc0) {
        count = byte & 0x3f;
        byte = pcx[src] ?? 0;
        src += 1;
      }
      while (count > 0 && row < rowBytes) {
        rowBuf[row] = byte;
        row += 1;
        count -= 1;
      }
    }
    for (let x = 0; x < width; x += 1) {
      if (dst < need) {
        indexed[dst] = rowBuf[x];
        dst += 1;
      }
    }
  }
  let pal = Buffer.alloc(1024, 0);
  const markerAt = pcx.length - 769;
  if (markerAt >= 0 && pcx[markerAt] === 0x0c) {
    for (let i = 0; i < 256; i += 1) {
      pal[i * 4] = pcx[markerAt + 1 + i * 3];
      pal[i * 4 + 1] = pcx[markerAt + 2 + i * 3];
      pal[i * 4 + 2] = pcx[markerAt + 3 + i * 3];
      pal[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < 16; i += 1) {
      pal[i * 4] = pcx[16 + i * 3];
      pal[i * 4 + 1] = pcx[17 + i * 3];
      pal[i * 4 + 2] = pcx[18 + i * 3];
      pal[i * 4 + 3] = 255;
    }
  }
  pal[3] = 0;
  return { indexed, pal };
}

function indexToRgba(indexed, width, height, pal) {
  const out = Buffer.alloc(width * height * 4, 0);
  for (let p = 0; p < indexed.length; p += 1) {
    const idx = indexed[p];
    if (idx === 0) continue;
    const a = pal[idx * 4 + 3];
    if (a === 0) continue;
    const o = p * 4;
    out[o] = pal[idx * 4];
    out[o + 1] = pal[idx * 4 + 1];
    out[o + 2] = pal[idx * 4 + 2];
    out[o + 3] = 255;
  }
  return out;
}

function openSffV1(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 11) !== 'ElecbyteSpr') {
    throw new Error(`Not an SFF: ${filePath}`);
  }
  // Header v1: 0x10 = nº de grupos, 0x14 = nº de imagens, 0x18 = 1º subfile.
  // Ler a contagem de 0x10 enumera só os primeiros N sprites (Asuma: 96 de 1110)
  // e todo o resto do personagem — combos, specials e FX — some.
  const nSprites = buf.readUInt32LE(0x14);
  let offset = buf.readUInt32LE(0x18);
  const looksValid = (off) => {
    if (off < 32 || off + 32 > buf.length) return false;
    const next = buf.readUInt32LE(off);
    return next > off && next <= buf.length;
  };
  if (!looksValid(offset) && looksValid(512)) offset = 512;
  const sprites = [];
  for (let i = 0; i < nSprites; i += 1) {
    if (offset < 32 || offset + 32 > buf.length) break;
    const next = buf.readUInt32LE(offset);
    const dataLen = buf.readUInt32LE(offset + 4);
    sprites.push({
      index: i,
      group: buf.readInt16LE(offset + 12),
      number: buf.readInt16LE(offset + 14),
      width: 0,
      height: 0,
      axisX: buf.readInt16LE(offset + 8),
      axisY: buf.readInt16LE(offset + 10),
      linked: buf.readUInt16LE(offset + 16),
      fmt: 10,
      dataOff: offset + 32,
      dataLen,
      sharedPal: buf[offset + 18],
      next,
    });
    offset = next;
  }
  return { buf, sprites, version: 1 };
}

function decodeSprite(sff, sprite, palOverride) {
  if (sprite.linked) {
    return decodeSprite(sff, sff.sprites[sprite.linked], palOverride);
  }
  const pcx = sff.buf.subarray(sprite.dataOff, sprite.dataOff + sprite.dataLen);
  if (pcx[0] !== 0x0a) {
    throw new Error(`SFF v1 sprite ${sprite.group},${sprite.number} is not PCX`);
  }
  const xmin = pcx.readUInt16LE(4);
  const ymin = pcx.readUInt16LE(6);
  const xmax = pcx.readUInt16LE(8);
  const ymax = pcx.readUInt16LE(10);
  const width = xmax - xmin + 1;
  const height = ymax - ymin + 1;
  const { indexed, pal } = decodePcx(pcx, width, height);
  sprite.width = width;
  sprite.height = height;
  return {
    ...sprite,
    width,
    height,
    rgba: indexToRgba(indexed, width, height, palOverride || pal),
    pal,
  };
}

function getSpriteV1(sff, group, number) {
  const sprite = sff.sprites.find((s) => s.group === group && s.number === number);
  if (!sprite) throw new Error(`Sprite ${group},${number} not found`);
  let pal = null;
  if (sprite.sharedPal && sprite.index > 0) {
    let i = sprite.index - 1;
    while (i >= 0) {
      const prev = sff.sprites[i];
      if (!prev.linked && prev.dataLen > 0 && !prev.sharedPal) {
        pal = decodeSprite(sff, prev).pal;
        break;
      }
      i -= 1;
    }
  }
  return decodeSprite(sff, sprite, pal);
}

module.exports = { openSffV1, getSpriteV1 };
