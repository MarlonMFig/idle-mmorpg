/**
 * Instala mapas de caça 3840×2160 (PNG nativo, sem downscale) + TMX de colisão.
 *
 * A colisão 32×18 das arenas 1024 é upsampleada ×7.5 (tile 16 → 240×135).
 * Hub Konoha e mapas mundi/UI do zip não são substituídos.
 *
 * Usage:
 *   node scripts/install-4k-hunt-maps.js [zip-or-extracted-dir]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public/maps');
const META_DIR = path.join(ROOT, 'public/data/wonsr/maps');
const DEFAULT_ZIP = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Mapas_Naruto_Dragon_Ball_4K_3840x2160.zip',
);
const TMP_DIR = path.join(ROOT, '.tmp-maps-4k');

const MAP_W = 3840;
const MAP_H = 2160;
const TILE = 16;
const S = MAP_W / 1024;
const COLS = MAP_W / TILE;
const ROWS = MAP_H / TILE;
const OLD_COLS = 32;
const OLD_ROWS = 18;

/** Colisão oval das arenas art 1024×576 (1 = sólido). */
const OLD_COLLISION = [
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1',
  '1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1',
  '1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1',
  '1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1',
  '1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1',
  '1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1',
].map((row) => row.split(',').map(Number));

const ART_SPAWN = { x: 528, y: 388 };
const ART_ENEMY_SPAWNS = [
  { x: 528, y: 241 },
  { x: 354, y: 333 },
  { x: 702, y: 333 },
  { x: 406, y: 278 },
  { x: 650, y: 278 },
  { x: 389, y: 370 },
  { x: 667, y: 370 },
  { x: 528, y: 342 },
];
const CLEARING_SPAWN = { x: 528, y: 376 };
const CLEARING_ENEMY_SPAWNS = [
  { x: 528, y: 220 },
  { x: 370, y: 316 },
  { x: 686, y: 316 },
  { x: 428, y: 255 },
  { x: 628, y: 255 },
  { x: 413, y: 359 },
  { x: 643, y: 359 },
  { x: 528, y: 324 },
];

const INSTALLS = [
  {
    mapKey: 'huntForestClearing',
    slug: 'hunt-forest-clearing',
    label: 'Floresta da Morte',
    match: /05_Floresta_da_Morte_4K\.png$/i,
    spawn: CLEARING_SPAWN,
    enemySpawns: CLEARING_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntValeDoFim',
    slug: 'hunt-vale-do-fim',
    label: 'Vale do Fim',
    match: /06_Vale_do_Fim_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntArenaExameChunnin',
    slug: 'hunt-arena-exame-chunnin',
    label: 'Arena Exame Chunin',
    match: /07_Arena_Exame_Chunin_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntPontePaisOnda',
    slug: 'hunt-ponte-pais-onda',
    label: 'Grande Ponte',
    match: /08_Grande_Ponte_Naruto_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntCampoTreinamento',
    slug: 'hunt-campo-treinamento',
    label: 'Campo de Treino 7',
    match: /09_Campo_de_Treino_7_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntEsconderijoAkatsuki',
    slug: 'hunt-esconderijo-akatsuki',
    label: 'Esconderijo Akatsuki',
    match: /10_Esconderijo_Akatsuki_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntKonohaDestruida',
    slug: 'hunt-konoha-destruida',
    label: 'Konoha Destruída',
    match: /11_Konoha_Destruida_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntLabOrochimaru',
    slug: 'hunt-lab-orochimaru',
    label: 'Laboratório Orochimaru',
    match: /12_Laboratorio_Orochimaru_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntPaisDoVento',
    slug: 'hunt-pais-do-vento',
    label: 'País do Vento',
    match: /13_Pais_do_Vento_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntNamekusei',
    slug: 'hunt-namekusei',
    label: 'Namekusei',
    match: /03_Namekusei_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntJogosCell',
    slug: 'hunt-jogos-cell',
    label: 'Jogos de Cell',
    match: /04_Jogos_de_Cell_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntTorneioArtesMarciais',
    slug: 'hunt-torneio-artes-marciais',
    label: 'Torneio de Artes Marciais',
    match: /05_Torneio_de_Artes_Marciais_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
  {
    mapKey: 'huntSalaDoTempo',
    slug: 'hunt-sala-do-tempo',
    label: 'Sala do Tempo',
    match: /06_Sala_do_Tempo_4K\.png$/i,
    spawn: ART_SPAWN,
    enemySpawns: ART_ENEMY_SPAWNS,
  },
];

function listFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function scalePt(pt) {
  return { x: Math.round(pt.x * S), y: Math.round(pt.y * S) };
}

function buildSolid() {
  const solid = new Array(COLS * ROWS);
  for (let ty = 0; ty < ROWS; ty++) {
    const oy = Math.min(OLD_ROWS - 1, Math.floor((ty * OLD_ROWS) / ROWS));
    for (let tx = 0; tx < COLS; tx++) {
      const ox = Math.min(OLD_COLS - 1, Math.floor((tx * OLD_COLS) / COLS));
      solid[ty * COLS + tx] = OLD_COLLISION[oy][ox];
    }
  }
  return solid;
}

function writeTmx(slug, solid) {
  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < ROWS; y++) {
    const g = [];
    const c = [];
    for (let x = 0; x < COLS; x++) {
      g.push(0);
      c.push(solid[y * COLS + x]);
    }
    groundRows.push(g.join(','));
    collisionRows.push(c.join(','));
  }

  const tmx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">`,
    ` <tileset firstgid="1" name="${slug}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">`,
    `  <image source="${slug}.png" width="${MAP_W}" height="${MAP_H}"/>`,
    ' </tileset>',
    ` <layer id="1" name="ground" width="${COLS}" height="${ROWS}">`,
    '  <data encoding="csv">',
    `${groundRows.join(',\n')},`,
    '  </data>',
    ' </layer>',
    ` <layer id="2" name="collision" width="${COLS}" height="${ROWS}" visible="0">`,
    '  <data encoding="csv">',
    `${collisionRows.join(',\n')},`,
    '  </data>',
    ' </layer>',
    '</map>',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(MAPS_DIR, `${slug}.tmx`), tmx);
}

