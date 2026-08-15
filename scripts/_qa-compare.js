/**
 * Side-by-side body-size comparison across a character's sheets (frame 0 of
 * each, bottom-aligned, same scale) + stray island highlight.
 * node scripts/_qa-compare.js <id> [zoom]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ALPHA_KEEP = 16;

function slice(data, width, height, n, i) {
  const fw = Math.round(width / n);
  const buf = Buffer.alloc(fw * height * 4);
  for (let y = 0; y < height; y += 1) {
    const src = (y * width + i * fw) * 4;
    data.copy(buf, y * fw * 4, src, src + fw * 4);
  }
  return { data: buf, w: fw, h: height };
}

function markStray(frame, w, h, minSize = 4) {
  const seen = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (seen[i] || frame[i * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [i];
    const cells = [];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      cells.push(p);
      const px = p % w;
      const py = (p - px) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (seen[np] || frame[np * 4 + 3] < ALPHA_KEEP) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    if (cells.length < minSize) {
      n += 1;
      for (const p of cells) {
        frame[p * 4] = 255;
        frame[p * 4 + 1] = 0;
        frame[p * 4 + 2] = 0;
        frame[p * 4 + 3] = 255;
      }
    }
  }
  return n;
}

async function main() {
  const id = process.argv[2] || 'ichigo';
  const zoom = Number(process.argv[3] || 4);
  const dir = path.join(ROOT, 'public', 'sprites', 'player', id);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const order = ['idle', 'walk', 'combo1', 'combo2', 'combo3', 'hurt', 'special1', 'special2', 'special3', 'special4'];

  const cells = [];
  for (const name of order) {
    const entry = meta[`${id}-${name}`];
    if (!entry) continue;
    const file = path.join(ROOT, 'public', entry.image.replace(/^\//, ''));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const f = slice(data, info.width, info.height, entry.frameCount, 0);
    const stray = markStray(f.data, f.w, f.h);
    cells.push({ name, ...f, stray });
    console.log(`${name}: frame0 ${f.w}x${f.h} strayIslands=${stray}`);
  }

  const cellW = Math.max(...cells.map((c) => c.w)) + 4;
  const cellH = Math.max(...cells.map((c) => c.h)) + 4;
  const composite = [];
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i];
    composite.push({
      input: await sharp(c.data, { raw: { width: c.w, height: c.h, channels: 4 } }).png().toBuffer(),
      left: i * cellW + Math.floor((cellW - c.w) / 2),
      top: cellH - c.h - 2,
    });
  }
  const W = cells.length * cellW;
  const base = await sharp({
    create: { width: W, height: cellH, channels: 4, background: { r: 40, g: 40, b: 60, alpha: 1 } },
  })
    .composite(composite)
    .png()
    .toBuffer();
  const out = path.join(ROOT, 'assets-src', '_qa', id, 'g-compare.png');
  const f = Math.min(zoom, 1024 / W);
  await sharp(base)
    .resize(Math.round(W * f), Math.round(cellH * f), { kernel: sharp.kernel.nearest })
    .png()
    .toFile(out);
  console.log('wrote', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
