/**
 * Remove isolated 1–3px flecks not connected to the main body mass.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'hinata');
const DIRS = ['idle', 'walk', 'combo', 'damage', 'jutsu', 'jutsu-vfx'];
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
  for (let i = 0; i < N; i += 1) if (data[i * 4 + 3] >= ALPHA) opaque[i] = 1;

  const seen = new Uint8Array(N);
  const comps = [];
  for (let start = 0; start < N; start += 1) {
    if (!opaque[start] || seen[start]) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
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
    comps.push(cells);
  }
  comps.sort((a, b) => b.length - a.length);
  const mainSize = comps[0] ? comps[0].length : 0;
  let cleared = 0;
  for (let c = 1; c < comps.length; c += 1) {
    // Drop satellites much smaller than the body.
    if (comps[c].length <= Math.max(8, Math.floor(mainSize * 0.02))) {
      for (const idx of comps[c]) {
        const i = idx * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        cleared += 1;
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else data[i + 3] = 255;
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(filePath);
  return cleared;
}

async function main() {
  let total = 0;
  for (const dir of DIRS) {
    const folder = path.join(BASE, dir);
    if (!fs.existsSync(folder)) continue;
    const files = fs.readdirSync(folder).filter((f) => /^frame_\d+\.png$/i.test(f));
    let n = 0;
    for (const f of files) n += await scrubFile(path.join(folder, f));
    console.log(`${dir}: cleared ${n}`);
    total += n;
  }
  console.log('TOTAL', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
