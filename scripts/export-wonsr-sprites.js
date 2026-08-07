/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Exporta spritesheets do WONSR para o projeto.
 *
 * Gera, a partir do Tibia.dat + Tibia.spr:
 *   outfits  → walk de cada lookType (colunas = fases, linhas = direções)
 *   effects  → animações de efeito (jutsus/impactos), colunas = fases
 *   missiles → projéteis, grid patternX × patternY
 *
 * Observação sobre "ataque": o DAT do Tibia não guarda animação de ataque para
 * outfits — só as 4 direções de caminhada. As animações de golpe do WONSR vivem
 * nas categorias effects/missiles, exportadas aqui junto.
 *
 * Uso:
 *   node scripts/export-wonsr-sprites.js
 *   node scripts/export-wonsr-sprites.js --only=outfits --limit=20
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { parseDat, getSpriteId } = require('./parse-wonsr-dat');
const { SprReader, blitSprite, SPRITE_SIZE } = require('./lib/spr-reader');

const ROOT = path.resolve(__dirname, '..');
const WONSR_ROOT =
  process.env.WONSR_ROOT ||
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo';
const DAT_PATH =
  process.env.WONSR_DAT ||
  path.join(WONSR_ROOT, 'OtClient 1.7', 'data', 'things', '860', 'Tibia.dat');
const SPR_PATH =
  process.env.WONSR_SPR ||
  path.join(WONSR_ROOT, 'OtClient 1.7', 'data', 'things', '860', 'Tibia.spr');

const OUT_ROOT = path.join(ROOT, 'public', 'sprites', 'wonsr');
const MANIFEST_PATH = path.join(
  ROOT,
  'public',
  'data',
  'wonsr',
  'sprite-index.json',
);

/** Direções do OTClient na ordem do patternX. */
const DIRECTIONS = ['north', 'east', 'south', 'west'];

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true];
  }),
);

const LIMIT = args.limit ? Number.parseInt(args.limit, 10) : null;
const ONLY = args.only ? String(args.only).split(',') : null;

function wants(group) {
  return !ONLY || ONLY.includes(group);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Alfa a partir do qual um pixel conta como desenho (descarta franjas). */
const ALPHA_THRESHOLD = 8;

/**
 * União das caixas de pixels visíveis de todos os frames, em coordenadas
 * locais ao frame. O jogo escala por essa altura em vez da altura da moldura:
 * no DAT do Tibia um mesmo personagem pode vir num frame de 32 ou de 64 px,
 * o que faria dois monstros do mesmo tamanho renderizarem com o dobro de
 * diferença se normalizássemos pela moldura.
 */
function measureContent(canvas, canvasWidth, frameWidth, frameHeight, columns, rows) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const originX = column * frameWidth;
      const originY = row * frameHeight;
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const alpha = canvas[((originY + y) * canvasWidth + originX + x) * 4 + 3];
          if (alpha <= ALPHA_THRESHOLD) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX < 0) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Monta uma folha de sprites a partir de uma lista de células.
 * Cada célula recebe (col, row) e devolve os sprites que compõem aquele frame.
 */
