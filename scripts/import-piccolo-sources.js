/**
 * Import Piccolo sprites from Downloads into
 * assets/dragon-ball-source/nu/piccolo/{idle,walk,combo,damage}/
 *
 * FLY.zip → walk. HURT.zip + DEATH.zip → damage (1 hurt + 3 death).
 *
 *   node scripts/import-piccolo-sources.js
 *   PICCOLO_SRC=... node scripts/import-piccolo-sources.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.PICCOLO_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\PICCOLO');
const DEST = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'piccolo');

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

  const simple = [
    { zip: 'FLY.zip', folder: 'walk' },
    { zip: 'IDLE.zip', folder: 'idle' },
    { zip: 'COMBO ATACK.zip', folder: 'combo' },
  ];
  for (const { zip, folder } of simple) {
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

  // damage = HURT (1) then DEATH (3)
  const damageRaw = path.join(rawRoot, 'damage');
  fs.mkdirSync(damageRaw, { recursive: true });
  for (const zip of ['HURT.zip', 'DEATH.zip']) {
    const zipPath = path.join(DOWNLOAD, zip);
    if (!fs.existsSync(zipPath)) throw new Error(`Missing ${zip}`);
    const tmp = path.join(rawRoot, `_tmp-${zip.replace(/\.zip$/i, '')}`);
    fs.mkdirSync(tmp, { recursive: true });
    extractZip(zipPath, tmp);
    console.log('extracted', zip, listPngs(tmp).length, 'png');
  }
  const hurtPngs = listPngs(path.join(rawRoot, '_tmp-HURT'));
  const deathPngs = listPngs(path.join(rawRoot, '_tmp-DEATH'));
  let di = 1;
  for (const src of [...hurtPngs, ...deathPngs]) {
    const dest = path.join(damageRaw, `frame_${String(di).padStart(3, '0')}.png`);
    await sharp(src).ensureAlpha().png().toFile(dest);
    di += 1;
  }
  console.log(`damage merged: ${hurtPngs.length} hurt + ${deathPngs.length} death = ${di - 1}`);

  const counts = {
    walk: await normalizeFolder(path.join(rawRoot, 'walk'), path.join(DEST, 'walk'), 'walk'),
    idle: await normalizeFolder(path.join(rawRoot, 'idle'), path.join(DEST, 'idle'), 'idle'),
    combo: await normalizeFolder(path.join(rawRoot, 'combo'), path.join(DEST, 'combo'), 'combo'),
    damage: await normalizeFolder(damageRaw, path.join(DEST, 'damage'), 'damage'),
  };
  console.log('COUNTS', JSON.stringify(counts, null, 2));
  return counts;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
