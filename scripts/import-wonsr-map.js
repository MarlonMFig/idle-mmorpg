/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Recorta uma região do nowo.otbm, renderiza os tiles originais do SPR/DAT,
 * gera um TMX compatível com o MapLoader e normaliza os spawns do recorte.
 *
 * Padrão: centro de Konoha, andar 7, 96x96 tiles (textura 3072x3072).
 *
 * Uso:
 *   node scripts/import-wonsr-map.js
 *   node scripts/import-wonsr-map.js --name=konoha --x=1968 --y=1944 --z=7 --width=96 --height=96
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { OTBMReader } = require('@v0rt4c/otbm');
const { parseDat, getSpriteId } = require('./parse-wonsr-dat');
const { buildServerToClientMap } = require('./lib/parse-otb');

const ROOT = path.resolve(__dirname, '..');
const WONSR_ROOT =
  process.env.WONSR_ROOT ||
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo';
const OTBM_PATH =
  process.env.WONSR_OTBM ||
  path.join(WONSR_ROOT, 'serv', 'data', 'world', 'nowo.otbm');
const SPAWN_PATH =
  process.env.WONSR_SPAWN ||
  path.join(WONSR_ROOT, 'serv', 'data', 'world', 'nowo-spawn.xml');
const DAT_PATH =
  process.env.WONSR_DAT ||
  path.join(WONSR_ROOT, 'OtClient 1.7', 'data', 'things', '860', 'Tibia.dat');
const OTB_PATH =
  process.env.WONSR_OTB ||
  path.join(WONSR_ROOT, 'serv', 'data', 'items', 'items.otb');
const SPRITES_DIR =
  process.env.WONSR_SPR_OUT ||
  path.join(ROOT, 'assets-src', 'wonsr-sprites-png');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
  }),
);

const config = {
  name: String(args.name || 'wonsr-konoha'),
  x: Number.parseInt(args.x || '1968', 10),
  y: Number.parseInt(args.y || '1944', 10),
  z: Number.parseInt(args.z || '7', 10),
  width: Number.parseInt(args.width || '96', 10),
  height: Number.parseInt(args.height || '96', 10),
  tileSize: 32,
};

const MAX_TEXTURE_SIZE = 4096;

