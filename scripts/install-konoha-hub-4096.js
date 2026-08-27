/**
 * Instala o hub Konoha isométrico (PNG nativo, sem reamostragem).
 *
 * Aceita 4096×2160, 8192×4320 ou maior com a mesma proporção.
 * Nunca amplia nem reduz — só cópia bit-a-bit (PNG) ou reencode lossless (JPG).
 *
 * Caminhável: praça circular, caminhos até as portas, ponte sul.
 * Bloqueado: prédios, água, penhascos, árvores, decoração.
 *
 * Usage:
 *   node scripts/install-konoha-hub-4096.js [source.png|jpg]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_SRC = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Hub_Konoha_RPG_HD_4096x2160.png',
);

const SRC = process.argv[2] || DEFAULT_SRC;
const ROOT = path.join(__dirname, '..');
const HUBS_DIR = path.join(ROOT, 'public/hubs');
const MAPS_DIR = path.join(ROOT, 'public/maps');
const SLUG = 'hub-interdimensional';
const HUB_PNG = `${SLUG}.png`;
const MAP_PNG = `${SLUG}.png`;
const MAP_TMX = `${SLUG}.tmx`;
const TILE = 16;
/** Mundo mínimo aceito; a fonte pode ser 4096×2160, 8192×4320, etc. (mesmo enquadramento 1024 ref). */
const MIN_HUB_W = 4096;
const MIN_HUB_H = 2160;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function distToSegment(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1) return Math.hypot(px - x0, py - y0);
  const t = clamp(((px - x0) * vx + (py - y0) * vy) / len2, 0, 1);
  return Math.hypot(px - (x0 + t * vx), py - (y0 + t * vy));
}

/** Layout da praça ilustrada (ref 1024×576 → escala S = hubW/1024). */
function makeLayout(S) {
  return {
    plaza: { cx: 512 * S, cy: 338 * S, rx: 128 * S, ry: 92 * S },
    buildings: [
      { name: 'market', cx: 268 * S, cy: 196 * S, rx: 88 * S, ry: 74 * S },
      { name: 'heal', cx: 512 * S, cy: 148 * S, rx: 86 * S, ry: 68 * S },
      { name: 'hunt', cx: 756 * S, cy: 196 * S, rx: 88 * S, ry: 74 * S },
      { name: 'forge', cx: 250 * S, cy: 418 * S, rx: 96 * S, ry: 72 * S },
      { name: 'depot', cx: 774 * S, cy: 418 * S, rx: 104 * S, ry: 74 * S },
    ],
    decor: [
      { name: 'fountain', cx: 188 * S, cy: 230 * S, rx: 30 * S, ry: 26 * S },
      { name: 'spire', cx: 868 * S, cy: 186 * S, rx: 24 * S, ry: 70 * S },
      { name: 'crane', cx: 840 * S, cy: 372 * S, rx: 34 * S, ry: 48 * S },
    ],
    doors: {
      shop: { x: 348 * S, y: 262 * S },
      heal: { x: 512 * S, y: 226 * S },
      map: { x: 676 * S, y: 262 * S },
      forge: { x: 348 * S, y: 372 * S },
      bag: { x: 676 * S, y: 372 * S },
    },
    pathHalfW: 30 * S,
    doorRadius: 22 * S,
    bridge: { x0: 472 * S, x1: 552 * S, y0: 430 * S, y1: 575 * S },
    waterY: 508 * S,
    cliffY: 108 * S,
    margin: 20 * S,
    bottomMargin: 8 * S,
  };
}

