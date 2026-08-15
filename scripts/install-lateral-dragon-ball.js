/**
 * Instala mapas laterais Dragon Ball 4K.
 * node scripts/install-lateral-dragon-ball.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const META_DIR = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
const SRC_DIR = path.join(ROOT, '.tmp', 'mapas-db');

const MAP_W = 3840;
const MAP_H = 2160;
const TILE = 16;
const COLS = MAP_W / TILE;
const ROWS = MAP_H / TILE;
const LAYOUT_SCALE = 5.75;
const CACHE_TAG = 'latdb2';

const INSTALLS = [
  {
    mapKey: 'huntNamekusei',
    slug: 'hunt-namekusei',
    label: 'Planeta Namekusei',
    src: 'planeta_namekusei_3840x2160.png',
    // Lip da grama azul (~1372) + plantio no solo.
    floorY: 1384,
    fg: 'blue',
  },
  {
    mapKey: 'huntTorneioArtesMarciais',
    slug: 'hunt-torneio-artes-marciais',
    label: 'Torneio de Artes Marciais',
    src: 'torneio_artes_marciais_3840x2160.png',
    // Lip da frente do tapete verde (~1452) + plantio.
    floorY: 1460,
    fg: 'grass',
  },
  {
    mapKey: 'huntSalaDoTempo',
    slug: 'hunt-sala-do-tempo',
    label: 'Sala do Tempo',
    src: 'sala_do_tempo_3840x2160.png',
    // Lip do mármore (~1444) + plantio na junta dourada.
    floorY: 1464,
    fg: 'edge',
  },
  {
    mapKey: 'huntDesertoSaiyajin',
    slug: 'hunt-deserto-saiyajin',
    label: 'Deserto Rochoso Saiyajin',
    src: 'deserto_rochoso_saiyajin_3840x2160.png',
    // Lip da areia (~1412) + plantio no corte.
    floorY: 1424,
    fg: 'sand',
  },
];

function isGrass(r, g, b) {
  return g > r + 8 && g > b + 5 && g > 38 && r < 200 && b < 160;
}

function isBlueMoss(r, g, b) {
  return b > 90 && g > 70 && b >= r + 10;
}

function isSand(r, g, b) {
  return r > 110 && g > 70 && b < 150 && r >= g - 10 && r - b > 20;
}

function isSurfacePixel(mode, r, g, b) {
  if (mode === 'grass') return isGrass(r, g, b);
  if (mode === 'blue') return isBlueMoss(r, g, b);
  if (mode === 'sand') return isSand(r, g, b);
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
  const fringe = mode === 'edge' ? 22 : mode === 'sand' ? 26 : 36;

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
    throw new Error(`Extract zip into ${SRC_DIR} first`);
  }
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  const metas = [];
  for (const entry of INSTALLS) {
    metas.push(await installOne(entry));
  }

  const indexPath = path.join(META_DIR, 'hunt-arenas-index.json');
  const index = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : { arenas: [] };
  const have = new Set(index.arenas.map((a) => a.mapKey));
  for (const m of metas) {
    const row = {
      mapKey: m.mapKey,
      slug: m.slug,
      label: m.label,
      image: m.image,
      tmx: m.tmx,
      width: m.width,
      height: m.height,
      cols: m.cols,
      rows: m.rows,
      lateralFloorY: m.lateralFloorY,
      layoutScale: m.layoutScale,
      spawn: m.spawn,
      enemySpawns: m.enemySpawns,
    };
    const idx = index.arenas.findIndex((a) => a.mapKey === m.mapKey);
    if (idx >= 0) index.arenas[idx] = row;
    else index.arenas.push(row);
    have.add(m.mapKey);
  }
  index.generatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  console.log('Done', metas.length, 'Dragon Ball lateral maps');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
