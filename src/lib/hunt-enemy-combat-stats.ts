import { huntEnemyStatsForLevel } from '@/constants/combat';
import { getEnemyHpMultiplier } from '@/config/devConfig';
import type { HuntDefinition, HuntTarget } from '@/types/hunt';

/**
 * Stats de combate do inimigo de Hunt — sem quality.
 * HP = curva oficial da caça (nível do alvo) × overlay DEV de HP, se houver.
 * ATK = fórmula de nível do golpe (sem multiplier de quality).
 * DEF = a Hunt não define DEF no inimigo (mitigação só no jogador).
 */
export function huntEnemyAtkForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.max(2, Math.floor(5 + safe * 1.65));
}

export function huntEnemyHpForCatalogLevel(level: number): number {
  return huntEnemyStatsForLevel(level).hp;
}

export interface HuntEnemyCombatSnapshot {
  characterId: string;
  huntId: string;
  huntName: string;
  enemyLevel: number;
  catalogHp: number;
  maxHp: number;
  atk: number;
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
  const catalogHp = Math.max(1, Math.floor(target.hp || huntEnemyHpForCatalogLevel(enemyLevel)));
  const hpMul = getEnemyHpMultiplier();
  const modifiers = ['hunt-level-hp-curve', 'hunt-level-atk-curve'];
  let maxHp = catalogHp;
  if (hpMul !== 1) {
    maxHp = Math.max(1, Math.round(catalogHp * hpMul));
    modifiers.push(`dev-enemyHpMultiplier:${hpMul}`);
  }
  return {
    characterId: target.sourceId,
    huntId: hunt.id,
    huntName: hunt.name,
    enemyLevel,
    catalogHp,
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
    `catalogHp=${row.catalogHp}`,
    `maxHp=${row.maxHp}`,
    `atk=${row.atk}`,
    `def=${row.def}`,
    `quality=none`,
    `modifiers=${row.modifiers.join(',')}`,
  ].join(' | ');
}
