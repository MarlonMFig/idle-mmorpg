/**
 * Flaw check for a packed character: clipping at frame borders, foot spread,
 * body-height drift between sheets and stray pixel islands.
 * node scripts/_qa-flaws.js <id>
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ALPHA_KEEP = 16;

function frameSlices(data, width, height, n) {
  const fw = Math.round(width / n);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const buf = Buffer.alloc(fw * height * 4);
    for (let y = 0; y < height; y += 1) {
      const src = (y * width + i * fw) * 4;
      data.copy(buf, y * fw * 4, src, src + fw * 4);
    }
    out.push({ data: buf, w: fw, h: height });
  }
  return out;
}

function bbox(frame, w, h) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, opaque };
}

/** Conta ilhas de pixels opacos; ilhas minúsculas soltas = lixo do rip. */
function islands(frame, w, h, minSize = 4) {
  const seen = new Uint8Array(w * h);
  const small = [];
  let big = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (seen[i] || frame[i * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [i];
    seen[i] = 1;
    let size = 0;
    while (stack.length) {
      const p = stack.pop();
      size += 1;
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
    if (size < minSize) small.push(size);
    else big += 1;
  }
  return { big, small };
}

async function main() {
  const id = process.argv[2] || 'ichigo';
  const dir = path.join(ROOT, 'public', 'sprites', 'player', id);
  const wire = JSON.parse(fs.readFileSync(path.join(dir, 'wire.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));

  const sheets = Object.entries(meta)
    .filter(([key]) => key.startsWith(`${id}-`))
    .map(([key, entry]) => ({ key, entry }));

  let problems = 0;
  for (const { key, entry } of sheets) {
    const file = path.join(ROOT, 'public', entry.image.replace(/^\//, ''));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frames = frameSlices(data, info.width, info.height, entry.frameCount);
    const fw = frames[0].w;
    const fh = frames[0].h;
    const isFx = key.endsWith('-fx');
    const clipped = [];
    const feet = [];
    const bodyH = [];
    let stray = 0;
    frames.forEach((f, i) => {
      const b = bbox(f.data, fw, fh);
      if (b.maxY < 0) {
        clipped.push(`f${i}:empty`);
        return;
      }
      feet.push(b.maxY);
      bodyH.push(b.maxY - b.minY + 1);
      const edges = [];
      if (b.minX === 0) edges.push('L');
      if (b.maxX === fw - 1) edges.push('R');
      if (b.minY === 0) edges.push('T');
      if (b.maxY === fh - 1) edges.push('B');
      if (edges.length) clipped.push(`f${i}:${edges.join('')}`);
      if (!isFx) {
        const isl = islands(f.data, fw, fh);
        stray += isl.small.length;
      }
    });
    const spread = Math.max(...feet) - Math.min(...feet);
    const hSpread = Math.max(...bodyH) - Math.min(...bodyH);
    const flags = [];
    if (clipped.length) flags.push(`CLIP[${clipped.join(' ')}]`);
    if (!isFx && spread > 3) flags.push(`FEET_SPREAD=${spread}`);
    if (!isFx && hSpread > Math.round(wire.contentHeight * 0.45)) {
      flags.push(`BODY_H_SPREAD=${hSpread}`);
    }
    if (stray) flags.push(`STRAY_ISLANDS=${stray}`);
    if (flags.length) problems += 1;
    console.log(
      `${key.padEnd(22)} ${entry.frameCount}f ${fw}x${fh} bodyH=${Math.min(...bodyH)}..${Math.max(...bodyH)} feet=${spread} ${flags.join(' ') || 'ok'}`,
    );
  }
  console.log(`\ncontentHeight=${wire.contentHeight} sheets=${sheets.length} flagged=${problems}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
