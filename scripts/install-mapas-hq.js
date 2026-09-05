/**
 * Instala mapas HQ do pacote MAPAS (RAR/pasta) em resolução nativa — sem downscale.
 * Copia o PNG principal byte-a-byte; só o overlay -fg passa pelo sharp (recorte).
 *
 * Usage:
 *   node scripts/install-mapas-hq.js [pasta-ou-rar]
 * Default: %USERPROFILE%/Downloads/SPRITES JOGO/MAPAS
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const META_DIR = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
const DEFAULT_SRC = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'SPRITES JOGO',
  'MAPAS',
);
const TMP_EXTRACT = path.join(ROOT, '.tmp', 'mapas-hq');
const TILE = 16;
const REF_W = 3840;
const REF_H = 2160;
const CACHE_TAG = 'hq2026';

/** floorY / spawns de referência (3840×2160). */
const LATERAL_REF = {
  huntForestClearing: { floorY: 1400, fg: 'grass' },
  huntValeDoFim: { floorY: 1384, fg: 'grass' },
  huntCampoTreinamento: { floorY: 1386, fg: 'grass' },
  huntPontePaisOnda: { floorY: 1470, fg: 'edge' },
  huntEsconderijoAkatsuki: { floorY: 1400, fg: 'edge' },
  huntLabOrochimaru: { floorY: 1400, fg: 'edge' },
  huntPaisDoVento: { floorY: 1387, fg: 'sand' },
  huntArenaExameChunnin: { floorY: 1400, fg: 'snow' },
  huntDistritoUchiha: { floorY: 1420, fg: 'edge' },
  huntArenaExameChunin: { floorY: 1500, fg: 'edge' },
};

const INSTALLS = [
  {
    slug: 'hunt-vale-do-fim',
    mapKey: 'huntValeDoFim',
    label: 'Vale do Fim',
    src: ['VALE DO FIM (1).png', 'VALE DO FIM.png'],
  },
  {
    slug: 'hunt-ponte-pais-onda',
    mapKey: 'huntPontePaisOnda',
    label: 'Ponte do País da Onda',
    src: ['PONTE DO PAIS DA ONDA (1).png', 'PONTE DO PAIS DA ONDA.png'],
  },
  {
    slug: 'hunt-campo-treinamento',
    mapKey: 'huntCampoTreinamento',
    label: 'Campo de Treinamento',
    src: ['CAMPO DE TREINAMENTO (1).png', 'CAMPO DE TREINAMENTO.png'],
  },
  {
    slug: 'hunt-esconderijo-akatsuki',
    mapKey: 'huntEsconderijoAkatsuki',
    label: 'Esconderijo Akatsuki',
    src: ['ESCONDERIJO AKATSUKI (1).png', 'ESCONDERIJO AKATSUKI.png'],
  },
  {
    slug: 'hunt-lab-orochimaru',
    mapKey: 'huntLabOrochimaru',
    label: 'Laboratório Orochimaru',
    src: ['LABORATORIO OROCHIMARU (1).png', 'LABORATORIO OROCHIMARU.png'],
  },
  {
    slug: 'hunt-pais-do-vento',
    mapKey: 'huntPaisDoVento',
    label: 'Vila da Areia',
    src: ['Mapa_Caca_Vila_da_Areia_3840x2160.png', 'PAIS DO VENTO.png'],
  },
  {
    slug: 'hunt-arena-exame-chunnin',
    mapKey: 'huntArenaExameChunnin',
    label: 'País do Ferro',
    src: ['04_Pais_do_Ferro_Proporcional_3840x2160.png'],
  },
  {
    slug: 'hunt-distrito-uchiha',
    mapKey: 'huntDistritoUchiha',
    label: 'Distrito Uchiha',
    src: ['Uchiha3840x2160.png'],
  },
  {
    slug: 'hunt-arena-exame-chunin',
    mapKey: 'huntArenaExameChunin',
    label: 'Arena Exame Chunin',
    src: ['ARENA EXAME CHUNNIN (1).png', 'ARENA EXAME CHUNNIN.png'],
  },
  {
    slug: 'hunt-konoha-destruida',
    mapKey: 'huntKonohaDestruida',
    label: 'Konoha Destruída',
    src: ['KONOHA DESTRUIDA POR PAIN (1).png', 'KONOHA DESTRUIDA POR PAIN.png'],
    arena: true,
  },
];

function listFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else if (/\.png$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}

function extractRar(rarPath) {
  const seven = 'C:\\Program Files\\7-Zip\\7z.exe';
  if (!fs.existsSync(seven)) throw new Error('7-Zip necessário para extrair .rar');
  if (fs.existsSync(TMP_EXTRACT)) fs.rmSync(TMP_EXTRACT, { recursive: true, force: true });
  fs.mkdirSync(TMP_EXTRACT, { recursive: true });
  execFileSync(seven, ['x', rarPath, `-o${TMP_EXTRACT}`, '-y'], { stdio: 'inherit' });
}

