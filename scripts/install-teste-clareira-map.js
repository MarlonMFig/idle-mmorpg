/**
 * Instala o mapa de teste "Clareira de Treinamento" (4096×2160, mesma
 * resolução do hub). Sem resize e sem recompressão — a arte entra como cópia
 * fiel para ficar no mesmo peso visual dos sprites 4K.
 *
 * node scripts/install-teste-clareira-map.js [caminho-do-png]
 *
 * Colisão: tiles de 16px (divide 4096 e 2160). Cada tile vota pelos pixels
 * (grama/trilha/ponte vs água/rocha/toco/boneco/cerca). Flood fill a partir
 * do centro evita spawn na floresta das bordas.
 *
 * Saídas:
 *   public/maps/hunt-teste-clareira.png   arte (cópia fiel)
 *   public/maps/hunt-teste-clareira.tmx   colisão 256×135 tiles de 16px
 *   .tmp/clareira-collision-preview.png   overlay para inspeção visual
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const SLUG = 'hunt-teste-clareira';
const DEFAULT_SRC = path.join(
  ROOT,
  '.tmp',
  'mapa-ninja',
  'Mapa_Treinamento_Ninja_Obstaculos_4096x2160.png',
);

const TILE = 16;
const ENEMY_SPAWNS = 16;
const SPAWN_MIN_DIST = 300;
/** Fração mínima de pixels caminháveis para o tile ficar aberto. */
const WALK_VOTE = 0.66;
/** Não nascer colado na borda do PNG. */
const SPAWN_INSET = 360;

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 1 = grama, trilha ou ponte; 0 = água, rocha, mata, toco, boneco, cerca.
 * Classifica o pixel, não a média do tile — senão um boneco no meio da
 * grama “some” na média verde e o personagem atravessa o obstáculo.
 */
function pixelWalkable(r, g, b) {
  const lum = luma(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  if (b > r + 14 && b > g - 10 && b > 70) return 0;
  if (lum < 64) return 0;
  if (sat < 26 && lum < 185) return 0;
  // Copa/tronco musgoso bem escuro — grama viva da clareira fica acima disso.
  if (g > r && g > b && lum < 90 && g - r < 24) return 0;
  if (g > r + 2 && g > b + 12) return 1;
  // Terra clara e tábuas da ponte (madeira quente o bastante para andar).
  if (r > 138 && g > 108 && r > b + 22 && lum > 112) return 1;
  return 0;
}

function tileWalkable(data, width, channels, tx, ty, height) {
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const x1 = Math.min(x0 + TILE, width);
  const y1 = Math.min(y0 + TILE, height);
  let walk = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * channels;
      walk += pixelWalkable(data[i], data[i + 1], data[i + 2]);
      n += 1;
    }
  }
  return n > 0 && walk / n >= WALK_VOTE;
}

/**
 * Solta os tiles bloqueados avulsos no meio da clareira (tufo, flor, sombra)
 * — sem isso o personagem trava em obstáculos que ninguém vê. Blocos de 2×2
 * ou maiores (tocos, postes, arbustos) continuam bloqueando.
 */
function despeckle(walk, cols, rows) {
  const cleaned = Uint8Array.from(walk);
  let freed = 0;
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      const at = y * cols + x;
      if (walk[at]) continue;
      let open = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if (walk[(y + dy) * cols + (x + dx)]) open += 1;
        }
      }
      if (open >= 6) {
        cleaned[at] = 1;
        freed += 1;
      }
    }
  }
  walk.set(cleaned);
  return freed;
}

