/**
 * Gera tileset "nature" + mapa leafVillage (chão + decoração).
 * node scripts/generate-nature-map.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TILE = 32;
const COLS = 8;
const ROWS = 4;
const TW = COLS * TILE;
const TH = ROWS * TILE;

/** Índices locais do tileset (0-based). GID = index + 1 */
const T = {
  GRASS: 0,
  GRASS2: 1,
  DIRT: 2,
  DIRT2: 3,
  CLIFF: 4,
  CLIFF_TOP: 5,
  STONE: 6,
  PATH: 7,
  FLOWER_PINK: 8,
  FLOWER_YELLOW: 9,
  FLOWER_PURPLE: 10,
  BUSH: 11,
  BAMBOO: 12,
  ROCK: 13,
  LOG: 14,
  FERN: 15,
  // 16-31 reserved / variants
  GRASS3: 16,
  DIRT3: 17,
  FLOWER_PINK2: 18,
  BUSH2: 19,
  BAMBOO2: 20,
  ROCK2: 21,
  TALL_GRASS: 22,
  MUSHROOM: 23,
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function hash(x, y, s = 0) {
  let n = x * 374761393 + y * 668265263 + s * 982451653;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function setPx(buf, w, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= w || y >= TH) return;
  const i = (y * w + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function fillRect(buf, w, x0, y0, rw, rh, r, g, b, a = 255) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) setPx(buf, w, x, y, r, g, b, a);
  }
}

function paintGrass(buf, ox, oy, variant) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, 10 + variant);
      const n2 = hash(x + 3, y + 7, 40 + variant);
      let r = 52 + Math.floor(n * 28);
      let g = 118 + Math.floor(n * 40);
      let b = 48 + Math.floor(n2 * 18);
      if (variant === 1) {
        r -= 8;
        g += 10;
      }
      if (variant === 2) {
        g -= 12;
        b += 6;
      }
      // blade speckles
      if (n > 0.82) {
        r = 70;
        g = 150;
        b = 55;
      }
      if (n2 > 0.9) {
        r = 40;
        g = 90;
        b = 35;
      }
      setPx(buf, TW, ox + x, oy + y, r, g, b);
    }
  }
}

function paintDirt(buf, ox, oy, variant) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, 20 + variant);
      let r = 118 + Math.floor(n * 36);
      let g = 84 + Math.floor(n * 22);
      let b = 48 + Math.floor(n * 14);
      if (variant === 1) {
        r += 12;
        g += 6;
      }
      if (variant === 2) {
        r -= 10;
        g -= 8;
      }
      if (n > 0.85) {
        r -= 20;
        g -= 15;
        b -= 10;
      }
      setPx(buf, TW, ox + x, oy + y, r, g, b);
    }
  }
}

function paintCliff(buf, ox, oy) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, 55);
      const band = Math.floor(y / 6);
      let r = 92 + band * 8 + Math.floor(n * 20);
      let g = 68 + band * 4 + Math.floor(n * 12);
      let b = 48 + Math.floor(n * 10);
      if (x < 3 || x > 28) {
        r -= 25;
        g -= 20;
        b -= 15;
      }
      if (y % 8 === 0) {
        r -= 15;
        g -= 12;
      }
      setPx(buf, TW, ox + x, oy + y, r, g, b);
    }
  }
}

function paintCliffTop(buf, ox, oy) {
  paintGrass(buf, ox, oy, 0);
  for (let y = 18; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, 56);
      const r = 95 + Math.floor(n * 18);
      const g = 72 + Math.floor(n * 10);
      const b = 50 + Math.floor(n * 8);
      setPx(buf, TW, ox + x, oy + y, r, g, b);
    }
  }
}

function paintStone(buf, ox, oy) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, 60);
      const r = 110 + Math.floor(n * 40);
      const g = 112 + Math.floor(n * 38);
      const b = 108 + Math.floor(n * 35);
      setPx(buf, TW, ox + x, oy + y, r, g, b);
    }
  }
}

