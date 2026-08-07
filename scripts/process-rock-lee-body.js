/**
 * Rock Lee idle + walk (fundo verde) → public/sprites/player/rock-lee/
 * Fontes: assets/naruto-source/nu/rock-lee-{idle,walk}-sheet.png
 *
 * npm run rock-lee:body
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee');
const TARGET_BODY_H = 48;

function isGreen(r, g, b) {
  return g >= 80 && r <= 40 && b <= 40 && g >= r + 40 && g >= b + 40;
}

/**
 * @param {string} inputPath
 * @param {string} outName idle.png | walk.png
 * @param {string} metaKey
 * @param {number} frameRate
 */
async function processSheet(inputPath, outName, metaKey, frameRate) {
  if (!fs.existsSync(inputPath)) throw new Error(`Sheet não encontrada: ${inputPath}`);

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h; y += 1) {
      const i = (y * w + x) * 4;
      if (!isGreen(data[i], data[i + 1], data[i + 2])) dens[x] += 1;
    }
  }

  const thr = Math.max(2, Math.floor(h * 0.06));
  const cells = [];
  let start = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      cells.push({ l: start, r: x });
      start = -1;
    }
  }
  const merged = [];
  for (const c of cells) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 4) prev.r = c.r;
    else merged.push({ ...c });
  }
  if (merged.length === 0) throw new Error(`nenhum frame em ${inputPath}`);
  console.log(`${outName}: cells=${merged.length}`, merged.map((c) => c.r - c.l).join(','));

  const cut = merged.map((cell) => {
    const fw = cell.r - cell.l;
    const frame = Buffer.alloc(fw * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const si = (y * w + cell.l + x) * 4;
        const di = (y * fw + x) * 4;
        const r = data[si];
        const g = data[si + 1];
        const b = data[si + 2];
        if (isGreen(r, g, b)) {
          frame[di + 3] = 0;
          continue;
        }
        frame[di] = r;
        frame[di + 1] = g;
        frame[di + 2] = b;
        frame[di + 3] = 255;
      }
    }
    let minX = fw;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < 16) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return {
      frame,
      fw,
      fh: h,
      minX,
      maxX,
      minY,
      maxY,
      bw: maxX - minX + 1,
      bh: maxY - minY + 1,
    };
  });

  const pad = 1;
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const contentH0 = Math.max(...cut.map((c) => c.bh));

  const normalized = cut.map((box) => {
    const canvas = Buffer.alloc(cellW * cellH * 4);
    const dx = Math.floor((cellW - box.bw) / 2);
    const dy = cellH - box.bh - pad;
    for (let y = 0; y < box.bh; y += 1) {
      for (let x = 0; x < box.bw; x += 1) {
        const si = ((box.minY + y) * box.fw + (box.minX + x)) * 4;
        const di = ((dy + y) * cellW + dx + x) * 4;
        canvas[di] = box.frame[si];
        canvas[di + 1] = box.frame[si + 1];
        canvas[di + 2] = box.frame[si + 2];
        canvas[di + 3] = box.frame[si + 3];
      }
    }
    return canvas;
  });

  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentH0));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const contentHeight = Math.max(1, Math.round(contentH0 * scale));

  const frames = [];
  for (const frame of normalized) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < d.length; i += 4) {
      if (isGreen(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
    }
    frames.push(d);
  }

  const sheetW = outW * frames.length;
  const sheet = Buffer.alloc(sheetW * outH * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < outH; y += 1) {
      frame.copy(sheet, (y * sheetW + index * outW) * 4, y * outW * 4, (y + 1) * outW * 4);
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet, { raw: { width: sheetW, height: outH, channels: 4 } })
    .png()
    .toFile(path.join(OUT_DIR, outName));

  const metrics = {
    image: `/sprites/player/rock-lee/${outName}`,
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight,
    frameRate,
  };
  console.log(
    `-> ${outName} ${sheetW}x${outH} fw=${outW} fh=${outH} n=${frames.length} contentH=${contentHeight}`,
  );
  return { metaKey, metrics };
}

async function main() {
  const src = path.join(ROOT, 'assets', 'naruto-source', 'nu');
  const idle = await processSheet(
    path.join(src, 'rock-lee-idle-sheet.png'),
    'idle.png',
    'rock-lee-idle',
    7,
  );
  const walk = await processSheet(
    path.join(src, 'rock-lee-walk-sheet.png'),
    'walk.png',
    'rock-lee-walk',
    10,
  );

  const metaPath = path.join(OUT_DIR, 'meta.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/\\n\s*$/, '').trim());
    } catch {
      meta = {};
    }
  }
  meta[idle.metaKey] = { ...idle.metrics, source: 'rock-lee-idle-sheet.png' };
  meta[walk.metaKey] = { ...walk.metrics, source: 'rock-lee-walk-sheet.png' };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(JSON.stringify({ idle: idle.metrics, walk: walk.metrics }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
