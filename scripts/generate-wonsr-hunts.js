/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Gera as caças idle e um atlas compacto com todos os personagens WONSR.
 *
 * Fontes:
 *   public/data/wonsr/{monsters,vocations,outfits,creature-sprites}.json
 *   assets-src/wonsr-sprites-png/{spriteId}.png
 *
 * Saídas:
 *   public/data/wonsr/hunts.json
 *   public/sprites/wonsr-hunts/characters.png
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
 * Personagens curados (sprites laterais) sem vocation WONSR.
 * lookTypes sintéticos — preview/animação via packs client.
 */
function buildCuratedExtraCharacters() {
  return [
    {
      id: 'wonsr-character-naruto-sennin',
      sourceId: 'wonsr-character-naruto-sennin',
      name: 'Naruto Sennin',
      category: 'personagem',
      source: 'curated/naruto-sennin',
      // Identidade client-only (character-packs NARUTO_SENNIN_LOOK_TYPE).
      lookType: 9001,
      // false: sem tile no atlas DAT; UI usa /sprites/player/previews/naruto-sennin.png
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-uchiha-itachi',
      sourceId: 'wonsr-character-uchiha-itachi',
      name: 'Uchiha Itachi',
      category: 'personagem',
      source: 'curated/uchiha-itachi',
      // Identidade client-only (character-packs UCHIHA_ITACHI_LOOK_TYPE).
      lookType: 9002,
      // false: sem tile no atlas DAT; UI usa /sprites/player/previews/itachi.png
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-neji-hyuga',
      sourceId: 'wonsr-character-neji-hyuga',
      name: 'Neji Hyuga',
      category: 'personagem',
      source: 'curated/neji',
      // Identidade client-only (character-packs NEJI_CURATED_LOOK_TYPE).
      lookType: 9003,
      // false: sem tile no atlas DAT; UI usa /sprites/player/previews/neji.png
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-chouji-akimichi',
      sourceId: 'wonsr-character-chouji-akimichi',
      name: 'Chouji Akimichi',
      category: 'personagem',
      source: 'curated/chouji',
      // Identidade client-only (character-packs CHOUJI_CURATED_LOOK_TYPE).
      lookType: 9004,
      // false: sem tile no atlas DAT; UI usa /sprites/player/previews/chouji.png
      hasSprite: false,
      sourceMonster: null,
    },
    {
      id: 'wonsr-character-hinata-hyuga',
      sourceId: 'wonsr-character-hinata-hyuga',
      name: 'Hinata Hyuga',
      category: 'personagem',
      source: 'curated/hinata',
      // Identidade client-only (character-packs HINATA_CURATED_LOOK_TYPE).
      lookType: 9005,
      // false: sem tile no atlas DAT; UI usa /sprites/player/previews/hinata.png
      hasSprite: false,
      sourceMonster: null,
    },
  ];
}

function buildBaseCharacters(vocations, outfits, creatureIndex) {
  const preferredFirst = [
    'Uzumaki Naruto',
    'Naruto Sennin',
    'Sakura Haruno',
    'Rock Lee',
    'Hinata Hyuga',
    'Shikamaru Nara',
    'Gaara',
    'Uchiha Sasuke',
    'Mitsashi Tenten',
    'Uchiha Itachi',
    'Neji Hyuga',
    'Chouji Akimichi',
    'Killer Bee',
  ];
  const order = new Map(preferredFirst.map((name, index) => [name, index]));
  const seenNames = new Set();

  const fromVocations = vocations
    .filter((vocation) => vocation.id > 0)
    .sort((a, b) => {
      const aOrder = order.get(cleanName(a.name)) ?? 1000 + a.id;
      const bOrder = order.get(cleanName(b.name)) ?? 1000 + b.id;
      return aOrder - bOrder;
    })
    .flatMap((vocation) => {
      const name = cleanName(vocation.name);
      if (seenNames.has(name)) return [];
      seenNames.add(name);

      const outfit = outfits
        .filter((entry) => entry.vocationId === vocation.id)
        .sort((a, b) => a.level - b.level)[0];
      if (!outfit) return [];

      return [
        {
          id: `wonsr-character-${slug(name)}-${vocation.id}`,
          sourceId: `wonsr-vocation-${vocation.id}`,
          name,
          category: 'personagem',
          source: 'vocations.xml/outfits.xml',
          lookType: outfit.lookType,
          hasSprite: Boolean(creatureIndex[outfit.lookType]),
          sourceMonster: null,
        },
      ];
    });

  // Curated wins on name collision (ex.: Uchiha Itachi vocation → pack lateral 9002).
  const curatedList = buildCuratedExtraCharacters();
  const curatedNames = new Set(curatedList.map((entry) => entry.name));
  const fromVocationsKept = fromVocations.filter((entry) => !curatedNames.has(entry.name));
  for (const entry of curatedList) seenNames.add(entry.name);

  return [...fromVocationsKept, ...curatedList].sort((a, b) => {
    const aOrder = order.get(cleanName(a.name)) ?? 1000;
    const bOrder = order.get(cleanName(b.name)) ?? 1000;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return cleanName(a.name).localeCompare(cleanName(b.name));
  });
}

function buildMonsterCharacters(monsters, creatureIndex) {
  return monsters
    .filter((monster) => monster.hostile)
    .sort((a, b) => sourcePower(a) - sourcePower(b) || cleanName(a.name).localeCompare(cleanName(b.name)))
    .map((monster) => ({
      id: monster.id,
      sourceId: monster.id,
      name: cleanName(monster.name) || `Personagem ${monster.lookType}`,
      category: monster.category,
      source: monster.source,
      lookType: monster.lookType,
      hasSprite: monster.lookType > 0 && Boolean(creatureIndex[monster.lookType]),
      sourceMonster: monster,
    }));
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
  const monsters = readJson(path.join(DATA_DIR, 'monsters.json'));
  const vocations = readJson(path.join(DATA_DIR, 'vocations.json'));
  const outfits = readJson(path.join(DATA_DIR, 'outfits.json'));
  const creatureIndex = readJson(path.join(DATA_DIR, 'creature-sprites.json'));

  const baseCharacters = buildBaseCharacters(vocations, outfits, creatureIndex);
  const monsterCharacters = buildMonsterCharacters(monsters, creatureIndex);
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
    source: 'WONSR / OTX 8.60',
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
  console.log('Caças WONSR geradas:', output.counts);
  console.log('Atlas:', atlas);
  console.log('Saída:', path.relative(ROOT, HUNTS_FILE));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
