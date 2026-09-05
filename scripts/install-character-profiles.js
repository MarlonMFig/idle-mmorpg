/**
 * Instala perfis pixel-art em public/ui/profiles/{characterId}.png
 *
 * Uso:
 *   node scripts/install-character-profiles.js
 *   node scripts/install-character-profiles.js --src "C:/path/to/naruto-world-idle-perfis-pixel-art"
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SRC = path.join(
  ROOT,
  '.tmp-profiles-extract',
  'naruto-world-idle-perfis-pixel-art',
);
const OUT_DIR = path.join(ROOT, 'public', 'ui', 'profiles');
const ASSETS_DIR = path.join(ROOT, 'assets', 'character-profiles');
const REGISTRY_PATH = path.join(ROOT, 'src', 'data', 'character-profiles.ts');

/**
 * slug do arquivo (sem número) → characterId(s) do jogo.
 * O primeiro id é o arquivo principal; os demais são aliases (cópia).
 */
const SLUG_TO_CHARACTER_IDS = {
  'uzumaki-naruto': ['naruto-classic', 'naruto'],
  'naruto-shippuden': ['naruto-shippuden'],
  'naruto-1-cauda': ['naruto-1-tail'],
  'naruto-4-caudas': ['naruto-4-tails'],
  'naruto-kyubi': ['naruto-kyubi'],
  'uchiha-sasuke': ['sasuke-classic', 'sasuke'],
  'sasuke-cursed': ['sasuke-cursed'],
  'uchiha-sasuke-g6': ['sasuke-g6'],
  'uchiha-itachi': ['uchiha-itachi', 'itachi'],
  'uchiha-shisui': ['shisui'],
  'rock-lee': ['rock-lee'],
  'rock-lee-g6': ['rock-lee-g6'],
  'neji-hyuga': ['neji'],
  'shikamaru-nara': ['shikamaru'],
  'chouji-akimichi': ['chouji'],
  'akimichi-choji-jump-force': ['choji-jf'],
  'ino-yamanaka': ['ino'],
  'shino-aburame': ['shino'],
  'aburame-shino-g6': ['shino-g6'],
  tenten: ['tenten'],
  'tenten-kid': ['tenten-kid'],
  'tenten-g6': ['tenten-g6'],
  'hinata-hyuga': ['hinata'],
  'hyuga-hinata-kid': ['hinata-kid'],
  'hyuga-hinata': ['hinata-g6'],
  'hyuga-hanabi': ['hanabi'],
  'kiba-inuzuka': ['kiba'],
  'kiba-inuzuka-kid': ['kiba-kid'],
  'konohamaru-sarutobi': ['konohamaru'],
  gaara: ['gaara'],
  'gaara-shukaku': ['gaara-shukaku'],
  temari: ['temari'],
  'temari-kid': ['temari-kid'],
  'temari-g6': ['temari-g6'],
  kankuro: ['kankuro'],
  'sakura-shippuden': ['sakura-shippuden', 'sakura'],
  'might-guy': ['guy'],
  'hatake-kakashi': ['kakashi'],
  'hatake-kakashi-g6': ['kakashi-g6'],
  'asuma-sarutobi': ['asuma'],
  'yuhi-kurenai': ['kurenai'],
  'hiruzen-sarutobi': ['hiruzen'],
  tsunade: ['tsunade'],
  jiraya: ['jiraiya'],
  shizune: ['shizune'],
  'zabuza-momochi': ['zabuza'],
  haku: ['haku'],
  'haku-jump-force': ['haku-jf'],
  orochimaru: ['orochimaru'],
  'orochimaru-g6': ['orochimaru-g6'],
  'yakushi-kabuto': ['kabuto'],
  kimimaro: ['kimimaro'],
  jiroubou: ['jirobo'],
  'tayuya-nun5': ['tayuya-nun5', 'tayuya'],
  'sakon-e-ukon-nun5': ['sakon-nun5', 'sakon'],
  kidomaru: ['kidomaru'],
  'kisame-hoshigaki': ['kisame'],
  sasori: ['sasori'],
  'sasori-hiruko': ['sasori-puppet'],
  deidara: ['deidara'],
  'pain-deva': ['pain'],
  'danzo-shimura': ['danzo'],
  'namikaze-minato-jonin': ['minato-jonin'],
  yamato: ['yamato'],
  sai: ['sai'],
  'senju-hashirama': ['hashirama'],
  'senju-tobirama': ['tobirama'],
  'anko-mitarashi': ['anko'],
  chiyo: ['chiyo'],
};

function parseArgs(argv) {
  const args = { src: DEFAULT_SRC };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--src' && argv[i + 1]) {
      args.src = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function slugFromFile(fileName) {
  return fileName.replace(/^\d+-/, '').replace(/\.png$/i, '');
}

function writeRegistry(characterIds) {
  const sorted = [...characterIds].sort((a, b) => a.localeCompare(b));
  const body = `/**
 * Perfis pixel-art instalados em \`/ui/profiles/{characterId}.png\`.
 * Gerado por \`scripts/install-character-profiles.js\` — não editar à mão.
 */
export const CHARACTER_PROFILE_IDS = new Set([
${sorted.map((id) => `  '${id}',`).join('\n')}
] as const);

export function hasCharacterProfile(characterId: string | null | undefined): boolean {
  return Boolean(characterId && CHARACTER_PROFILE_IDS.has(characterId));
}

/** URL pública do perfil, ou null se não houver arte. */
export function getCharacterProfileUrl(characterId: string | null | undefined): string | null {
  if (!hasCharacterProfile(characterId)) return null;
  return \`/ui/profiles/\${characterId}.png\`;
}
`;
  fs.writeFileSync(REGISTRY_PATH, body, 'utf8');
}

function main() {
  const { src } = parseArgs(process.argv.slice(2));
  const src128 = path.join(src, 'individuais-128x128');
  const src256 = path.join(src, 'individuais-256x256');
  const preferred = fs.existsSync(src256) ? src256 : src128;

  if (!fs.existsSync(preferred)) {
    console.error('Pasta de perfis não encontrada:', preferred);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // Guarda cópia de referência do pacote (manifest + LEIA-ME + 128).
  for (const name of ['manifest.json', 'LEIA-ME.md']) {
    const from = path.join(src, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(ASSETS_DIR, name));
    }
  }

  const files = fs
    .readdirSync(preferred)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort();

  const installed = [];
  const unknown = [];
  const characterIds = new Set();

  for (const file of files) {
    const slug = slugFromFile(file);
    const ids = SLUG_TO_CHARACTER_IDS[slug];
    if (!ids || ids.length === 0) {
      unknown.push(slug);
      continue;
    }

    const from = path.join(preferred, file);
    const assetCopy = path.join(ASSETS_DIR, `${slug}.png`);
    fs.copyFileSync(from, assetCopy);

    for (const id of ids) {
      const dest = path.join(OUT_DIR, `${id}.png`);
      fs.copyFileSync(from, dest);
      characterIds.add(id);
      installed.push({ slug, id, dest: path.relative(ROOT, dest).replace(/\\/g, '/') });
    }
  }

  writeRegistry(characterIds);

  const mapPath = path.join(ASSETS_DIR, '_install-map.json');
  fs.writeFileSync(
    mapPath,
    JSON.stringify({ preferredSource: preferred, installed, unknown }, null, 2),
    'utf8',
  );

  console.log(`installed ${installed.length} profile files → ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`registry → ${path.relative(ROOT, REGISTRY_PATH)}`);
  if (unknown.length) {
    console.warn('unknown slugs (skipped):', unknown);
  }
}

main();
