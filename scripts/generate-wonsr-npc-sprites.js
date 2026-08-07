/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Monta o sprite idle (virado pra baixo/sul) de lookTypes WONSR a partir de:
 *   - public/data/wonsr/creature-sprites.json  (lookType → índices de sprite)
 *   - assets-src/wonsr-sprites-png/{id}.png     (pixels já extraídos do .spr)
 *
 * Saída: public/sprites/npc-wonsr/{lookType}.png (upscaled 2x, nearest).
 * Também aceita montar a tira das 4 direções (--strip).
 *
 * Uso:
 *   node scripts/generate-wonsr-npc-sprites.js --looks=587,891,365,734,590
 *   node scripts/generate-wonsr-npc-sprites.js --looks=587 --strip
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INDEX_PATH = path.join(__dirname, '..', 'public', 'data', 'wonsr', 'creature-sprites.json');
const SPRITES_DIR = path.join(__dirname, '..', 'assets-src', 'wonsr-sprites-png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'npc-wonsr');
const TILE = 32;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const LOOKS = String(args.looks || '587,891,365,734,590')
  .split(',')
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const STRIP = Boolean(args.strip);
const SCALE = Number.parseInt(args.scale || '2', 10);

// Direções no DAT: north=0, east=1, south=2, west=3
const SOUTH = 2;

/** Índice linear OTClient getSpriteIndex(w,h,l,x,y,z,a). */
function spriteIndex(meta, w, h, l, x, y, z, a) {
  const phases = meta.phases || 1;
  const px = meta.px || 1;
  const py = meta.py || 1;
  const pz = meta.pz || 1;
  const layers = meta.layers || 1;
  const W = meta.w || 1;
  const H = meta.h || 1;
  return (
    ((((((a % phases) * pz + z) * py + y) * px + x) * layers + l) * H + h) * W + w
  );
}

function spriteIdFor(meta, direction, phase = 0) {
  const idx = spriteIndex(meta, 0, 0, 0, direction, 0, 0, phase);
  return meta.sprites[idx] || 0;
}

function pngPath(id) {
  return path.join(SPRITES_DIR, `${id}.png`);
}

async function tileBuffer(id) {
  const file = pngPath(id);
  if (id > 0 && fs.existsSync(file)) return file;
  // sprite vazio → tile transparente
  return sharp({
    create: { width: TILE, height: TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
}

async function buildSouth(meta, outFile) {
  const id = spriteIdFor(meta, SOUTH, 0);
  const input = await tileBuffer(id);
  await sharp(input)
    .resize(TILE * SCALE, TILE * SCALE, { kernel: 'nearest' })
    .png()
    .toFile(outFile);
  return { id, size: `${TILE * SCALE}x${TILE * SCALE}` };
}

async function buildStrip(meta, outFile) {
  const canvas = sharp({
    create: {
      width: TILE * 4,
      height: TILE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const composites = [];
  for (let dir = 0; dir < 4; dir++) {
    const id = spriteIdFor(meta, dir, 0);
    if (id > 0 && fs.existsSync(pngPath(id))) {
      composites.push({ input: pngPath(id), left: dir * TILE, top: 0 });
    }
  }
  const base = await canvas.composite(composites).png().toBuffer();
  await sharp(base)
    .resize(TILE * 4 * SCALE, TILE * SCALE, { kernel: 'nearest' })
    .png()
    .toFile(outFile);
  return { frames: 4, size: `${TILE * 4 * SCALE}x${TILE * SCALE}` };
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Índice ausente: ${INDEX_PATH} (rode: npm run wonsr:dat)`);
  }
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const look of LOOKS) {
    const meta = index[look];
    if (!meta) {
      console.warn(`lookType ${look}: não encontrado no índice`);
      continue;
    }
    const outFile = path.join(OUT_DIR, `${look}.png`);
    const result = STRIP ? await buildStrip(meta, outFile) : await buildSouth(meta, outFile);
    console.log(`lookType ${look}:`, result, '→', path.relative(process.cwd(), outFile));
  }
  console.log('OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
