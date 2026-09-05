/**
 * Perfis pixel-art em `/ui/profiles/{characterId}.png`.
 * Arte: pack `naruto-world-idle-perfis-pixel-art` (via `scripts/install-character-profiles.js`).
 */

/** IDs com arquivo em `public/ui/profiles/{id}.png`. */
export const CHARACTER_PROFILE_IDS = new Set<string>([
  'anko',
  'asuma',
  'chiyo',
  'choji-jf',
  'chouji',
  'danzo',
  'deidara',
  'gaara',
  'gaara-shukaku',
  'guy',
  'haku',
  'haku-jf',
  'hanabi',
  'hashirama',
  'hinata',
  'hinata-g6',
  'hinata-kid',
  'hiruzen',
  'ino',
  'itachi',
  'jiraiya',
  'jirobo',
  'kabuto',
  'kakashi',
  'kakashi-g6',
  'kankuro',
  'kiba',
  'kiba-kid',
  'kidomaru',
  'kimimaro',
  'kisame',
  'konohamaru',
  'kurenai',
  'minato-jonin',
  'naruto',
  'naruto-1-tail',
  'naruto-4-tails',
  'naruto-classic',
  'naruto-kyubi',
  'naruto-shippuden',
  'neji',
  'orochimaru',
  'orochimaru-g6',
  'pain',
  'rock-lee',
  'rock-lee-g6',
  'sai',
  'sakon',
  'sakon-nun5',
  'sakura',
  'sakura-shippuden',
  'sasori',
  'sasori-puppet',
  'sasuke',
  'sasuke-classic',
  'sasuke-cursed',
  'sasuke-g6',
  'shikamaru',
  'shino',
  'shino-g6',
  'shisui',
  'shizune',
  'tayuya',
  'tayuya-nun5',
  'temari',
  'temari-g6',
  'temari-kid',
  'tenten',
  'tenten-g6',
  'tenten-kid',
  'tobirama',
  'tsunade',
  'uchiha-itachi',
  'yamato',
  'zabuza',
]);

/**
 * Slug do arquivo de arte / sourceId WONSR (sem prefixo) → id do perfil.
 * Ex.: `shikamaru-nara` e `wonsr-character-shikamaru-nara` → `shikamaru`.
 */
