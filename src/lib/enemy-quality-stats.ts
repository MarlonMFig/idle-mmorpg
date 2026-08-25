import { getEnemyHpMultiplier } from '@/config/devConfig';
import { Decimal, d, floorNonNeg } from '@/lib/decimal';
import { huntEnemyHpForLevel } from '@/lib/hunt-enemy-xp';
import type { EnemyDefinition } from '@/types/enemy';

/**
 * HP/ATK de Hunt NÃO usam quality.
 * quality / qualityStatMultiplier existem só na CharacterInstance capturada.
 */
export function enemyMaxHpForDefinition(definition: EnemyDefinition): Decimal {
  if (definition.combatHpFromLevel) {
    const curve = huntEnemyHpForLevel(definition.level);
    const mul = getEnemyHpMultiplier();
    const hp = mul === 1 ? curve : curve.mul(mul);
    return Decimal.max(d(1), hp);
  }
  return Decimal.max(d(1), floorNonNeg(definition.hp));
}

/** Dano bruto de hunt: fórmula de nível, sem multiplier de quality. */
export function scaleEnemyLevelDamage(raw: number | Decimal, _definition?: EnemyDefinition): Decimal {
  void _definition;
  return Decimal.max(d(2), floorNonNeg(raw));
}
