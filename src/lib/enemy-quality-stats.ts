import type { EnemyDefinition } from '@/types/enemy';

/**
 * HP/ATK de Hunt NÃO usam quality.
 * quality / qualityStatMultiplier existem só na CharacterInstance capturada.
 */
export function enemyMaxHpForDefinition(definition: EnemyDefinition): number {
  return Math.max(1, Math.floor(definition.hp));
}

/** Dano bruto de hunt: fórmula de nível, sem multiplier de quality. */
export function scaleEnemyLevelDamage(raw: number, _definition?: EnemyDefinition): number {
  void _definition;
  return Math.max(2, Math.floor(raw));
}
