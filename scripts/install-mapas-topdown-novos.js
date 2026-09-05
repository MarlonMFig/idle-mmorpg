/**
 * Instala mapas top-down do pacote MAPAS NOVOS (RAR/pasta) em resolução nativa.
 * Copia PNG byte-a-byte; gera TMX/colisão/spawns por arte (sem resize).
 *
 * Usage:
 *   node scripts/install-mapas-topdown-novos.js [pasta-ou-rar]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public', 'maps');
const META_DIR = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
const DEFAULT_RAR = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'SPRITES JOGO',
  'MAPAS',
  'MAPAS NOVOS',
  'MAPAS NOVOS.rar',
);
const TMP_EXTRACT = path.join(ROOT, '.tmp', 'mapas-topdown-novos');
const TILE = 16;
const ENEMY_SPAWNS = 16;
const SPAWN_MIN_DIST = 280;
const WALK_VOTE = 0.55;
const SPAWN_INSET = 220;
const MIN_CONNECTED_RATIO = 0.04;
const CACHE_TAG = 'tdnov2026';

/**
 * 13 PNGs do MAPAS NOVOS → 13 mapas huntTd distintos (nunca sobrescrever arte).
 * Cópias WONSR opcionais só como alias do mesmo PNG, em slugs próprios.
 */
const GROUPS = [
  {
    src: ['VALE DO FIM.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-vale-do-fim', mapKey: 'huntTdValeDoFim' },
      { slug: 'wonsr-vale-das-estatuas', mapKey: 'huntWonsrValeDasEstatuas' },
    ],
  },
  {
    src: ['ARENA EXAME CHUNNIN.png'],
    walkMode: 'forest',
    targets: [{ slug: 'hunt-td-arena-exame-chunin', mapKey: 'huntTdArenaExameChunin' }],
  },
  {
    src: ['PONTE DO PAIS DA ONDA.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-ponte-das-ondas', mapKey: 'huntTdPonteDasOndas' },
      { slug: 'wonsr-ponte-da-nevoa', mapKey: 'huntWonsrPonteDaNevoa' },
    ],
  },
  {
    src: ['CAMPO DE TREINAMENTO.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-clareira-equipe-7', mapKey: 'huntTdClareiraEquipe7' },
      { slug: 'wonsr-campo-treinamento', mapKey: 'huntWonsrCampoTreinamento' },
    ],
  },
  {
    src: ['ESCONDERIJO AKATSUKI (2).png', 'ESCONDERIJO AKATSUKI.png'],
    walkMode: 'open',
    targets: [
      { slug: 'hunt-td-caverna-akatsuki', mapKey: 'huntTdCavernaAkatsuki' },
      { slug: 'wonsr-caverna-akatsuki', mapKey: 'huntWonsrCavernaAkatsuki' },
    ],
  },
  {
    src: ['KONOHA DESTRUIDA POR PAIN (2).png', 'KONOHA DESTRUIDA POR PAIN.png'],
    walkMode: 'forest',
    targets: [{ slug: 'hunt-td-cratera-konoha', mapKey: 'huntTdCrateraKonoha' }],
  },
  {
    src: ['LABORATORIO OROCHIMARU.png'],
    walkMode: 'open',
    targets: [
      { slug: 'hunt-td-laboratorio-orochimaru', mapKey: 'huntTdLaboratorioOrochimaru' },
      { slug: 'wonsr-laboratorio-orochimaru', mapKey: 'huntWonsrLaboratorioOrochimaru' },
      { slug: 'wonsr-esconderijo-orochimaru', mapKey: 'huntWonsrEsconderijoOrochimaru' },
    ],
  },
  {
    src: ['04_Esconderijo_Sasori_3840x2160.png'],
    walkMode: 'loose',
    targets: [
      { slug: 'hunt-td-arena-vila-areia', mapKey: 'huntTdArenaVilaAreia' },
      { slug: 'wonsr-deserto-areia', mapKey: 'huntWonsrDesertoAreia' },
    ],
  },
  {
    src: ['02_Ilha_Tartaruga_Cachoeira_Verdade_3840x2160.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-ilha-tartaruga', mapKey: 'huntTdIlhaTartaruga' },
      { slug: 'wonsr-floresta-da-morte', mapKey: 'huntWonsrFlorestaDaMorte' },
    ],
  },
  {
    src: ['01_Monte_Myoboku_3840x2160.png'],
    walkMode: 'forest',
    targets: [{ slug: 'hunt-td-monte-myoboku', mapKey: 'huntTdMonteMyoboku' }],
  },
  {
    src: ['03_Uzushiogakure_Proporcional_3840x2160.png'],
    walkMode: 'forest',
    targets: [{ slug: 'hunt-td-uzushiogakure', mapKey: 'huntTdUzushiogakure' }],
  },
  {
    src: ['02_Campo_Uchiha_Proporcional_3840x2160.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-campo-uchiha', mapKey: 'huntTdCampoUchiha' },
      { slug: 'wonsr-clareira-equipe-7', mapKey: 'huntWonsrClareiraEquipe7' },
    ],
  },
  {
    src: ['01_Hospital_Konoha_Proporcional_3840x2160.png'],
    walkMode: 'forest',
    targets: [
      { slug: 'hunt-td-hospital-konoha', mapKey: 'huntTdHospitalKonoha' },
      { slug: 'wonsr-pais-do-ferro', mapKey: 'huntWonsrPaisDoFerro' },
    ],
  },
];

function listFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else if (/\.png$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}

