/**
 * Empacota walk 4 dirs (N/S/W/E) do zip Male_ninja → spritesheet Suna.
 */
if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join('tmp-male-ninja', 'Male_ninja_2D_pixel_art');
const OUT_DIR = path.join('public', 'sprites', 'player', 'suna');
const DIRS = [
  { name: 'north', row: 'up' },
  { name: 'south', row: 'down' },
  { name: 'west', row: 'left' },
  { name: 'east', row: 'right' },
];
const FRAME_COUNT = 6;
const CELL = 96;

async function loadPng(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function blit(dest, destW, dx, dy, src, srcW, srcH) {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 4;
      const di = ((dy + y) * destW + (dx + x)) * 4;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = src[si + 3];
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sheetW = CELL * FRAME_COUNT;
  const sheetH = CELL * DIRS.length;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);

  for (let r = 0; r < DIRS.length; r++) {
    const dir = DIRS[r].name;
    for (let f = 0; f < FRAME_COUNT; f++) {
      const file = path.join(
        ROOT,
        'animations',
        'Walk',
        dir,
        `frame_${String(f).padStart(3, '0')}.png`,
      );
      const { data, w, h } = await loadPng(file);
      const ox = Math.floor((CELL - w) / 2);
      const oy = CELL - h;
      blit(sheet, sheetW, f * CELL + ox, r * CELL + oy, data, w, h);
    }
  }

  const walkOut = path.join(OUT_DIR, 'suna-male-walk.png');
  await sharp(sheet, { raw: { width: sheetW, height: sheetH, channels: 4 } })
    .png()
    .toFile(walkOut);

  const previewSrc = path.join(ROOT, 'rotations', 'south.png');
  const previewOut = path.join(OUT_DIR, 'suna-male.png');
  await sharp(previewSrc).png().toFile(previewOut);

  // Ataque placeholder: idle sul (1 frame) até chegar sheet de ataque.
  const attackOut = path.join(OUT_DIR, 'suna-male-attack.png');
  await sharp(previewSrc).png().toFile(attackOut);

  console.log('wrote', walkOut, `${sheetW}x${sheetH}`, 'cell', CELL);
  console.log('wrote', previewOut);
  console.log('wrote', attackOut);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
