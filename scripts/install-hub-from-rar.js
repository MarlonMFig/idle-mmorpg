const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join('.tmp-hub-novo-rar', 'hub novo.png');
const HUBS = path.join('public', 'hubs');
const MAPS = path.join('public', 'maps');
const SLUG = 'hub-interdimensional';
const HUB_W = 4096;
const HUB_H = 2160;
const TILE = 16;
/** Fonte 12800×6750 → 4096×2160 (÷3.125). Topo do passeio ~4950 na fonte. */
const FLOOR_Y = 1584;
const EDGE = 96;
const COLS = HUB_W / TILE;
const ROWS = HUB_H / TILE;
const DOORS = { shop: 369, heal: 1147, map: 2048, forge: 2908, bag: 3604 };

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`fonte ausente: ${SRC}`);
  fs.mkdirSync(HUBS, { recursive: true });
  fs.mkdirSync(MAPS, { recursive: true });

  const cur = path.join(HUBS, `${SLUG}.png`);
  if (fs.existsSync(cur)) {
    const m = await sharp(cur).metadata();
    if (m.width !== HUB_W || m.height !== HUB_H) {
      const bak = path.join(HUBS, `${SLUG}-prev-${m.width}x${m.height}.png`);
      if (!fs.existsSync(bak)) fs.copyFileSync(cur, bak);
      console.log('backup', bak);
    }
  }

  const meta = await sharp(SRC).metadata();
  console.log(`fonte ${meta.width}×${meta.height}`);
  const t0 = Date.now();
  // Downscale com lanczos3 = supersampling (preserva qualidade pintada).
  // Nunca nearest — nearest em downscale destroi ilustração.
  const png = await sharp(SRC)
    .resize(HUB_W, HUB_H, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(path.join(HUBS, `${SLUG}.png`), png);
  fs.writeFileSync(path.join(MAPS, `${SLUG}.png`), png);
  console.log(
    `arte public/hubs/${SLUG}.png — ${HUB_W}×${HUB_H}, ${(png.length / 1048576).toFixed(1)} MB (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );

  const floorRow = Math.floor(FLOOR_Y / TILE);
  const minRow = floorRow - 2;
  const maxRow = floorRow + 1;
  const minCol = Math.floor(EDGE / TILE);
  const maxCol = COLS - 1 - minCol;
  const collision = [];
  const empty = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = new Array(COLS);
    const walk = r >= minRow && r <= maxRow;
    for (let c = 0; c < COLS; c += 1) {
      row[c] = walk && c >= minCol && c <= maxCol ? 0 : 1;
    }
    collision.push(row.join(','));
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
${collision.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(path.join(MAPS, `${SLUG}.tmx`), tmx);
  console.log(`chão lateralFloorY=${FLOOR_Y}`);
  console.log('portas', DOORS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
