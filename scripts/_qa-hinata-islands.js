/**
 * Pixel island audit for Hinata sheets (sharp).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'public', 'sprites', 'player', 'hinata');
const QA = path.join(ROOT, 'assets-src', '_qa', 'hinata');

const SHEETS = [
  { file: 'idle.png', fw: 38, fh: 58, n: 5 },
  { file: 'walk.png', fw: 30, fh: 60, n: 6 },
  { file: 'combo1.png', fw: 56, fh: 57, n: 5 },
  { file: 'combo2.png', fw: 56, fh: 57, n: 5 },
  { file: 'combo3.png', fw: 56, fh: 57, n: 5 },
  { file: 'hurt.png', fw: 64, fh: 59, n: 2 },
  { file: 'death.png', fw: 64, fh: 59, n: 3 },
  { file: 'hakke-shou.png', fw: 86, fh: 85, n: 27 },
  { file: 'hakke-shou-fx.png', fw: 138, fh: 166, n: 4 },
];

const OPAQUE = 20;
const MAX_ISLAND = 6;

function frameSlice(sheet, sw, fw, fh, i) {
  const out = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const sx = i * fw + x;
      const si = (y * sw + sx) * 4;
      const di = (y * fw + x) * 4;
      out[di] = sheet[si];
      out[di + 1] = sheet[si + 1];
      out[di + 2] = sheet[si + 2];
      out[di + 3] = sheet[si + 3];
    }
  }
  return out;
}

function components(data, w, h) {
  const seen = new Uint8Array(w * h);
  const comps = [];
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i] || data[i * 4 + 3] < OPAQUE) continue;
      const q = [[x, y]];
      seen[i] = 1;
      let size = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      while (q.length) {
        const [cx, cy] = q.pop();
        size++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni] || data[ni * 4 + 3] < OPAQUE) continue;
          seen[ni] = 1;
          q.push([nx, ny]);
        }
      }
      comps.push({ size, minX, maxX, minY, maxY });
    }
  }
  comps.sort((a, b) => b.size - a.size);
  return comps;
}

async function writeMag(data, w, h, outPath, scale = 6) {
  const mag = Buffer.alloc(w * scale * h * scale * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const r = data[si], g = data[si + 1], b = data[si + 2], a = data[si + 3];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const di = ((y * scale + dy) * w * scale + (x * scale + dx)) * 4;
          if (a < OPAQUE) {
            mag[di] = 255; mag[di + 1] = 0; mag[di + 2] = 255; mag[di + 3] = 255;
          } else {
            mag[di] = r; mag[di + 1] = g; mag[di + 2] = b; mag[di + 3] = 255;
          }
        }
      }
    }
  }
  await sharp(mag, { raw: { width: w * scale, height: h * scale, channels: 4 } })
    .png()
    .toFile(outPath);
}

async function main() {
  let totalIslands = 0;
  const flagged = [];
  for (const s of SHEETS) {
    const { data, info } = await sharp(path.join(DIR, s.file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < s.n; i++) {
      const frame = frameSlice(data, info.width, s.fw, s.fh, i);
      const comps = components(frame, s.fw, s.fh);
      const main = comps[0]?.size || 0;
      const islands = comps.filter((c) => c.size <= MAX_ISLAND && c.size < main * 0.05);
      if (islands.length) {
        flagged.push({
          sheet: s.file,
          frame: i,
          islands: islands.map((c) => ({
            size: c.size,
            box: [c.minX, c.minY, c.maxX, c.maxY],
          })),
          comps: comps.length,
          main,
        });
        totalIslands += islands.length;
        await writeMag(
          frame,
          s.fw,
          s.fh,
          path.join(QA, `island-${path.basename(s.file, '.png')}-f${i}-x6.png`),
          6,
        );
      }
    }
  }
  console.log(JSON.stringify({ totalIslands, flagged }, null, 2));
  console.log(flagged.length ? `FLAGGED ${flagged.length} frames` : 'CLEAN');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
