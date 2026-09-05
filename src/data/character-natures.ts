import type { DamageElement } from '@/data/damage-elements';
import { getCuratedPackByLookType } from '@/data/character-packs';

/**
 * Natureza primária do personagem (afinidade canônica / assinatura).
 * Separado do elemento de skill de combate — é metadado de ficha.
 */
export const CHARACTER_NATURES = [
  'wind',
  'fire',
  'water',
  'earth',
  'lightning',
  'ice',
  'wood',
  'physical',
  'yin',
  'yang',
] as const;

export type CharacterNatureId = (typeof CHARACTER_NATURES)[number];

export interface CharacterNatureDefinition {
  id: CharacterNatureId;
  label: string;
  icon: string;
  /** Mapeamento para o eixo de dano do combate. */
  damageElement: DamageElement;
}

export const CHARACTER_NATURE_BY_ID: Record<CharacterNatureId, CharacterNatureDefinition> = {
  wind: { id: 'wind', label: 'Vento', icon: '🌪️', damageElement: 'wind' },
  fire: { id: 'fire', label: 'Fogo', icon: '🔥', damageElement: 'fire' },
  water: { id: 'water', label: 'Água', icon: '💧', damageElement: 'water' },
  earth: { id: 'earth', label: 'Terra', icon: '🪨', damageElement: 'earth' },
  lightning: { id: 'lightning', label: 'Relâmpago', icon: '⚡', damageElement: 'lightning' },
  ice: { id: 'ice', label: 'Gelo', icon: '❄️', damageElement: 'ice' },
  wood: { id: 'wood', label: 'Madeira', icon: '🌲', damageElement: 'earth' },
  physical: { id: 'physical', label: 'Taijutsu', icon: '👊', damageElement: 'physical' },
  yin: { id: 'yin', label: 'Yin', icon: '🌑', damageElement: 'yin' },
  yang: { id: 'yang', label: 'Yang', icon: '☀️', damageElement: 'yang' },
};

/**
 * Afinidade primária por personagem (pesquisa canônica / assinatura de combate).
 * Variantes do mesmo herói compartilham a natureza base.
 */
export const CHARACTER_NATURE_AFFINITY: Record<string, CharacterNatureId> = {
  // Starters / clássicos
  'naruto-classic': 'wind',
  'sasuke-classic': 'lightning',
  'rock-lee': 'physical',

  // Time 7 / Konoha
  sakura: 'earth',
  'sakura-shippuden': 'earth',
  kakashi: 'lightning',
  'kakashi-g6': 'lightning',
  sai: 'yang',
  yamato: 'wood',

  // Time 8 / 10 / Gai
  shikamaru: 'yin',
  chouji: 'yang',
  'choji-jf': 'yang',
  ino: 'yin',
  hinata: 'physical',
  'hinata-g6': 'physical',
  'hinata-kid': 'physical',
  hanabi: 'physical',
  neji: 'physical',
  kiba: 'physical',
  'kiba-kid': 'physical',
  shino: 'earth',
  'shino-g6': 'earth',
  guy: 'physical',
  'rock-lee-g6': 'physical',
  tenten: 'physical',
  'tenten-kid': 'physical',
  'tenten-g6': 'physical',

  // Sannin / Hokage / Konoha
  jiraiya: 'fire',
  tsunade: 'yang',
  orochimaru: 'earth',
  'orochimaru-g6': 'earth',
  hiruzen: 'fire',
  asuma: 'wind',
  kurenai: 'yin',
  anko: 'fire',
  shizune: 'physical',
  konohamaru: 'fire',
  hashirama: 'wood',
  tobirama: 'water',
  'minato-jonin': 'lightning',
  danzo: 'wind',

  // Uchiha / Naruto forms
  'uchiha-itachi': 'fire',
  shisui: 'fire',
  'sasuke-cursed': 'lightning',
  'sasuke-g6': 'lightning',
  'naruto-shippuden': 'wind',
  'naruto-sennin': 'wind',
  'naruto-1-tail': 'wind',
  'naruto-4-tails': 'wind',
  'naruto-kyubi': 'wind',

  // Suna
  gaara: 'earth',
  'gaara-shukaku': 'earth',
  temari: 'wind',
  'temari-kid': 'wind',
  'temari-g6': 'wind',
  kankuro: 'earth',

  // Kiri / Sound / Akatsuki
  zabuza: 'water',
  haku: 'ice',
  'haku-jf': 'ice',
  kisame: 'water',
  deidara: 'earth',
  sasori: 'physical',
  'sasori-puppet': 'physical',
  chiyo: 'physical',
  pain: 'yin',
  kabuto: 'water',
  kimimaro: 'earth',
  jirobo: 'earth',
  kidomaru: 'earth',
  sakon: 'physical',
  'sakon-nun5': 'physical',
  tayuya: 'yin',
  'tayuya-nun5': 'yin',
};

export function isCharacterNatureId(value: unknown): value is CharacterNatureId {
  return typeof value === 'string' && value in CHARACTER_NATURE_BY_ID;
}

/** Resolve id de pack mesmo quando a instância ainda usa `look:N`. */
export function resolveNatureCharacterId(characterId: string | null | undefined): string | null {
  if (!characterId) return null;
  if (CHARACTER_NATURE_AFFINITY[characterId]) return characterId;
  const lookMatch = /^look:(\d+)$/.exec(characterId);
  if (lookMatch) {
    const pack = getCuratedPackByLookType(Number(lookMatch[1]));
    if (pack?.id) return pack.id;
  }
  return characterId;
}

export function getCharacterNature(characterId: string | null | undefined): CharacterNatureDefinition {
  const resolved = resolveNatureCharacterId(characterId);
  const affinity = resolved ? CHARACTER_NATURE_AFFINITY[resolved] : undefined;
  return CHARACTER_NATURE_BY_ID[affinity ?? 'physical'];
}

export function getCharacterNatureLabel(characterId: string | null | undefined): string {
  return getCharacterNature(characterId).label;
}