/** Mantém apenas a área caminhável conectada ao centro do mapa. */
function keepCenterRegion(walk, cols, rows) {
  const start = findSeed(walk, cols, rows);
  if (!start) throw new Error('nenhum tile caminhável no centro da imagem');
  const seen = new Uint8Array(cols * rows);
  const queue = [start];
  seen[start] = 1;
  let count = 0;
  while (queue.length) {
    const at = queue.pop();
    count += 1;
    const x = at % cols;
    const y = (at - x) / cols;
    const neighbours = [
      x > 0 ? at - 1 : -1,
      x < cols - 1 ? at + 1 : -1,
      y > 0 ? at - cols : -1,
      y < rows - 1 ? at + cols : -1,
    ];
    for (const next of neighbours) {
      if (next < 0 || seen[next] || !walk[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  for (let i = 0; i < walk.length; i += 1) walk[i] = seen[i] ? 1 : 0;
  return { count, seed: start };
}

/** Tile caminhável mais próximo do centro geométrico. */
function findSeed(walk, cols, rows) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const at = y * cols + x;
      if (!walk[at]) continue;
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = at;
      }
    }
  }
  return best;
}

function innerTiles(walk, cols, rows, margin) {
  const inner = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!walk[y * cols + x]) continue;
      let clear = true;
      for (let dy = -margin; dy <= margin && clear; dy += 1) {
        for (let dx = -margin; dx <= margin; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !walk[ny * cols + nx]) {
            clear = false;
            break;
          }
        }
      }
      if (clear) inner.push({ x, y });
    }
  }
  return inner;
}

function pickSpawns(tiles, count, minDist, center, width, height) {
  const world = tiles
    .map((tile) => ({
      x: tile.x * TILE + TILE / 2,
      y: tile.y * TILE + TILE / 2,
    }))
    .filter(
      (p) =>
        p.x >= SPAWN_INSET &&
        p.y >= SPAWN_INSET &&
        p.x <= width - SPAWN_INSET &&
        p.y <= height - SPAWN_INSET,
    );
  const picked = [];
  const rings = [520, 820];
  const perRing = Math.ceil(count / rings.length);
  for (const radius of rings) {
    for (let i = 0; i < perRing && picked.length < count; i += 1) {
      const angle = (i / perRing) * Math.PI * 2 + (radius === rings[0] ? 0.2 : 0.55);
      const tx = center.x + Math.cos(angle) * radius;
      const ty = center.y + Math.sin(angle) * radius;
      let best = null;
      let bestDist = Infinity;
      for (const candidate of world) {
        const far = picked.every(
          (p) => (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2 >= minDist * minDist,
        );
        if (!far) continue;
        const d = (candidate.x - tx) ** 2 + (candidate.y - ty) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = candidate;
        }
      }
      if (best) picked.push(best);
    }
  }
  picked.sort((a, b) => a.y - b.y || a.x - b.x);
  return picked;
}

function writeTmx(walk, cols, rows, width, height) {
  const ground = Array.from({ length: rows }, () => Array(cols).fill(0).join(','));
  const collision = [];
  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) row.push(walk[y * cols + x] ? 0 : 1);
    collision.push(row.join(','));
  }

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="${SLUG}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="${SLUG}.png" width="${width}" height="${height}"/>
 </tileset>
 <layer id="1" name="ground" width="${cols}" height="${rows}">
  <data encoding="csv">
${ground.join(',\n')}
</data>
 </layer>
 <layer id="2" name="collision" width="${cols}" height="${rows}">
  <data encoding="csv">
${collision.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(path.join(MAPS_DIR, `${SLUG}.tmx`), tmx);
}

async function writePreview(src, walk, cols, rows, width, height, spawns, player) {
  const previewW = 1024;
  const scale = previewW / width;
  const svgTiles = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (walk[y * cols + x]) continue;
      svgTiles.push(
        `<rect x="${(x * TILE * scale).toFixed(1)}" y="${(y * TILE * scale).toFixed(1)}" width="${(TILE * scale).toFixed(1)}" height="${(TILE * scale).toFixed(1)}" fill="#ff0000" opacity="0.45"/>`,
      );
    }
  }
  const dots = spawns
    .map(
      (s) =>
        `<circle cx="${(s.x * scale).toFixed(1)}" cy="${(s.y * scale).toFixed(1)}" r="5" fill="#00e5ff"/>`,
    )
    .join('');
  const hero = `<circle cx="${(player.x * scale).toFixed(1)}" cy="${(player.y * scale).toFixed(1)}" r="8" fill="#ffee00"/>`;
  const previewH = Math.round(height * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${previewW}" height="${previewH}">${svgTiles.join('')}${dots}${hero}</svg>`;
  const out = path.join(ROOT, '.tmp', 'clareira-collision-preview.png');
  await sharp(src)
    .resize(previewW, previewH)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(out);
  return out;
}

