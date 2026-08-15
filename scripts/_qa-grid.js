/**
 * Grid QA view for a packed sheet or a raw frame folder.
 * node scripts/_qa-grid.js <sheetPngOrDir> <out.png> [zoom] [cols]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function loadFrames(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const files = fs
      .readdirSync(target)
      .filter((f) => f.endsWith('.png'))
      .sort();
    const out = [];
    for (const f of files) {
      const buf = await sharp(path.join(target, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      out.push({ data: buf.data, w: buf.info.width, h: buf.info.height });
    }
    return out;
  }
  const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Guess frame count from wire/meta by scanning for square-ish division is unreliable;
  // caller passes cols; here we split by height (sheets are 1 row of fh-tall frames).
  const fh = info.height;
  const n = Math.max(1, Math.round(info.width / fh) || 1);
  return { raw: { data, w: info.width, h: fh }, n };
}

async function main() {
  const target = process.argv[2];
  const out = process.argv[3];
  const zoom = Number(process.argv[4] || 5);
  const framesPerRow = Number(process.argv[5] || 6);
  const frameCount = Number(process.argv[6] || 0);

  let frames = [];
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    frames = await loadFrames(target);
  } else {
    const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = frameCount || Math.max(1, Math.round(info.width / info.height));
    const fw = Math.round(info.width / n);
    for (let i = 0; i < n; i += 1) {
      const buf = Buffer.alloc(fw * info.height * 4);
      for (let y = 0; y < info.height; y += 1) {
        const srcStart = (y * info.width + i * fw) * 4;
        data.copy(buf, y * fw * 4, srcStart, srcStart + fw * 4);
      }
      frames.push({ data: buf, w: fw, h: info.height });
    }
  }

  const cellW = Math.max(...frames.map((f) => f.w));
  const cellH = Math.max(...frames.map((f) => f.h));
  const cols = Math.min(framesPerRow, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const gap = 2;
  const gridW = cols * (cellW + gap);
  const gridH = rows * (cellH + gap);
  const composite = [];
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    const cx = (i % cols) * (cellW + gap);
    const cy = Math.floor(i / cols) * (cellH + gap);
    composite.push({
      input: await sharp(f.data, { raw: { width: f.w, height: f.h, channels: 4 } }).png().toBuffer(),
      left: cx + Math.floor((cellW - f.w) / 2),
      top: cy + (cellH - f.h),
    });
  }
  const base = await sharp({
    create: { width: gridW, height: gridH, channels: 4, background: { r: 40, g: 40, b: 60, alpha: 1 } },
  })
    .composite(composite)
    .png()
    .toBuffer();
  await sharp(base)
    .resize(gridW * zoom, gridH * zoom, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(out);
  console.log(`${out} frames=${frames.length} cell=${cellW}x${cellH} -> ${gridW * zoom}x${gridH * zoom}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
