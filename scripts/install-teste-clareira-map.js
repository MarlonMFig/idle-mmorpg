/**
 * Instala o mapa de teste `hunt-teste-clareira` (primeira caça).
 *
 * node scripts/install-teste-clareira-map.js [caminho-do-png]
 *
 * Aceita arte quadrada/retangular. Se a largura/altura não for múltipla do
 * tile (16px), faz crop central para o maior múltiplo — sem upscale.
 *
 * Colisão: cada tile vota pelos pixels (chão/trilha vs água/rocha/copa densa).
 * Flood fill a partir do centro evita spawn na mata das bordas.
 *
 * Saídas:
 *   public/maps/hunt-teste-clareira.png
 *   public/maps/hunt-teste-clareira.tmx
 *   .tmp/clareira-collision-preview.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const SLUG = 'hunt-teste-clareira';
const DEFAULT_SRC = path.join(
  ROOT,
  '.tmp-mapa-floresta',
  'mapa_floresta_5000x5000',
  'mapa_floresta_5000x5000.png',
);

const TILE = 16;
const ENEMY_SPAWNS = 16;
const SPAWN_MIN_DIST = 380;
/** Fração mínima de pixels caminháveis para o tile ficar aberto. */
const WALK_VOTE = 0.55;
/** Não nascer colado na borda do PNG. */
const SPAWN_INSET = 420;

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 1 = chão da clareira / trilha; 0 = água, rocha, mata densa, toco, cerca.
 * Arte floresta 5k: grama oliva escura (lum ~75–110) sob luz quente — não
 * exigir verde “claro” como na clareira 4K antiga.
 */
function pixelWalkable(r, g, b) {
  const lum = luma(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  // Água / sombra azulada
  if (b > r + 10 && b > g + 4 && b > 55) return 0;
  if (lum < 52) return 0;
  // Rocha cinza / madeira cinzenta
  if (sat < 22 && lum < 170) return 0;
  // Copa/tronco bem escuro
  if (g >= r && g > b && lum < 68) return 0;
  // Grama / chão da clareira (oliva / amarelo-verde)
  if (g >= r - 4 && g > b + 8 && lum >= 68 && lum <= 185 && sat >= 18) return 1;
  // Terra / trilha quente
  if (r >= g - 6 && r > b + 10 && lum >= 78 && lum <= 190 && sat >= 16) return 1;
  // Madeira de ponte clara
  if (r > 120 && g > 95 && r > b + 18 && lum > 105 && sat > 20) return 1;
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
  const rings = [720, 1200, 1680];
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
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) throw new Error('não foi possível ler dimensões da arte');
  if (srcW < TILE * 8 || srcH < TILE * 8) {
    throw new Error(`arte ${srcW}×${srcH} é pequena demais`);
  }

  const width = Math.floor(srcW / TILE) * TILE;
  const height = Math.floor(srcH / TILE) * TILE;
  const cropLeft = Math.floor((srcW - width) / 2);
  const cropTop = Math.floor((srcH - height) / 2);
  const cols = width / TILE;
  const rows = height / TILE;
  console.log(
    `fonte ${srcW}×${srcH}` +
      (width !== srcW || height !== srcH
        ? ` → crop central ${width}×${height} (tile ${TILE}px)`
        : ` · nativo múltiplo de ${TILE}px`),
  );
  console.log(`colisão ${cols}×${rows} tiles`);

  const outPng = path.join(MAPS_DIR, `${SLUG}.png`);
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });

  const prepared = sharp(src).extract({
    left: cropLeft,
    top: cropTop,
    width,
    height,
  });
  // PNG do mapa: crop só se preciso; sem upscale. Reusa arquivo se já bate.
  let reusePng = false;
  if (fs.existsSync(outPng)) {
    const existing = await sharp(outPng).metadata();
    if (existing.width === width && existing.height === height) reusePng = true;
  }
  // Sempre grava quando a fonte veio na CLI (arte nova, mesmo tamanho).
  const forceWrite = Boolean(process.argv[2]);
  if (!reusePng || forceWrite) {
    await prepared.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outPng);
    reusePng = false;
  }
  console.log(
    `png  ${(fs.statSync(outPng).size / 1048576).toFixed(2)}MB → ${outPng}` +
      (reusePng ? ' (já instalado)' : ''),
  );

  const { data, info } = await prepared
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
  const preview = await writePreview(outPng, walk, cols, rows, width, height, spawns, player);
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
