const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public', 'sprites', 'player', 'sasuke', 'classic');
const META_PATH = path.join(DIR, 'meta.json');
const TARGET_CONTENT_H = 88;
const TARGET_FRAME_H = 98;
const ALPHA_THRESH = 20;

const SHEETS = [
  { key: 'chidori', maxScale: Infinity },
  { key: 'hosenka-start', maxScale: Infinity },
  { key: 'combo1', maxScale: 2.0 },
];

function opaqueBBox(data, fw, fh, strideW, offsetX) {
  let minX = fw, minY = fh, maxX = -1, maxY = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const i = (y * strideW + offsetX + x) * 4;
      if (data[i + 3] > ALPHA_THRESH) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function extractFrameRgba(imgPath, frameIndex, fw, fh, sheetW) {
  const { data } = await sharp(imgPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(fw * fh * 4);
  const ox = frameIndex * fw;
  for (let y = 0; y < fh; y++) {
    const srcOff = (y * sheetW + ox) * 4;
    data.copy(out, y * fw * 4, srcOff, srcOff + fw * 4);
  }
  return out;
}

async function processSheet(meta, key, maxScale) {
  const entry = meta[key];
  if (!entry) throw new Error(`Missing meta key: ${key}`);
  let fw = entry.frameWidth;
  let fh = entry.frameHeight;
  const fc = entry.frameCount;
  const imgPath = path.join(DIR, entry.image);

  console.log(`\n=== ${key} (${entry.image}) before: ${fw}x${fh} x ${fc} ===`);

  // Load full sheet once
  const sheet = await sharp(imgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sheetW = sheet.info.width;
  const sheetH = sheet.info.height;
  if (sheetH !== fh || sheetW < fw * fc) {
    console.warn(`  size note: sheet ${sheetW}x${sheetH}, expected ${fw * fc}x${fh}`);
  }

  // Pass 1: measure each frame's opaque bbox and required scale
  const frames = [];
  let maxNeededW = fw;

  for (let f = 0; f < fc; f++) {
    const bbox = opaqueBBox(sheet.data, fw, fh, sheetW, f * fw);
    if (!bbox) {
      frames.push({ empty: true });
      continue;
    }
    let scale = TARGET_CONTENT_H / bbox.height;
    if (scale > maxScale) scale = maxScale;
    // Prefer not to upscale wildly; still allow up to maxScale
    const scaledW = Math.ceil(bbox.width * scale);
    const scaledH = Math.round(bbox.height * scale);
    if (scaledW > maxNeededW) maxNeededW = scaledW;
    frames.push({ bbox, scale, scaledW, scaledH, empty: false });
    console.log(
      `  frame ${f}: bbox ${bbox.width}x${bbox.height} @ (${bbox.minX},${bbox.minY}) scale=${scale.toFixed(3)} -> ${scaledW}x${scaledH}`
    );
  }

  const newFw = Math.max(fw, maxNeededW);
  const newFh = TARGET_FRAME_H;

  // Pass 2: render each frame onto newFw x newFh, bottom-aligned, horizontally centered
  const outBuffers = [];
  for (let f = 0; f < fc; f++) {
    const canvas = Buffer.alloc(newFw * newFh * 4, 0);
    const info = frames[f];
    if (info.empty) {
      outBuffers.push(canvas);
      continue;
    }

    const { bbox, scale } = info;
    // Extract content region
    const contentW = bbox.width;
    const contentH = bbox.height;
    const content = Buffer.alloc(contentW * contentH * 4);
    const ox = f * fw;
    for (let y = 0; y < contentH; y++) {
      for (let x = 0; x < contentW; x++) {
        const srcI = ((bbox.minY + y) * sheetW + ox + bbox.minX + x) * 4;
        const dstI = (y * contentW + x) * 4;
        content[dstI] = sheet.data[srcI];
        content[dstI + 1] = sheet.data[srcI + 1];
        content[dstI + 2] = sheet.data[srcI + 2];
        content[dstI + 3] = sheet.data[srcI + 3];
      }
    }

    const scaledW = Math.max(1, Math.round(contentW * scale));
    const scaledH = Math.max(1, Math.round(contentH * scale));

    const scaled = await sharp(content, {
      raw: { width: contentW, height: contentH, channels: 4 },
    })
      .resize(scaledW, scaledH, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const destX = Math.floor((newFw - scaledW) / 2);
    const destY = newFh - scaledH; // bottom-aligned

    for (let y = 0; y < scaledH; y++) {
      const dy = destY + y;
      if (dy < 0 || dy >= newFh) continue;
      for (let x = 0; x < scaledW; x++) {
        const dx = destX + x;
        if (dx < 0 || dx >= newFw) continue;
        const srcI = (y * scaledW + x) * 4;
        const dstI = (dy * newFw + dx) * 4;
        // alpha composite over transparent
        const sa = scaled[srcI + 3] / 255;
        if (sa <= 0) continue;
        const da = canvas[dstI + 3] / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) continue;
        canvas[dstI] = Math.round((scaled[srcI] * sa + canvas[dstI] * da * (1 - sa)) / outA);
        canvas[dstI + 1] = Math.round((scaled[srcI + 1] * sa + canvas[dstI + 1] * da * (1 - sa)) / outA);
        canvas[dstI + 2] = Math.round((scaled[srcI + 2] * sa + canvas[dstI + 2] * da * (1 - sa)) / outA);
        canvas[dstI + 3] = Math.round(outA * 255);
      }
    }
    outBuffers.push(canvas);
  }

  // Stitch horizontal strip
  const outW = newFw * fc;
  const outH = newFh;
  const strip = Buffer.alloc(outW * outH * 4, 0);
  for (let f = 0; f < fc; f++) {
    const frame = outBuffers[f];
    for (let y = 0; y < outH; y++) {
      const srcOff = y * newFw * 4;
      const dstOff = (y * outW + f * newFw) * 4;
      frame.copy(strip, dstOff, srcOff, srcOff + newFw * 4);
    }
  }

  await sharp(strip, { raw: { width: outW, height: outH, channels: 4 } })
    .png()
    .toFile(imgPath);

  entry.frameWidth = newFw;
  entry.frameHeight = newFh;
  entry.frameCount = fc;
  entry.outputSize = { width: outW, height: outH };

  console.log(`=== ${key} after: ${newFw}x${newFh} x ${fc}, outputSize ${outW}x${outH} ===`);
  return { key, frameWidth: newFw, frameHeight: newFh, frameCount: fc, outputSize: entry.outputSize };
}

async function main() {
  // Optional: verify walk content height
  const walkPath = path.join(DIR, 'walk.png');
  const walkMeta = JSON.parse(fs.readFileSync(META_PATH, 'utf8')).walk;
  const walkSheet = await sharp(walkPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const heights = [];
  for (let f = 0; f < walkMeta.frameCount; f++) {
    const bbox = opaqueBBox(
      walkSheet.data,
      walkMeta.frameWidth,
      walkMeta.frameHeight,
      walkSheet.info.width,
      f * walkMeta.frameWidth
    );
    if (bbox) heights.push(bbox.height);
  }
  console.log(
    `Walk reference content heights: [${heights.join(', ')}] avg=${(
      heights.reduce((a, b) => a + b, 0) / heights.length
    ).toFixed(1)} (target ${TARGET_CONTENT_H})`
  );

  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  const results = [];
  for (const { key, maxScale } of SHEETS) {
    results.push(await processSheet(meta, key, maxScale));
  }

  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');
  console.log('\n--- Final dimensions ---');
  for (const r of results) {
    console.log(
      `${r.key}: ${r.frameWidth}x${r.frameHeight} x ${r.frameCount}, outputSize ${r.outputSize.width}x${r.outputSize.height}`
    );
  }
  console.log('\nmeta.json updated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
