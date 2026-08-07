/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Parser do Tibia.dat WONSR (cliente 8.60 + otfi extended).
 *
 * Spec: OtClient 1.7 thingtypemanager.cpp / thingtype.cpp
 * Features (OLD/Tibia.otfi):
 *   extended: true          → sprite IDs U32
 *   transparency: false
 *   frame-durations: false  → sem Animator
 *   frame-groups: false     → 1 grupo por thing
 *
 * Uso:
 *   node scripts/parse-wonsr-dat.js
 *   node scripts/parse-wonsr-dat.js --look=266,519 --assemble
 *   node scripts/parse-wonsr-dat.js --outfit=266,519 --validate
 */
const fs = require('fs');
const path = require('path');

const DAT_PATH =
  process.env.WONSR_DAT ||
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo/OtClient 1.7/data/things/860/Tibia.dat';
const SPRITES_DIR =
  process.env.WONSR_SPR_OUT ||
  path.join(__dirname, '..', 'assets-src', 'wonsr-sprites-png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data', 'wonsr');
const VALIDATE_DIR = path.join(__dirname, '..', 'assets-src', 'wonsr-dat-validate');

const ThingCategory = {
  Item: 0,
  Creature: 1,
  Effect: 2,
  Missile: 3,
};

const ThingLastAttr = 255;

