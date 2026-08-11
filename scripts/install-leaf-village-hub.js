/**
 * Install Leaf Village hub art + collision TMX.
 *
 * - Copies/resizes source into public/hubs/konoha.png and public/maps/leaf-village-hub.png
 * - Classifies 32×32 tiles via color heuristics + flood-fill from plaza
 * - Geometric fallbacks (plaza circle, moat, outer margin, sky)
 *
 * Usage:
 *   node scripts/install-leaf-village-hub.js [source.png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_SRC = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_mapa-e1aca314-5799-4b55-8f76-6f7dc276d5d7.png',
);

const SRC = process.argv[2] || DEFAULT_SRC;
const ROOT = path.join(__dirname, '..');
const HUBS_DIR = path.join(ROOT, 'public/hubs');
const MAPS_DIR = path.join(ROOT, 'public/maps');
const HUB_PNG = 'konoha.png';
const MAP_PNG = 'leaf-village-hub.png';
const MAP_TMX = 'leaf-village-hub.tmx';
const TILE = 32;
/** Prefer original if max edge ≤ this; otherwise scale max edge to 1920. */
const KEEP_IF_MAX_EDGE = 2048;
const DOWNSCALE_MAX_EDGE = 1920;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: h * 360, s, v: max };
}

/** Soft walkable ground candidate (paths, plaza stone, wood bridge). */
function isWalkableColor(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  // Blue water / sky-ish blue
  if (b > r + 15 && b > g + 10 && b > 70) return false;
  // Dense saturated green (trees, grass roofs) — unless low sat plaza grass handled later
  if (g > r + 18 && g > b + 18 && g > 55 && s > 0.28) return false;
  // Very dark (roofs, shadows under walls)
  if (v < 0.18) return false;

  // Gray stone plaza / walls light: low-mid sat, medium value, similar RGB
  if (s < 0.28 && v > 0.28 && v < 0.75 && chroma < 45) {
    // avoid pure mountain dark-gray
    if (v > 0.32 || r > 70) return true;
  }

  // Warm tan / beige dirt paths
  if (r > g && g >= b - 10 && r > 90 && r < 220 && s > 0.12 && s < 0.65 && v > 0.3 && v < 0.85) {
    // not brick-red roofs
    if (r < 200 || g > 90) return true;
  }

  // Wooden bridge browns
  if (h >= 15 && h <= 50 && s > 0.2 && s < 0.7 && v > 0.25 && v < 0.7 && r > 70 && r > g) {
    return true;
  }

  // Pale sand near plaza (mixed sample)
  if (r > 110 && g > 90 && b > 50 && r - b > 25 && s < 0.45 && v > 0.4 && v < 0.8) {
    return true;
  }

  // Central plaza grass (short / desaturated green, not tree canopy)
  if (g > r && g > b && s > 0.2 && s < 0.7 && v > 0.25 && v < 0.65 && Math.abs(r - b) < 40) {
    // allow only if not too dark-canopy-like
    if (g < 150 && g > 40 && chroma < 100) return true;
  }

  return false;
}

function isHardSolidColor(r, g, b, nx, ny) {
  const { h, s, v } = rgbToHsv(r, g, b);

  // Water blues
  if (b > r + 12 && b > g + 8 && b > 60 && h > 160 && h < 260) return true;
  // Bright water cyan/teal with medium sat
  if (h > 175 && h < 230 && s > 0.2 && b > 80) return true;

  // Sky pale near top
  if (ny < 0.12 && v > 0.55 && s < 0.35) return true;

  // Dense tree canopy green
  if (g > r + 20 && g > b + 15 && s > 0.3 && g > 50) return true;

  // Red/orange roofs & banners
  if (h < 25 && s > 0.35 && v > 0.35 && r > 120 && r > g + 30) return true;
  // Purple roofs
  if (h > 260 && h < 320 && s > 0.2 && v > 0.25) return true;
  // Dark blue roofs
  if (h > 200 && h < 260 && s > 0.25 && v < 0.55 && b > 60) return true;
  // Green glazed roofs (high sat green-yellow)
  if (h > 70 && h < 150 && s > 0.35 && g > 80 && g > r + 10) return true;

  // Mountain dark browns (upper region)
  if (ny < 0.35 && v < 0.35 && s < 0.4) return true;
  if (ny < 0.28 && r < 100 && g < 90 && b < 80) return true;

  // Very dark roofs / interiors
  if (v < 0.15) return true;

  return false;
}

