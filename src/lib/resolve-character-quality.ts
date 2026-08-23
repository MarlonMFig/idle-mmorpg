import type { CharacterQuality } from '@/types/character-meta';
import type { EnemyDefinition } from '@/types/enemy';
import { isCharacterQuality } from '@/utils/character-identity';

/** Qualidade não vive no inimigo da Hunt. Fallback legado D se o campo antigo existir. */
export function resolveEnemyCaptureQuality(definition: EnemyDefinition): CharacterQuality {
  const quality = definition.sealable?.quality;
  return isCharacterQuality(quality) ? quality : 'D';
}

export function isHuntCatalogSealable(hunt: { tab?: string; sealable?: boolean; id?: string }): boolean {
  if (hunt.sealable === false) return false;
  if (hunt.tab === 'bosses') return false;
  return true;
}
