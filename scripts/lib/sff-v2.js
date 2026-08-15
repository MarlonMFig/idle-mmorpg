/**
 * Elecbyte SFF v2 (MUGEN 1.0) reader.
 * Header: 512 bytes; palettes 16B; sprites 28B; RLE8/LZ5 + linked.
 */
const fs = require('fs');
const zlib = require('zlib');

function decodeRLE8(data, width, height) {
  const need = width * height;
  const out = Buffer.alloc(need, 0);
  let x = 0;
  let y = 0;
  let runlength = -1;
  for (let index = 0; index < data.length - 4; index += 1) {
    const value = data[index + 4];
    if ((value & 0xc0) !== 0x40 || runlength !== -1) {
      if (runlength === -1) runlength = 1;
      for (let i = 0; i < runlength; i += 1) {
        out[y * width + x] = value;
        x += 1;
        if (x >= width) {
          y += 1;
          x = 0;
          if (y >= height) return out;
        }
      }
      runlength = -1;
      if (y >= height) return out;
    } else {
      runlength = value - 0x40;
    }
  }
  return out;
}

function decodeLZ5(rle, width, height) {
  const encoded = rle.subarray(4);
  const decoded = Buffer.alloc(width * height, 0);
  let i = 0;
  let j = 0;
  let n = 0;
  let ct = encoded[i];
  let cts = 0;
  let rb = 0;
  let rbc = 0;
  if (i < encoded.length - 1) i += 1;
  while (j < decoded.length) {
    let d = encoded[i];
    if (i < encoded.length - 1) i += 1;
    if ((ct & (1 << cts)) !== 0) {
      if ((d & 0x3f) === 0) {
        d = (d << 2 | encoded[i]) + 1;
        if (i < encoded.length - 1) i += 1;
        n = encoded[i] + 2;
        if (i < encoded.length - 1) i += 1;
      } else {
        rb |= (d & 0xc0) >> rbc;
        rbc += 2;
        n = d & 0x3f;
        if (rbc < 8) {
          d = encoded[i] + 1;
          if (i < encoded.length - 1) i += 1;
        } else {
          d = rb + 1;
          rb = 0;
          rbc = 0;
        }
      }
      while (true) {
        if (j < decoded.length) {
          decoded[j] = decoded[j - d];
          j += 1;
        }
        n -= 1;
        if (n < 0) break;
      }
    } else {
      if ((d & 0xe0) === 0) {
        n = encoded[i] + 8;
        if (i < encoded.length - 1) i += 1;
      } else {
        n = d >> 5;
        d &= 0x1f;
      }
      for (; n > 0; n -= 1) {
        if (j < decoded.length) {
          decoded[j] = d;
          j += 1;
        }
      }
    }
    cts += 1;
    if (cts >= 8) {
      ct = encoded[i];
      cts = 0;
      if (i < encoded.length - 1) i += 1;
    }
  }
  return decoded;
}

function indexToRgba(indexed, width, height, palette) {
  const out = Buffer.alloc(width * height * 4, 0);
  for (let p = 0; p < indexed.length; p += 1) {
    const idx = indexed[p];
    if (idx === 0) continue;
    const a = palette[idx * 4 + 3];
    if (a === 0) continue;
    const o = p * 4;
    out[o] = palette[idx * 4];
    out[o + 1] = palette[idx * 4 + 1];
    out[o + 2] = palette[idx * 4 + 2];
    out[o + 3] = 255;
  }
  return out;
}