function extractRar(rarPath) {
  const seven = 'C:\\Program Files\\7-Zip\\7z.exe';
  if (!fs.existsSync(seven)) throw new Error('7-Zip necessário para extrair .rar');
  if (fs.existsSync(TMP_EXTRACT)) fs.rmSync(TMP_EXTRACT, { recursive: true, force: true });
  fs.mkdirSync(TMP_EXTRACT, { recursive: true });
  execFileSync(seven, ['x', rarPath, `-o${TMP_EXTRACT}`, '-y'], { stdio: 'inherit' });
}

function findSrc(files, names) {
  for (const name of names) {
    const hit = files.find((f) => path.basename(f).toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  const stems = names.map((n) => n.toLowerCase().replace(/\.png$/i, ''));
  for (const file of files) {
    const base = path.basename(file).toLowerCase();
    if (stems.some((stem) => base === stem || base.includes(stem))) return file;
  }
  return null;
}

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

async function analyzeSource(srcPath, walkMode) {
  const meta = await sharp(srcPath).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error(`sem dimensões: ${srcPath}`);
  const cols = Math.floor(width / TILE);
  const rows = Math.floor(height / TILE);
  if (cols < 1 || rows < 1) throw new Error(`${srcPath}: pequeno demais`);
  const analysisW = cols * TILE;
  const analysisH = rows * TILE;
  const { data, info } = await sharp(srcPath)
    .extract({ left: 0, top: 0, width: analysisW, height: analysisH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let walk = null;
  let mode = walkMode;
  if (walkMode === 'open') {
    walk = openWalkGrid(cols, rows);
  } else {
    const tryForest = walkMode !== 'loose';
    if (tryForest) walk = buildWalk(data, info, cols, rows, pixelWalkableForest);
    if (!walk) walk = buildWalk(data, info, cols, rows, pixelWalkableLoose);
    if (!walk) {
      walk = buildWalk(
        data,
        info,
        cols,
        rows,
        pixelWalkableAdaptive(lumaThreshold(data, info.channels)),
      );
      mode = 'adaptive';
    }
    if (!walk) {
      walk = openWalkGrid(cols, rows);
      mode = 'open';
    }
  }
  const kept = keepCenterRegion(walk, cols, rows);
  if (!kept) throw new Error(`${srcPath}: colisão vazia`);
  const player = {
    x: (kept.seed % cols) * TILE + TILE / 2,
    y: Math.floor(kept.seed / cols) * TILE + TILE / 2,
  };
  const inner = innerTiles(walk, cols, rows, 3);
  const spawns = pickSpawns(inner, ENEMY_SPAWNS, SPAWN_MIN_DIST, player, width, height);
  return { width, height, cols, rows, walk, mode, spawn: player, enemySpawns: spawns };
}

async function installGroup(files, group) {
  const src = findSrc(files, group.src);
  if (!src) {
    console.warn('skip (missing)', group.src.join(' | '));
    return [];
  }
  const analysis = await analyzeSource(src, group.walkMode || 'forest');
  const installed = [];
  for (const target of group.targets) {
    const destPng = path.join(MAPS_DIR, `${target.slug}.png`);
    fs.copyFileSync(src, destPng);
    writeTmx(target.slug, analysis.walk, analysis.cols, analysis.rows, analysis.width, analysis.height);
    const row = {
      mapKey: target.mapKey,
      slug: target.slug,
      label: target.slug,
      source: path.basename(src),
      image: `/maps/${target.slug}.png`,
      tmx: `/maps/${target.slug}.tmx`,
      cacheTag: CACHE_TAG,
      width: analysis.width,
      height: analysis.height,
      spawn: analysis.spawn,
      enemySpawns: analysis.enemySpawns,
      walkMode: analysis.mode,
    };
    fs.writeFileSync(path.join(META_DIR, `${target.slug}.json`), JSON.stringify(row, null, 2) + '\n');
    installed.push(row);
    console.log(
      'ok',
      target.slug,
      `${analysis.width}×${analysis.height}`,
      `← ${path.basename(src)}`,
      `walk=${analysis.mode}`,
      `(${Math.round(fs.statSync(destPng).size / 1024 / 1024)}MB)`,
    );
  }
  return installed;
}

async function main() {
  let srcRoot = process.argv[2] || DEFAULT_RAR;
  if (srcRoot.toLowerCase().endsWith('.rar')) {
    extractRar(srcRoot);
    srcRoot = TMP_EXTRACT;
  }
  if (!fs.existsSync(srcRoot)) throw new Error(`Fonte não encontrada: ${srcRoot}`);

  fs.mkdirSync(MAPS_DIR, { recursive: true });
  fs.mkdirSync(META_DIR, { recursive: true });

  const files = listFiles(srcRoot);
  const installed = [];
  const seenSlug = new Set();
  for (const group of GROUPS) {
    const rows = await installGroup(files, group);
    for (const row of rows) {
      if (seenSlug.has(row.slug)) {
        console.warn('overwrite meta', row.slug, '←', row.source);
      }
      seenSlug.add(row.slug);
      const idx = installed.findIndex((r) => r.slug === row.slug);
      if (idx >= 0) installed[idx] = row;
      else installed.push(row);
    }
  }

  fs.writeFileSync(
    path.join(META_DIR, 'topdown-novos-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), cacheTag: CACHE_TAG, maps: installed }, null, 2) +
      '\n',
  );
  console.log('\nInstalled', installed.length, 'top-down slugs. cacheTag =', CACHE_TAG);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
