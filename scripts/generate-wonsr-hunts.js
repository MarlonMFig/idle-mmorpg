/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Gera as caças idle só com packs laterais curados (personagens que você adicionou).
 * Vocations e monros WONSR brutos NÃO entram no catálogo.
 *
 * Saídas:
 *   public/data/wonsr/hunts.json
 *   public/sprites/wonsr-hunts/characters.png  (vazio/placeholder)
 *   public/sprites/wonsr-hunts/characters.json
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data', 'wonsr');
const SOURCE_SPRITES = path.join(ROOT, 'assets-src', 'wonsr-sprites-png');
const ATLAS_DIR = path.join(ROOT, 'public', 'sprites', 'wonsr-hunts');
const HUNTS_FILE = path.join(DATA_DIR, 'hunts.json');
const ATLAS_IMAGE = path.join(ATLAS_DIR, 'characters.png');
const ATLAS_JSON = path.join(ATLAS_DIR, 'characters.json');

const TARGETS_PER_HUNT = 1;
const CHARACTERS_PER_LEVEL_TIER = 5;
const CELL_SIZE = 64;
const ATLAS_COLUMNS = 32;
const SOUTH = 2;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return cleanName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function spriteIndex(meta, w, h, l, x, y, z, a) {
  const phases = meta.phases || 1;
  const patternX = meta.px || 1;
  const patternY = meta.py || 1;
  const patternZ = meta.pz || 1;
  const layers = meta.layers || 1;
  const width = meta.w || 1;
  const height = meta.h || 1;
  return ((((((a % phases) * patternZ + z) * patternY + y) * patternX + x) * layers + l) *
    height +
    h) *
    width +
    w;
}

function sourcePower(monster) {
  const strongestAttack = Math.max(
    1,
    ...monster.attacks.map((attack) => Math.abs(attack.max || attack.min || 0)),
  );
  return (
    Math.log10(Math.max(1, monster.health)) * 40 +
    Math.log10(strongestAttack) * 25 +
    Math.log10(Math.max(1, monster.experience)) * 15 +
    Math.min(500, Math.max(1, monster.level))
  );
}

function normalizedStats(level, source) {
  const sourceSpeed = source?.speed || 300;
  return {
    level,
    hp: Math.round(45 + level * 16 + Math.pow(level, 1.18) * 2),
    xp: Math.round(10 + level * 3.5),
    speed: Math.max(42, Math.min(92, Math.round(sourceSpeed / 6))),
    targetDistance: Math.max(1, Math.min(4, source?.targetDistance || 1)),
  };
}

/**
 * Personagens curados (sprites laterais) — única fonte de caças/selamento.
 * Sem vocations/monstros brutos do WONSR.
 */