function openSff(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 11) !== 'ElecbyteSpr') {
    throw new Error(`Not an SFF: ${filePath}`);
  }
  const verhi = buf[15];
  if (verhi !== 2) {
    throw new Error(`SFF v${verhi} not supported (need v2)`);
  }

  const spriteOffset = buf.readUInt32LE(0x24);
  const nSprites = buf.readUInt32LE(0x28);
  const palOffset = buf.readUInt32LE(0x2c);
  const nPalettes = buf.readUInt32LE(0x30);
  const ldataOffset = buf.readUInt32LE(0x34);
  const tdataOffset = buf.readUInt32LE(0x38);

  const palettes = [];
  for (let i = 0; i < nPalettes; i += 1) {
    const o = palOffset + i * 16;
    palettes.push({
      group: buf.readInt16LE(o),
      number: buf.readInt16LE(o + 2),
      cols: buf.readUInt16LE(o + 4),
      linked: buf.readUInt16LE(o + 6),
      dataOff: buf.readUInt32LE(o + 8),
      dataLen: buf.readUInt32LE(o + 12),
    });
  }

  const sprites = [];
  for (let i = 0; i < nSprites; i += 1) {
    const o = spriteOffset + i * 28;
    sprites.push({
      index: i,
      group: buf.readInt16LE(o),
      number: buf.readInt16LE(o + 2),
      width: buf.readUInt16LE(o + 4),
      height: buf.readUInt16LE(o + 6),
      axisX: buf.readInt16LE(o + 8),
      axisY: buf.readInt16LE(o + 10),
      linked: buf.readUInt16LE(o + 12),
      fmt: buf[o + 14],
      depth: buf[o + 15],
      dataOff: buf.readUInt32LE(o + 16),
      dataLen: buf.readUInt32LE(o + 20),
      pal: buf.readUInt16LE(o + 24),
      flags: buf.readUInt16LE(o + 26),
    });
  }

  return { buf, sprites, palettes, ldataOffset, tdataOffset };
}

function paletteBytes(sff, pal) {
  if (!pal || pal.dataLen <= 0) return null;
  return sff.buf.subarray(
    sff.ldataOffset + pal.dataOff,
    sff.ldataOffset + pal.dataOff + pal.dataLen,
  );
}

function resolvePalette(sff, palIndex) {
  let idx = palIndex;
  const seen = new Set();
  while (idx >= 0 && idx < sff.palettes.length && !seen.has(idx)) {
    seen.add(idx);
    const pal = sff.palettes[idx];
    const data = paletteBytes(sff, pal);
    if (data) return data;
    // linked 0 is valid (share palettes[0]); `pal.linked &&` would skip it.
    if (pal.linked !== idx) {
      idx = pal.linked;
      continue;
    }
    break;
  }
  return Buffer.alloc(1024, 0);
}

function opaqueQuality(rgba) {
  let opaque = 0;
  let sum = 0;
  const colors = new Set();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 40) continue;
    opaque += 1;
    sum += rgba[i] + rgba[i + 1] + rgba[i + 2];
    colors.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  }
  return { colors: colors.size, lum: opaque ? sum / (opaque * 3) : 0, opaque };
}

function rgbaFromPalette(indexed, width, height, pal) {
  const rgba = indexToRgba(indexed, width, height, pal);
  const q = opaqueQuality(rgba);
  return { rgba, score: q.colors * 10 + Math.min(80, q.lum), ...q };
}

function isUsablePal(q) {
  return q.colors >= 8 && q.lum >= 18;
}

function bestIndexedRgba(sff, indexed, width, height, preferredPalIdx) {
  const first = rgbaFromPalette(indexed, width, height, resolvePalette(sff, preferredPalIdx));
  if (isUsablePal(first)) return first.rgba;
  const order = [];
  for (let d = 1; d <= 16; d += 1) order.push(preferredPalIdx + d);
  for (let d = 1; d <= 16; d += 1) order.push(preferredPalIdx - d);
  for (const i of order) {
    if (i < 0 || i >= sff.palettes.length) continue;
    const pal = paletteBytes(sff, sff.palettes[i]);
    if (!pal) continue;
    const next = rgbaFromPalette(indexed, width, height, pal);
    if (isUsablePal(next)) return next.rgba;
  }
  for (let i = 0; i < Math.min(8, sff.palettes.length); i += 1) {
    if (sff.palettes[i].dataLen < 256) continue;
    const pal = paletteBytes(sff, sff.palettes[i]);
    if (!pal) continue;
    const next = rgbaFromPalette(indexed, width, height, pal);
    if (isUsablePal(next)) return next.rgba;
  }
  return first.rgba;
}