function paintPath(buf, ox, oy) {
  paintDirt(buf, ox, oy, 1);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x + y) % 7 === 0) {
        setPx(buf, TW, ox + x, oy + y, 140, 105, 65);
      }
    }
  }
}

function clearTile(buf, ox, oy) {
  fillRect(buf, TW, ox, oy, TILE, TILE, 0, 0, 0, 0);
}

function paintFlower(buf, ox, oy, kind) {
  clearTile(buf, ox, oy);
  const stem = [48, 120, 40];
  fillRect(buf, TW, ox + 15, oy + 16, 2, 12, ...stem);
  const petals =
    kind === 'pink'
      ? [230, 90, 140]
      : kind === 'yellow'
        ? [240, 190, 50]
        : [150, 90, 210];
  const centers = [
    [16, 12],
    [12, 14],
    [20, 14],
    [14, 10],
    [18, 10],
  ];
  for (const [cx, cy] of centers) {
    fillRect(buf, TW, ox + cx, oy + cy, 3, 3, ...petals);
  }
  fillRect(buf, TW, ox + 15, oy + 12, 2, 2, 250, 230, 80);
}

function paintBush(buf, ox, oy, variant) {
  clearTile(buf, ox, oy);
  const shades = variant
    ? [
        [40, 110, 45],
        [55, 140, 60],
        [30, 90, 35],
      ]
    : [
        [35, 100, 40],
        [50, 130, 55],
        [25, 80, 30],
      ];
  fillRect(buf, TW, ox + 6, oy + 14, 20, 14, ...shades[0]);
  fillRect(buf, TW, ox + 10, oy + 10, 14, 10, ...shades[1]);
  fillRect(buf, TW, ox + 4, oy + 18, 8, 8, ...shades[2]);
  fillRect(buf, TW, ox + 20, oy + 18, 8, 8, ...shades[2]);
  // berries
  fillRect(buf, TW, ox + 12, oy + 16, 2, 2, 200, 50, 60);
  fillRect(buf, TW, ox + 18, oy + 20, 2, 2, 200, 50, 60);
}

function paintBamboo(buf, ox, oy, variant) {
  clearTile(buf, ox, oy);
  const xs = variant ? [10, 18, 24] : [8, 16, 22];
  for (const x of xs) {
    fillRect(buf, TW, ox + x, oy + 4, 3, 26, 70, 150, 55);
    for (let seg = 0; seg < 4; seg++) {
      fillRect(buf, TW, ox + x, oy + 8 + seg * 6, 3, 1, 40, 100, 35);
    }
    fillRect(buf, TW, ox + x - 2, oy + 6, 7, 2, 90, 170, 70);
  }
}

function paintRock(buf, ox, oy, variant) {
  clearTile(buf, ox, oy);
  const base = variant ? [130, 130, 125] : [120, 118, 112];
  fillRect(buf, TW, ox + 8, oy + 16, 16, 10, ...base);
  fillRect(buf, TW, ox + 10, oy + 12, 12, 8, base[0] + 20, base[1] + 18, base[2] + 15);
  fillRect(buf, TW, ox + 6, oy + 20, 6, 6, base[0] - 15, base[1] - 15, base[2] - 12);
  fillRect(buf, TW, ox + 20, oy + 18, 7, 7, base[0] - 10, base[1] - 10, base[2] - 8);
}

function paintLog(buf, ox, oy) {
  clearTile(buf, ox, oy);
  fillRect(buf, TW, ox + 4, oy + 18, 24, 8, 110, 75, 40);
  fillRect(buf, TW, ox + 4, oy + 18, 24, 2, 140, 100, 55);
  fillRect(buf, TW, ox + 6, oy + 20, 3, 4, 90, 60, 30);
  fillRect(buf, TW, ox + 22, oy + 20, 3, 4, 90, 60, 30);
}

