/**
 * Import Gotenks sprites from Downloads into
 * assets/dragon-ball-source/nu/gotenks/{idle,walk,combo,damage,jutsu}/
 *
 * fly.zip → walk. ESPECIAL.png → jutsu (3 rows × 6 poses = 18f).
 *
 *   node scripts/import-gotenks-sources.js
 *   GOTENKS_SRC=... node scripts/import-gotenks-sources.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const { keyGreenBackground, isContent } = require('./lib/chroma-green-bg');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.GOTENKS_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\Gotenks');
const DEST = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'gotenks');

const ZIP_MAP = [
  { zip: 'fly.zip', folder: 'walk' },
  { zip: 'idle.zip', folder: 'idle' },
  { zip: 'combo atack.zip', folder: 'combo' },
  { zip: 'hurt and death.zip', folder: 'damage' },
];

const ALPHA = 16;

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (/\.(png|jpe?g|webp)$/i.test(name)) out.push(p);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const r = spawnSync('tar', ['-xf', zipPath, '-C', outDir], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`tar failed for ${zipPath}: ${r.stderr || r.stdout}`);
  }
}

async function isEmptyFrame(srcPath) {
  const { data } = await sharp(srcPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= ALPHA) opaque += 1;
  }
  return opaque < 40;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isScreenGreen(r, g, b) {
  return (
    (g >= 90 && g >= r + 40 && g >= b + 40) ||
    (g >= 70 && g >= r + 25 && g >= b + 25 && r <= 100 && b <= 100)
  );
}

function findBands(data, w, h, minH = 40) {
  const rd = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isScreenGreen(data[i], data[i + 1], data[i + 2])) continue;
      rd[y] += 1;
    }
  }
  const bands = [];
  let s = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && rd[y] > 8;
    if (filled && s < 0) s = y;
    if (!filled && s >= 0) {
      if (y - s >= minH) bands.push({ t: s, b: y });
      s = -1;
    }
  }
  return bands;
}

function cellsFromBand(data, w, band, { gapX = 3, minW = 18, thrRatio = 0.025 } = {}) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (isScreenGreen(data[i], data[i + 1], data[i + 2])) continue;
      dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * thrRatio));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 6) raw.push({ l: xs, r: x });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= gapX) prev.r = c.r;
    else merged.push({ ...c });
  }
  return merged
    .filter((c) => c.r - c.l >= minW)
    .map((c) => ({
      l: Math.max(0, c.l - 1),
      r: Math.min(w, c.r + 1),
      t: band.t,
      b: band.b,
    }));
}

function extractCell(data, w, cell, pad = 1) {
  const rawW = cell.r - cell.l;
  const rawH = cell.b - cell.t;
  const tmp = Buffer.alloc(rawW * rawH * 4);
  for (let y = 0; y < rawH; y += 1) {
    for (let x = 0; x < rawW; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * rawW + x) * 4;
      tmp[di] = data[si];
      tmp[di + 1] = data[si + 1];
      tmp[di + 2] = data[si + 2];
      tmp[di + 3] = data[si + 3];
    }
  }
  keyGreenBackground(tmp, rawW, rawH, { stripLabels: false });

  let minX = rawW;
  let maxX = -1;
  let minY = rawH;
  let maxY = -1;
  let op = 0;
  for (let y = 0; y < rawH; y += 1) {
    for (let x = 0; x < rawW; x += 1) {
      if (!isContent(tmp, (y * rawW + x) * 4)) continue;
      const i = (y * rawW + x) * 4;
      if (isScreenGreen(tmp[i], tmp[i + 1], tmp[i + 2]) && greenness(tmp[i], tmp[i + 1], tmp[i + 2]) >= 40) {
        continue;
      }
      op += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || op < 80) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const fw = bw + pad * 2;
  const fh = bh + pad * 2;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const si = ((minY + y) * rawW + (minX + x)) * 4;
      if (!isContent(tmp, si)) continue;
      if (isScreenGreen(tmp[si], tmp[si + 1], tmp[si + 2]) && greenness(tmp[si], tmp[si + 1], tmp[si + 2]) >= 40) {
        continue;
      }
      const di = ((y + pad) * fw + (x + pad)) * 4;
      frame[di] = tmp[si];
      frame[di + 1] = tmp[si + 1];
      frame[di + 2] = tmp[si + 2];
      frame[di + 3] = 255;
    }
  }
  return { frame, fw, fh, op, bw, bh };
}

async function writeFrames(outDir, frames) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(outDir, f));
  }
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
    await sharp(f.frame, { raw: { width: f.fw, height: f.fh, channels: 4 } })
      .png()
      .toFile(path.join(outDir, name));
  }
}

/** ESPECIAL.png — 3 rows de cast (6f cada); última linha = debris (ignorar). */
async function sliceEspecialSheet(sheetPath, outDir) {
  const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const bands = findBands(data, w, h, 40);
  if (bands.length < 3) {
    throw new Error(`ESPECIAL: expected ≥3 row bands, got ${bands.length}`);
  }

  const frames = [];
  for (let bi = 0; bi < 3; bi += 1) {
    const band = bands[bi];
    const cells = cellsFromBand(data, w, band, { gapX: 3, minW: 26, thrRatio: 0.02 });
    if (cells.length !== 6) {
      console.warn(`ESPECIAL row ${bi + 1}: expected 6 cells, got ${cells.length}`);
    }
    for (const cell of cells) {
      const cut = extractCell(data, w, cell);
      if (!cut) continue;
      if (cut.bh < 28 || cut.op < 200) continue;
      frames.push(cut);
    }
  }

  if (frames.length < 16) {
    throw new Error(`ESPECIAL: too few jutsu frames (${frames.length})`);
  }

  console.log(`ESPECIAL sliced: ${frames.length} frames (3 body rows)`);
  await writeFrames(outDir, frames);
  return frames.length;
}

