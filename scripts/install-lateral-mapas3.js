/**
 * Instala mapas laterais 4K do MAPAS 3.zip.
 * node scripts/install-lateral-mapas3.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const META_DIR = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
const SRC_DIR = path.join(ROOT, '.tmp', 'mapas3');

const MAP_W = 3840;
const MAP_H = 2160;
const TILE = 16;
const COLS = MAP_W / TILE;
const ROWS = MAP_H / TILE;
/** Mesmo tamanho na tela que o teste 1024×576 @ 1.8 */
const LAYOUT_SCALE = 5.75;
const CACHE_TAG = 'lat4k3';

const INSTALLS = [
  {
    mapKey: 'huntMonteMyoboku',
    slug: 'hunt-monte-myoboku',
    label: 'Monte Myoboku',
    src: 'monte_myoboku_3840x2160.png',
    floorY: 1440,
    fg: 'grass',
  },
  {
    mapKey: 'huntArenaExameChunin',
    slug: 'hunt-arena-exame-chunin',
    label: 'Arena Exame Chunin',
    src: 'arena_exame_chunin_3840x2160.png',
    floorY: 1500,
    fg: 'edge',
  },
  {
    mapKey: 'huntDistritoUchiha',
    slug: 'hunt-distrito-uchiha',
    label: 'Distrito Uchiha',
    src: 'distrito_uchiha_3840x2160.png',
    floorY: 1420,
    fg: 'edge',
  },
  {
    mapKey: 'huntCampoGuerraNinja',
    slug: 'hunt-campo-guerra-ninja',
    label: 'Campo de Guerra Ninja',
    src: 'campo_guerra_ninja_3840x2160.png',
    floorY: 1390,
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

function writeTmx(slug) {
  const zeros = Array.from({ length: ROWS }, () => Array(COLS).fill(0).join(','));
  const collision = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(r < 3 ? 1 : 0);
    }
    collision.push(row.join(','));
  }

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="${slug}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="${slug}.png" width="${MAP_W}" height="${MAP_H}"/>
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
  fs.writeFileSync(path.join(MAPS_DIR, `${slug}.tmx`), tmx);
}

async function installOne(entry) {
  const src = path.join(SRC_DIR, entry.src);
  if (!fs.existsSync(src)) throw new Error(`Missing ${src}`);
  const outPng = path.join(MAPS_DIR, `${entry.slug}.png`);
  const outFg = path.join(MAPS_DIR, `${entry.slug}-fg.png`);
  await sharp(src).png().toFile(outPng);
  await buildForeground(src, outFg, entry.floorY, entry.fg);
  writeTmx(entry.slug);

  const meta = {
    mapKey: entry.mapKey,
    slug: entry.slug,
    label: entry.label,
    image: `/maps/${entry.slug}.png`,
    foreground: `/maps/${entry.slug}-fg.png`,
    tmx: `/maps/${entry.slug}.tmx`,
    width: MAP_W,
    height: MAP_H,
    cols: COLS,
    rows: ROWS,
    lateralFloorY: entry.floorY,
    layoutScale: LAYOUT_SCALE,
    spawn: { x: Math.round(MAP_W / 2), y: entry.floorY },
    enemySpawns: [
      { x: MAP_W - 160, y: entry.floorY },
      { x: 160, y: entry.floorY },
    ],
  };
  fs.mkdirSync(META_DIR, { recursive: true });
  fs.writeFileSync(path.join(META_DIR, `${entry.slug}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log('OK', entry.slug, `floor=${entry.floorY}`);
  return meta;
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Extract MAPAS 3.zip into ${SRC_DIR} first`);
  }
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  for (const entry of INSTALLS) {
    await installOne(entry);
  }
  console.log('Done', INSTALLS.length, 'maps from MAPAS 3');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
