/**
 * Instala mapas de caça laterais 4K (visão de perfil) a partir dos zips MAPAS.
 * node scripts/install-lateral-hunt-maps.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const META_DIR = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
const SRC_DIRS = [path.join(ROOT, '.tmp', 'mapas1'), path.join(ROOT, '.tmp', 'mapas2')];

const MAP_W = 3840;
const MAP_H = 2160;
const TILE = 16;
const COLS = MAP_W / TILE; // 240
const ROWS = MAP_H / TILE; // 135
const LAYOUT_SCALE = 6.75; // 1.8 no mapa 1024 × (2160/576) — mesmo tamanho na tela
const CACHE_TAG = 'lat4k2';

/**
 * floorY = pés na superfície (topo do solo / grama / neve / madeira).
 * fg = gera overlay da franja frontal (pés atrás da vegetação).
 */
const INSTALLS = [
  {
    mapKey: 'huntForestClearing',
    slug: 'hunt-forest-clearing',
    label: 'Floresta da Morte',
    src: 'floresta_da_morte_3840x2160.png',
    floorY: 1400,
    fg: 'grass',
  },
  {
    mapKey: 'huntValeDoFim',
    slug: 'hunt-vale-do-fim',
    label: 'Vale do Fim',
    src: 'vale_das_estatuas_3840x2160.png',
    floorY: 1384,
    fg: 'grass',
  },
  {
    mapKey: 'huntCampoTreinamento',
    slug: 'hunt-campo-treinamento',
    label: 'Campo de Treinamento',
    src: 'campo_treinamento_konoha_3840x2160.png',
    floorY: 1400,
    fg: 'grass',
  },
  {
    mapKey: 'huntPontePaisOnda',
    slug: 'hunt-ponte-pais-onda',
    label: 'Ponte da Névoa',
    src: 'ponte_da_nevoa_3840x2160.png',
    floorY: 1470,
    fg: 'edge',
  },
  {
    mapKey: 'huntEsconderijoAkatsuki',
    slug: 'hunt-esconderijo-akatsuki',
    label: 'Caverna Akatsuki',
    src: 'caverna_akatsuki_3840x2160.png',
    floorY: 1400,
    fg: 'edge',
  },
  {
    mapKey: 'huntLabOrochimaru',
    slug: 'hunt-lab-orochimaru',
    label: 'Esconderijo Orochimaru',
    src: 'esconderijo_orochimaru_3840x2160.png',
    floorY: 1400,
    fg: 'edge',
  },
  {
    mapKey: 'huntPaisDoVento',
    slug: 'hunt-pais-do-vento',
    label: 'Deserto da Areia',
    src: 'deserto_da_areia_3840x2160.png',
    floorY: 1400,
    fg: 'sand',
  },
  {
    mapKey: 'huntArenaExameChunnin',
    slug: 'hunt-arena-exame-chunnin',
    label: 'País do Ferro',
    src: 'pais_do_ferro_3840x2160.png',
    floorY: 1400,
    fg: 'snow',
  },
];

function findSrc(name) {
  for (const dir of SRC_DIRS) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(`Source missing: ${name}`);
}

function isGrass(r, g, b) {
  return g > r + 8 && g > b + 5 && g > 38 && r < 180 && b < 120;
}

function isSand(r, g, b) {
  return r > 120 && g > 90 && b < 140 && r >= g - 5 && r - b > 30;
}

function isSnow(r, g, b) {
  return r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25;
}

function isSurfacePixel(mode, r, g, b) {
  if (mode === 'grass') return isGrass(r, g, b);
  if (mode === 'sand') return isSand(r, g, b);
  if (mode === 'snow') return isSnow(r, g, b);
  // edge: qualquer pixel próximo da superfície (não transparente no recorte)
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
      // Só o céu no topo bloqueia; o chão lateral usa floorY no runtime.
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
  const src = findSrc(entry.src);
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

function writeIndex(metas) {
  const index = {
    generatedAt: new Date().toISOString(),
    arenas: metas.map((m) => ({
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
    })),
  };
  fs.writeFileSync(path.join(META_DIR, 'hunt-arenas-index.json'), JSON.stringify(index, null, 2) + '\n');
}

function tsEntry(entry) {
  const v = CACHE_TAG;
  return `  [MAP_KEYS.${entry.mapKey}]: {
    mapKey: MAP_KEYS.${entry.mapKey},
    imageKey: 'map-${entry.slug}',
    imageUrl: '/maps/${entry.slug}.png?v=${v}',
    foregroundKey: 'map-${entry.slug}-fg',
    foregroundUrl: '/maps/${entry.slug}-fg.png?v=${v}',
    width: ${MAP_W},
    height: ${MAP_H},
    spawn: { x: ${Math.round(MAP_W / 2)}, y: ${entry.floorY} },
    enemySpawns: [
      { x: ${MAP_W - 160}, y: ${entry.floorY} },
      { x: 160, y: ${entry.floorY} },
    ],
    lateralFloorY: ${entry.floorY},
    layoutScale: ${LAYOUT_SCALE},
  },`;
}

async function main() {
  for (const dir of SRC_DIRS) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Extract zips first into ${dir}`);
    }
  }
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  const metas = [];
  for (const entry of INSTALLS) {
    metas.push(await installOne(entry));
  }
  writeIndex(metas);

  const snippetPath = path.join(ROOT, '.tmp', 'lateral-maps-snippet.ts');
  fs.writeFileSync(snippetPath, INSTALLS.map(tsEntry).join('\n') + '\n');
  console.log('wrote', snippetPath);
  console.log('Done', metas.length, 'lateral maps');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
