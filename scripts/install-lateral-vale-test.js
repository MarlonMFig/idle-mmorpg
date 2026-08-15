/**
 * Instala mapa de teste lateral + overlay da grama (pés atrás da vegetação).
 * node scripts/install-lateral-vale-test.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_e20947e3ed094deb68a3b495673c18de_images_image-75218030-bb12-4cc2-a82a-253817e93da7.png',
);
const SRC_FALLBACK = path.join(ROOT, '.tmp', 'vale-lateral-src.png');
const OUT_PNG = path.join(ROOT, 'public', 'maps', 'hunt-vale-do-fim-lateral.png');
const OUT_FG = path.join(ROOT, 'public', 'maps', 'hunt-vale-do-fim-lateral-fg.png');
const OUT_TMX = path.join(ROOT, 'public', 'maps', 'hunt-vale-do-fim-lateral.tmx');
const OUT_META = path.join(ROOT, 'public', 'data', 'wonsr', 'maps', 'hunt-vale-do-fim-lateral.json');

const W = 1024;
const H = 576;
const TILE = 16;
const COLS = W / TILE;
const ROWS = H / TILE;

/** Pés no topo do solo, logo abaixo das lâminas de grama. */
const FLOOR_Y = 373;
const PLAYER_SPAWN = { x: 512, y: FLOOR_Y };
const ENEMY_SPAWN_RIGHT = { x: 968, y: FLOOR_Y };
const ENEMY_SPAWN_LEFT = { x: 56, y: FLOOR_Y };

function isDirt(r, g, b) {
  const max = Math.max(r, g, b);
  if (max < 8) return true;
  if (r < 95 && g < 95 && b < 85 && r >= b - 6 && g >= b - 12 && max > 8 && Math.abs(r - g) < 28) {
    return true;
  }
  return r > 35 && r >= g - 8 && g > 18 && b < 95 && r - b > 8 && r < 190;
}

function isGrass(r, g, b) {
  return g > r + 8 && g > b + 5 && g > 38 && r < 175 && b < 110;
}

async function buildForeground(srcPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .resize(W, H, { kernel: sharp.kernel.nearest, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  const channels = info.channels;
  const DIRT_Y = 372;

  for (let x = 0; x < W; x += 1) {
    let dirtTop = DIRT_Y;
    let seenDirt = false;
    for (let y = H - 1; y >= 300; y -= 1) {
      const i = (y * W + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!seenDirt && isDirt(r, g, b)) seenDirt = true;
      if (seenDirt && isGrass(r, g, b)) {
        dirtTop = y + 1;
        break;
      }
    }
    if (dirtTop < 360 || dirtTop > 390) dirtTop = DIRT_Y;

    let grassTop = dirtTop;
    for (let y = dirtTop - 1; y >= dirtTop - 24 && y >= 0; y -= 1) {
      const i = (y * W + x) * channels;
      if (isGrass(data[i], data[i + 1], data[i + 2])) grassTop = y;
    }

    for (let y = 0; y < H; y += 1) {
      const i = (y * W + x) * channels;
      if (y >= dirtTop) continue;
      if (y >= grassTop && isGrass(data[i], data[i + 1], data[i + 2])) continue;
      out[i + 3] = 0;
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels } }).png().toFile(OUT_FG);
}

async function main() {
  const srcPath = fs.existsSync(SRC) ? SRC : SRC_FALLBACK;
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing source map: ${srcPath}`);
  }
  fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
  if (srcPath !== SRC_FALLBACK) {
    fs.copyFileSync(srcPath, SRC_FALLBACK);
  }

  await sharp(srcPath)
    .resize(W, H, { kernel: sharp.kernel.nearest, fit: 'fill' })
    .png()
    .toFile(OUT_PNG);
  await buildForeground(srcPath);

  const collision = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(r < 2 ? 1 : 0);
    }
    collision.push(row.join(','));
  }
  const zeros = Array.from({ length: ROWS }, () => Array(COLS).fill(0).join(','));

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="hunt-vale-do-fim-lateral" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="hunt-vale-do-fim-lateral.png" width="${W}" height="${H}"/>
 </tileset>
 <layer id="1" name="ground" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${zeros.join(',\n')}
</data>
 </layer>
 <layer id="2" name="collision" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${collision.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(OUT_TMX, tmx);

  const meta = {
    mapKey: 'huntValeDoFimLateral',
    slug: 'hunt-vale-do-fim-lateral',
    label: 'Floresta de Treino (Lateral)',
    image: '/maps/hunt-vale-do-fim-lateral.png',
    foreground: '/maps/hunt-vale-do-fim-lateral-fg.png',
    tmx: '/maps/hunt-vale-do-fim-lateral.tmx',
    width: W,
    height: H,
    cols: COLS,
    rows: ROWS,
    lateralFloorY: FLOOR_Y,
    spawn: PLAYER_SPAWN,
    enemySpawns: [ENEMY_SPAWN_RIGHT, ENEMY_SPAWN_LEFT],
  };
  fs.mkdirSync(path.dirname(OUT_META), { recursive: true });
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2) + '\n');
  console.log('wrote', OUT_PNG);
  console.log('wrote', OUT_FG);
  console.log('wrote', OUT_TMX);
  console.log('wrote', OUT_META);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