function spriteBlob(sff, sprite) {
  const base = sprite.flags & 1 ? sff.tdataOffset : sff.ldataOffset;
  return sff.buf.subarray(base + sprite.dataOff, base + sprite.dataOff + sprite.dataLen);
}

function decodeIndexed(sff, sprite) {
  if (sprite.linked) {
    return decodeIndexed(sff, sff.sprites[sprite.linked]);
  }
  const blob = spriteBlob(sff, sprite);
  if (sprite.fmt === 2) return decodeRLE8(blob, sprite.width, sprite.height);
  if (sprite.fmt === 4) return decodeLZ5(blob, sprite.width, sprite.height);
  if (sprite.fmt === 0) return blob.subarray(0, sprite.width * sprite.height);
  throw new Error(`Unsupported SFF fmt ${sprite.fmt} for ${sprite.group},${sprite.number}`);
}

function pngBlob(blob) {
  if (blob[0] === 0x89 && blob[1] === 0x50) return blob;
  if (blob.length > 8 && blob[4] === 0x89 && blob[5] === 0x50) return blob.subarray(4);
  return blob;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Indexed 8-bit PNG → palette indices (SFF v2 fmt 10). */
function decodePngIndexed(blob, width, height) {
  const png = pngBlob(blob);
  let p = 8;
  const idats = [];
  while (p + 12 <= png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString('ascii', p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    if (type === 'IDAT') idats.push(data);
    if (type === 'IEND') break;
    p += 12 + len;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const stride = width;
  const out = Buffer.alloc(width * height, 0);
  let src = 0;
  let prev = Buffer.alloc(stride, 0);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = Buffer.alloc(stride, 0);
    inflated.copy(row, 0, src, src + stride);
    src += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x > 0 ? row[x - 1] : 0;
      const up = prev[x];
      const upLeft = x > 0 ? prev[x - 1] : 0;
      let v = row[x];
      if (filter === 1) v = (v + left) & 255;
      else if (filter === 2) v = (v + up) & 255;
      else if (filter === 3) v = (v + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) v = (v + paeth(left, up, upLeft)) & 255;
      row[x] = v;
    }
    row.copy(out, y * width);
    prev = row;
  }
  return out;
}

function getSprite(sff, group, number) {
  const sprite = sff.sprites.find((s) => s.group === group && s.number === number);
  if (!sprite) throw new Error(`Sprite ${group},${number} not found`);
  let target = sprite;
  const seen = new Set();
  while (target.linked && !seen.has(target.index)) {
    seen.add(target.index);
    target = sff.sprites[target.linked];
  }
  if (target.fmt === 10 || target.fmt === 11 || target.fmt === 12) {
    throw new Error(`PNG sprite ${group},${number} requires getSpriteAsync`);
  }
  const indexed = decodeIndexed(sff, sprite);
  return {
    ...sprite,
    rgba: bestIndexedRgba(sff, indexed, sprite.width, sprite.height, sprite.pal),
  };
}

async function getSpriteAsync(sff, group, number) {
  const sprite = sff.sprites.find((s) => s.group === group && s.number === number);
  if (!sprite) throw new Error(`Sprite ${group},${number} not found`);
  let target = sprite;
  const seen = new Set();
  while (target.linked && !seen.has(target.index)) {
    seen.add(target.index);
    target = sff.sprites[target.linked];
  }
  if (target.fmt === 10 || target.fmt === 11 || target.fmt === 12) {
    const indexed = decodePngIndexed(spriteBlob(sff, target), target.width, target.height);
    return {
      ...sprite,
      width: target.width,
      height: target.height,
      rgba: bestIndexedRgba(sff, indexed, target.width, target.height, target.pal),
    };
  }
  return getSprite(sff, group, number);
}

module.exports = {
  openSff,
  getSprite,
  getSpriteAsync,
  decodePngIndexed,
  spriteBlob,
  paletteBytes,
  rgbaFromPalette,
};
