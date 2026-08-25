import { getEnemyHpMultiplier } from '@/config/devConfig';
import { Decimal, d, type Decimal as DecimalType } from '@/lib/decimal';
import { huntEnemyAtkForLevel, huntEnemyHpForLevel } from '@/lib/hunt-enemy-xp';
import type { HuntDefinition, HuntTarget } from '@/types/hunt';

export { huntEnemyAtkForLevel };

export function huntEnemyHpForCatalogLevel(level: number): Decimal {
  return huntEnemyHpForLevel(level);
}

export interface HuntEnemyCombatSnapshot {
  characterId: string;
  huntId: string;
  huntName: string;
  enemyLevel: number;
  catalogHp: DecimalType;
  maxHp: DecimalType;
  atk: DecimalType;
  def: number;
  quality: null;
  qualityStatMultiplier: null;
  modifiers: string[];
}

export function snapshotHuntEnemyCombat(
  hunt: Pick<HuntDefinition, 'id' | 'name'>,
  target: Pick<HuntTarget, 'sourceId' | 'level' | 'hp'>,
): HuntEnemyCombatSnapshot {
  const enemyLevel = Math.max(1, Math.floor(target.level));
  const curveHp = huntEnemyHpForLevel(enemyLevel);
  const jsonHp = target.hp ? d(target.hp).floor() : d(0);
  const hpMul = getEnemyHpMultiplier();
  const modifiers = ['hunt-level-hp-curve', 'hunt-level-atk-curve'];
  let maxHp = curveHp;
  if (hpMul !== 1) {
    maxHp = Decimal.max(d(1), curveHp.mul(hpMul));
    modifiers.push(`dev-enemyHpMultiplier:${hpMul}`);
  }
  return {
    characterId: target.sourceId,
    huntId: hunt.id,
    huntName: hunt.name,
    enemyLevel,
    catalogHp: jsonHp.gt(0) ? jsonHp : curveHp,
    maxHp,
    atk: huntEnemyAtkForLevel(enemyLevel),
    def: 0,
    quality: null,
    qualityStatMultiplier: null,
    modifiers,
  };
}

export function describeHuntEnemyCombatSnapshot(row: HuntEnemyCombatSnapshot): string {
  return [
    `character=${row.characterId}`,
    `hunt=${row.huntId}`,
    `level=${row.enemyLevel}`,
    `catalogHp=${row.catalogHp.toString()}`,
    `maxHp=${row.maxHp.toString()}`,
    `atk=${row.atk.toString()}`,
    `def=${row.def}`,
    `quality=none`,
    `modifiers=${row.modifiers.join(',')}`,
  ].join(' | ');
}