function findSrc(files, names) {
  const candidates = [];
  for (const name of names) {
    const exact = files.find((f) => path.basename(f).toLowerCase() === name.toLowerCase());
    if (exact) candidates.push(exact);
  }
  const stems = names.map((n) => n.toLowerCase().replace(/\.png$/i, ''));
  for (const file of files) {
    const base = path.basename(file).toLowerCase();
    if (stems.some((stem) => base === stem || base.includes(stem))) candidates.push(file);
  }
  const uniq = [...new Set(candidates)];
  if (!uniq.length) return null;
  let best = uniq[0];
  let bestArea = 0;
  for (const file of uniq) {
    try {
      const { size } = fs.statSync(file);
      if (size > bestArea) {
        bestArea = size;
        best = file;
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

function scaledLayoutScale(width, base = 4.75) {
  return Math.round((base * width) / REF_W * 100) / 100;
}

function arenaLayoutScale(width) {
  return Math.round((3.75 * width) / REF_W * 100) / 100;
}

function scalePt(pt, sx, sy) {
  return { x: Math.round(pt.x * sx), y: Math.round(pt.y * sy) };
}

function lateralMeta(width, height, floorY) {
  const sx = width / REF_W;
  const sy = height / REF_H;
  const y = Math.round(floorY * sy);
  return {
    width,
    height,
    spawn: { x: Math.round(width / 2), y },
    enemySpawns: [
      { x: Math.round(3680 * sx), y },
      { x: Math.round(160 * sx), y },
    ],
    lateralFloorY: y,
    layoutScale: scaledLayoutScale(width),
  };
}

const ART_REF = {
  spawn: { x: 1980, y: 1455 },
  enemySpawns: [
    { x: 1980, y: 904 },
    { x: 1328, y: 1249 },
    { x: 2633, y: 1249 },
    { x: 1523, y: 1043 },
    { x: 2438, y: 1043 },
    { x: 1459, y: 1388 },
    { x: 2501, y: 1388 },
    { x: 1980, y: 1283 },
  ],
};

function arenaMeta(width, height) {
  const sx = width / REF_W;
  const sy = height / REF_H;
  return {
    width,
    height,
    spawn: scalePt(ART_REF.spawn, sx, sy),
    enemySpawns: ART_REF.enemySpawns.map((p) => scalePt(p, sx, sy)),
    layoutScale: arenaLayoutScale(width),
  };
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
  return (r + g + b) / 3 > 25;
}

async function buildForeground(srcPath, outPath, floorY, mode) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  await sharp(out, { raw: { width: W, height: H, channels } })
    .png({ compressionLevel: 6, effort: 1 })
    .toFile(outPath);
}

function writeTmx(slug, width, height) {
  const cols = Math.floor(width / TILE);
  const rows = Math.floor(height / TILE);
  if (cols < 1 || rows < 1) {
    throw new Error(`${slug}: mapa pequeno demais (${width}×${height})`);
  }
  const zeros = Array.from({ length: rows }, () => Array(cols).fill(0).join(','));
  const collision = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) row.push(r < 3 ? 1 : 0);
    collision.push(row.join(','));
  }
  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="${slug}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="${slug}.png" width="${width}" height="${height}"/>
 </tileset>
 <layer id="1" name="ground" width="${cols}" height="${rows}">
  <data encoding="csv">
${zeros.join(',\n')}
</data>
 </layer>
 <layer id="2" name="collision" width="${cols}" height="${rows}">
  <data encoding="csv">
${collision.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(path.join(MAPS_DIR, `${slug}.tmx`), tmx);
}

async function installOne(files, spec) {
  const src = findSrc(files, spec.src);
  if (!src) {
    console.warn('skip (missing)', spec.slug, spec.src.join(' | '));
    return null;
  }
  const meta = await sharp(src).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!(width > 0) || !(height > 0)) throw new Error(`${src}: dimensões inválidas`);

  const destPng = path.join(MAPS_DIR, `${spec.slug}.png`);
  fs.copyFileSync(src, destPng);

  let mapMeta;
  if (spec.arena) {
    mapMeta = arenaMeta(width, height);
    writeTmx(spec.slug, width, height);
  } else {
    const lateral = LATERAL_REF[spec.mapKey];
    if (!lateral) throw new Error(`Sem ref lateral: ${spec.mapKey}`);
    mapMeta = lateralMeta(width, height, lateral.floorY);
    const floorY = mapMeta.lateralFloorY;
    await buildForeground(src, path.join(MAPS_DIR, `${spec.slug}-fg.png`), floorY, lateral.fg);
    writeTmx(spec.slug, width, height);
  }

  const json = {
    mapKey: spec.mapKey,
    slug: spec.slug,
    label: spec.label,
    source: path.basename(src),
    image: `/maps/${spec.slug}.png`,
    foreground: spec.arena ? null : `/maps/${spec.slug}-fg.png`,
    tmx: `/maps/${spec.slug}.tmx`,
    cacheTag: CACHE_TAG,
    ...mapMeta,
  };
  fs.writeFileSync(path.join(META_DIR, `${spec.slug}.json`), JSON.stringify(json, null, 2) + '\n');
  console.log(
    'ok',
    spec.slug,
    `${width}×${height}`,
    `← ${path.basename(src)}`,
    `(${Math.round(fs.statSync(destPng).size / 1024 / 1024)}MB)`,
  );
  return json;
}

async function main() {
  let srcRoot = process.argv[2] || DEFAULT_SRC;
  if (srcRoot.toLowerCase().endsWith('.rar')) {
    extractRar(srcRoot);
    srcRoot = TMP_EXTRACT;
  }
  if (!fs.existsSync(srcRoot)) throw new Error(`Fonte não encontrada: ${srcRoot}`);

  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(META_DIR, { recursive: true });

  const files = listFiles(srcRoot);
  const installed = [];
  for (const spec of INSTALLS) {
    const row = await installOne(files, spec);
    if (row) installed.push(row);
  }

  fs.writeFileSync(
    path.join(META_DIR, 'hq-maps-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), cacheTag: CACHE_TAG, maps: installed }, null, 2) +
      '\n',
  );
  console.log('\nInstalled', installed.length, 'maps. cacheTag =', CACHE_TAG);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
