/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Minera os jutsus do servidor "WONSR" (spells.xml) e gera um
 * catálogo de REFERÊNCIA em src/data/wonsr-jutsu-reference.ts.
 *
 * Não é o catálogo final do jogo: dano é estimado. Serve para curar
 * manualmente para dentro de src/data/skills.ts.
 */
const fs = require('fs');
const path = require('path');

const SPELLS_XML =
  'C:/Users/marlo/Downloads/wonsr completo/wonsr completo/serv/data/spells/spells.xml';
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'wonsr-jutsu-reference.ts');

/** name → element por palavra-chave (natureza do chakra). */
const ELEMENT_RULES = [
  ['fire', /katon|fire|fireball|flame|amateras|goukakyu|housenka|karyu|bijuu\s*dama|bijudama|endon|hibashiri/i],
  ['water', /suiton|water|mizu|kirigakure|suirou|daibakufu|hyouton|hyoton|ice|mizudama|araumi/i],
  ['wind', /futon|fuuton|wind|rasen\s*shuriken|rasenshuriken|kamaitachi|renkudan|sasandan/i],
  ['earth', /doton|earth|doryuheki|iwa|golem|shinju|mokuton|wood|suna|sabaku|yoton|youton/i],
  ['lightning', /raiton|lightning|chidori|raikiri|kirin|thunder|raigeki|lariat/i],
  ['yin', /genjutsu|tsukuyomi|kotoamatsukami|shadow|kagemane|nara|sharingan|mangekyou/i],
  ['yang', /rasengan|taijutsu|hachimon|gate|punch|puch|kick|chakra\s*puch|juuken|renge|hirudora/i],
];

function inferElement(name, scriptPath) {
  const hay = `${name} ${scriptPath}`;
  for (const [element, re] of ELEMENT_RULES) {
    if (re.test(hay)) return element;
  }
  return 'neutral';
}

function attr(tag, key) {
  const m = tag.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`, 'i'));
  return m ? m[1] : undefined;
}

function slug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Estimativa grosseira de dano a partir do nível exigido. */
function estimateDamage(level) {
  const lvl = Number.isFinite(level) ? level : 1;
  return Math.max(10, Math.round(20 + lvl * 1.5));
}

if (!fs.existsSync(SPELLS_XML)) {
  console.error('spells.xml não encontrado:', SPELLS_XML);
  process.exit(1);
}

const xml = fs.readFileSync(SPELLS_XML, 'utf8');
const instantRe = /<instant\b[^>]*>/gi;
const tags = xml.match(instantRe) || [];

const seen = new Set();
const entries = [];

for (const tag of tags) {
  const name = attr(tag, 'name');
  // WONSR usa tanto value="char/file.lua" quanto script="char/file.lua"
  const value = attr(tag, 'value') || attr(tag, 'script') || '';
  const event = attr(tag, 'event');
  if (!name) continue;

  // Só jutsus com script por personagem (value tipo "naruto/rasengan.lua")
  // ou spells de combate com alvo/alcance.
  const hasCharPath = value.includes('/');
  const aggressive = attr(tag, 'aggressive') === '1';
  const needtarget = attr(tag, 'needtarget') === '1';
  const range = attr(tag, 'range');
  const isCombat = aggressive || needtarget || range != null;
  if (!hasCharPath && !isCombat) continue;

  // Filtra utilitários óbvios de GM / house
  if (/^god |gm |house |admin /i.test(name)) continue;

  const character = hasCharPath ? value.split('/')[0].toLowerCase() : 'todos';
  const level = Number.parseInt(attr(tag, 'lvl') || '0', 10);
  const mana = Number.parseInt(attr(tag, 'mana') || '0', 10);
  const exhaustion = Number.parseInt(attr(tag, 'exhaustion') || '0', 10);

  let id = `wonsr-${slug(name)}`;
  if (seen.has(id)) {
    id = `${id}-${slug(character)}`;
  }
  if (seen.has(id)) continue;
  seen.add(id);

  entries.push({
    id,
    name: name.trim(),
    character,
    element: inferElement(name, value),
    level,
    mana,
    cooldownMs: exhaustion > 0 ? exhaustion : 2000,
    damage: estimateDamage(level),
    range: range ? Number.parseInt(range, 10) : undefined,
    needtarget,
    aggressive,
    words: attr(tag, 'words') || '',
    script: value,
  });
}

entries.sort((a, b) => a.character.localeCompare(b.character) || a.name.localeCompare(b.name));

const header = `// GERADO por scripts/parse-wonsr-jutsus.js — catálogo de REFERÊNCIA.
// Fonte: servidor "WONSR" (spells.xml). Dano é ESTIMADO (a partir do
// nível); ajuste manualmente ao migrar para src/data/skills.ts.
import type { SkillElement } from '@/types/skill';

export interface WonsrJutsuReference {
  id: string;
  name: string;
  /** Personagem/pasta de origem no servidor WONSR. */
  character: string;
  element: SkillElement;
  /** Nível exigido no servidor original. */
  level: number;
  /** Custo de mana original. */
  mana: number;
  /** Cooldown estimado (ms) — do exhaustion original. */
  cooldownMs: number;
  /** Dano ESTIMADO — precisa de tuning manual. */
  damage: number;
  range?: number;
  needtarget: boolean;
  aggressive: boolean;
  /** Palavras de invocação originais. */
  words: string;
  /** Caminho do .lua original (referência). */
  script: string;
}

export const WONSR_JUTSU_REFERENCE: readonly WonsrJutsuReference[] = ${JSON.stringify(
  entries,
  null,
  2,
)};
`;

fs.writeFileSync(OUT_FILE, header, 'utf8');

const byChar = {};
const byElement = {};
for (const e of entries) {
  byChar[e.character] = (byChar[e.character] || 0) + 1;
  byElement[e.element] = (byElement[e.element] || 0) + 1;
}

console.log(`Jutsus extraídos: ${entries.length}`);
console.log('Por elemento:', JSON.stringify(byElement));
console.log(
  'Top personagens:',
  Object.entries(byChar)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, v]) => `${k}:${v}`)
    .join(', '),
);
console.log('Arquivo:', path.relative(path.join(__dirname, '..'), OUT_FILE));