function buildCuratedExtraCharacters() {
  return [
    {
      id: 'wonsr-character-uzumaki-naruto',
      sourceId: 'wonsr-character-uzumaki-naruto',
      name: 'Uzumaki Naruto',
      category: 'personagem',
      source: 'curated/naruto',
      lookType: 9011,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-uchiha-sasuke',
      sourceId: 'wonsr-character-uchiha-sasuke',
      name: 'Uchiha Sasuke',
      category: 'personagem',
      source: 'curated/sasuke',
      lookType: 9012,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-rock-lee',
      sourceId: 'wonsr-character-rock-lee',
      name: 'Rock Lee',
      category: 'personagem',
      source: 'curated/rock-lee',
      lookType: 9013,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-naruto-sennin',
      sourceId: 'wonsr-character-naruto-sennin',
      name: 'Naruto Sennin',
      category: 'personagem',
      source: 'curated/naruto-sennin',
      lookType: 9001,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-uchiha-itachi',
      sourceId: 'wonsr-character-uchiha-itachi',
      name: 'Uchiha Itachi',
      category: 'personagem',
      source: 'curated/uchiha-itachi',
      lookType: 9002,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-shikamaru-nara',
      sourceId: 'wonsr-character-shikamaru-nara',
      name: 'Shikamaru Nara',
      category: 'personagem',
      source: 'curated/shikamaru',
      lookType: 1426,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-sakura-haruno',
      sourceId: 'wonsr-character-sakura-haruno',
      name: 'Sakura Haruno',
      category: 'personagem',
      source: 'curated/sakura',
      lookType: 1423,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-gaara',
      sourceId: 'wonsr-character-gaara',
      name: 'Gaara',
      category: 'personagem',
      source: 'curated/gaara',
      lookType: 1395,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-neji-hyuga',
      sourceId: 'wonsr-character-neji-hyuga',
      name: 'Neji Hyuga',
      category: 'personagem',
      source: 'curated/neji',
      lookType: 9003,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-chouji-akimichi',
      sourceId: 'wonsr-character-chouji-akimichi',
      name: 'Chouji Akimichi',
      category: 'personagem',
      source: 'curated/chouji',
      lookType: 9004,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-hinata-hyuga',
      sourceId: 'wonsr-character-hinata-hyuga',
      name: 'Hinata Hyuga',
      category: 'personagem',
      source: 'curated/hinata',
      lookType: 9005,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-might-guy',
      sourceId: 'wonsr-character-might-guy',
      name: 'Might Guy',
      category: 'personagem',
      source: 'curated/guy',
      lookType: 9006,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-ino-yamanaka',
      sourceId: 'wonsr-character-ino-yamanaka',
      name: 'Ino Yamanaka',
      category: 'personagem',
      source: 'curated/ino',
      lookType: 9007,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-hatake-kakashi',
      sourceId: 'wonsr-character-hatake-kakashi',
      name: 'Hatake Kakashi',
      category: 'personagem',
      source: 'curated/kakashi',
      lookType: 9008,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-jiraiya',
      sourceId: 'wonsr-character-jiraiya',
      name: 'Jiraya',
      category: 'personagem',
      source: 'curated/jiraiya',
      lookType: 9009,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-jirobo',
      sourceId: 'wonsr-character-jirobo',
      name: 'Jiroubou',
      category: 'personagem',
      source: 'curated/jirobo',
      lookType: 9010,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-yakushi-kabuto',
      sourceId: 'wonsr-character-yakushi-kabuto',
      name: 'Yakushi Kabuto',
      category: 'personagem',
      source: 'curated/kabuto',
      lookType: 9014,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-tsunade',
      sourceId: 'wonsr-character-tsunade',
      name: 'Tsunade',
      category: 'personagem',
      source: 'curated/tsunade',
      lookType: 9015,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-kiba-inuzuka',
      sourceId: 'wonsr-character-kiba-inuzuka',
      name: 'Kiba Inuzuka',
      category: 'personagem',
      source: 'curated/kiba',
      lookType: 9016,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-kimimaro',
      sourceId: 'wonsr-character-kimimaro',
      name: 'Kimimaro',
      category: 'personagem',
      source: 'curated/kimimaro',
      lookType: 9017,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-sasuke-cursed',
      sourceId: 'wonsr-character-sasuke-cursed',
      name: 'Sasuke Cursed',
      category: 'personagem',
      source: 'curated/sasuke-cursed',
      lookType: 9018,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-orochimaru',
      sourceId: 'wonsr-character-orochimaru',
      name: 'Orochimaru',
      category: 'personagem',
      source: 'curated/orochimaru',
      lookType: 9019,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-naruto-kyubi',
      sourceId: 'wonsr-character-naruto-kyubi',
      name: 'Naruto Kyubi',
      category: 'personagem',
      source: 'curated/naruto-kyubi',
      lookType: 9020,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-kisame',
      sourceId: 'wonsr-character-kisame',
      name: 'Kisame Hoshigaki',
      category: 'personagem',
      source: 'curated/kisame',
      lookType: 9021,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-deidara',
      sourceId: 'wonsr-character-deidara',
      name: 'Deidara',
      category: 'personagem',
      source: 'curated/deidara',
      lookType: 9022,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-sakura-shippuden',
      sourceId: 'wonsr-character-sakura-shippuden',
      name: 'Sakura Shippuden',
      category: 'personagem',
      source: 'curated/sakura-shippuden',
      lookType: 9023,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-tenten',
      sourceId: 'wonsr-character-tenten',
      name: 'Tenten',
      category: 'personagem',
      source: 'curated/tenten',
      lookType: 9024,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-temari',
      sourceId: 'wonsr-character-temari',
      name: 'Temari',
      category: 'personagem',
      source: 'curated/temari',
      lookType: 9025,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-tayuya',
      sourceId: 'wonsr-character-tayuya',
      name: 'Tayuya',
      category: 'personagem',
      source: 'curated/tayuya',
      lookType: 9026,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-shino',
      sourceId: 'wonsr-character-shino',
      name: 'Shino Aburame',
      category: 'personagem',
      source: 'curated/shino',
      lookType: 9027,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-momo-hinamori',
      sourceId: 'wonsr-character-momo-hinamori',
      name: 'Momo Hinamori',
      category: 'personagem',
      source: 'curated/momo-hinamori',
      lookType: 9028,
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-hitsugaya',
      sourceId: 'wonsr-character-hitsugaya',
      name: 'Toshiro Hitsugaya',
      category: 'personagem',
      source: 'curated/hitsugaya',
      lookType: 9029,
      hasSprite: false,
      sourceMonster: null,
    },
  ];
}

