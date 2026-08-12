/**
 * Import Naruto Shippuden sprites from Downloads into
 * assets/naruto-source/nu/naruto-shippuden/{idle,walk,combo,damage,jutsu}/
 *
 * Prefer zip extracts for body packs. JUTSU: loose JUTSU/ is PRIMARY
 * (wider corrected canvases); fall back to JUTSU.zip. Filter empty,
 * exact-duplicate, incomplete lead-in, and post-peak impact restarts
 * (e.g. frame_040..042 cloning the peak envelope).
 *
 *   node scripts/import-naruto-shippuden-sources.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.NARUTO_SHIPPUDEN_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\NARUTO SHIPUDEN');
const DEST = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'naruto-shippuden');

const ZIP_MAP = [
  { zip: 'WALK.zip', folder: 'walk' },
  { zip: 'IDLE.zip', folder: 'idle' },
  { zip: 'COMBO ATACK.zip', folder: 'combo' },
  { zip: 'HURT AND DEATH.zip', folder: 'damage' },
  // JUTSU.zip is fallback only - handled separately after loose folder.
  { zip: 'JUTSU.zip', folder: 'jutsu', optional: true },
];

const ALPHA = 16;
// Full-sheet dump / residual: huge fill + multi-edge clamp.
const JUTSU_GARBAGE_FILL = 0.70;
const JUTSU_GARBAGE_MIN_EDGES = 3;
// Incomplete first frames (feet-only) vs established cast pose height.
const JUTSU_LEADIN_H_RATIO = 0.55;
// After impact has peaked and resolved, block returning to near-peak (loop restart).
const JUTSU_POST_PEAK_RESTART = 0.9;
const JUTSU_RESOLVE_RATIO = 0.85;

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

/**
 * @returns {Promise<{ keep: boolean, reason?: string, opaque?: number, fill?: number, bh?: number }>}
 */
async function classifyJutsuFrame(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width: w, height: h } = info;
  let opaque = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (opaque < 40) {
    return { keep: false, reason: 'empty', opaque, fill: opaque / (w * h), bh: 0 };
  }
  const fill = opaque / (w * h);
  const bh = maxY >= 0 ? maxY - minY + 1 : 0;
  const edges =
    (minX <= 1 ? 1 : 0) +
    (minY <= 1 ? 1 : 0) +
    (maxX >= w - 2 ? 1 : 0) +
    (maxY >= h - 2 ? 1 : 0);
  const nearFullSheet =
    maxX >= 0 &&
    maxX - minX + 1 >= w * 0.92 &&
    maxY - minY + 1 >= h * 0.95 &&
    fill >= JUTSU_GARBAGE_FILL;
  if (nearFullSheet || (fill >= JUTSU_GARBAGE_FILL && edges >= JUTSU_GARBAGE_MIN_EDGES)) {
    return {
      keep: false,
      reason: `garbage_fill=${(fill * 100).toFixed(1)}%_edges=${edges}`,
      opaque,
      fill,
      bh,
    };
  }
  return { keep: true, opaque, fill, bh };
}

/**
 * Copy unique, continuous PNG frames into extractTo as flat files.
 * Order preserved. Drops: file/pixel dups, empty/garbage, incomplete lead-in,
 * and post-peak "impact restart" clones (opaque pops giant VFX back).
 */
async function copyFilteredJutsu(srcPaths, extractTo) {
  fs.rmSync(extractTo, { recursive: true, force: true });
  fs.mkdirSync(extractTo, { recursive: true });
  const seenFile = new Set();
  const seenPixel = new Set();
  /** @type {{ src: string, buf: Buffer, opaque: number, bh: number }[]} */
  const candidates = [];
  let skipped = 0;

  for (const src of srcPaths) {
    const buf = fs.readFileSync(src);
    const fileHash = crypto.createHash('sha1').update(buf).digest('hex');
    if (seenFile.has(fileHash)) {
      console.log(`  skip dup_file ${path.basename(src)}`);
      skipped += 1;
      continue;
    }
    const cls = await classifyJutsuFrame(src);
    if (!cls.keep) {
      console.log(`  skip ${path.basename(src)} (${cls.reason})`);
      skipped += 1;
      continue;
    }
    // Perceptual/pixel duplicate (re-encoded clones of peak frames).
    const { data } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixelHash = crypto.createHash('sha1').update(data).digest('hex');
    if (seenPixel.has(pixelHash)) {
      console.log(`  skip dup_pixel ${path.basename(src)}`);
      skipped += 1;
      continue;
    }
    seenFile.add(fileHash);
    seenPixel.add(pixelHash);
    candidates.push({ src, buf, opaque: cls.opaque || 0, bh: cls.bh || 0 });
  }

  // Drop incomplete lead-in (feet-only): height << early cast pose.
  if (candidates.length >= 4) {
    const probe = candidates.slice(1, Math.min(6, candidates.length)).map((c) => c.bh);
    const med = probe.slice().sort((a, b) => a - b)[Math.floor(probe.length / 2)] || 1;
    while (
      candidates.length > 2 &&
      candidates[0].bh > 0 &&
      candidates[0].bh < med * JUTSU_LEADIN_H_RATIO
    ) {
      console.log(
        `  skip leadin_incomplete ${path.basename(candidates[0].src)} (bh=${candidates[0].bh} < ${Math.round(med * JUTSU_LEADIN_H_RATIO)} of early pose)`,
      );
      candidates.shift();
      skipped += 1;
    }
  }

  // Block post-peak restart: impact peak -> decline -> giant again (continuity pop).
  let peakOpaque = 0;
  let sawImpactPeak = false;
  let decliningFromPeak = false;
  const keptList = [];
  for (const c of candidates) {
    const impactScale = c.opaque > 20000 || peakOpaque > 20000;
    if (c.opaque > peakOpaque) {
      if (
        decliningFromPeak &&
        sawImpactPeak &&
        c.opaque >= peakOpaque * JUTSU_POST_PEAK_RESTART
      ) {
        console.log(
          `  skip post_peak_restart ${path.basename(c.src)} (opaque=${c.opaque} peak=${peakOpaque})`,
        );
        skipped += 1;
        continue;
      }
      peakOpaque = c.opaque;
      if (peakOpaque > 20000) sawImpactPeak = true;
      decliningFromPeak = false;
    } else if (sawImpactPeak && impactScale && c.opaque < peakOpaque * JUTSU_RESOLVE_RATIO) {
      decliningFromPeak = true;
    } else if (
      decliningFromPeak &&
      sawImpactPeak &&
      c.opaque >= peakOpaque * JUTSU_POST_PEAK_RESTART
    ) {
      console.log(
        `  skip post_peak_restart ${path.basename(c.src)} (opaque=${c.opaque} peak=${peakOpaque})`,
      );
      skipped += 1;
      continue;
    }
    keptList.push(c);
  }

  let kept = 0;
  for (const c of keptList) {
    kept += 1;
    const dest = path.join(extractTo, `frame_${String(kept).padStart(3, '0')}.png`);
    fs.writeFileSync(dest, c.buf);
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
    // Flatten RGB/JPEG -> straight alpha, preserve opaque sources.
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

  for (const { zip, folder, optional } of ZIP_MAP) {
    if (folder === 'jutsu') continue; // handled below
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

  // JUTSU: loose folder PRIMARY (user-corrected 376px canvases). Zip fallback.
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
  const { kept, skipped } = await copyFilteredJutsu(jutsuSrcPaths, jutsuRaw);
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
