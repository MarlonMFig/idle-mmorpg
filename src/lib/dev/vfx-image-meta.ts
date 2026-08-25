import sharp from 'sharp';
import { suggestHorizontalFrameCount } from '@/data/vfx/types';
import { resolvePublicVfxUrl } from '@/lib/dev/vfx-paths';

export interface VfxImageMeta {
  width: number;
  height: number;
  url: string;
  suggestedFrameCount: number | null;
}

export { suggestHorizontalFrameCount };

export async function readVfxImageMeta(
  url: string,
  frameWidth?: number,
  frameHeight?: number,
): Promise<VfxImageMeta> {
  const abs = resolvePublicVfxUrl(url);
  const info = await sharp(abs).metadata();
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const suggestedFrameCount =
    frameWidth && frameHeight
      ? suggestHorizontalFrameCount(width, height, frameWidth, frameHeight)
      : null;
  return { width, height, url, suggestedFrameCount };
}

export async function readBufferImageSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const info = await sharp(buffer).metadata();
  return { width: info.width ?? 0, height: info.height ?? 0 };
}

export async function readSequenceMetas(urls: readonly string[]): Promise<{
  width: number;
  height: number;
  frames: VfxImageMeta[];
}> {
  if (urls.length < 1) throw new Error('Sequência sem frames');
  const frames: VfxImageMeta[] = [];
  for (const url of urls) {
    frames.push(await readVfxImageMeta(url));
  }
  const width = Math.max(...frames.map((frame) => frame.width));
  const height = Math.max(...frames.map((frame) => frame.height));
  return { width, height, frames };
}
