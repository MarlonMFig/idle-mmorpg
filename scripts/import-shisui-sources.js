/**
 * Import Shisui sprites from Downloads zips into assets/naruto-source/nu/shisui.
 * Then pack idle/walk/combo/hurt/death via curated alpha pack.
 *
 * Usage:
 *   node scripts/import-shisui-sources.js
 *   node scripts/process-shisui-all.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOAD =
  process.env.SHISUI_SRC ||
  path.normalize('c:\\Users\\marlo\\Downloads\\SPRITES JOGO\\SHISUI');
const DEST = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shisui');

const ZIP_MAP = [
  { zip: 'walk.zip', folder: 'walk' },
  { zip: 'idle.zip', folder: 'idle' },
  { zip: 'combo atack.zip', folder: 'combo' },
  { zip: 'hurt.zip', folder: 'hurt' },
  { zip: 'death.zip', folder: 'death' },
];

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
  // tar.exe handles most Zip on Win10+
  const r = spawnSync(
    'tar',
    ['-xf', zipPath, '-C', outDir],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`tar failed for ${zipPath}: ${r.stderr || r.stdout}`);
  }
}

async function normalizeFolder(srcDir, outDir, prefix) {
  fs.mkdirSync(outDir, { recursive: true });
  // clean old frames
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
  console.log(`${prefix}: ${pngs.length} frames → ${outDir}`);
  return pngs.length;
}

async function main() {
  if (!fs.existsSync(DOWNLOAD)) {
    throw new Error(`Source folder missing: ${DOWNLOAD}`);
  }
  fs.mkdirSync(DEST, { recursive: true });

  const rawRoot = path.join(DEST, '_raw');
  fs.mkdirSync(rawRoot, { recursive: true });

  for (const { zip, folder } of ZIP_MAP) {
    const zipPath = path.join(DOWNLOAD, zip);
    if (!fs.existsSync(zipPath)) {
      console.warn(`skip missing zip: ${zipPath}`);
      continue;
    }
    const extractTo = path.join(rawRoot, folder);
    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.mkdirSync(extractTo, { recursive: true });
    extractZip(zipPath, extractTo);
    console.log('extracted', zip);
  }

  // Loose folders can override zips (corrections), but never with fewer frames
  // than the zip extract just produced (stale partial folders).
  const looseOverrides = [
    { name: 'idle', dest: 'idle' },
    { name: 'combo atack', dest: 'combo' },
    { name: 'combo attack', dest: 'combo' },
    { name: 'combo', dest: 'combo' },
    { name: 'walk', dest: 'walk' },
    { name: 'hurt', dest: 'hurt' },
    { name: 'death', dest: 'death' },
  ];
  for (const { name, dest } of looseOverrides) {
    const loose = path.join(DOWNLOAD, name);
    if (!fs.existsSync(loose) || !listPngs(loose).length) continue;
    const extractTo = path.join(rawRoot, dest);
    const existing = listPngs(extractTo).length;
    const incoming = listPngs(loose).length;
    if (existing > 0 && incoming < existing) {
      console.log(
        `skip loose ${name}/ → ${dest} (${incoming} frames < zip ${existing})`,
      );
      continue;
    }
    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.mkdirSync(extractTo, { recursive: true });
    for (const src of listPngs(loose)) {
      fs.copyFileSync(src, path.join(extractTo, path.basename(src)));
    }
    console.log(`copied loose ${name}/ → ${dest} (${incoming} frames)`);
  }

  const counts = {};
  counts.walk = await normalizeFolder(path.join(rawRoot, 'walk'), path.join(DEST, 'walk'), 'walk');
  counts.idle = await normalizeFolder(path.join(rawRoot, 'idle'), path.join(DEST, 'idle'), 'idle');
  counts.combo = await normalizeFolder(path.join(rawRoot, 'combo'), path.join(DEST, 'combo'), 'combo');
  counts.hurt = await normalizeFolder(path.join(rawRoot, 'hurt'), path.join(DEST, 'hurt'), 'hurt');
  counts.death = await normalizeFolder(path.join(rawRoot, 'death'), path.join(DEST, 'death'), 'death');

  // Curated pack wants single damage/ folder = hurt then death
  const damageDir = path.join(DEST, 'damage');
  fs.mkdirSync(damageDir, { recursive: true });
  for (const f of fs.readdirSync(damageDir)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(damageDir, f));
  }
  let di = 1;
  for (const folder of ['hurt', 'death']) {
    for (const f of listPngs(path.join(DEST, folder))) {
      const dest = path.join(damageDir, `frame_${String(di).padStart(3, '0')}.png`);
      fs.copyFileSync(f, dest);
      di += 1;
    }
  }
  counts.damage = di - 1;
  console.log(`damage: ${counts.damage} frames (hurt+death)`);
  console.log('COUNTS', JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
