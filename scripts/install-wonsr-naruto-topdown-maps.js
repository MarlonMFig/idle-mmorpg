/**
 * Instala os 8 mapas top-down 3840×2160 (zip 8_Mapas_de_Caca_Naruto_3840x2160) para a aba WONSR.
 *
 * node scripts/install-wonsr-naruto-topdown-maps.js [pasta-dos-png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const DEFAULT_SRC_DIR = path.join(
  ROOT,
  '.tmp-wonsr-8mapas',
  'mapas_caca_naruto_3840x2160',
);

const TILE = 16;
const ENEMY_SPAWNS = 16;
const SPAWN_MIN_DIST = 280;
const WALK_VOTE = 0.55;
const SPAWN_INSET = 220;
const MIN_CONNECTED_RATIO = 0.04;

const MAPS = [
  {
    file: 'floresta_da_morte_3840x2160.png',
    slug: 'wonsr-floresta-da-morte',
    mapKey: 'huntWonsrFlorestaDaMorte',
  },
  {
    file: 'campo_treinamento_konoha_3840x2160.png',
    slug: 'wonsr-campo-treinamento',
    mapKey: 'huntWonsrCampoTreinamento',
  },
  {
    file: 'caverna_akatsuki_3840x2160.png',
    slug: 'wonsr-caverna-akatsuki',
    mapKey: 'huntWonsrCavernaAkatsuki',
    walkMode: 'open',
  },
  {
    file: 'deserto_da_areia_3840x2160.png',
    slug: 'wonsr-deserto-areia',
    mapKey: 'huntWonsrDesertoAreia',
  },
  {
    file: 'esconderijo_orochimaru_3840x2160.png',
    slug: 'wonsr-esconderijo-orochimaru',
    mapKey: 'huntWonsrEsconderijoOrochimaru',
  },
  {
    file: 'pais_do_ferro_3840x2160.png',
    slug: 'wonsr-pais-do-ferro',
    mapKey: 'huntWonsrPaisDoFerro',
  },
  {
    file: 'ponte_da_nevoa_3840x2160.png',
    slug: 'wonsr-ponte-da-nevoa',
    mapKey: 'huntWonsrPonteDaNevoa',
  },
  {
    file: 'vale_das_estatuas_3840x2160.png',
    slug: 'wonsr-vale-das-estatuas',
    mapKey: 'huntWonsrValeDasEstatuas',
  },
];

const EXTRA_MAPS = [
  {
    file: '04_Clareira_Equipe_7_3840x2160_upscaled.png',
    slug: 'wonsr-clareira-equipe-7',
    mapKey: 'huntWonsrClareiraEquipe7',
  },
  {
    file: '07_Laboratorio_Orochimaru_3840x2160_upscaled.png',
    slug: 'wonsr-laboratorio-orochimaru',
    mapKey: 'huntWonsrLaboratorioOrochimaru',
    walkMode: 'open',
  },
];

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function pixelWalkableForest(r, g, b) {
  const lum = luma(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (b > r + 10 && b > g + 4 && b > 55) return 0;
  if (lum < 52) return 0;
  if (sat < 22 && lum < 170) return 0;
  if (g >= r && g > b && lum < 68) return 0;
  if (g >= r - 4 && g > b + 8 && lum >= 68 && lum <= 185 && sat >= 18) return 1;
  if (r >= g - 6 && r > b + 10 && lum >= 78 && lum <= 190 && sat >= 16) return 1;
  if (r > 120 && g > 95 && r > b + 18 && lum > 105 && sat > 20) return 1;
  return 0;
}

/** Caverna / pedra / areia: bloqueia só água e quase-preto. */
function pixelWalkableLoose(r, g, b) {
  const lum = luma(r, g, b);
  if (b > r + 14 && b > g + 8 && b > 48) return 0;
  if (lum < 18) return 0;
  return 1;
}

function lumaThreshold(data, channels) {
  const samples = [];
  const step = channels * 47;
  for (let i = 0; i + 2 < data.length; i += step) {
    samples.push(luma(data[i], data[i + 1], data[i + 2]));
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * 0.28)] ?? 40;
}

function pixelWalkableAdaptive(threshold) {
  return (r, g, b) => {
    if (b > r + 14 && b > g + 8 && b > 48) return 0;
    return luma(r, g, b) >= threshold ? 1 : 0;
  };
}

function tileWalkable(data, width, channels, tx, ty, height, pixelFn) {
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const x1 = Math.min(x0 + TILE, width);
  const y1 = Math.min(y0 + TILE, height);
  let walk = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * channels;
      walk += pixelFn(data[i], data[i + 1], data[i + 2]);
      n += 1;
    }
  }
  return n > 0 && walk / n >= WALK_VOTE;
}

function despeckle(walk, cols, rows) {
  const cleaned = Uint8Array.from(walk);
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
      if (open >= 6) cleaned[at] = 1;
    }
  }
  walk.set(cleaned);
}

