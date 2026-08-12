/**
 * Importa arenas PNG de `Downloads/SPRITES JOGO/MAPAS` → public/maps/*.png + .tmx
 * + manifesto em public/data/wonsr/maps/*.json
 *
 * Uso:
 *   node scripts/import-hunt-arena-maps.js
 *   node scripts/import-hunt-arena-maps.js --src "C:/path/to/MAPAS"
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TILE = 32;
/** Mesma escala da clareira legada (1024×576) — evita arena “expandida”. */
const MAX_EDGE = 1024;

const DEFAULT_SRC = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'SPRITES JOGO',
  'MAPAS',
);

/** Filename → mapKey + slug de arquivo. */
const ARENAS = [
  {
    file: 'ARENA EXAME CHUNNIN.png',
    mapKey: 'huntArenaExameChunnin',
    slug: 'hunt-arena-exame-chunnin',
    label: 'Arena Exame Chunin',
  },
  {
    file: 'CAMPO DE TREINAMENTO.png',
    mapKey: 'huntCampoTreinamento',
    slug: 'hunt-campo-treinamento',
    label: 'Campo de Treinamento',
  },
  {
    file: 'ESCONDERIJO AKATSUKI.png',
    mapKey: 'huntEsconderijoAkatsuki',
    slug: 'hunt-esconderijo-akatsuki',
    label: 'Esconderijo Akatsuki',
  },
  {
    file: 'KONOHA DESTRUIDA POR PAIN.png',
    mapKey: 'huntKonohaDestruida',
    slug: 'hunt-konoha-destruida',
    label: 'Konoha Destruída',
  },
  {
    file: 'LABORATORIO OROCHIMARU.png',
    mapKey: 'huntLabOrochimaru',
    slug: 'hunt-lab-orochimaru',
    label: 'Laboratório Orochimaru',
  },
  {
    file: 'PAIS DO VENTO.png',
    mapKey: 'huntPaisDoVento',
    slug: 'hunt-pais-do-vento',
    label: 'País do Vento',
  },
  {
    file: 'PONTE DO PAIS DA ONDA.png',
    mapKey: 'huntPontePaisOnda',
    slug: 'hunt-ponte-pais-onda',
    label: 'Ponte do País da Onda',
  },
  {
    file: 'VALE DO FIM.png',
    mapKey: 'huntValeDoFim',
    slug: 'hunt-vale-do-fim',
    label: 'Vale do Fim',
  },
];

function parseArgs(argv) {
  let src = DEFAULT_SRC;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--src' && argv[i + 1]) {
      src = argv[++i];
    } else if (a.startsWith('--src=')) {
      src = a.slice('--src='.length);
    }
  }
  return { src };
}

function toPx(tx, ty) {
  return {
    x: Math.round(tx * TILE + TILE / 2),
    y: Math.round(ty * TILE + TILE / 2),
  };
}

async function buildArena(srcPath, arena, outMaps, outMeta) {
  const meta = await sharp(srcPath).metadata();
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  let w = Math.floor((meta.width * scale) / TILE) * TILE;
  let h = Math.floor((meta.height * scale) / TILE) * TILE;
  if (w < TILE || h < TILE) {
    throw new Error(`${arena.file}: invalid size ${w}x${h}`);
  }

  const pngName = `${arena.slug}.png`;
  const tmxName = `${arena.slug}.tmx`;
  const pngPath = path.join(outMaps, pngName);
  await sharp(srcPath).resize(w, h, { fit: 'fill' }).png().toFile(pngPath);

  const cols = w / TILE;
  const rows = h / TILE;
  const tilecount = cols * rows;

  // Arena caminhável: elipse compacta, mais alta no frame (perto das paredes/estruturas).
  const cx = cols / 2;
  const cy = rows * 0.46;
  const rx = cols * 0.26;
  const ry = rows * 0.24;

  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < rows; y += 1) {
    const g = [];
    const c = [];
    for (let x = 0; x < cols; x += 1) {
      g.push(y * cols + x + 1);
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const inside = dx * dx + dy * dy <= 1;
      c.push(inside ? 0 : 1);
    }
    groundRows.push(g.join(','));
    collisionRows.push(c.join(','));
  }

  const tmx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">`,
    ` <tileset firstgid="1" name="${arena.slug}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tilecount}" columns="${cols}">`,
    `  <image source="${pngName}" width="${w}" height="${h}"/>`,
    ' </tileset>',
    ` <layer id="1" name="ground" width="${cols}" height="${rows}">`,
    '  <data encoding="csv">',
    `${groundRows.join(',\n')},`,
    '  </data>',
    ' </layer>',
    ` <layer id="2" name="collision" width="${cols}" height="${rows}" visible="0">`,
    '  <data encoding="csv">',
    `${collisionRows.join(',\n')},`,
    '  </data>',
    ' </layer>',
    '</map>',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outMaps, tmxName), tmx);

  const entry = {
    mapKey: arena.mapKey,
    slug: arena.slug,
    label: arena.label,
    image: `/maps/${pngName}`,
    tmx: `/maps/${tmxName}`,
    width: w,
    height: h,
    cols,
    rows,
    spawn: toPx(cx, cy + ry * 0.3),
    enemySpawns: [
      toPx(cx, cy - ry * 0.5),
      toPx(cx - rx * 0.5, cy),
      toPx(cx + rx * 0.5, cy),
      toPx(cx - rx * 0.35, cy - ry * 0.3),
      toPx(cx + rx * 0.35, cy - ry * 0.3),
      toPx(cx - rx * 0.4, cy + ry * 0.2),
      toPx(cx + rx * 0.4, cy + ry * 0.2),
      toPx(cx, cy + ry * 0.05),
    ],
  };

  fs.mkdirSync(outMeta, { recursive: true });
  fs.writeFileSync(
    path.join(outMeta, `${arena.slug}.json`),
    `${JSON.stringify(entry, null, 2)}\n`,
  );

  console.log(
    `-> ${pngName} ${w}x${h} mapKey=${arena.mapKey} (from ${meta.width}x${meta.height})`,
  );
  return entry;
}

async function main() {
  const { src } = parseArgs(process.argv);
  if (!fs.existsSync(src)) {
    throw new Error(`Pasta de mapas não encontrada: ${src}`);
  }

  const outMaps = path.join(__dirname, '../public/maps');
  const outMeta = path.join(__dirname, '../public/data/wonsr/maps');
  fs.mkdirSync(outMaps, { recursive: true });

  const results = [];
  for (const arena of ARENAS) {
    const srcPath = path.join(src, arena.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`skip missing: ${arena.file}`);
      continue;
    }
    results.push(await buildArena(srcPath, arena, outMaps, outMeta));
  }

  const indexPath = path.join(outMeta, 'hunt-arenas-index.json');
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), arenas: results }, null, 2)}\n`,
  );
  console.log(`-> ${results.length} arenas · index ${path.relative(process.cwd(), indexPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