function assertConfig() {
  for (const key of ['x', 'y', 'z', 'width', 'height']) {
    if (!Number.isInteger(config[key])) {
      throw new Error(`Argumento inválido: ${key}=${config[key]}`);
    }
  }
  if (config.width <= 0 || config.height <= 0) {
    throw new Error('width/height devem ser positivos');
  }
  if (
    config.width * config.tileSize > MAX_TEXTURE_SIZE ||
    config.height * config.tileSize > MAX_TEXTURE_SIZE
  ) {
    throw new Error(
      `Recorte excede ${MAX_TEXTURE_SIZE}px. Use no máximo 128x128 tiles.`,
    );
  }
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} não encontrado: ${filePath}`);
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseAttrs(source) {
  const attrs = {};
  for (const match of source.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseSpawns(xml) {
  const entries = [];
  const spawnRegex = /<spawn\b([^>]*)>([\s\S]*?)<\/spawn>/g;
  let spawnMatch;

  while ((spawnMatch = spawnRegex.exec(xml))) {
    const center = parseAttrs(spawnMatch[1]);
    const centerX = Number(center.centerx);
    const centerY = Number(center.centery);
    const centerZ = Number(center.centerz);
    const radius = Number(center.radius || 1);

    for (const entityMatch of spawnMatch[2].matchAll(
      /<(monster|npc)\b([^>]*)\/>/g,
    )) {
      const entity = parseAttrs(entityMatch[2]);
      const offsetX = Number(entity.x || 0);
      const offsetY = Number(entity.y || 0);
      const entityZ = Number(entity.z || centerZ);
      const worldX = centerX + offsetX;
      const worldY = centerY + offsetY;

      entries.push({
        kind: entityMatch[1],
        name: String(entity.name || '').trim(),
        world: { x: worldX, y: worldY, z: entityZ },
        spawnCenter: { x: centerX, y: centerY, z: centerZ },
        offset: { x: offsetX, y: offsetY },
        radius,
        spawnTimeSeconds: Number(entity.spawntime || 60),
        direction: entity.direction == null ? null : Number(entity.direction),
      });
    }
  }

  return entries;
}

function isInside(worldX, worldY, worldZ) {
  return (
    worldZ === config.z &&
    worldX >= config.x &&
    worldX < config.x + config.width &&
    worldY >= config.y &&
    worldY < config.y + config.height
  );
}

/**
 * Itens multi-tile são ancorados no canto inferior-direito e desenham para
 * cima/esquerda, então tiles logo fora do recorte ainda pintam dentro dele.
 */
const RENDER_MARGIN = 4;

function isInRenderArea(worldX, worldY, worldZ) {
  return (
    worldZ === config.z &&
    worldX >= config.x &&
    worldX < config.x + config.width + RENDER_MARGIN &&
    worldY >= config.y &&
    worldY < config.y + config.height + RENDER_MARGIN
  );
}

function extractTiles(root) {
  const mapData = root.children[0];
  const selected = new Map();
  let candidates = 0;
  let duplicates = 0;

  for (const area of mapData.children) {
    if (area.type !== 4 || area.z !== config.z) continue;
    if (
      area.x > config.x + config.width - 1 ||
      area.x + 255 < config.x ||
      area.y > config.y + config.height - 1 ||
      area.y + 255 < config.y
    ) {
      continue;
    }

    for (const tile of area.children) {
      const worldX = tile.realX;
      const worldY = tile.realY;
      if (!isInRenderArea(worldX, worldY, tile.z)) continue;
      candidates++;

      const key = `${worldX},${worldY}`;
      const current = selected.get(key);
      if (current) duplicates++;

      // Alguns mapas antigos repetem TILE_AREA. Mantém a versão mais completa.
      const score =
        (tile.attributes?.tileId ? 1 : 0) +
        (tile.children?.length || 0) * 2;
      if (!current || score > current.score) {
        selected.set(key, { tile, score });
      }
    }
  }

  return {
    tiles: [...selected.values()].map((entry) => entry.tile),
    candidates,
    duplicates,
  };
}

function collectTileItemIds(tile) {
  const ids = [];
  if (tile.attributes?.tileId) ids.push(tile.attributes.tileId);
  for (const child of tile.children || []) {
    if (child.type === 6 && child.id) ids.push(child.id);
  }
  return ids;
}

function spriteCallsForThing(thing, tileX, tileY, worldX, worldY, orderBase) {
  if (!thing) return [];
  const calls = [];
  const width = Math.max(1, thing.width);
  const height = Math.max(1, thing.height);

  // OTClient escolhe o pattern pela posição no mundo (varia chão, bordas e água).
  const patternX = ((worldX % thing.patternX) + thing.patternX) % thing.patternX;
  const patternY = ((worldY % thing.patternY) + thing.patternY) % thing.patternY;

  for (let layer = 0; layer < thing.layers; layer++) {
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const spriteId = getSpriteId(thing, w, h, layer, patternX, patternY, 0, 0);
        if (!spriteId) continue;
        // ThingType::draw desenha o sprite (w,h) em dest - (w*32, h*32).
        calls.push({
          spriteId,
          x: (tileX - w) * config.tileSize,
          y: (tileY - h) * config.tileSize,
          order: orderBase + layer * 100 + h * width + w,
        });
      }
    }
  }

  return calls;
}

function buildDrawCalls(tiles, datItems, serverToClient) {
  const calls = [];
  const usedItemIds = new Set();
  const missingItemIds = new Set();
  const unmappedItemIds = new Set();
  const blockedCells = new Set();

  for (const tile of tiles) {
    const localX = tile.realX - config.x;
    const localY = tile.realY - config.y;
    const ids = collectTileItemIds(tile);

    ids.forEach((serverId, stackIndex) => {
      usedItemIds.add(serverId);
      const itemId = serverToClient.get(serverId);
      if (!itemId) {
        unmappedItemIds.add(serverId);
        return;
      }
      const thing = datItems.get(itemId);
      if (!thing) {
        missingItemIds.add(itemId);
        return;
      }
      if (
        thing.attrs.includes(12) &&
        localX >= 0 &&
        localX < config.width &&
        localY >= 0 &&
        localY < config.height
      ) {
        blockedCells.add(`${localX},${localY}`);
      }
      calls.push(
        ...spriteCallsForThing(
          thing,
          localX,
          localY,
          tile.realX,
          tile.realY,
          localY * 1_000_000 + localX * 1_000 + stackIndex * 200,
        ),
      );
    });
  }

  calls.sort((a, b) => a.order - b.order);
  return { calls, usedItemIds, missingItemIds, unmappedItemIds, blockedCells };
}

async function loadSprite(spriteId) {
  const spritePath = path.join(SPRITES_DIR, `${spriteId}.png`);
  if (!fs.existsSync(spritePath)) return null;
  const { data, info } = await sharp(spritePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function blend(canvas, canvasWidth, canvasHeight, source, targetX, targetY) {
  for (let sy = 0; sy < source.height; sy++) {
    const dy = targetY + sy;
    if (dy < 0 || dy >= canvasHeight) continue;
    for (let sx = 0; sx < source.width; sx++) {
      const dx = targetX + sx;
      if (dx < 0 || dx >= canvasWidth) continue;

      const sourceOffset = (sy * source.width + sx) * 4;
      const sourceAlpha = source.data[sourceOffset + 3];
      if (sourceAlpha === 0) continue;

      const destOffset = (dy * canvasWidth + dx) * 4;
      if (sourceAlpha === 255) {
        canvas[destOffset] = source.data[sourceOffset];
        canvas[destOffset + 1] = source.data[sourceOffset + 1];
        canvas[destOffset + 2] = source.data[sourceOffset + 2];
        canvas[destOffset + 3] = 255;
        continue;
      }

      const sa = sourceAlpha / 255;
      const da = canvas[destOffset + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA === 0) continue;
      for (let channel = 0; channel < 3; channel++) {
        canvas[destOffset + channel] = Math.round(
          (source.data[sourceOffset + channel] * sa +
            canvas[destOffset + channel] * da * (1 - sa)) /
            outA,
        );
      }
      canvas[destOffset + 3] = Math.round(outA * 255);
    }
  }
}

async function renderMap(calls, outputPath) {
  const width = config.width * config.tileSize;
  const height = config.height * config.tileSize;
  const canvas = Buffer.alloc(width * height * 4);
  const uniqueSpriteIds = [...new Set(calls.map((call) => call.spriteId))];
  const sprites = new Map();
  const missingSpriteIds = [];

  console.log(`Carregando ${uniqueSpriteIds.length} sprites do recorte...`);
  for (const spriteId of uniqueSpriteIds) {
    const sprite = await loadSprite(spriteId);
    if (sprite) sprites.set(spriteId, sprite);
    else missingSpriteIds.push(spriteId);
  }

  for (const call of calls) {
    const sprite = sprites.get(call.spriteId);
    if (sprite) blend(canvas, width, height, sprite, call.x, call.y);
  }

  await sharp(canvas, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  return {
    width,
    height,
    uniqueSpriteCount: uniqueSpriteIds.length,
    missingSpriteIds,
  };
}

function buildTmx(imageFileName, blockedCells) {
  const tileCount = config.width * config.height;
  const gids = Array.from({ length: tileCount }, (_, index) => index + 1);
  const groundRows = [];
  const collisionRows = [];
  for (let y = 0; y < config.height; y++) {
    groundRows.push(
      gids
        .slice(y * config.width, (y + 1) * config.width)
        .join(',') + ',',
    );
    collisionRows.push(
      Array.from({ length: config.width }, (_, x) =>
        blockedCells.has(`${x},${y}`) ? y * config.width + x + 1 : 0,
      ).join(',') + ',',
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${config.width}" height="${config.height}" tilewidth="${config.tileSize}" tileheight="${config.tileSize}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="${escapeXml(config.name)}" tilewidth="${config.tileSize}" tileheight="${config.tileSize}" tilecount="${tileCount}" columns="${config.width}">
  <image source="${escapeXml(imageFileName)}" width="${config.width * config.tileSize}" height="${config.height * config.tileSize}"/>
 </tileset>
 <layer id="1" name="ground" width="${config.width}" height="${config.height}">
  <data encoding="csv">
${groundRows.join('\n')}
  </data>
 </layer>
 <layer id="2" name="collision" width="${config.width}" height="${config.height}" visible="0">
  <data encoding="csv">
${collisionRows.join('\n')}
  </data>
 </layer>
</map>
`;
}

