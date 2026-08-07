/**
 * Builds public/maps/hunt-forest-clearing.png + .tmx from a source arena image.
 * Visual is the full PNG at runtime; TMX collision is an oval matching the dirt clearing.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets',
    'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-e419d4bb-4b5a-4a20-881d-96f295de640a.png',
  );

const OUT_DIR = path.join(__dirname, '../public/maps');
const PNG_NAME = 'hunt-forest-clearing.png';
const TMX_NAME = 'hunt-forest-clearing.tmx';
const TILE = 32;
const MAX_EDGE = 1408;

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source image not found: ${SRC}`);
  }

  const meta = await sharp(SRC).metadata();
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  let w = Math.floor((meta.width * scale) / TILE) * TILE;
  let h = Math.floor((meta.height * scale) / TILE) * TILE;
  if (w < TILE || h < TILE) {
    throw new Error(`Invalid export size ${w}x${h} from ${meta.width}x${meta.height}`);
  }

  const pngPath = path.join(OUT_DIR, PNG_NAME);
  await sharp(SRC).resize(w, h, { fit: 'fill' }).png().toFile(pngPath);

  const cols = w / TILE;
  const rows = h / TILE;
  const tilecount = cols * rows;

  // Dirt arena oval (approx): slightly below center, roomy for combat.
  const cx = cols / 2;
  const cy = rows * 0.52;
  const rx = cols * 0.28;
  const ry = rows * 0.3;

  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < rows; y++) {
    const g = [];
    const c = [];
    for (let x = 0; x < cols; x++) {
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
    ` <tileset firstgid="1" name="hunt-forest-clearing" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tilecount}" columns="${cols}">`,
    `  <image source="${PNG_NAME}" width="${w}" height="${h}"/>`,
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

  fs.writeFileSync(path.join(OUT_DIR, TMX_NAME), tmx);

  const toPx = (tx, ty) => ({
    x: Math.round(tx * TILE + TILE / 2),
    y: Math.round(ty * TILE + TILE / 2),
  });

  const metaOut = {
    mapKey: 'huntForestClearing',
    width: w,
    height: h,
    cols,
    rows,
    spawn: toPx(cx, cy + ry * 0.35),
    enemySpawns: [
      toPx(cx, cy - ry * 0.55),
      toPx(cx - rx * 0.55, cy),
      toPx(cx + rx * 0.55, cy),
      toPx(cx - rx * 0.35, cy - ry * 0.35),
      toPx(cx + rx * 0.35, cy - ry * 0.35),
      toPx(cx - rx * 0.4, cy + ry * 0.25),
      toPx(cx + rx * 0.4, cy + ry * 0.25),
      toPx(cx, cy + ry * 0.05),
    ],
  };

  console.log(JSON.stringify(metaOut, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