function extractZip(zipPath) {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TMP_DIR, { recursive: true });
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${TMP_DIR.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' },
  );
}

async function main() {
  const input = process.argv[2] || DEFAULT_ZIP;
  let srcRoot = input;
  if (fs.existsSync(input) && input.toLowerCase().endsWith('.zip')) {
    extractZip(input);
    srcRoot = TMP_DIR;
  }
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`Source not found: ${input}`);
  }

  const files = listFiles(srcRoot);
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(META_DIR, { recursive: true });

  const solid = buildSolid();
  const arenas = [];

  for (const spec of INSTALLS) {
    const src = files.find((file) => spec.match.test(file.replace(/\\/g, '/')));
    if (!src) {
      throw new Error(`PNG not found for ${spec.slug} (${spec.match})`);
    }
    const meta = await sharp(src).metadata();
    if (meta.width !== MAP_W || meta.height !== MAP_H) {
      throw new Error(
        `${path.basename(src)} esperado ${MAP_W}×${MAP_H}, recebido ${meta.width}×${meta.height}`,
      );
    }

    const destPng = path.join(MAPS_DIR, `${spec.slug}.png`);
    fs.copyFileSync(src, destPng);
    writeTmx(spec.slug, solid);

    const spawn = scalePt(spec.spawn);
    const enemySpawns = spec.enemySpawns.map(scalePt);
    const json = {
      mapKey: spec.mapKey,
      slug: spec.slug,
      label: spec.label,
      image: `/maps/${spec.slug}.png`,
      tmx: `/maps/${spec.slug}.tmx`,
      width: MAP_W,
      height: MAP_H,
      cols: COLS,
      rows: ROWS,
      spawn,
      enemySpawns,
    };
    fs.writeFileSync(path.join(META_DIR, `${spec.slug}.json`), JSON.stringify(json, null, 2) + '\n');
    arenas.push(json);
    console.log(`ok ${spec.slug} ← ${path.basename(src)} (${fs.statSync(destPng).size} bytes)`);
  }

  fs.writeFileSync(
    path.join(META_DIR, 'hunt-arenas-index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), arenas }, null, 2) + '\n',
  );

  console.log(
    JSON.stringify(
      {
        layoutScale: S,
        tile: TILE,
        cols: COLS,
        rows: ROWS,
        maps: arenas.length,
        spawn: scalePt(ART_SPAWN),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
