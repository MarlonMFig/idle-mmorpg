/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Converte conteúdo estático do WONSR para JSON consumível pelo browser.
 * O runtime OTX/Lua não é copiado: somente dados determinísticos.
 */
const fs = require('fs');
const path = require('path');

const ROOT =
  process.env.WONSR_ROOT ||
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo/serv/data';
const OUT = path.join(__dirname, '..', 'public', 'data', 'wonsr');

function text(file) {
  return fs.readFileSync(file, 'utf8');
}

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) {
    result[match[1].toLowerCase()] = decodeXml(match[2]);
  }
  return result;
}

function decodeXml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function filesRecursive(directory, extension) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesRecursive(full, extension));
    else if (entry.name.toLowerCase().endsWith(extension)) result.push(full);
  }
  return result;
}

function parseItems() {
  const xml = text(path.join(ROOT, 'items', 'items.xml'));
  const entries = [];
  const itemRe = /<item\b([^>]*?)(?:\/>|>([\s\S]*?)<\/item>)/gi;
  for (const match of xml.matchAll(itemRe)) {
    const head = attrs(match[1]);
    const body = match[2] || '';
    const from = number(head.fromid || head.id, -1);
    const to = number(head.toid || head.id, from);
    if (from < 0 || to < from || to - from > 500) continue;

    const attributes = {};
    for (const attribute of body.matchAll(/<attribute\b([^>]*)\/?>/gi)) {
      const data = attrs(attribute[1]);
      if (data.key) attributes[data.key.toLowerCase()] = data.value || '';
    }

    for (let clientId = from; clientId <= to; clientId++) {
      entries.push({
        id: `wonsr-item-${clientId}`,
        clientId,
        name: head.name || `Item ${clientId}`,
        article: head.article || '',
        description: attributes.description || '',
        weight: number(attributes.weight),
        attack: number(attributes.attack),
        defense: number(attributes.defense),
        armor: number(attributes.armor),
        slotType: attributes.slottype || '',
        weaponType: attributes.weapontype || '',
        stackable: boolean(attributes.stackable),
        charges: number(attributes.charges),
        decayTo: number(attributes.decayto, -1),
        attributes,
      });
    }
  }
  return entries;
}

