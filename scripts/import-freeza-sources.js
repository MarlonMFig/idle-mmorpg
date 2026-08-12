/**
 * Import Freeza sprites from Downloads into
 * assets/dragon-ball-source/nu/freeza/{idle,walk,combo,damage,jutsu,vfx}/
 *
 * Fly.zip → walk (flight). Especial Death Ball.zip / ESPECIAL/ → jutsu.
 * vfx novo.zip / VFX ESPECIAL INIMIGO/ → vfx.
 *
 *   node scripts/import-freeza-sources.js
 *   FREEZA_SRC=... node scripts/import-freeza-sources.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.FREEZA_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\freeza');
const DEST = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'freeza');

const ZIP_MAP = [
  { zip: 'Fly.zip', folder: 'walk' },
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

async function copySimpleFrames(srcPaths, extractTo, label) {
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
  console.log(`${label} filtered: kept ${kept}, skipped ${skipped}`);
  return kept;
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

  const especialZip = path.join(DOWNLOAD, 'Especial Death Ball.zip');
  const especialDir = path.join(DOWNLOAD, 'ESPECIAL');
  const vfxNovoZip = path.join(DOWNLOAD, 'vfx novo.zip');
  const vfxDir = path.join(DOWNLOAD, 'VFX ESPECIAL INIMIGO');

  let especialSrcPaths = [];
  let especialLabel = '';
  if (fs.existsSync(especialZip)) {
    const especialRaw = path.join(rawRoot, 'especial-zip');
    fs.mkdirSync(especialRaw, { recursive: true });
    extractZip(especialZip, especialRaw);
    especialSrcPaths = listPngs(especialRaw);
    especialLabel = `Especial Death Ball.zip (${especialSrcPaths.length} files)`;
  } else if (fs.existsSync(especialDir) && listPngs(especialDir).length > 0) {
    especialSrcPaths = listPngs(especialDir);
    especialLabel = `ESPECIAL/ (${especialSrcPaths.length} files)`;
  } else {
    throw new Error('Missing ESPECIAL: need "Especial Death Ball.zip" or ESPECIAL/ under ' + DOWNLOAD);
  }
  console.log(`jutsu source: ${especialLabel}`);

  let vfxSrcPaths = [];
  let vfxLabel = '';
  if (fs.existsSync(vfxNovoZip)) {
    const vfxRaw = path.join(rawRoot, 'vfx-zip');
    fs.mkdirSync(vfxRaw, { recursive: true });
    extractZip(vfxNovoZip, vfxRaw);
    vfxSrcPaths = listPngs(vfxRaw);
    vfxLabel = `vfx novo.zip (${vfxSrcPaths.length} files)`;
  } else if (fs.existsSync(vfxDir) && listPngs(vfxDir).length > 0) {
    vfxSrcPaths = listPngs(vfxDir);
    vfxLabel = `VFX ESPECIAL INIMIGO/ (${vfxSrcPaths.length} files)`;
  } else {
    throw new Error('Missing VFX: need "vfx novo.zip" or VFX ESPECIAL INIMIGO/ under ' + DOWNLOAD);
  }
  console.log(`vfx source: ${vfxLabel}`);

  await copySimpleFrames(especialSrcPaths, path.join(rawRoot, 'jutsu'), 'jutsu');
  await copySimpleFrames(vfxSrcPaths, path.join(rawRoot, 'vfx'), 'vfx');

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
    vfx: await normalizeFolder(path.join(rawRoot, 'vfx'), path.join(DEST, 'vfx'), 'vfx'),
  };
  console.log('COUNTS', JSON.stringify(counts, null, 2));
  return counts;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
