/**
 * Instala o hub pixel-art em tamanho NATIVO (sem reamostragem).
 *
 *   node scripts/install-pixel-hub.js [src.png|jpg]
 *
 * Regras: não usa lanczos/cover; copia pixels 1:1 para PNG; gera TMX na
 * resolução da arte. Mundo = tamanho do arquivo.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SRC = path.join(
  ROOT,
  '.cursor-user-assets-hub-novo.jpg', // optional local copy
);
const SRC =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-marlo-Projects-idle-mmorpg',
    'assets',
    'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_e20947e3ed094deb68a3b495673c18de_images_hub_novo-ec38b86c-e25d-4014-be01-76b500d6ccc3.jpg',
  );

const HUBS_DIR = path.join(ROOT, 'public', 'hubs');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const SLUG = 'hub-interdimensional';
const TILE = 16;
/** Topo do passeio de pedra (pés) — medido na arte 1024×540. */
const FLOOR_Y = 412;
const EDGE_MARGIN = 24;

/** Centros aproximados das portas (5 prédios L→R). */
const DOORS = {
  shop: 120,
  heal: 300,
  map: 512,
  forge: 720,
  bag: 900,
};

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`fonte ausente: ${SRC}`);

  fs.mkdirSync(HUBS_DIR, { recursive: true });
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const meta = await sharp(SRC).metadata();
  const HUB_W = meta.width;
  const HUB_H = meta.height;
  if (!HUB_W || !HUB_H) throw new Error('metadata sem dimensões');

  // Backup do hub pintado 4K se ainda existir com tamanho diferente.
  const prev = path.join(HUBS_DIR, `${SLUG}.png`);
  if (fs.existsSync(prev)) {
    const prevMeta = await sharp(prev).metadata();
    if (prevMeta.width !== HUB_W || prevMeta.height !== HUB_H) {
      const bak = path.join(HUBS_DIR, `${SLUG}-prev-${prevMeta.width}x${prevMeta.height}.png`);
      if (!fs.existsSync(bak)) fs.copyFileSync(prev, bak);
      console.log(`backup   ${bak}`);
    }
  }

  // Sem resize: só reencode lossless PNG (mesmo raster).
  const png = await sharp(SRC)
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
    .toBuffer();

  fs.writeFileSync(path.join(HUBS_DIR, `${SLUG}.png`), png);
  fs.writeFileSync(path.join(MAPS_DIR, `${SLUG}.png`), png);

  const COLS = Math.floor(HUB_W / TILE);
  const ROWS = Math.floor(HUB_H / TILE);
  // Crop world to multiple of tile (1024/16=64, 540/16=33.75 → 528 height usable?)
  // Keep full image visual; collision grid uses floor of tiles. World size = image size.
  const floorRow = Math.floor(FLOOR_Y / TILE);
  const minRow = Math.max(0, floorRow - 2);
  const maxRow = Math.min(ROWS - 1, floorRow + 1);
  const minCol = Math.floor(EDGE_MARGIN / TILE);
  const maxCol = COLS - 1 - minCol;

  const collisionRows = [];
  const empty = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = new Array(COLS);
    const walkable = r >= minRow && r <= maxRow;
    for (let c = 0; c < COLS; c += 1) {
      row[c] = walkable && c >= minCol && c <= maxCol ? 0 : 1;
    }
    collisionRows.push(row.join(','));
    empty.push(new Array(COLS).fill(0).join(','));
  }

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

  console.log(`fonte     ${SRC} — ${HUB_W}×${HUB_H}`);
  console.log(
    `arte      public/hubs/${SLUG}.png — ${(png.length / 1024).toFixed(0)} KB (nativa, sem reamostragem)`,
  );
  console.log(`colisão   public/maps/${SLUG}.tmx (${COLS}×${ROWS} tiles)`);
  console.log(`chão      lateralFloorY=${FLOOR_Y}`);
  console.log(`spawn     { x: ${DOORS.map}, y: ${FLOOR_Y} }`);
  for (const [name, x] of Object.entries(DOORS)) {
    console.log(`porta     ${name.padEnd(6)} x=${x}`);
  }
  console.log(`\nAtualize hub-backgrounds.ts: width=${HUB_W} height=${HUB_H} floor=${FLOOR_Y}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