async function installImage(srcPath) {
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source image not found: ${srcPath}`);
  }

  const meta = await sharp(srcPath).metadata();
  const origW = meta.width;
  const origH = meta.height;

  if (!origW || !origH) throw new Error('metadata sem dimensões');
  if (origW < MIN_HUB_W || origH < MIN_HUB_H) {
    throw new Error(
      `Hub esperado ≥${MIN_HUB_W}×${MIN_HUB_H}, recebido ${origW}×${origH} — ampliar degrada a arte`,
    );
  }

  const worldRatio = MIN_HUB_W / MIN_HUB_H;
  const srcRatio = origW / origH;
  if (Math.abs(srcRatio - worldRatio) > 0.01) {
    throw new Error(
      `Proporção ${origW}×${origH} (${srcRatio.toFixed(4)}) incompatível com hub ${worldRatio.toFixed(4)}`,
    );
  }

  fs.mkdirSync(HUBS_DIR, { recursive: true });
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const hubPath = path.join(HUBS_DIR, HUB_PNG);
  const mapPath = path.join(MAPS_DIR, MAP_PNG);

  // Sem resize: cópia nativa (PNG) ou reencode lossless (JPG → PNG).
  if (srcPath.toLowerCase().endsWith('.png')) {
    fs.copyFileSync(srcPath, hubPath);
    fs.copyFileSync(hubPath, mapPath);
  } else {
    await sharp(srcPath)
      .png({ compressionLevel: 9, palette: false, adaptiveFiltering: true })
      .toFile(hubPath);
    fs.copyFileSync(hubPath, mapPath);
  }

  return { origW, origH, width: origW, height: origH, hubPath, mapPath, native: true };
}

function paintCapsule(walk, cols, rows, x0, y0, x1, y1, halfW) {
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      if (distToSegment(px, py, x0, y0, x1, y1) <= halfW) {
        walk[ty * cols + tx] = true;
      }
    }
  }
}

function inAnyEllipse(px, py, list) {
  return list.some((e) => inEllipse(px, py, e.cx, e.cy, e.rx, e.ry));
}

function buildCollision(hubW, hubH) {
  const S = hubW / 1024;
  const LAYOUT = makeLayout(S);
  const {
    plaza,
    buildings,
    decor,
    doors,
    pathHalfW,
    doorRadius,
    bridge,
    waterY,
    cliffY,
    margin,
    bottomMargin,
  } = LAYOUT;
  const cols = hubW / TILE;
  const rows = hubH / TILE;
  const walk = new Array(cols * rows).fill(false);

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      if (inEllipse(px, py, plaza.cx, plaza.cy, plaza.rx, plaza.ry)) {
        walk[ty * cols + tx] = true;
      }
    }
  }

  paintCapsule(walk, cols, rows, plaza.cx, plaza.cy, doors.shop.x, doors.shop.y, pathHalfW);
  paintCapsule(walk, cols, rows, plaza.cx, plaza.cy, doors.heal.x, doors.heal.y, pathHalfW);
  paintCapsule(walk, cols, rows, plaza.cx, plaza.cy, doors.map.x, doors.map.y, pathHalfW);
  paintCapsule(walk, cols, rows, plaza.cx, plaza.cy, doors.forge.x, doors.forge.y, pathHalfW);
  paintCapsule(walk, cols, rows, plaza.cx, plaza.cy, doors.bag.x, doors.bag.y, pathHalfW);
  paintCapsule(
    walk,
    cols,
    rows,
    plaza.cx,
    plaza.cy + plaza.ry * 0.55,
    (bridge.x0 + bridge.x1) / 2,
    bridge.y0 + 8 * S,
    pathHalfW + 4 * S,
  );

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      if (px >= bridge.x0 && px <= bridge.x1 && py >= bridge.y0 && py <= bridge.y1) {
        walk[ty * cols + tx] = true;
      }
    }
  }

  for (const door of Object.values(doors)) {
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const px = tx * TILE + TILE / 2;
        const py = ty * TILE + TILE / 2;
        if (Math.hypot(px - door.x, py - door.y) <= doorRadius) walk[ty * cols + tx] = true;
      }
    }
  }

  const blockers = [...buildings, ...decor];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      if (inAnyEllipse(px, py, blockers)) walk[ty * cols + tx] = false;
    }
  }

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      const i = ty * cols + tx;
      if (py < cliffY || px < margin || px >= hubW - margin || py >= hubH - bottomMargin) {
        walk[i] = false;
        continue;
      }
      const onBridge = px >= bridge.x0 && px <= bridge.x1 && py >= bridge.y0;
      if (py >= waterY && !onBridge) walk[i] = false;
    }
  }

  const solid = new Array(cols * rows).fill(1);
  const seedX = Math.floor(plaza.cx / TILE);
  const seedY = Math.floor(plaza.cy / TILE);
  const queue = [seedX, seedY];
  if (walk[seedY * cols + seedX]) solid[seedY * cols + seedX] = 0;

  while (queue.length) {
    const x = queue.shift();
    const y = queue.shift();
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const i = ny * cols + nx;
      if (solid[i] === 0 || !walk[i]) continue;
      solid[i] = 0;
      queue.push(nx, ny);
    }
  }

  return { solid, cols, rows };
}

function writeTmx(cols, rows, width, height, solid) {
  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < rows; y++) {
    const g = [];
    const c = [];
    for (let x = 0; x < cols; x++) {
      g.push(0);
      c.push(solid[y * cols + x]);
    }
    groundRows.push(g.join(','));
    collisionRows.push(c.join(','));
  }

  const tmx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">`,
    ` <tileset firstgid="1" name="${SLUG}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">`,
    `  <image source="${MAP_PNG}" width="${width}" height="${height}"/>`,
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

  fs.writeFileSync(path.join(MAPS_DIR, MAP_TMX), tmx);
}

function nearestFree(solid, cols, rows, tx, ty) {
  const blocked = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || solid[y * cols + x] !== 0;
  if (!blocked(tx, ty)) {
    return { tx, ty, px: tx * TILE + TILE / 2, py: ty * TILE + TILE / 2 };
  }
  for (let r = 1; r < Math.max(cols, rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (!blocked(x, y)) {
          return { tx: x, ty: y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2 };
        }
      }
    }
  }
  return null;
}

async function main() {
  const installed = await installImage(SRC);
  const { solid, cols, rows } = buildCollision(installed.width, installed.height);
  writeTmx(cols, rows, installed.width, installed.height, solid);

  const S = installed.width / 1024;
  const LAYOUT = makeLayout(S);
  const freeTiles = solid.filter((v) => v === 0).length;
  const targets = {
    spawn: { x: LAYOUT.plaza.cx, y: LAYOUT.plaza.cy + 18 * S },
    ...LAYOUT.doors,
  };
  const places = {};
  for (const [name, pt] of Object.entries(targets)) {
    const found = nearestFree(
      solid,
      cols,
      rows,
      clamp(Math.floor(pt.x / TILE), 0, cols - 1),
      clamp(Math.floor(pt.y / TILE), 0, rows - 1),
    );
    places[name] = found
      ? { pixel: { x: Math.round(found.px), y: Math.round(found.py) } }
      : null;
  }

  console.log(
    JSON.stringify(
      {
        source: SRC,
        native: installed.native,
        final: { width: installed.width, height: installed.height },
        tile: TILE,
        cols,
        rows,
        collision: {
          freeTiles,
          totalTiles: solid.length,
          walkablePct: Math.round((freeTiles / solid.length) * 1000) / 10,
        },
        places,
        outputs: {
          hubPng: `public/hubs/${HUB_PNG}`,
          mapPng: `public/maps/${MAP_PNG}`,
          mapTmx: `public/maps/${MAP_TMX}`,
        },
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