/**
 * Lista final de caças = só packs laterais aditionados ao cliente.
 * Vocations.xml / monsters.xml WONSR não entram no catálogo.
 */
function buildBaseCharacters() {
  const preferredFirst = [
    'Uzumaki Naruto',
    'Naruto Sennin',
    'Sakura Haruno',
    'Rock Lee',
    'Hinata Hyuga',
    'Shikamaru Nara',
    'Gaara',
    'Uchiha Sasuke',
    'Uchiha Itachi',
    'Neji Hyuga',
    'Chouji Akimichi',
    'Ino Yamanaka',
    'Might Guy',
    'Hatake Kakashi',
    'Jiraya',
    'Jiroubou',
    'Yakushi Kabuto',
    'Tsunade',
    'Kiba Inuzuka',
    'Kimimaro',
    'Sasuke Cursed',
    'Orochimaru',
    'Naruto Kyubi',
    'Kisame Hoshigaki',
    'Deidara',
    'Sakura Shippuden',
    'Tenten',
    'Temari',
    'Tayuya',
    'Shino Aburame',
    'Momo Hinamori',
    'Toshiro Hitsugaya',
  ];
  const order = new Map(preferredFirst.map((name, index) => [name, index]));
  return buildCuratedExtraCharacters().sort((a, b) => {
    const aOrder = order.get(cleanName(a.name)) ?? 1000;
    const bOrder = order.get(cleanName(b.name)) ?? 1000;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return cleanName(a.name).localeCompare(cleanName(b.name));
  });
}

function buildMonsterCharacters() {
  // Monstros WONSR desativados no catálogo de caças.
  return [];
}

function huntLevel(index) {
  const tier = Math.floor(index / CHARACTERS_PER_LEVEL_TIER);
  return tier === 0 ? 1 : tier * 10;
}

function huntName(index, targets) {
  const targetName = targets[0]?.name || `Personagem ${index + 1}`;
  return `Mapa de ${targetName}`;
}

function buildHunts(characters) {
  const hunts = [];
  for (let offset = 0; offset < characters.length; offset += TARGETS_PER_HUNT) {
    const index = hunts.length;
    const level = huntLevel(index);
    const slice = characters.slice(offset, offset + TARGETS_PER_HUNT);
    const targets = slice.map((character) => ({
      id: character.id,
      sourceId: character.sourceId,
      name: character.name,
      category: character.category,
      source: character.source,
      lookType: character.lookType,
      hasSprite: character.hasSprite,
      requiredLevel: level,
      ...normalizedStats(level, character.sourceMonster),
      loot: character.sourceMonster?.loot || [],
    }));

    hunts.push({
      id: `wonsr-hunt-${String(index + 1).padStart(3, '0')}`,
      name: huntName(index, targets),
      requiredLevel: level,
      // For now: todas as caças usam a arena de clareira (huntForestClearing).
      mapKey: 'huntForestClearing',
      description: `Caça automática de ${targets[0]?.name || 'personagem'} para níveis ${level}+.`,
      targets,
    });
  }
  return hunts;
}

