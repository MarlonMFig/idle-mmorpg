import sharp from 'sharp';

export type SequencePadAlign = 'feet' | 'center';

/**
 * Phaser precisa de frames iguais. Canvas comum transparente:
 * pose = pés na base + centro X; VFX = centro.
 */
export async function padImagesToCommonCanvas(
  buffers: Buffer[],
  align: SequencePadAlign,
): Promise<{ buffers: Buffer[]; width: number; height: number }> {
  if (buffers.length < 1) throw new Error('Sequência sem frames');
  const sizes: { width: number; height: number }[] = [];
  for (const buffer of buffers) {
    const info = await sharp(buffer).metadata();
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    if (!(width > 0) || !(height > 0)) throw new Error('Frame inválido');
    sizes.push({ width, height });
  }
  const width = Math.max(...sizes.map((size) => size.width));
  const height = Math.max(...sizes.map((size) => size.height));
  const out: Buffer[] = [];
  for (let i = 0; i < buffers.length; i += 1) {
    const size = sizes[i];
    const left = Math.floor((width - size.width) / 2);
    const top = align === 'feet' ? height - size.height : Math.floor((height - size.height) / 2);
    out.push(
      await sharp({
        create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: buffers[i], left, top }])
        .png()
        .toBuffer(),
    );
  }
  return { buffers: out, width, height };
}