async function main() {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;
  if (!fs.existsSync(src)) throw new Error(`arte não encontrada: ${src}`);

  const meta = await sharp(src).metadata();
  const width = meta.width;
  const height = meta.height;
  if (width !== 4096 || height !== 2160) {
    throw new Error(`esperado 4096×2160, recebido ${width}×${height} — recusar resize`);
  }
  const cols = width / TILE;
  const rows = height / TILE;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
    throw new Error(`tile ${TILE}px não divide ${width}×${height}`);
  }
  console.log(`arte ${width}×${height} · colisão ${cols}×${rows} tiles de ${TILE}px`);

  const outPng = path.join(MAPS_DIR, `${SLUG}.png`);
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(path.join(ROOT, '.tmp', 'mapa-ninja'), { recursive: true });
  // Cópia binária: nenhum resize, nenhuma recompressão.
  if (path.resolve(src) !== path.resolve(outPng)) {
    fs.copyFileSync(src, outPng);
  }
  const cacheSrc = path.join(
    ROOT,
    '.tmp',
    'mapa-ninja',
    'Mapa_Treinamento_Ninja_Obstaculos_4096x2160.png',
  );
  if (path.resolve(src) !== path.resolve(cacheSrc)) {
    fs.copyFileSync(src, cacheSrc);
  }
  console.log(`png  ${(fs.statSync(outPng).size / 1048576).toFixed(2)}MB → ${outPng} (cópia fiel)`);

  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const walk = new Uint8Array(cols * rows);
  for (let ty = 0; ty < rows; ty += 1) {
    for (let tx = 0; tx < cols; tx += 1) {
      walk[ty * cols + tx] = tileWalkable(data, info.width, info.channels, tx, ty, info.height)
        ? 1
        : 0;
    }
  }
  const rawWalk = walk.reduce((acc, v) => acc + v, 0);
  const freed = despeckle(walk, cols, rows);
  const { count, seed } = keepCenterRegion(walk, cols, rows);
  console.log(
    `caminhável ${rawWalk} tiles (+${freed} ruídos liberados) → ${count} conectados ao centro (${((count / (cols * rows)) * 100).toFixed(1)}% do mapa)`,
  );

  const player = {
    x: (seed % cols) * TILE + TILE / 2,
    y: Math.floor(seed / cols) * TILE + TILE / 2,
  };
  const inner = innerTiles(walk, cols, rows, 3);
  const spawns = pickSpawns(inner, ENEMY_SPAWNS, SPAWN_MIN_DIST, player, width, height);
  console.log(`spawn do jogador ${player.x},${player.y} · ${spawns.length} pontos de monstro`);

  writeTmx(walk, cols, rows, width, height);
  const preview = await writePreview(src, walk, cols, rows, width, height, spawns, player);
  console.log(`tmx  → ${path.join(MAPS_DIR, `${SLUG}.tmx`)}`);
  console.log(`preview → ${preview}`);

  console.log('\n--- wonsr-rendered-maps.ts ---');
  console.log(`    width: ${width},`);
  console.log(`    height: ${height},`);
  console.log(`    spawn: { x: ${player.x}, y: ${player.y} },`);
  console.log('    enemySpawns: [');
  for (const s of spawns) console.log(`      { x: ${s.x}, y: ${s.y} },`);
  console.log('    ],');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
