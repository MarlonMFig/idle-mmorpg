/**
 * Substitui 3 arenas laterais da aba Naruto pelos PNGs upscaled do RAR.
 * node scripts/install-naruto-tab-3-upscaled.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const SRC_DIR = path.join(ROOT, '.tmp-naruto-3mapas');

const MAP_W = 3840;
const MAP_H = 2160;

const INSTALLS = [
  {
    mapKey: 'huntCampoTreinamento',
    slug: 'hunt-campo-treinamento',
    src: 'campo_treinamento_konoha_3840x2160_upscaled.png',
    floorY: 1386,
    fg: 'grass',
  },
  {
    mapKey: 'huntEsconderijoAkatsuki',
    slug: 'hunt-esconderijo-akatsuki',
    src: 'caverna_akatsuki_3840x2160_upscaled.png',
    floorY: 1400,
    fg: 'edge',
  },
  {
    mapKey: 'huntLabOrochimaru',
    slug: 'hunt-lab-orochimaru',
    src: 'esconderijo_orochimaru_3840x2160_upscaled.png',
    floorY: 1400,
    fg: 'edge',
  },
];

function isGrass(r, g, b) {
  return g > r + 8 && g > b + 5 && g > 38 && r < 180 && b < 120;
}

function isSurfacePixel(mode, r, g, b) {
  if (mode === 'grass') return isGrass(r, g, b);
  return (r + g + b) / 3 > 25;
}

async function buildForeground(srcPath, outPath, floorY, mode) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const channels = info.channels;
  const out = Buffer.from(data);
  const fringe = mode === 'edge' ? 18 : 28;

  for (let x = 0; x < W; x += 1) {
    let top = floorY;
    for (let y = floorY - 1; y >= floorY - fringe && y >= 0; y -= 1) {
      const i = (y * W + x) * channels;
      if (isSurfacePixel(mode, data[i], data[i + 1], data[i + 2])) top = y;
    }
    for (let y = 0; y < H; y += 1) {
      const i = (y * W + x) * channels;
      if (y >= floorY) continue;
      if (y >= top && isSurfacePixel(mode, data[i], data[i + 1], data[i + 2])) continue;
      out[i + 3] = 0;
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels } }).png().toFile(outPath);
}

async function installOne(entry) {
  const src = path.join(SRC_DIR, entry.src);
  if (!fs.existsSync(src)) throw new Error(`Missing ${src}`);
  const meta = await sharp(src).metadata();
  console.log(entry.src, `${meta.width}x${meta.height}`);
  const prepared = sharp(src).resize(MAP_W, MAP_H, { fit: 'fill' });
  const outPng = path.join(MAPS_DIR, `${entry.slug}.png`);
  const outFg = path.join(MAPS_DIR, `${entry.slug}-fg.png`);
  await prepared.clone().png({ compressionLevel: 6 }).toFile(outPng);
  await buildForeground(outPng, outFg, entry.floorY, entry.fg);
  console.log('OK', entry.slug, `${MAP_W}x${MAP_H}`, `floor=${entry.floorY}`);
}

async function main() {
  for (const entry of INSTALLS) {
    await installOne(entry);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
