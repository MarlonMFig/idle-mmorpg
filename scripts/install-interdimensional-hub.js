/**
 * Instala o hub lateral da vila (mundo 4096×2160).
 *
 *   node scripts/install-interdimensional-hub.js [src.png]
 *
 * A arte é uma ilustração pintada exportada bem acima do tamanho do mundo
 * (10752×5670 = 2.625× exatos nos dois eixos), então o downscale usa `lanczos3`,
 * que aqui funciona como supersampling. `nearest` só serve para ampliar
 * pixel-art; num downscale destes ele produziria aliasing.
 *
 * A fonte nunca é ampliada: se vier menor que o mundo o script aborta, porque
 * upscale é exatamente o que degradou a arte na primeira versão do hub.
 *
 * Colisão: visão lateral. Só o passeio da plataforma é livre; o resto do TMX
 * é bloqueado e `lateralFloorY` trava os pés na superfície.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SRC = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Sem nome (4096 x 2160 px).png',
);
const SRC = process.argv[2] || DEFAULT_SRC;

const HUBS_DIR = path.join(ROOT, 'public', 'hubs');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const SLUG = 'hub-interdimensional';

/** 4096×2160 = proporção exata da arte (1.8963); 16:9 cortaria os prédios das pontas. */
const HUB_W = 4096;
const HUB_H = 2160;
const TILE = 16;
const COLS = HUB_W / TILE;
const ROWS = HUB_H / TILE;

/**
 * Passeio de pedra da plataforma, medido na arte: a pedra iluminada vai de
 * y=1468 a 1493 e o muro escuro começa em 1494. Pés em 1489 deixam o
 * personagem na borda da frente do passeio, com a pedra visível sob ele.
 */
const FLOOR_Y = 1489;
/** Margem lateral: impede o jogador de encostar na borda da tela. */
const EDGE_MARGIN = 96;

/** Centro da porta de cada prédio (px do mundo 4096×2160). */
const DOORS = {
  shop: 372,
  heal: 1131,
  map: 2048,
  forge: 2910,
  bag: 3569,
};

async function installImages() {
  fs.mkdirSync(HUBS_DIR, { recursive: true });
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const meta = await sharp(SRC).metadata();
  if (meta.width < HUB_W || meta.height < HUB_H) {
    throw new Error(
      `fonte ${meta.width}×${meta.height} é menor que o mundo ${HUB_W}×${HUB_H}: ` +
        'ampliar degrada a arte — exporte a ilustração em resolução maior',
    );
  }

  const srcRatio = meta.width / meta.height;
  const worldRatio = HUB_W / HUB_H;
  if (Math.abs(srcRatio - worldRatio) > 0.002) {
    console.warn(
      `aviso: proporção da fonte ${srcRatio.toFixed(4)} != mundo ${worldRatio.toFixed(4)} — a arte vai esticar`,
    );
  }

  const native = meta.width === HUB_W && meta.height === HUB_H;
  const pipeline = sharp(SRC);
  if (!native) pipeline.resize(HUB_W, HUB_H, { kernel: 'lanczos3', fit: 'fill' });
  // `adaptiveFiltering` escolhe o filtro por scanline: 12.9 MB → 7.3 MB nesta
  // arte, sem tocar em nenhum pixel (PNG segue lossless).
  const png = await pipeline
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
    .toBuffer();

  fs.writeFileSync(path.join(HUBS_DIR, `${SLUG}.png`), png);
  // O tileset do TMX resolve a imagem relativa a public/maps.
  fs.writeFileSync(path.join(MAPS_DIR, `${SLUG}.png`), png);
  return { native, bytes: png.length, src: meta, factor: meta.width / HUB_W };
}

/**
 * Corredor de colisão em volta da linha do chão. O corpo do personagem tem
 * ~10px de altura nos pés, então 2 tiles acima e 1 abaixo sobram de folga sem
 * que ele consiga escalar o cenário.
 */
function buildCollision() {
  const floorRow = Math.floor(FLOOR_Y / TILE);
  const minRow = floorRow - 2;
  const maxRow = floorRow + 1;
  const minCol = Math.floor(EDGE_MARGIN / TILE);
  const maxCol = COLS - 1 - minCol;

  const rows = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = new Array(COLS);
    const walkableRow = r >= minRow && r <= maxRow;
    for (let c = 0; c < COLS; c += 1) {
      row[c] = walkableRow && c >= minCol && c <= maxCol ? 0 : 1;
    }
    rows.push(row.join(','));
  }
  return { rows, minCol, maxCol, minRow, maxRow };
}

function writeTmx(collisionRows) {
  const empty = Array.from({ length: ROWS }, () => new Array(COLS).fill(0).join(','));
  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="${SLUG}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="${SLUG}.png" width="${HUB_W}" height="${HUB_H}"/>
 </tileset>
 <layer id="1" name="ground" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${empty.join(',\n')}
</data>
 </layer>
 <layer id="2" name="collision" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${collisionRows.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(path.join(MAPS_DIR, `${SLUG}.tmx`), tmx);
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`fonte ausente: ${SRC}`);

  const { native, bytes, src, factor } = await installImages();
  const collision = buildCollision();
  writeTmx(collision.rows);

  console.log(`fonte     ${SRC} — ${src.width}×${src.height}`);
  console.log(
    `arte      public/hubs/${SLUG}.png — ${HUB_W}×${HUB_H}, ${(bytes / 1048576).toFixed(1)} MB` +
      `${native ? ' (nativa, sem reamostragem)' : ` (downscale lanczos3 de ${factor.toFixed(3)}×)`}`,
  );
  console.log(`colisão   public/maps/${SLUG}.tmx`);
  console.log(`chão      lateralFloorY=${FLOOR_Y} (linhas ${collision.minRow}–${collision.maxRow})`);
  console.log(`limites   x ${collision.minCol * TILE}–${(collision.maxCol + 1) * TILE}`);
  console.log(`spawn     { x: ${DOORS.map}, y: ${FLOOR_Y} }`);
  for (const [name, x] of Object.entries(DOORS)) {
    console.log(`porta     ${name.padEnd(6)} x=${x}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