function paintFern(buf, ox, oy) {
  clearTile(buf, ox, oy);
  fillRect(buf, TW, ox + 15, oy + 18, 2, 10, 40, 100, 40);
  for (let i = 0; i < 5; i++) {
    fillRect(buf, TW, ox + 8 + i * 3, oy + 12 + (i % 2) * 2, 4, 3, 60, 140, 55);
  }
}

function paintTallGrass(buf, ox, oy) {
  clearTile(buf, ox, oy);
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 4;
    fillRect(buf, TW, ox + x, oy + 10, 2, 18, 55 + i * 5, 130, 45);
  }
}

function paintMushroom(buf, ox, oy) {
  clearTile(buf, ox, oy);
  fillRect(buf, TW, ox + 14, oy + 18, 4, 8, 230, 220, 200);
  fillRect(buf, TW, ox + 10, oy + 12, 12, 8, 210, 60, 55);
  fillRect(buf, TW, ox + 12, oy + 10, 8, 4, 230, 80, 70);
  fillRect(buf, TW, ox + 13, oy + 14, 2, 2, 250, 230, 220);
  fillRect(buf, TW, ox + 17, oy + 13, 2, 2, 250, 230, 220);
}

async function buildTileset() {
  const buf = Buffer.alloc(TW * TH * 4, 0);

  const place = (index, paint) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    paint(buf, col * TILE, row * TILE);
  };

  place(T.GRASS, (b, x, y) => paintGrass(b, x, y, 0));
  place(T.GRASS2, (b, x, y) => paintGrass(b, x, y, 1));
  place(T.DIRT, (b, x, y) => paintDirt(b, x, y, 0));
  place(T.DIRT2, (b, x, y) => paintDirt(b, x, y, 1));
  place(T.CLIFF, (b, x, y) => paintCliff(b, x, y));
  place(T.CLIFF_TOP, (b, x, y) => paintCliffTop(b, x, y));
  place(T.STONE, (b, x, y) => paintStone(b, x, y));
  place(T.PATH, (b, x, y) => paintPath(b, x, y));
  place(T.FLOWER_PINK, (b, x, y) => paintFlower(b, x, y, 'pink'));
  place(T.FLOWER_YELLOW, (b, x, y) => paintFlower(b, x, y, 'yellow'));
  place(T.FLOWER_PURPLE, (b, x, y) => paintFlower(b, x, y, 'purple'));
  place(T.BUSH, (b, x, y) => paintBush(b, x, y, 0));
  place(T.BAMBOO, (b, x, y) => paintBamboo(b, x, y, 0));
  place(T.ROCK, (b, x, y) => paintRock(b, x, y, 0));
  place(T.LOG, (b, x, y) => paintLog(b, x, y));
  place(T.FERN, (b, x, y) => paintFern(b, x, y));
  place(T.GRASS3, (b, x, y) => paintGrass(b, x, y, 2));
  place(T.DIRT3, (b, x, y) => paintDirt(b, x, y, 2));
  place(T.FLOWER_PINK2, (b, x, y) => paintFlower(b, x, y, 'pink'));
  place(T.BUSH2, (b, x, y) => paintBush(b, x, y, 1));
  place(T.BAMBOO2, (b, x, y) => paintBamboo(b, x, y, 1));
  place(T.ROCK2, (b, x, y) => paintRock(b, x, y, 1));
  place(T.TALL_GRASS, (b, x, y) => paintTallGrass(b, x, y));
  place(T.MUSHROOM, (b, x, y) => paintMushroom(b, x, y));

  const outDir = path.join(ROOT, 'public', 'tilesets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'nature.png');
  await sharp(buf, { raw: { width: TW, height: TH, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
  return T;
}

function gid(local) {
  return local + 1;
}

function csvLayer(w, h, fill) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(String(fill(x, y)));
    rows.push(row.join(','));
  }
  return `${rows.join(',\n')},`;
}

function inBlob(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function buildLeafMap() {
  const W = 32;
  const H = 28;

  const ground = (x, y) => {
    // left cliff wall
    if (x <= 1) return gid(T.CLIFF);
    if (x === 2) return gid(T.CLIFF_TOP);

    // dirt path cross + organic patches
    if (x === 16 || y === 14) return gid(T.PATH);
    if (inBlob(x, y, 10, 10, 4.2, 3.2)) return hash(x, y, 1) > 0.35 ? gid(T.DIRT) : gid(T.DIRT2);
    if (inBlob(x, y, 22, 18, 5, 3.5)) return hash(x, y, 2) > 0.4 ? gid(T.DIRT2) : gid(T.DIRT3);
    if (inBlob(x, y, 18, 7, 3.5, 2.5)) return gid(T.DIRT);
    if (inBlob(x, y, 8, 20, 3, 2.2)) return gid(T.DIRT3);

    // stone plaza near center-right
    if (x >= 24 && x <= 28 && y >= 11 && y <= 15) return gid(T.STONE);

    const n = hash(x, y, 3);
    if (n > 0.72) return gid(T.GRASS2);
    if (n < 0.18) return gid(T.GRASS3);
    return gid(T.GRASS);
  };

  const decorPool = [
    T.FLOWER_PINK,
    T.FLOWER_YELLOW,
    T.FLOWER_PURPLE,
    T.FLOWER_PINK2,
    T.BUSH,
    T.BUSH2,
    T.BAMBOO,
    T.BAMBOO2,
    T.ROCK,
    T.ROCK2,
    T.FERN,
    T.TALL_GRASS,
    T.LOG,
    T.MUSHROOM,
  ];

  const decor = (x, y) => {
    if (x <= 2) return 0;
    if (x === 16 || y === 14) return 0; // keep path clear
    if (x >= 24 && x <= 28 && y >= 11 && y <= 15) return 0;

    // clear spawn / NPC areas roughly
    if (inBlob(x, y, 10, 9, 2.2, 2)) return 0;
    if (inBlob(x, y, 15, 12.5, 2.5, 2)) return 0;

    const n = hash(x, y, 99);
    if (n < 0.62) return 0;

    // denser vegetation on left meadow & edges
    const edgeBoost = x < 8 || y < 4 || y > H - 5 || x > W - 5 ? 0.15 : 0;
    if (n < 0.72 - edgeBoost) return 0;

    const pick = decorPool[Math.floor(hash(x, y, 100) * decorPool.length)];
    // bamboo clusters on left
    if (x < 9 && hash(x, y, 101) > 0.55) return gid(T.BAMBOO);
    if (x < 9 && hash(x, y, 102) > 0.7) return gid(T.BAMBOO2);
    return gid(pick);
  };

  const groundCsv = csvLayer(W, H, ground);
  const decorCsv = csvLayer(W, H, decor);

  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="nature" tilewidth="32" tileheight="32" tilecount="32" columns="8">
  <image source="../tilesets/nature.png" width="256" height="128"/>
  <tile id="${T.CLIFF}">
   <properties>
    <property name="collides" type="bool" value="true"/>
   </properties>
  </tile>
 </tileset>
 <layer id="1" name="ground" width="${W}" height="${H}">
  <data encoding="csv">
${groundCsv}
</data>
 </layer>
 <layer id="2" name="decor" width="${W}" height="${H}">
  <data encoding="csv">
${decorCsv}
</data>
 </layer>
</map>
`;
}

async function main() {
  await buildTileset();
  const mapsDir = path.join(ROOT, 'public', 'maps');
  fs.mkdirSync(mapsDir, { recursive: true });
  const mapPath = path.join(mapsDir, 'leafVillage.tmx');
  fs.writeFileSync(mapPath, buildLeafMap(), 'utf8');
  console.log('wrote', mapPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
