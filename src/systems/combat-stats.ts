import { attributesStore } from '@/stores/attributes-store';
import { teamStore } from '@/stores/team-store';
import {
  identityModifiers,
  type StatusModifiers,
} from '@/data/status-effect-def';
import { getActiveLineageSpecializationModifiers } from '@/lib/lineage-specialization-modifiers';
import { villageKillSpeedMultiplier } from '@/lib/village-bonuses';
import { heritageCombatExtras } from '@/lib/heritage-runtime';
import { Decimal, d, floorNonNeg, type Decimal as DecimalValue } from '@/lib/decimal';

export const PLAYER_STATUS_UNIT_ID = 'player';

/**
 * Ordem dos modificadores (não altera a fórmula de defesa):
 *
 * 1. Base (`BASE_ATTRIBUTES`)
 * 2. Stars no base
 * 3. Level (aditivo)
 * 4. Quality da instância (HP/ATK/DEF) — uma vez
 * 5. Awakening (percentuais derivados sobre o valor já com quality)
 * 6. Lineage + buffs additive (`attributesStore`)
 * 7. Temporary status multipliers
 * 8. Final combat stats
 *
 * Buffs/Debuffs NÃO escrevem em `character.attack` permanente.
 */
export interface EffectiveCombatStats {
  attack: DecimalValue;
  defense: DecimalValue;
  movementSpeed: number;
  attackSpeedMultiplier: number;
  criticalChance: number;
  criticalDamage: number;
  defenseMultiplier: number;
}

export interface CombatStatBases {
  attack?: number;
  defense?: number;
  movementSpeed?: number;
  criticalChance?: number;
  criticalDamage?: number;
}

type ModifierReader = (unitId: string) => Required<StatusModifiers>;

let readModifiers: ModifierReader = () => identityModifiers();

export function bindCombatStatModifiers(reader: ModifierReader): void {
  readModifiers = reader;
}

export function unbindCombatStatModifiers(): void {
  readModifiers = () => identityModifiers();
}

function product(value: number | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 1;
}

function lineageCombatExtras(unitId: string): {
  attackSpeedPercent: number;
  criticalDamage: number;
} {
  try {
    let characterId: string | null = null;
    if (unitId === PLAYER_STATUS_UNIT_ID) {
      characterId = teamStore.getActive()?.characterId ?? null;
    } else if (unitId.startsWith('companion:')) {
      const instanceId = unitId.slice('companion:'.length);
      characterId = teamStore.getCharacterInstance(instanceId)?.characterId ?? null;
    }
    const mods = getActiveLineageSpecializationModifiers(characterId);
    return {
      attackSpeedPercent: mods.attackSpeedPercent ?? 0,
      criticalDamage: mods.criticalDamage ?? 0,
    };
  } catch {
    return { attackSpeedPercent: 0, criticalDamage: 0 };
  }
}

function villageCombatExtras(unitId: string): { attackSpeedMultiplier: number } {
  if (unitId !== PLAYER_STATUS_UNIT_ID && !unitId.startsWith('companion:')) {
    return { attackSpeedMultiplier: 1 };
  }
  return { attackSpeedMultiplier: villageKillSpeedMultiplier() };
}

export function getEffectiveCombatStats(
  unitId: string,
  bases?: CombatStatBases,
): EffectiveCombatStats {
  const mods = readModifiers(unitId);
  const isPlayerLike = unitId === PLAYER_STATUS_UNIT_ID || unitId.startsWith('companion:');
  const attackBase = isPlayerLike ? attributesStore.getStrength() : (bases?.attack ?? 0);
  const defenseBase = isPlayerLike ? attributesStore.getDefense() : (bases?.defense ?? 0);
  const moveBase = isPlayerLike ? attributesStore.getSpeed() : (bases?.movementSpeed ?? 0);
  const critBase = isPlayerLike ? attributesStore.getCritical() : (bases?.criticalChance ?? 0);
  const critDmgBase = bases?.criticalDamage ?? 1;
  const lineage = isPlayerLike ? lineageCombatExtras(unitId) : { attackSpeedPercent: 0, criticalDamage: 0 };
  const village = villageCombatExtras(unitId);
  const heritageAs =
    unitId === PLAYER_STATUS_UNIT_ID ? 1 + (heritageCombatExtras().attackSpeedPercent ?? 0) : 1;
  return {
    attack: Decimal.max(d(0), d(attackBase).mul(product(mods.attackMultiplier))),
    defense: Decimal.max(d(0), d(defenseBase).mul(product(mods.defenseMultiplier))),
    movementSpeed: Math.max(0, moveBase * product(mods.movementSpeedMultiplier)),
    attackSpeedMultiplier:
      product(mods.attackSpeedMultiplier) *
      (1 + lineage.attackSpeedPercent) *
      village.attackSpeedMultiplier *
      heritageAs,
    criticalChance: Math.max(0, critBase * product(mods.criticalChanceMultiplier)),
    criticalDamage: Math.max(0, critDmgBase * product(mods.criticalDamageMultiplier) * (1 + lineage.criticalDamage)),
    defenseMultiplier: product(mods.defenseMultiplier),
  };
}

/**
 * Fórmula atual de defesa do jogador: `max(1, floor(raw - defense * 0.35))`.
 * Não altera o coeficiente 0.35.
 *
 * Inimigos não têm defesa base. Sem Status, o dano recebido permanece `raw`
 * (Hunt inalterado). Com `defenseMultiplier !== 1`, o dano recebido escala
 * por `1 / defenseMultiplier` para o Debuff não ser no-op em defesa 0.
 */
export function mitigateIncomingDamage(
  rawAmount: number | DecimalValue,
  stats: EffectiveCombatStats,
): DecimalValue {
  const raw = d(rawAmount);
  if (raw.lte(0)) return d(0);
  if (stats.defense.gt(0)) {
    return Decimal.max(d(1), raw.sub(stats.defense.mul(0.35)).floor());
  }
  if (stats.defenseMultiplier !== 1) {
    return Decimal.max(d(1), raw.div(stats.defenseMultiplier).floor());
  }
  return floorNonNeg(raw);
}

export function scaledAttackCooldown(baseMs: number, unitId: string): number {
  const speed = getEffectiveCombatStats(unitId).attackSpeedMultiplier;
  if (speed <= 0) return baseMs * 8;
  return Math.max(40, Math.round(baseMs / speed));
}
