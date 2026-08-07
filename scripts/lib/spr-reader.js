/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Leitor do Tibia.spr do WONSR (cliente 8.60 + otfi extended).
 *
 * Decodifica direto do arquivo binário em vez de reabrir os 132k PNGs já
 * extraídos — montar milhares de spritesheets ficaria ordens de magnitude mais
 * lento passando por `sharp` em cada sprite.
 *
 * Formato (igual ao OTClient):
 *   signature(u32) + count(u32 quando extended) + offsets[count](u32) + dados
 *   Cada sprite: [3 bytes color-key][u16 pixelDataSize]
 *   RLE: (u16 transparentes)(u16 coloridos)(coloridos * canais)
 *   canais = 3 (RGB) porque o otfi do WONSR tem transparency=false.
 */
const fs = require('fs');

const SPRITE_SIZE = 32;
const SPRITE_BYTES = SPRITE_SIZE * SPRITE_SIZE * 4;

class SprReader {
  constructor(filePath, { hasAlpha = false } = {}) {
    this.buf = fs.readFileSync(filePath);
    this.hasAlpha = hasAlpha;
    this.cache = new Map();

    this.signature = this.buf.readUInt32LE(0);
    const countU16 = this.buf.readUInt16LE(4);
    const countU32 = this.buf.readUInt32LE(4);

    // Mesma heurística do extrator: extended usa contagem/offsets em u32.
    const useU32 =
      countU32 > 10000 && 8 + countU32 * 4 < this.buf.length && countU32 < 500000;
    this.count = useU32 ? countU32 : countU16;
    this.offsetBase = useU32 ? 8 : 6;
  }

  /** RGBA cru 32×32 do sprite, ou null se vazio/inexistente. */
  get(spriteId) {
    if (!spriteId || spriteId > this.count) return null;
    if (this.cache.has(spriteId)) return this.cache.get(spriteId);

    const pixels = this.decode(spriteId);
    this.cache.set(spriteId, pixels);
    return pixels;
  }

  /** Libera o cache entre lotes grandes para não estourar a memória. */
  clearCache() {
    this.cache.clear();
  }

  decode(spriteId) {
    const offsetPos = this.offsetBase + (spriteId - 1) * 4;
    if (offsetPos + 4 > this.buf.length) return null;
    const offset = this.buf.readUInt32LE(offsetPos);
    if (!offset || offset + 5 > this.buf.length) return null;

    let pos = offset + 3; // pula color-key
    const dataSize = this.buf.readUInt16LE(pos);
    pos += 2;
    const end = pos + dataSize;
    if (end > this.buf.length) return null;

    const channels = this.hasAlpha ? 4 : 3;
    const pixels = Buffer.alloc(SPRITE_BYTES, 0);
    const total = SPRITE_SIZE * SPRITE_SIZE;
    let write = 0;
    let opaque = false;

    while (pos + 4 <= end && write < total) {
      write += this.buf.readUInt16LE(pos);
      pos += 2;
      const colored = this.buf.readUInt16LE(pos);
      pos += 2;

      for (let i = 0; i < colored && write < total; i++) {
        if (pos + channels > end) break;
        const target = write * 4;
        pixels[target] = this.buf[pos];
        pixels[target + 1] = this.buf[pos + 1];
        pixels[target + 2] = this.buf[pos + 2];
        pixels[target + 3] = this.hasAlpha ? this.buf[pos + 3] : 255;
        if (pixels[target + 3] !== 0) opaque = true;
        pos += channels;
        write++;
      }
    }

    return opaque ? pixels : null;
  }
}

/** Copia um sprite 32×32 RGBA para dentro de um canvas RGBA maior. */
function blitSprite(canvas, canvasWidth, source, targetX, targetY) {
  for (let row = 0; row < SPRITE_SIZE; row++) {
    const y = targetY + row;
    if (y < 0) continue;
    let read = row * SPRITE_SIZE * 4;
    let write = (y * canvasWidth + targetX) * 4;
    for (let col = 0; col < SPRITE_SIZE; col++, read += 4, write += 4) {
      const alpha = source[read + 3];
      if (alpha === 0) continue;
      canvas[write] = source[read];
      canvas[write + 1] = source[read + 1];
      canvas[write + 2] = source[read + 2];
      canvas[write + 3] = alpha;
    }
  }
}

module.exports = { SprReader, blitSprite, SPRITE_SIZE };