function keepCenterRegion(walk, cols, rows) {
  const start = findSeed(walk, cols, rows);
  if (start == null) return null;
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
  const rings = [360, 620, 900];
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

function writeTmx(slug, walk, cols, rows, width, height) {
  const ground = Array.from({ length: rows }, () => Array(cols).fill(0).join(','));
  const collision = [];
  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) row.push(walk[y * cols + x] ? 0 : 1);
    collision.push(row.join(','));
  }
  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="wonsr-collision-16" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="wonsr-collision-16.png" width="16" height="16"/>
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
  fs.writeFileSync(path.join(MAPS_DIR, `${slug}.tmx`), tmx);
}

function buildWalk(data, info, cols, rows, pixelFn) {
  const walk = new Uint8Array(cols * rows);
  for (let ty = 0; ty < rows; ty += 1) {
    for (let tx = 0; tx < cols; tx += 1) {
      walk[ty * cols + tx] = tileWalkable(
        data,
        info.width,
        info.channels,
        tx,
        ty,
        info.height,
        pixelFn,
      )
        ? 1
        : 0;
    }
  }
  despeckle(walk, cols, rows);
  const kept = keepCenterRegion(walk, cols, rows);
  if (!kept || kept.count < cols * rows * MIN_CONNECTED_RATIO) return null;
  return walk;
}

function openWalkGrid(cols, rows) {
  const walk = new Uint8Array(cols * rows);
  walk.fill(1);
  for (let x = 0; x < cols; x += 1) {
    walk[x] = 0;
    walk[(rows - 1) * cols + x] = 0;
  }
  for (let y = 0; y < rows; y += 1) {
    walk[y * cols] = 0;
    walk[y * cols + cols - 1] = 0;
  }
  keepCenterRegion(walk, cols, rows);
  return walk;
}

async function installOne(srcDir, spec) {
  const src = path.join(srcDir, spec.file);
  if (!fs.existsSync(src)) throw new Error(`arte não encontrada: ${src}`);
  const meta = await sharp(src).metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) throw new Error(`sem dimensões: ${spec.file}`);
  const TARGET_W = 3840;
  const TARGET_H = 2160;
  const resized = srcW !== TARGET_W || srcH !== TARGET_H;
  const base = resized
    ? sharp(src).resize(TARGET_W, TARGET_H, { fit: 'fill' })
    : sharp(src);
  const width = Math.floor(TARGET_W / TILE) * TILE;
  const height = Math.floor(TARGET_H / TILE) * TILE;
  const cropLeft = Math.floor((TARGET_W - width) / 2);
  const cropTop = Math.floor((TARGET_H - height) / 2);
  const cols = width / TILE;
  const rows = height / TILE;
  const outPng = path.join(MAPS_DIR, `${spec.slug}.png`);
  const prepared = base.extract({ left: cropLeft, top: cropTop, width, height });
  if (fs.existsSync(outPng)) fs.unlinkSync(outPng);
  await prepared.clone().png({ compressionLevel: 6 }).toFile(outPng);

  const { data, info } = await prepared.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let walk = null;
  let mode = 'forest';
  if (spec.walkMode === 'open') {
    walk = openWalkGrid(cols, rows);
    mode = 'open';
  } else {
    walk = buildWalk(data, info, cols, rows, pixelWalkableForest);
    if (!walk) {
      walk = buildWalk(data, info, cols, rows, pixelWalkableLoose);
      mode = 'loose';
    }
    if (!walk) {
      walk = buildWalk(data, info, cols, rows, pixelWalkableAdaptive(lumaThreshold(data, info.channels)));
      mode = 'adaptive';
    }
    if (!walk) {
      walk = openWalkGrid(cols, rows);
      mode = 'open';
    }
  }
  if (!walk) throw new Error(`${spec.slug}: colisão vazia`);
  const kept = keepCenterRegion(walk, cols, rows);
  if (!kept) throw new Error(`${spec.slug}: colisão vazia`);
  const { count, seed } = kept;
  const player = {
    x: (seed % cols) * TILE + TILE / 2,
    y: Math.floor(seed / cols) * TILE + TILE / 2,
  };
  const inner = innerTiles(walk, cols, rows, 3);
  const spawns = pickSpawns(inner, ENEMY_SPAWNS, SPAWN_MIN_DIST, player, width, height);
  writeTmx(spec.slug, walk, cols, rows, width, height);
  console.log(
    `${spec.slug} ${width}×${height} walk=${mode} ${((count / (cols * rows)) * 100).toFixed(1)}% spawn=${player.x},${player.y} enemies=${spawns.length}`,
  );
  return {
    mapKey: spec.mapKey,
    slug: spec.slug,
    width,
    height,
    spawn: player,
    enemySpawns: spawns,
  };
}

async function main() {
  const extraOnly = process.argv.includes('--extra-only');
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const srcDir = extraOnly
    ? path.resolve(positional[0] || path.join(ROOT, '.tmp-wonsr-2mapas'))
    : positional[0]
      ? path.resolve(positional[0])
      : DEFAULT_SRC_DIR;
  const list = extraOnly ? EXTRA_MAPS : MAPS;
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
  const results = [];
  for (const spec of list) {
    results.push(await installOne(srcDir, spec));
  }
  const outJson = path.join(
    ROOT,
    '.tmp',
    extraOnly ? 'wonsr-extra-3840-spawns.json' : 'wonsr-naruto-topdown-spawns.json',
  );
  fs.writeFileSync(outJson, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`spawns → ${outJson}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