/** Atributos que carregam payload além do flag byte. */
const ATTR_PAYLOAD = {
  0: 'u16', // Ground
  8: 'u16', // Writable
  9: 'u16', // WritableOnce
  21: 'light', // Light: intensity+color
  24: 'displacement', // Displacement: x+y (versão >=755)
  25: 'u16', // Elevation
  28: 'u16', // MinimapColor
  29: 'u16', // LensHelp
  32: 'u16', // Cloth
  33: 'market', // Market (raro em 8.60, mas suportado pelo OTClient)
  34: 'u16', // Usable
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const LOOK_IDS = String(args.look || args.outfit || '266,519')
  .split(',')
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const ASSEMBLE = Boolean(args.assemble || args.validate);

class DatReader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }

  remaining() {
    return this.buf.length - this.pos;
  }

  u8() {
    if (this.pos >= this.buf.length) throw new Error(`EOF u8 @${this.pos}`);
    return this.buf[this.pos++];
  }

  u16() {
    if (this.pos + 2 > this.buf.length) throw new Error(`EOF u16 @${this.pos}`);
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  u32() {
    if (this.pos + 4 > this.buf.length) throw new Error(`EOF u32 @${this.pos}`);
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  skip(n) {
    this.pos += n;
  }

  /** String OT: u16 length + bytes */
  string() {
    const len = this.u16();
    if (this.pos + len > this.buf.length) throw new Error(`EOF string(${len}) @${this.pos}`);
    const s = this.buf.toString('utf8', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
}

function skipAttrPayload(reader, attr) {
  const kind = ATTR_PAYLOAD[attr];
  if (!kind) return;
  switch (kind) {
    case 'u16':
      reader.u16();
      break;
    case 'light':
      reader.u16();
      reader.u16();
      break;
    case 'displacement':
      reader.u16();
      reader.u16();
      break;
    case 'market':
      reader.u16(); // category
      reader.u16(); // tradeAs
      reader.u16(); // showAs
      reader.string(); // name
      reader.u16(); // vocation
      reader.u16(); // level
      break;
    default:
      break;
  }
}

/**
 * Lê flags até ThingLastAttr (255).
 * Armadilhas:
 * - NÃO remapear attrs em 8.60 (só >=1000 / <860 mudam numeração).
 * - Attr desconhecido sem payload: só o byte flag (default OTClient).
 * - Market/Usable existem no enum OTClient mesmo em DAT 8.60 custom.
 */
function readAttributes(reader) {
  const attrs = [];
  for (let i = 0; i < ThingLastAttr; i++) {
    const attr = reader.u8();
    if (attr === ThingLastAttr) return attrs;
    skipAttrPayload(reader, attr);
    attrs.push(attr);
  }
  throw new Error(`corrupt attrs (no terminator) @${reader.pos}`);
}

function readThing(reader, id, category, spritesU32) {
  const attrs = readAttributes(reader);

  // frame-groups=false → sempre 1 grupo; IdleAnimations só em Creature se feature ligada
  const groupCount = 1;
  let width = 1;
  let height = 1;
  let realSize = 32;
  let layers = 1;
  let patternX = 1;
  let patternY = 1;
  let patternZ = 1;
  let animationPhases = 1;
  const spritesIndex = [];

  for (let g = 0; g < groupCount; g++) {
    width = reader.u8();
    height = reader.u8();
    if (width > 1 || height > 1) {
      realSize = reader.u8();
    } else {
      realSize = 32;
    }
    layers = reader.u8();
    patternX = reader.u8();
    patternY = reader.u8();
    patternZ = reader.u8(); // clientVersion >= 755
    animationPhases = reader.u8();

    // frame-durations=false → sem bloco Animator

    const totalSprites =
      width * height * layers * patternX * patternY * patternZ * animationPhases;
    if (totalSprites > 4096) {
      throw new Error(`thing ${category}:${id} has ${totalSprites} sprites (>4096)`);
    }
    for (let i = 0; i < totalSprites; i++) {
      spritesIndex.push(spritesU32 ? reader.u32() : reader.u16());
    }
  }

  return {
    id,
    category,
    attrs,
    width,
    height,
    realSize,
    layers,
    patternX,
    patternY,
    patternZ,
    animationPhases,
    spritesIndex,
  };
}

/**
 * Índice linear OTClient ThingType::getSpriteIndex(w,h,l,x,y,z,a)
 */
function getSpriteIndex(thing, w, h, l, x, y, z, a) {
  return (
    ((((((a % thing.animationPhases) * thing.patternZ + z) * thing.patternY + y) *
      thing.patternX +
      x) *
      thing.layers +
      l) *
      thing.height +
      h) *
      thing.width +
      w
  );
}

function getSpriteId(thing, w, h, l, x, y, z, a) {
  const idx = getSpriteIndex(thing, w, h, l, x, y, z, a);
  return thing.spritesIndex[idx] || 0;
}

function parseDat(buf) {
  const reader = new DatReader(buf);
  const signature = reader.u32();

  const countsStored = [
    reader.u16(), // items
    reader.u16(), // creatures / outfits
    reader.u16(), // effects
    reader.u16(), // missiles
  ];
  // OTClient: size = stored + 1
  const sizes = countsStored.map((c) => c + 1);

  const things = {
    items: new Map(),
    creatures: new Map(),
    effects: new Map(),
    missiles: new Map(),
  };
  const categoryOrder = [
    ['items', ThingCategory.Item, 100],
    ['creatures', ThingCategory.Creature, 1],
    ['effects', ThingCategory.Effect, 1],
    ['missiles', ThingCategory.Missile, 1],
  ];

  const spritesU32 = true; // otfi extended:true

  for (let ci = 0; ci < categoryOrder.length; ci++) {
    const [key, category, firstId] = categoryOrder[ci];
    const size = sizes[ci];
    for (let id = firstId; id < size; id++) {
      try {
        const thing = readThing(reader, id, category, spritesU32);
        things[key].set(id, thing);
      } catch (err) {
        throw new Error(
          `Falha em ${key} id=${id} @byte ${reader.pos}: ${err.message}`,
        );
      }
    }
  }

  return {
    signature,
    countsStored,
    sizes,
    bytesRead: reader.pos,
    bytesTotal: buf.length,
    things,
  };
}

function summarizeThing(thing) {
  const nonZero = thing.spritesIndex.filter((id) => id > 0);
  return {
    id: thing.id,
    category: thing.category,
    width: thing.width,
    height: thing.height,
    realSize: thing.realSize,
    layers: thing.layers,
    patternX: thing.patternX,
    patternY: thing.patternY,
    patternZ: thing.patternZ,
    animationPhases: thing.animationPhases,
    spriteCount: thing.spritesIndex.length,
    uniqueSprites: new Set(nonZero).size,
    sampleSpriteIds: nonZero.slice(0, 12),
  };
}

/** Direções OTClient: North=0, East=1, South=2, West=3 */
const DIR_NAMES = ['north', 'east', 'south', 'west'];

function outfitFrameMap(thing) {
  const frames = [];
  for (let a = 0; a < thing.animationPhases; a++) {
    for (let x = 0; x < thing.patternX; x++) {
      const tiles = [];
      for (let h = 0; h < thing.height; h++) {
        for (let w = 0; w < thing.width; w++) {
          // layer 0 = base; layer 1 = template/addon mask quando layers>1
          tiles.push({
            w,
            h,
            spriteId: getSpriteId(thing, w, h, 0, x, 0, 0, a),
          });
        }
      }
      frames.push({
        direction: DIR_NAMES[x] || `x${x}`,
        patternX: x,
        phase: a,
        tiles,
      });
    }
  }
  return frames;
}

async function assembleLookType(thing, outFile) {
  const sharp = require('sharp');
  const tile = 32;
  const cols = thing.patternX;
  const rows = thing.animationPhases;
  const frameW = thing.width * tile;
  const frameH = thing.height * tile;
  const canvasW = cols * frameW;
  const canvasH = rows * frameH;

  const composites = [];
  for (let a = 0; a < rows; a++) {
    for (let x = 0; x < cols; x++) {
      for (let h = 0; h < thing.height; h++) {
        for (let w = 0; w < thing.width; w++) {
          const spriteId = getSpriteId(thing, w, h, 0, x, 0, 0, a);
          if (!spriteId) continue;
          const pngPath = path.join(SPRITES_DIR, `${spriteId}.png`);
          if (!fs.existsSync(pngPath)) continue;
          // OTClient desenha tiles de baixo-para-cima / direita-para-esquerda em alguns paths;
          // para sheet de validação usamos w,h diretos no grid do frame.
          composites.push({
            input: pngPath,
            left: x * frameW + w * tile,
            top: a * frameH + (thing.height - 1 - h) * tile,
          });
        }
      }
    }
  }

  await sharp({
    create: {
      width: Math.max(1, canvasW),
      height: Math.max(1, canvasH),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outFile);

  return { canvasW, canvasH, composites: composites.length, outFile };
}

async function main() {
  console.log('Lendo', DAT_PATH);
  const buf = fs.readFileSync(DAT_PATH);
  const parsed = parseDat(buf);

  console.log({
    signature: `0x${parsed.signature.toString(16)}`,
    countsStored: parsed.countsStored,
    sizes: parsed.sizes,
    bytesRead: parsed.bytesRead,
    bytesTotal: parsed.bytesTotal,
    leftover: parsed.bytesTotal - parsed.bytesRead,
    items: parsed.things.items.size,
    creatures: parsed.things.creatures.size,
    effects: parsed.things.effects.size,
    missiles: parsed.things.missiles.size,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(VALIDATE_DIR, { recursive: true });

  const validation = {
    source: DAT_PATH,
    otfi: {
      extended: true,
      transparency: false,
      frameDurations: false,
      frameGroups: false,
    },
    signature: parsed.signature,
    countsStored: parsed.countsStored,
    looks: {},
  };

  for (const lookId of LOOK_IDS) {
    const thing = parsed.things.creatures.get(lookId);
    if (!thing) {
      validation.looks[lookId] = { error: 'not found' };
      console.warn(`lookType ${lookId}: NÃO encontrado`);
      continue;
    }
    const summary = summarizeThing(thing);
    const frames = outfitFrameMap(thing);
    validation.looks[lookId] = { ...summary, frames };

    const pngExists = summary.sampleSpriteIds.map((id) => ({
      id,
      exists: fs.existsSync(path.join(SPRITES_DIR, `${id}.png`)),
    }));
    validation.looks[lookId].pngProbe = pngExists;

    console.log(`lookType ${lookId}:`, summary);
    console.log(
      `  png probe:`,
      pngExists.map((p) => `${p.id}:${p.exists ? 'ok' : 'missing'}`).join(' '),
    );

    if (ASSEMBLE) {
      const outFile = path.join(VALIDATE_DIR, `look-${lookId}.png`);
      const assembled = await assembleLookType(thing, outFile);
      validation.looks[lookId].assembled = assembled;
      console.log(`  sheet:`, assembled);
    }
  }

  const outJson = path.join(VALIDATE_DIR, 'look-validation.json');
  fs.writeFileSync(outJson, `${JSON.stringify(validation, null, 2)}\n`);
  console.log('Validação escrita em', outJson);

  // Índice compacto só de creatures (lookTypes) → metadados + sprites (útil ao idle)
  const creatureIndex = {};
  for (const [id, thing] of parsed.things.creatures) {
    creatureIndex[id] = {
      w: thing.width,
      h: thing.height,
      layers: thing.layers,
      px: thing.patternX,
      py: thing.patternY,
      pz: thing.patternZ,
      phases: thing.animationPhases,
      sprites: thing.spritesIndex,
    };
  }
  const indexPath = path.join(OUT_DIR, 'creature-sprites.json');
  fs.writeFileSync(indexPath, `${JSON.stringify(creatureIndex)}\n`);
  console.log(
    `Índice creatures: ${Object.keys(creatureIndex).length} → ${indexPath}`,
  );
}

module.exports = {
  parseDat,
  getSpriteId,
  getSpriteIndex,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