function tileAvg(data, imgW, imgH, tx, ty) {
  let R = 0;
  let G = 0;
  let B = 0;
  let n = 0;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  // Subsample 4px for speed
  for (let py = 0; py < TILE; py += 2) {
    for (let px = 0; px < TILE; px += 2) {
      const x = x0 + px;
      const y = y0 + py;
      if (x >= imgW || y >= imgH) continue;
      const i = (y * imgW + x) * 4;
      R += data[i];
      G += data[i + 1];
      B += data[i + 2];
      n++;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0 };
  return { r: R / n, g: G / n, b: B / n };
}

function snapToTile(size) {
  return Math.floor(size / TILE) * TILE;
}

async function installImage(srcPath) {
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source image not found: ${srcPath}`);
  }

  const meta = await sharp(srcPath).metadata();
  const origW = meta.width;
  const origH = meta.height;
  const maxEdge = Math.max(origW, origH);

  let targetW;
  let targetH;
  if (maxEdge <= KEEP_IF_MAX_EDGE) {
    targetW = snapToTile(origW);
    targetH = snapToTile(origH);
  } else {
    const scale = DOWNSCALE_MAX_EDGE / maxEdge;
    targetW = snapToTile(Math.round(origW * scale));
    targetH = snapToTile(Math.round(origH * scale));
  }

  if (targetW < TILE || targetH < TILE) {
    throw new Error(`Invalid export size ${targetW}x${targetH} from ${origW}x${origH}`);
  }

  fs.mkdirSync(HUBS_DIR, { recursive: true });
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const hubPath = path.join(HUBS_DIR, HUB_PNG);
  const mapPath = path.join(MAPS_DIR, MAP_PNG);

  // Always re-encode as PNG so extension matches content.
  await sharp(srcPath)
    .resize(targetW, targetH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(hubPath);
  fs.copyFileSync(hubPath, mapPath);

  return { origW, origH, width: targetW, height: targetH, hubPath, mapPath };
}

function buildCollision(data, width, height) {
  const cols = width / TILE;
  const rows = height / TILE;

  /** 0 = free, 1 = solid */
  const solid = new Array(cols * rows).fill(1);
  const candidate = new Array(cols * rows).fill(false);

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const i = ty * cols + tx;
      const { r, g, b } = tileAvg(data, width, height, tx, ty);
      const nx = (tx + 0.5) / cols;
      const ny = (ty + 0.5) / rows;

      if (isHardSolidColor(r, g, b, nx, ny)) {
        candidate[i] = false;
        continue;
      }
      candidate[i] = isWalkableColor(r, g, b);
    }
  }

  // --- Geometric fallbacks -----------------------------------------------
  // Outer margin solid (trees beyond village)
  const marginX = Math.max(1, Math.floor(cols * 0.04));
  const marginY = Math.max(1, Math.floor(rows * 0.04));
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx < marginX || tx >= cols - marginX || ty < marginY || ty >= rows - marginY) {
        candidate[ty * cols + tx] = false;
      }
    }
  }

  // Sky / mountain / top walls: first ~28% height always solid
  const skyRows = Math.ceil(rows * 0.28);
  for (let ty = 0; ty < skyRows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      candidate[ty * cols + tx] = false;
    }
  }

  // Moat water band near bottom (exclude center bridge corridor)
  const moatY0 = Math.floor(rows * 0.78);
  const moatY1 = rows - 1;
  const bridgeX0 = Math.floor(cols * 0.42);
  const bridgeX1 = Math.ceil(cols * 0.58);
  for (let ty = moatY0; ty <= moatY1; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx < bridgeX0 || tx > bridgeX1) {
        candidate[ty * cols + tx] = false;
      }
    }
  }
  // Bridge corridor forced walkable where colors allow wood/path
  for (let ty = Math.floor(rows * 0.72); ty < rows - 1; ty++) {
    for (let tx = bridgeX0; tx <= bridgeX1; tx++) {
      const { r, g, b } = tileAvg(data, width, height, tx, ty);
      // not pure blue water
      if (!(b > r + 20 && b > g + 15 && b > 80)) {
        candidate[ty * cols + tx] = true;
      }
    }
  }

  // Force plaza circle walkable (gray stone ring + grass center)
  const plazaCx = cols * 0.5;
  const plazaCy = rows * 0.58;
  const plazaR = Math.min(cols, rows) * 0.14;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const dx = tx + 0.5 - plazaCx;
      const dy = ty + 0.5 - plazaCy;
      if (dx * dx + dy * dy <= plazaR * plazaR) {
        candidate[ty * cols + tx] = true;
      }
    }
  }

  // Path spokes from plaza toward bridge / left ramen / right market (ellipse)
  const forcePathSeg = (x0, y0, x1, y1, halfW) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      for (let dy = -halfW; dy <= halfW; dy++) {
        for (let dx = -halfW; dx <= halfW; dx++) {
          const tx = Math.round(cx + dx);
          const ty = Math.round(cy + dy);
          if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
          // skip already forced solid mountain rows
          if (ty < skyRows) continue;
          const { r, g, b } = tileAvg(data, width, height, tx, ty);
          if (isHardSolidColor(r, g, b, (tx + 0.5) / cols, (ty + 0.5) / rows)) continue;
          candidate[ty * cols + tx] = true;
        }
      }
    }
  };

  // Bridge → plaza
  forcePathSeg(cols * 0.5, rows * 0.88, plazaCx, plazaCy + plazaR * 0.6, 1);
  // Plaza → east training
  forcePathSeg(plazaCx + plazaR, plazaCy, cols * 0.72, rows * 0.45, 1);
  // Plaza → west ramen-ish
  forcePathSeg(plazaCx - plazaR, plazaCy + 2, cols * 0.28, rows * 0.68, 1);
  // Plaza → north mansion approach
  forcePathSeg(plazaCx, plazaCy - plazaR, plazaCx, rows * 0.42, 1);
  // Plaza → SE purple roof shop
  forcePathSeg(plazaCx + plazaR * 0.7, plazaCy + plazaR * 0.5, cols * 0.7, rows * 0.68, 1);

  // Flood-fill from plaza center through candidates
  const seedX = Math.floor(plazaCx);
  const seedY = Math.floor(plazaCy);
  const queue = [];
  const start = seedY * cols + seedX;
  if (candidate[start]) {
    solid[start] = 0;
    queue.push(seedX, seedY);
  } else {
    // find nearest candidate seed in plaza region
    let best = null;
    let bestD = Infinity;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        if (!candidate[ty * cols + tx]) continue;
        const d = Math.hypot(tx - seedX, ty - seedY);
        if (d < bestD) {
          bestD = d;
          best = { tx, ty };
        }
      }
    }
    if (best) {
      solid[best.ty * cols + best.tx] = 0;
      queue.push(best.tx, best.ty);
    }
  }

  while (queue.length) {
    const x = queue.shift();
    const y = queue.shift();
    const neigh = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const i = ny * cols + nx;
      if (solid[i] === 0) continue;
      if (!candidate[i]) continue;
      solid[i] = 0;
      queue.push(nx, ny);
    }
  }

  // Re-assert outer margin / sky / moat solid after flood
  for (let ty = 0; ty < skyRows; ty++) {
    for (let tx = 0; tx < cols; tx++) solid[ty * cols + tx] = 1;
  }
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx < marginX || tx >= cols - marginX || ty < marginY || ty >= rows - marginY) {
        solid[ty * cols + tx] = 1;
      }
    }
  }
  for (let ty = moatY0; ty <= moatY1; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx < bridgeX0 || tx > bridgeX1) solid[ty * cols + tx] = 1;
    }
  }

  // Ensure plaza circle free (playable hub heart)
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const dx = tx + 0.5 - plazaCx;
      const dy = ty + 0.5 - plazaCy;
      if (dx * dx + dy * dy <= plazaR * plazaR) solid[ty * cols + tx] = 0;
    }
  }
  // Ensure bridge corridor free (entry), excluding pure water tiles
  for (let ty = Math.floor(rows * 0.72); ty < rows - 1; ty++) {
    for (let tx = bridgeX0; tx <= bridgeX1; tx++) {
      const { r, g, b } = tileAvg(data, width, height, tx, ty);
      if (b > r + 25 && b > g + 18 && b > 90) {
        solid[ty * cols + tx] = 1;
      } else {
        solid[ty * cols + tx] = 0;
      }
    }
  }

  return { solid, cols, rows, plazaCx, plazaCy, plazaR };
}

function writeTmx(cols, rows, width, height, solid) {
  const tilecount = cols * rows;
  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < rows; y++) {
    const g = [];
    const c = [];
    for (let x = 0; x < cols; x++) {
      g.push(y * cols + x + 1);
      c.push(solid[y * cols + x]);
    }
    groundRows.push(g.join(','));
    collisionRows.push(c.join(','));
  }

  const tmx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">`,
    ` <tileset firstgid="1" name="leaf-village-hub" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tilecount}" columns="${cols}">`,
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

function isBlocked(solid, cols, rows, x, y) {
  return x < 0 || y < 0 || x >= cols || y >= rows || solid[y * cols + x] !== 0;
}

function hasClearance(solid, cols, rows, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (isBlocked(solid, cols, rows, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function nearestFree(solid, cols, rows, tx, ty, radius = 1) {
  // spiral search
  if (hasClearance(solid, cols, rows, tx, ty, radius)) {
    return { tx, ty, px: tx * TILE + TILE / 2, py: ty * TILE + TILE / 2 };
  }
  for (let r = 1; r < Math.max(cols, rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (hasClearance(solid, cols, rows, x, y, radius)) {
          return { tx: x, ty: y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2 };
        }
      }
    }
  }
  // fallback: nearest free tile without clearance
  for (let r = 0; r < Math.max(cols, rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (!isBlocked(solid, cols, rows, x, y)) {
          return { tx: x, ty: y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2 };
        }
      }
    }
  }
  return null;
}

function toPx(tx, ty) {
  return { x: Math.round(tx * TILE + TILE / 2), y: Math.round(ty * TILE + TILE / 2) };
}

async function main() {
  const installed = await installImage(SRC);
  const { data, info } = await sharp(installed.mapPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { solid, cols, rows, plazaCx, plazaCy } = buildCollision(
    data,
    info.width,
    info.height,
  );
  writeTmx(cols, rows, info.width, info.height, solid);

  const freeTiles = solid.filter((v) => v === 0).length;
  const totalTiles = solid.length;

  // Targets (fraction of map → tile)
  const targets = {
    spawn: { fx: 0.5, fy: 0.58 },
    mapa: { fx: 0.72, fy: 0.48 },
    bag: { fx: 0.68, fy: 0.66 },
    heal: { fx: 0.28, fy: 0.7 },
    iruka: { fx: 0.46, fy: 0.5 },
    kakashi: { fx: 0.54, fy: 0.5 },
    hiruzen: { fx: 0.5, fy: 0.46 },
    kuro: { fx: 0.66, fy: 0.72 },
    anko: { fx: 0.74, fy: 0.42 },
  };

  const places = {};
  for (const [name, { fx, fy }] of Object.entries(targets)) {
    const tx = clamp(Math.floor(fx * cols), 0, cols - 1);
    const ty = clamp(Math.floor(fy * rows), 0, rows - 1);
    const found = nearestFree(solid, cols, rows, tx, ty, name === 'spawn' ? 1 : 0);
    places[name] = found
      ? {
          tile: { x: found.tx, y: found.ty },
          pixel: { x: Math.round(found.px), y: Math.round(found.py) },
        }
      : null;
  }

  const report = {
    source: SRC,
    original: { width: installed.origW, height: installed.origH },
    final: { width: installed.width, height: installed.height },
    tile: TILE,
    cols,
    rows,
    collision: {
      freeTiles,
      totalTiles,
      walkablePct: Math.round((freeTiles / totalTiles) * 1000) / 10,
    },
    plazaSeed: toPx(Math.floor(plazaCx), Math.floor(plazaCy)),
    places,
    outputs: {
      hubPng: path.relative(ROOT, installed.hubPath).replace(/\\/g, '/'),
      mapPng: `public/maps/${MAP_PNG}`,
      mapTmx: `public/maps/${MAP_TMX}`,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