function parseMonsters() {
  const directory = path.join(ROOT, 'monster');
  const entries = [];
  for (const file of filesRecursive(directory, '.xml')) {
    if (path.basename(file).toLowerCase() === 'monsters.xml') continue;
    const xml = text(file);
    const root = xml.match(/<monster\b([^>]*)>/i);
    if (!root) continue;
    const data = attrs(root[1]);
    const health = attrs(xml.match(/<health\b([^>]*)\/?>/i)?.[1] || '');
    const look = attrs(xml.match(/<look\b([^>]*)\/?>/i)?.[1] || '');
    const flags = {};
    for (const flag of xml.matchAll(/<flag\b([^>]*)\/?>/gi)) {
      Object.assign(flags, attrs(flag[1]));
    }
    const attacks = [];
    for (const attack of xml.matchAll(/<attack\b([^>]*)\/?>/gi)) {
      const attackData = attrs(attack[1]);
      attacks.push({
        name: attackData.name || 'melee',
        intervalMs: number(attackData.interval, 1000),
        min: Math.abs(number(attackData.min)),
        max: Math.abs(number(attackData.max)),
        range: number(attackData.range, 1),
        element: attackData.element || '',
      });
    }
    const loot = [];
    const lootBlock = xml.match(/<loot>([\s\S]*?)<\/loot>/i)?.[1] || '';
    for (const item of lootBlock.matchAll(/<item\b([^>]*)\/?>/gi)) {
      const itemData = attrs(item[1]);
      const clientId = number(itemData.id, -1);
      if (clientId < 0) continue;
      loot.push({
        itemId: `wonsr-item-${clientId}`,
        clientId,
        chance: Math.min(1, number(itemData.chance || itemData.chancemax) / 100000),
        countMax: Math.max(1, number(itemData.countmax, 1)),
      });
    }
    const relative = path.relative(directory, file).replaceAll('\\', '/');
    const name = data.name || path.basename(file, '.xml');
    entries.push({
      id: `wonsr-monster-${slug(relative.replace(/\.xml$/i, ''))}`,
      name,
      category: relative.includes('/') ? relative.split('/')[0] : 'geral',
      source: relative,
      level: Math.max(1, Math.round(number(data.experience) / 100)),
      experience: number(data.experience),
      health: number(health.max || health.now, 1),
      speed: number(data.speed, 200),
      lookType: number(look.type),
      corpseId: number(look.corpse),
      hostile: boolean(flags.hostile),
      targetDistance: number(flags.targetdistance, 1),
      attacks,
      loot,
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function parseNpcs() {
  const directory = path.join(ROOT, 'npc');
  const entries = [];
  for (const file of filesRecursive(directory, '.xml')) {
    const xml = text(file);
    const root = xml.match(/<npc\b([^>]*)>/i);
    if (!root) continue;
    const data = attrs(root[1]);
    const look = attrs(xml.match(/<look\b([^>]*)\/?>/i)?.[1] || '');
    const parameters = {};
    for (const parameter of xml.matchAll(/<parameter\b([^>]*)\/?>/gi)) {
      const parsed = attrs(parameter[1]);
      if (parsed.key) parameters[parsed.key] = parsed.value || '';
    }
    const relative = path.relative(directory, file).replaceAll('\\', '/');
    entries.push({
      id: `wonsr-npc-${slug(relative.replace(/\.xml$/i, ''))}`,
      name: data.name || path.basename(file, '.xml'),
      source: relative,
      script: data.script || '',
      lookType: number(look.type),
      dialogue: Object.entries(parameters)
        .filter(([key]) => key.startsWith('message_'))
        .map(([, value]) => value),
      parameters,
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function parseVocations() {
  const xml = text(path.join(ROOT, 'XML', 'vocations.xml'));
  const entries = [];
  for (const match of xml.matchAll(/<vocation\b([^>]*)>([\s\S]*?)<\/vocation>/gi)) {
    const data = attrs(match[1]);
    const formula = attrs(match[2].match(/<formula\b([^>]*)\/?>/i)?.[1] || '');
    entries.push({
      id: number(data.id),
      name: data.name || 'Unknown',
      description: data.description || '',
      gainHp: number(data.gainhp),
      gainMana: number(data.gainmana),
      baseSpeed: number(data.basespeed),
      attackSpeedMs: number(data.attackspeed),
      premium: boolean(data.needpremium),
      formula,
    });
  }
  return entries;
}

function parseOutfits() {
  const xml = text(path.join(ROOT, 'XML', 'outfits.xml'));
  const entries = [];
  for (const match of xml.matchAll(/<outfit\b([^>]*)>([\s\S]*?)<\/outfit>/gi)) {
    const data = attrs(match[1]);
    const list = attrs(match[2].match(/<list\b([^>]*)\/?>/i)?.[1] || '');
    if (!list.looktype) continue;
    entries.push({
      id: number(data.id),
      vocationId: number(data.voc),
      level: number(data.lvl),
      gender: list.gender || '',
      lookType: number(list.looktype),
      name: list.name || `Outfit ${data.id}`,
    });
  }
  return entries;
}

function parseSpells() {
  const xml = text(path.join(ROOT, 'spells', 'spells.xml'));
  const entries = [];
  for (const match of xml.matchAll(/<instant\b([^>]*)>/gi)) {
    const data = attrs(match[1]);
    const script = data.script || data.value || '';
    if (!data.name) continue;
    entries.push({
      id: `wonsr-skill-${slug(data.name)}`,
      name: data.name,
      words: data.words || '',
      character: script.includes('/') ? script.split('/')[0].toLowerCase() : 'all',
      script,
      level: number(data.lvl),
      mana: number(data.mana),
      cooldownMs: number(data.cooldownvalue || data.exhaustion, 1000),
      range: number(data.range),
      target: boolean(data.needtarget),
      aggressive: boolean(data.aggressive),
      description: data.desc || '',
    });
  }
  return entries;
}

function parseQuests() {
  const xml = text(path.join(ROOT, 'XML', 'quests.xml'));
  const entries = [];
  for (const match of xml.matchAll(/<quest\b([^>]*)>([\s\S]*?)<\/quest>/gi)) {
    const data = attrs(match[1]);
    const missions = [];
    for (const mission of match[2].matchAll(/<mission\b([^>]*)\/?>/gi)) {
      const missionData = attrs(mission[1]);
      missions.push({
        name: missionData.name || '',
        storageId: number(missionData.storageid),
        startValue: number(missionData.startvalue),
        endValue: number(missionData.endvalue),
        description: missionData.description || '',
      });
    }
    entries.push({
      id: `wonsr-quest-${slug(data.name || String(entries.length + 1))}`,
      name: data.name || 'Quest',
      startStorageId: number(data.startstorageid),
      startStorageValue: number(data.startstoragevalue),
      missions,
    });
  }
  return entries;
}

/** Curva/estágios de XP do OTX (stages.xml) — rate por faixa de nível. */
function parseStages() {
  const xml = text(path.join(ROOT, 'XML', 'stages.xml'));
  const config = /<config\b([^>]*)\/?>/i.exec(xml);
  const enabled = config ? boolean(attrs(config[1]).enabled || '1') : true;
  const stages = [];
  for (const match of xml.matchAll(/<stage\b([^>]*)\/?>/gi)) {
    const data = attrs(match[1]);
    stages.push({
      minLevel: number(data.minlevel, 1),
      maxLevel: number(data.maxlevel, 9999),
      multiplier: number(data.multiplier, 1),
    });
  }
  stages.sort((a, b) => a.minLevel - b.minLevel);
  return { enabled, stages };
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(value)}\n`);
}

function main() {
  if (!fs.existsSync(ROOT)) throw new Error(`WONSR data não encontrado: ${ROOT}`);
  fs.mkdirSync(OUT, { recursive: true });

  const catalogs = {
    skills: parseSpells(),
    monsters: parseMonsters(),
    items: parseItems(),
    npcs: parseNpcs(),
    vocations: parseVocations(),
    outfits: parseOutfits(),
    quests: parseQuests(),
  };
  for (const [name, value] of Object.entries(catalogs)) writeJson(name, value);

  const stages = parseStages();
  writeJson('stages', stages);

  const manifest = {
    source: 'WONSR / OTX 8.60',
    generatedAt: new Date().toISOString(),
    counts: Object.fromEntries(
      Object.entries(catalogs).map(([name, entries]) => [name, entries.length]),
    ),
    stages: {
      enabled: stages.enabled,
      bands: stages.stages.length,
    },
    files: [...Object.keys(catalogs).map((name) => `${name}.json`), 'stages.json'],
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(manifest);
}

main();