async function main() {
  assertConfig();
  ensureFile(OTBM_PATH, 'OTBM');
  ensureFile(SPAWN_PATH, 'Spawn XML');
  ensureFile(DAT_PATH, 'Tibia.dat');
  ensureFile(SPRITES_DIR, 'Diretório de sprites');

  const publicMapsDir = path.join(ROOT, 'public', 'maps');
  const dataMapsDir = path.join(ROOT, 'public', 'data', 'wonsr', 'maps');
  fs.mkdirSync(publicMapsDir, { recursive: true });
  fs.mkdirSync(dataMapsDir, { recursive: true });

  console.log('Lendo OTBM:', OTBM_PATH);
  const root = new OTBMReader(
    new Uint8Array(fs.readFileSync(OTBM_PATH)),
  ).getRootNode();
  const extraction = extractTiles(root);
  console.log(
    `Tiles únicos: ${extraction.tiles.length} (${extraction.duplicates} duplicatas resolvidas)`,
  );

  console.log('Lendo OTB:', OTB_PATH);
  const { map: serverToClient } = buildServerToClientMap(OTB_PATH);
  console.log(`Mapeamento server→client: ${serverToClient.size} itens`);

  console.log('Lendo DAT:', DAT_PATH);
  const dat = parseDat(fs.readFileSync(DAT_PATH));
  const drawing = buildDrawCalls(
    extraction.tiles,
    dat.things.items,
    serverToClient,
  );

  const pngFileName = `${config.name}.png`;
  const pngPath = path.join(publicMapsDir, pngFileName);
  const render = await renderMap(drawing.calls, pngPath);

  const tmxPath = path.join(publicMapsDir, `${config.name}.tmx`);
  fs.writeFileSync(
    tmxPath,
    buildTmx(pngFileName, drawing.blockedCells),
    'utf8',
  );

  const allSpawns = parseSpawns(fs.readFileSync(SPAWN_PATH, 'utf8'));
  const spawns = allSpawns
    .filter((spawn) => isInside(spawn.world.x, spawn.world.y, spawn.world.z))
    .map((spawn, index) => ({
      id: `${config.name}-${spawn.kind}-${index + 1}`,
      ...spawn,
      localTile: {
        x: spawn.world.x - config.x,
        y: spawn.world.y - config.y,
      },
      pixel: {
        x: (spawn.world.x - config.x + 0.5) * config.tileSize,
        y: (spawn.world.y - config.y + 0.5) * config.tileSize,
      },
    }));

  const manifest = {
    id: config.name,
    source: {
      otbm: OTBM_PATH,
      spawnXml: SPAWN_PATH,
      dat: DAT_PATH,
      sprites: SPRITES_DIR,
    },
    bounds: {
      x: config.x,
      y: config.y,
      z: config.z,
      width: config.width,
      height: config.height,
      tileSize: config.tileSize,
    },
    files: {
      tmx: `/maps/${config.name}.tmx`,
      image: `/maps/${pngFileName}`,
    },
    stats: {
      tileCandidates: extraction.candidates,
      uniqueTiles: extraction.tiles.length,
      duplicateTilesResolved: extraction.duplicates,
      drawCalls: drawing.calls.length,
      blockedTiles: drawing.blockedCells.size,
      itemIds: drawing.usedItemIds.size,
      missingItemIds: [...drawing.missingItemIds].sort((a, b) => a - b),
      unmappedItemIds: [...drawing.unmappedItemIds].sort((a, b) => a - b),
      uniqueSprites: render.uniqueSpriteCount,
      missingSpriteIds: render.missingSpriteIds,
      spawnCount: spawns.length,
      monsters: spawns.filter((spawn) => spawn.kind === 'monster').length,
      npcs: spawns.filter((spawn) => spawn.kind === 'npc').length,
    },
    spawns,
  };

  const manifestPath = path.join(dataMapsDir, `${config.name}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('Mapa:', tmxPath);
  console.log('Imagem:', pngPath);
  console.log('Spawns:', manifestPath);
  console.log(manifest.stats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