async function normalizeFolder(srcDir, outDir, prefix) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(outDir, f));
  }
  const pngs = listPngs(srcDir);
  let i = 1;
  for (const src of pngs) {
    const dest = path.join(outDir, `frame_${String(i).padStart(3, '0')}.png`);
    await sharp(src).ensureAlpha().png().toFile(dest);
    i += 1;
  }
  console.log(`${prefix}: ${pngs.length} frames -> ${outDir}`);
  return pngs.length;
}

async function main() {
  if (!fs.existsSync(DOWNLOAD)) {
    throw new Error(`Source folder missing: ${DOWNLOAD}`);
  }
  fs.mkdirSync(DEST, { recursive: true });
  const rawRoot = path.join(DEST, '_raw');
  fs.rmSync(rawRoot, { recursive: true, force: true });
  fs.mkdirSync(rawRoot, { recursive: true });

  for (const { zip, folder } of ZIP_MAP) {
    const zipPath = path.join(DOWNLOAD, zip);
    if (!fs.existsSync(zipPath)) {
      console.warn('skip missing', zip);
      continue;
    }
    const out = path.join(rawRoot, folder);
    fs.mkdirSync(out, { recursive: true });
    extractZip(zipPath, out);
    console.log('extracted', zip, '->', folder, listPngs(out).length, 'png');
  }

  const especialPath = path.join(DOWNLOAD, 'ESPECIAL.png');
  if (!fs.existsSync(especialPath)) {
    throw new Error('Missing ESPECIAL.png under ' + DOWNLOAD);
  }
  const jutsuN = await sliceEspecialSheet(especialPath, path.join(DEST, 'jutsu'));

  const counts = {
    walk: await normalizeFolder(path.join(rawRoot, 'walk'), path.join(DEST, 'walk'), 'walk'),
    idle: await normalizeFolder(path.join(rawRoot, 'idle'), path.join(DEST, 'idle'), 'idle'),
    combo: await normalizeFolder(path.join(rawRoot, 'combo'), path.join(DEST, 'combo'), 'combo'),
    damage: await normalizeFolder(
      path.join(rawRoot, 'damage'),
      path.join(DEST, 'damage'),
      'damage',
    ),
    jutsu: jutsuN,
  };
  console.log('COUNTS', JSON.stringify(counts, null, 2));
  return counts;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
