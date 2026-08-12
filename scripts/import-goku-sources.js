/**
 * Import Goku sprites from Downloads into
 * assets/dragon-ball-source/nu/goku/{idle,walk,combo,damage,jutsu}/
 *
 * Extract zips for walk/idle/combo/damage. Prefer loose JUTSU/ for jutsu
 * (copy + normalize frame_001.png...). Skip complex shippuden filters
 * unless frames are empty or exact duplicates.
 *
 *   node scripts/import-goku-sources.js
 *   GOKU_SRC=... node scripts/import-goku-sources.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.GOKU_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\GOKU');
const DEST = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'goku');

const ZIP_MAP = [
  { zip: 'WALK.zip', folder: 'walk' },
  { zip: 'IDLE.zip', folder: 'idle' },
  { zip: 'COMBO ATACK.zip', folder: 'combo' },
  { zip: 'HURT AND DEATH.zip', folder: 'damage' },
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
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width: w, height: h } = info;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= ALPHA) opaque += 1;
  }
  return opaque < 40;
}

/**
 * Copy PNG frames, skipping empty / exact file+pixel duplicates only.
 * Writes flat frame_001.png ... into extractTo.
 */
async function copySimpleJutsu(srcPaths, extractTo) {
  fs.rmSync(extractTo, { recursive: true, force: true });
  fs.mkdirSync(extractTo, { recursive: true });
  const seenFile = new Set();
  const seenPixel = new Set();
  let kept = 0;
  let skipped = 0;

  for (const src of srcPaths) {
    const buf = fs.readFileSync(src);
    const fileHash = crypto.createHash('sha1').update(buf).digest('hex');
    if (seenFile.has(fileHash)) {
      console.log(`  skip dup_file ${path.basename(src)}`);
      skipped += 1;
      continue;
    }
    if (await isEmptyFrame(src)) {
      console.log(`  skip empty ${path.basename(src)}`);
      skipped += 1;
      continue;
    }
    const { data } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixelHash = crypto.createHash('sha1').update(data).digest('hex');
    if (seenPixel.has(pixelHash)) {
      console.log(`  skip dup_pixel ${path.basename(src)}`);
      skipped += 1;
      continue;
    }
    seenFile.add(fileHash);
    seenPixel.add(pixelHash);
    kept += 1;
    const dest = path.join(extractTo, `frame_${String(kept).padStart(3, '0')}.png`);
    fs.writeFileSync(dest, buf);
  }
  return { kept, skipped };
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

  const looseJutsu = path.join(DOWNLOAD, 'JUTSU');
  const zipJutsu = path.join(DOWNLOAD, 'JUTSU.zip');
  const jutsuRaw = path.join(rawRoot, 'jutsu');
  let jutsuSrcPaths = [];
  let jutsuSourceLabel = '';

  if (fs.existsSync(looseJutsu) && listPngs(looseJutsu).length > 0) {
    jutsuSrcPaths = listPngs(looseJutsu);
    jutsuSourceLabel = `loose JUTSU/ (${jutsuSrcPaths.length} files)`;
  } else if (fs.existsSync(zipJutsu)) {
    fs.mkdirSync(jutsuRaw, { recursive: true });
    extractZip(zipJutsu, jutsuRaw);
    jutsuSrcPaths = listPngs(jutsuRaw);
    jutsuSourceLabel = `JUTSU.zip fallback (${jutsuSrcPaths.length} files)`;
  } else {
    throw new Error('No JUTSU source: need JUTSU/ folder or JUTSU.zip under ' + DOWNLOAD);
  }

  console.log(`jutsu source: ${jutsuSourceLabel}`);
  const { kept, skipped } = await copySimpleJutsu(jutsuSrcPaths, jutsuRaw);
  console.log(`jutsu filtered: kept ${kept}, skipped ${skipped}`);

  const counts = {
    walk: await normalizeFolder(path.join(rawRoot, 'walk'), path.join(DEST, 'walk'), 'walk'),
    idle: await normalizeFolder(path.join(rawRoot, 'idle'), path.join(DEST, 'idle'), 'idle'),
    combo: await normalizeFolder(path.join(rawRoot, 'combo'), path.join(DEST, 'combo'), 'combo'),
    damage: await normalizeFolder(
      path.join(rawRoot, 'damage'),
      path.join(DEST, 'damage'),
      'damage',
    ),
    jutsu: await normalizeFolder(path.join(rawRoot, 'jutsu'), path.join(DEST, 'jutsu'), 'jutsu'),
  };
  console.log('COUNTS', JSON.stringify(counts, null, 2));
  return counts;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