async function writeSheet({ spr, thing, columns, rows, cellFor, outFile }) {
  const frameWidth = thing.width * SPRITE_SIZE;
  const frameHeight = thing.height * SPRITE_SIZE;
  const canvasWidth = columns * frameWidth;
  const canvasHeight = rows * frameHeight;
  const canvas = Buffer.alloc(canvasWidth * canvasHeight * 4, 0);
  let painted = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cell = cellFor(column, row);
      for (let h = 0; h < thing.height; h++) {
        for (let w = 0; w < thing.width; w++) {
          const spriteId = getSpriteId(
            thing,
            w,
            h,
            cell.layer ?? 0,
            cell.patternX ?? 0,
            cell.patternY ?? 0,
            cell.patternZ ?? 0,
            cell.phase ?? 0,
          );
          const pixels = spr.get(spriteId);
          if (!pixels) continue;
          // Sprites multi-tile crescem para esquerda/cima a partir da âncora.
          blitSprite(
            canvas,
            canvasWidth,
            pixels,
            column * frameWidth + (thing.width - 1 - w) * SPRITE_SIZE,
            row * frameHeight + (thing.height - 1 - h) * SPRITE_SIZE,
          );
          painted++;
        }
      }
    }
  }

  if (!painted) return null;

  await sharp(canvas, {
    raw: { width: canvasWidth, height: canvasHeight, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  return {
    frameWidth,
    frameHeight,
    columns,
    rows,
    canvasWidth,
    canvasHeight,
    content: measureContent(
      canvas,
      canvasWidth,
      frameWidth,
      frameHeight,
      columns,
      rows,
    ),
  };
}

async function exportOutfits(dat, spr) {
  const dir = path.join(OUT_ROOT, 'outfits');
  ensureDir(dir);

  const entries = {};
  let done = 0;
  let skipped = 0;

  for (const [lookType, thing] of dat.things.creatures) {
    if (LIMIT && done >= LIMIT) break;

    const phases = Math.max(1, thing.animationPhases);
    const directions = Math.max(1, thing.patternX);
    const outFile = path.join(dir, `${lookType}.png`);

    // Layer 0 é a base; layer 1 é a máscara de cor do template do Tibia.
    const sheet = await writeSheet({
      spr,
      thing,
      columns: phases,
      rows: directions,
      cellFor: (column, row) => ({ phase: column, patternX: row, layer: 0 }),
      outFile,
    });

    if (!sheet) {
      skipped++;
      continue;
    }

    entries[lookType] = {
      url: `/sprites/wonsr/outfits/${lookType}.png`,
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
      phases,
      directions: DIRECTIONS.slice(0, directions),
      tiles: { width: thing.width, height: thing.height },
      content: sheet.content,
      hasColorTemplate: thing.layers > 1,
    };

    done++;
    if (done % 200 === 0) {
      console.log(`  outfits: ${done}`);
      spr.clearCache();
    }
  }

  console.log(`outfits: ${done} exportados (${skipped} vazios)`);
  return entries;
}

async function exportAnimationGroup(collection, groupName, spr) {
  const dir = path.join(OUT_ROOT, groupName);
  ensureDir(dir);

  const entries = {};
  let done = 0;
  let skipped = 0;

  for (const [id, thing] of collection) {
    if (LIMIT && done >= LIMIT) break;

    const phases = Math.max(1, thing.animationPhases);
    const variants = Math.max(1, thing.patternX) * Math.max(1, thing.patternY);
    const patternX = Math.max(1, thing.patternX);
    const outFile = path.join(dir, `${id}.png`);

    const sheet = await writeSheet({
      spr,
      thing,
      columns: phases,
      rows: variants,
      cellFor: (column, row) => ({
        phase: column,
        patternX: row % patternX,
        patternY: Math.floor(row / patternX),
      }),
      outFile,
    });

    if (!sheet) {
      skipped++;
      continue;
    }

    entries[id] = {
      url: `/sprites/wonsr/${groupName}/${id}.png`,
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
      phases,
      variants,
      tiles: { width: thing.width, height: thing.height },
      content: sheet.content,
    };

    done++;
    if (done % 200 === 0) {
      console.log(`  ${groupName}: ${done}`);
      spr.clearCache();
    }
  }

  console.log(`${groupName}: ${done} exportados (${skipped} vazios)`);
  return entries;
}

async function main() {
  console.log('Lendo DAT:', DAT_PATH);
  const dat = parseDat(fs.readFileSync(DAT_PATH));
  console.log('Lendo SPR:', SPR_PATH);
  const spr = new SprReader(SPR_PATH);
  console.log(`SPR: ${spr.count} sprites disponíveis`);

  ensureDir(OUT_ROOT);
  const manifest = {
    source: { dat: DAT_PATH, spr: SPR_PATH },
    generatedAt: new Date().toISOString(),
    directions: DIRECTIONS,
    groups: {},
  };

  if (wants('outfits')) {
    manifest.groups.outfits = await exportOutfits(dat, spr);
    spr.clearCache();
  }
  if (wants('effects')) {
    manifest.groups.effects = await exportAnimationGroup(
      dat.things.effects,
      'effects',
      spr,
    );
    spr.clearCache();
  }
  if (wants('missiles')) {
    manifest.groups.missiles = await exportAnimationGroup(
      dat.things.missiles,
      'missiles',
      spr,
    );
    spr.clearCache();
  }

  manifest.counts = Object.fromEntries(
    Object.entries(manifest.groups).map(([group, entries]) => [
      group,
      Object.keys(entries).length,
    ]),
  );

  ensureDir(path.dirname(MANIFEST_PATH));
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`);
  console.log('Manifesto:', MANIFEST_PATH, manifest.counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
