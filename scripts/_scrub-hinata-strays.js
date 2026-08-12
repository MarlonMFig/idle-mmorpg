/**
 * Scrub stray opaque pixels on canvas edges for Hinata alpha frames.
 * Keeps the main silhouette; only clears tiny border flecks.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'hinata');
const DIRS = ['idle', 'walk', 'combo', 'damage', 'jutsu'];
const ALPHA = 16;

async function scrubFile(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const N = w * h;
  const opaque = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    if (data[i * 4 + 3] >= ALPHA) opaque[i] = 1;
  }

  // Connected components; drop tiny ones that touch the border.
  const seen = new Uint8Array(N);
  let cleared = 0;
  for (let start = 0; start < N; start += 1) {
    if (!opaque[start] || seen[start]) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    let touchesBorder = false;
    while (stack.length) {
      const idx = stack.pop();
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || !opaque[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    // Stray flecks only: small + on border. Main body also touches border (feet)
    // so require very small size.
    if (touchesBorder && cells.length <= 6) {
      for (const idx of cells) {
        const i = idx * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        cleared += 1;
      }
    }
  }

  // Harden alpha: no soft fringe
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(filePath);
  return cleared;
}

async function main() {
  let total = 0;
  for (const dir of DIRS) {
    const folder = path.join(BASE, dir);
    if (!fs.existsSync(folder)) continue;
    const files = fs.readdirSync(folder).filter((f) => /^frame_\d+\.png$/i.test(f));
    let dirCleared = 0;
    for (const f of files) {
      dirCleared += await scrubFile(path.join(folder, f));
    }
    console.log(`${dir}: cleared ${dirCleared} stray px across ${files.length} frames`);
    total += dirCleared;
  }
  console.log(`TOTAL cleared ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