async function buildAtlas(lookTypes, creatureIndex) {
  fs.mkdirSync(ATLAS_DIR, { recursive: true });
  // Packs laterais usam hasSprite=false — atlas vazio (UI usa previews curados).
  if (!lookTypes.length) {
    const emptyW = CELL_SIZE;
    const emptyH = CELL_SIZE;
    await sharp({
      create: {
        width: emptyW,
        height: emptyH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toFile(ATLAS_IMAGE);
    fs.writeFileSync(
      ATLAS_JSON,
      JSON.stringify(
        {
          frames: {},
          meta: {
            app: 'idle-mmorpg generate-wonsr-hunts',
            version: '1.0',
            image: 'characters.png',
            format: 'RGBA8888',
            size: { w: emptyW, h: emptyH },
            scale: '1',
            note: 'curated-only: no WONSR outfit atlas tiles',
          },
        },
        null,
        2,
      ),
    );
    return { width: emptyW, height: emptyH, frames: 0, missing: [] };
  }

  const rows = Math.ceil(lookTypes.length / ATLAS_COLUMNS);
  const width = ATLAS_COLUMNS * CELL_SIZE;
  const height = rows * CELL_SIZE;
  const composites = [];
  const frames = {};
  const missing = [];

  for (let index = 0; index < lookTypes.length; index++) {
    const lookType = lookTypes[index];
    const meta = creatureIndex[lookType];
    const tileWidth = (meta?.w || 1) * 32;
    const tileHeight = (meta?.h || 1) * 32;
    const tileComposites = [];

    for (let h = 0; h < (meta?.h || 1); h++) {
      for (let w = 0; w < (meta?.w || 1); w++) {
        const spriteId =
          meta?.sprites[spriteIndex(meta, w, h, 0, SOUTH, 0, 0, 0)] || 0;
        const input = path.join(SOURCE_SPRITES, `${spriteId}.png`);
        if (!spriteId || !fs.existsSync(input)) continue;
        tileComposites.push({
          input,
          left: w * 32,
          top: ((meta?.h || 1) - 1 - h) * 32,
        });
      }
    }

    if (!tileComposites.length) {
      missing.push({ lookType });
      continue;
    }

    const x = (index % ATLAS_COLUMNS) * CELL_SIZE;
    const y = Math.floor(index / ATLAS_COLUMNS) * CELL_SIZE;
    const assembled = await sharp({
      create: {
        width: tileWidth,
        height: tileHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(tileComposites)
      .png()
      .toBuffer();
    const sprite = await sharp(assembled)
      .resize(CELL_SIZE, CELL_SIZE, {
        kernel: 'nearest',
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({ input: sprite, left: x, top: y });
    frames[`look-${lookType}`] = {
      frame: { x, y, w: CELL_SIZE, h: CELL_SIZE },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: CELL_SIZE, h: CELL_SIZE },
      sourceSize: { w: CELL_SIZE, h: CELL_SIZE },
    };
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(ATLAS_IMAGE);

  fs.writeFileSync(
    ATLAS_JSON,
    JSON.stringify(
      {
        frames,
        meta: {
          app: 'idle-mmorpg generate-wonsr-hunts',
          version: '1.0',
          image: 'characters.png',
          format: 'RGBA8888',
          size: { w: width, h: height },
          scale: '1',
        },
      },
      null,
      2,
    ),
  );

  return { width, height, frames: Object.keys(frames).length, missing };
}

async function main() {
  const creatureIndex = readJson(path.join(DATA_DIR, 'creature-sprites.json'));

  const baseCharacters = buildBaseCharacters();
  const monsterCharacters = buildMonsterCharacters();
  const characters = [...baseCharacters, ...monsterCharacters];
  const hunts = buildHunts(characters);
  const lookTypes = [
    ...new Set(
      characters
        .filter((character) => character.hasSprite)
        .map((character) => character.lookType),
    ),
  ];
  const atlas = await buildAtlas(lookTypes, creatureIndex);

  const output = {
    source: 'curated character packs only (no WONSR vocations/monsters)',
    generatedAt: new Date().toISOString(),
    progression: {
      targetsPerHunt: TARGETS_PER_HUNT,
      charactersPerLevelTier: CHARACTERS_PER_LEVEL_TIER,
      firstLevel: 1,
      levelStep: 10,
    },
    counts: {
      hunts: hunts.length,
      targets: characters.length,
      baseCharacters: baseCharacters.length,
      monsterVariants: monsterCharacters.length,
      uniqueLookTypes: lookTypes.length,
    },
    atlas: {
      key: 'wonsr-hunt-characters',
      imageUrl: '/sprites/wonsr-hunts/characters.png',
      atlasUrl: '/sprites/wonsr-hunts/characters.json',
      frameSize: CELL_SIZE,
    },
    hunts,
  };

  fs.writeFileSync(HUNTS_FILE, JSON.stringify(output, null, 2));
  console.log('Caças geradas (só packs curados):', output.counts);
  console.log(
    'Personagens:',
    characters.map((c) => `${c.name} (${c.lookType})`).join(', '),
  );
  console.log('Atlas:', atlas);
  console.log('Saída:', path.relative(ROOT, HUNTS_FILE));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
