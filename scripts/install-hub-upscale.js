const fs = require('fs');
const path = require('path');

const SRC = path.join(
  '.tmp-hub-upscale',
  'Hub_Anime_Visao_Aerea_4096x2160_upscaled.png',
);
const SLUG = 'hub-interdimensional';
const HUB_W = 8000;
const HUB_H = 4216;
const TILE = 8;
const COLS = HUB_W / TILE;
const ROWS = HUB_H / TILE;
const FLOOR_Y = 3162;
const EDGE = Math.round(96 * (HUB_W / 4096));

async function main() {
  const srcAbs = path.join(process.cwd(), SRC);
  if (!fs.existsSync(srcAbs)) throw new Error(`fonte ausente: ${srcAbs}`);

  const hubs = path.join('public', 'hubs');
  const maps = path.join('public', 'maps');
  fs.mkdirSync(hubs, { recursive: true });
  fs.mkdirSync(maps, { recursive: true });

  const destHub = path.join(hubs, `${SLUG}.png`);
  const destMap = path.join(maps, `${SLUG}.png`);
  fs.copyFileSync(srcAbs, destHub);
  fs.copyFileSync(srcAbs, destMap);
  const mb = fs.statSync(destHub).size / 1048576;
  console.log(`cópia nativa ${HUB_W}×${HUB_H} — ${mb.toFixed(1)} MB`);

  const floorRow = Math.floor(FLOOR_Y / TILE);
  const minRow = floorRow - 4;
  const maxRow = floorRow + 2;
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
  fs.writeFileSync(path.join(maps, `${SLUG}.tmx`), tmx);
  console.log(`tmx ${COLS}×${ROWS} tile ${TILE}, floor ${FLOOR_Y}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