const PROFILE_SLUG_TO_ID: Record<string, string> = {
  'uzumaki-naruto': 'naruto-classic',
  'naruto-shippuden': 'naruto-shippuden',
  'naruto-1-cauda': 'naruto-1-tail',
  'naruto-1-tail': 'naruto-1-tail',
  'naruto-4-caudas': 'naruto-4-tails',
  'naruto-4-tails': 'naruto-4-tails',
  'naruto-kyubi': 'naruto-kyubi',
  'uchiha-sasuke': 'sasuke-classic',
  'sasuke-cursed': 'sasuke-cursed',
  'uchiha-sasuke-g6': 'sasuke-g6',
  'sasuke-g6': 'sasuke-g6',
  'uchiha-itachi': 'uchiha-itachi',
  itachi: 'uchiha-itachi',
  'uchiha-shisui': 'shisui',
  shisui: 'shisui',
  'rock-lee': 'rock-lee',
  'rock-lee-g6': 'rock-lee-g6',
  'neji-hyuga': 'neji',
  neji: 'neji',
  'shikamaru-nara': 'shikamaru',
  shikamaru: 'shikamaru',
  'chouji-akimichi': 'chouji',
  chouji: 'chouji',
  'akimichi-choji-jump-force': 'choji-jf',
  'choji-jf': 'choji-jf',
  'ino-yamanaka': 'ino',
  ino: 'ino',
  'shino-aburame': 'shino',
  shino: 'shino',
  'aburame-shino-g6': 'shino-g6',
  'shino-g6': 'shino-g6',
  tenten: 'tenten',
  'tenten-kid': 'tenten-kid',
  'tenten-g6': 'tenten-g6',
  'hinata-hyuga': 'hinata',
  hinata: 'hinata',
  'hyuga-hinata-kid': 'hinata-kid',
  'hinata-kid': 'hinata-kid',
  'hyuga-hinata': 'hinata-g6',
  'hinata-g6': 'hinata-g6',
  'hyuga-hanabi': 'hanabi',
  hanabi: 'hanabi',
  'kiba-inuzuka': 'kiba',
  kiba: 'kiba',
  'kiba-inuzuka-kid': 'kiba-kid',
  'kiba-kid': 'kiba-kid',
  'konohamaru-sarutobi': 'konohamaru',
  konohamaru: 'konohamaru',
  gaara: 'gaara',
  'gaara-shukaku': 'gaara-shukaku',
  temari: 'temari',
  'temari-kid': 'temari-kid',
  'temari-g6': 'temari-g6',
  kankuro: 'kankuro',
  'sakura-shippuden': 'sakura-shippuden',
  sakura: 'sakura-shippuden',
  'might-guy': 'guy',
  guy: 'guy',
  'hatake-kakashi': 'kakashi',
  kakashi: 'kakashi',
  'hatake-kakashi-g6': 'kakashi-g6',
  'kakashi-g6': 'kakashi-g6',
  'asuma-sarutobi': 'asuma',
  asuma: 'asuma',
  'yuhi-kurenai': 'kurenai',
  kurenai: 'kurenai',
  'hiruzen-sarutobi': 'hiruzen',
  hiruzen: 'hiruzen',
  tsunade: 'tsunade',
  jiraya: 'jiraiya',
  jiraiya: 'jiraiya',
  shizune: 'shizune',
  'zabuza-momochi': 'zabuza',
  zabuza: 'zabuza',
  haku: 'haku',
  'haku-jump-force': 'haku-jf',
  'haku-jf': 'haku-jf',
  orochimaru: 'orochimaru',
  'orochimaru-g6': 'orochimaru-g6',
  'yakushi-kabuto': 'kabuto',
  kabuto: 'kabuto',
  kimimaro: 'kimimaro',
  jiroubou: 'jirobo',
  jirobo: 'jirobo',
  'tayuya-nun5': 'tayuya-nun5',
  tayuya: 'tayuya',
  'sakon-e-ukon-nun5': 'sakon-nun5',
  sakon: 'sakon',
  'sakon-nun5': 'sakon-nun5',
  kidomaru: 'kidomaru',
  'kisame-hoshigaki': 'kisame',
  kisame: 'kisame',
  sasori: 'sasori',
  'sasori-hiruko': 'sasori-puppet',
  'sasori-puppet': 'sasori-puppet',
  deidara: 'deidara',
  'pain-deva': 'pain',
  pain: 'pain',
  'danzo-shimura': 'danzo',
  danzo: 'danzo',
  'namikaze-minato-jonin': 'minato-jonin',
  'minato-jonin': 'minato-jonin',
  yamato: 'yamato',
  sai: 'sai',
  'senju-hashirama': 'hashirama',
  hashirama: 'hashirama',
  'senju-tobirama': 'tobirama',
  tobirama: 'tobirama',
  'anko-mitarashi': 'anko',
  anko: 'anko',
  chiyo: 'chiyo',
  naruto: 'naruto-classic',
  'naruto-classic': 'naruto-classic',
  sasuke: 'sasuke-classic',
  'sasuke-classic': 'sasuke-classic',
};

function stripSourcePrefixes(raw: string): string {
  return raw
    .replace(/^wonsr-character-/, '')
    .replace(/^wonsr-vocation-/, '')
    .replace(/^curated-character-/, '')
    .trim();
}

/** Resolve qualquer id/sourceId/slug para o id do arquivo de perfil. */
export function resolveCharacterProfileId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!id) return null;

  if (CHARACTER_PROFILE_IDS.has(id)) return id;

  const fromSlug = PROFILE_SLUG_TO_ID[id];
  if (fromSlug && CHARACTER_PROFILE_IDS.has(fromSlug)) return fromSlug;

  const stripped = stripSourcePrefixes(id);
  if (stripped !== id) {
    if (CHARACTER_PROFILE_IDS.has(stripped)) return stripped;
    const fromStripped = PROFILE_SLUG_TO_ID[stripped];
    if (fromStripped && CHARACTER_PROFILE_IDS.has(fromStripped)) return fromStripped;
  }

  return null;
}

export function hasCharacterProfile(characterId: string | null | undefined): boolean {
  return resolveCharacterProfileId(characterId) != null;
}

/** URL pública do perfil a partir de um id/sourceId, ou null. */
export function getCharacterProfileUrl(characterId: string | null | undefined): string | null {
  const id = resolveCharacterProfileId(characterId);
  if (!id) return null;
  return `/ui/profiles/${id}.png`;
}

/**
 * Resolve o perfil do membro da equipe (characterId WONSR, sourceId, starter…).
 * Preferência: arte do pack de perfis; não usa preview de sprite.
 */
export function resolveMemberProfileUrl(member: {
  characterId?: string | null;
  sourceId?: string | null;
  starterId?: string | null;
}): string | null {
  for (const candidate of [member.characterId, member.sourceId, member.starterId]) {
    const url = getCharacterProfileUrl(candidate);
    if (url) return url;
  }
  return null;
}
