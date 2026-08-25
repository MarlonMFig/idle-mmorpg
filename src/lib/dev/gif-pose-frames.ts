import sharp from 'sharp';
import { padImagesToCommonCanvas } from '@/lib/dev/pad-sequence-frames';

function averageDelayMs(delay: number[] | number | undefined): number {
  if (typeof delay === 'number' && delay > 0) return delay;
  if (!Array.isArray(delay) || delay.length === 0) return 80;
  const sum = delay.reduce((total, value) => total + Math.max(0, value), 0);
  return Math.max(20, sum / delay.length);
}

export function frameRateFromGifDelay(delay: number[] | number | undefined): number {
  const fps = Math.round(1000 / averageDelayMs(delay));
  return Math.min(30, Math.max(8, fps));
}

/**
 * Extrai cada página do GIF como PNG (mesmo tamanho).
 * Phaser não toca GIF animado; o lab grava sequência de frames.
 */
export async function gifBufferToPngFrames(buffer: Buffer): Promise<{
  frames: Buffer[];
  width: number;
  height: number;
  frameRate: number;
}> {
  const meta = await sharp(buffer, { animated: true, limitInputPixels: false }).metadata();
  const format = (meta.format ?? '').toLowerCase();
  if (format && format !== 'gif') {
    throw new Error('O arquivo não é um GIF');
  }
  const pages = Math.max(1, meta.pages ?? 1);
  const pageHeight = meta.pageHeight || meta.height || 0;
  const frames: Buffer[] = [];

  for (let index = 0; index < pages; index += 1) {
    const { data, info } = await sharp(buffer, {
      animated: true,
      page: index,
      pages: 1,
      limitInputPixels: false,
    })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    let h = info.height;
    let slice = data;
    if (pageHeight > 0 && h > pageHeight * 1.5) {
      h = pageHeight;
      const offset = index * pageHeight * w * 4;
      slice = data.subarray(offset, offset + w * h * 4);
    }
    if (!(w > 0) || !(h > 0) || slice.length < w * h * 4) {
      throw new Error(`GIF frame ${index + 1} inválido`);
    }
    const png = await sharp(slice, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer();
    frames.push(png);
  }

  const padded = await padImagesToCommonCanvas(frames, 'feet');
  return {
    frames: padded.buffers,
    width: padded.width,
    height: padded.height,
    frameRate: frameRateFromGifDelay(meta.delay),
  };
}
