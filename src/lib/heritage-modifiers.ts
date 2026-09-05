import {
  getHeritageOptionById,
  getHeritageOptionModifiersAtLevel,
  HERITAGE_GATES,
  HERITAGE_OPTION_MAX_LEVEL,
  HERITAGE_STAT_FLOOR_RATIO,
  clampHeritageOptionLevel,
  clampHeritageOptionLevelFor,
  type HeritageModifiers,
  type HeritageOptionDefinition,
} from '@/constants/heritage-system';
import type { HeritageLoadout } from '@/types/heritage';
import type { AttributeValues } from '@/types/attributes';

export interface HeritageCombatExtras {
  attackSpeedPercent: number;
  criticalPercent: number;
  dropChancePercent: number;
  captureChancePercent: number;
  regenPerKill: number;
  regenPerSecond: number;
  gatePenaltyScale: number;
}

export interface HeritageResolvedModifiers {
  /** Camada dos portões (já com redução Salamandra nas penalidades). */
  gates: HeritageModifiers;
  passives: HeritageModifiers;
  sennin: HeritageModifiers;
  combat: HeritageCombatExtras;
}

function emptyMods(): HeritageModifiers {
  return {};
}

function addMod(target: HeritageModifiers, source: HeritageModifiers, scalePenalties = 1): void {
  const keys: (keyof HeritageModifiers)[] = [
    'ataque',
    'defesa',
    'hp',
    'velocidadeAtaque',
    'critico',
    'chanceDrop',
    'chanceCaptura',
    'regenPorKill',
    'reducaoPenalidadePortoes',
    'regenContinuoPorSegundo',
  ];
  for (const key of keys) {
    const value = source[key];
    if (value == null || value === 0) continue;
    let next = value;
    if (scalePenalties !== 1 && (key === 'hp' || key === 'defesa') && value < 0) {
      next = value * scalePenalties;
    }
    target[key] = (target[key] ?? 0) + next;
  }
}

/**
 * Modificadores do portão ativo apenas (não soma níveis anteriores).
 * Ex.: 6º = exatamente +28% atk / +16% vel / −15% HP/def.
 */
export function getActiveGateModifiers(activeGateLevel: number): HeritageModifiers {
  const level = Math.max(0, Math.min(8, Math.floor(activeGateLevel)));
  if (level <= 0) return emptyMods();
  const gate = HERITAGE_GATES.find((row) => row.level === level);
  return gate ? { ...gate.modifiers } : emptyMods();
}

/** @deprecated use getActiveGateModifiers — valores não são mais cumulativos. */
export function sumOpenGateModifiers(openGateLevel: number): HeritageModifiers {
  return getActiveGateModifiers(openGateLevel);
}

export function getLoadoutOptionLevel(loadout: HeritageLoadout, optionId: string | null | undefined): number {
  if (!optionId) return 1;
  const option = getHeritageOptionById(optionId);
  if (!option) {
    return clampHeritageOptionLevel(loadout.optionLevels[optionId] ?? 1, HERITAGE_OPTION_MAX_LEVEL);
  }
  return clampHeritageOptionLevelFor(option, loadout.optionLevels[optionId] ?? 1);
}

export function resolveOptionModifiers(
  option: HeritageOptionDefinition | null | undefined,
  loadout: HeritageLoadout,
): HeritageModifiers {
  if (!option) return emptyMods();
  return getHeritageOptionModifiersAtLevel(option, getLoadoutOptionLevel(loadout, option.id));
}

export function resolveHeritageModifiers(input: {
  loadout: HeritageLoadout;
  cla?: HeritageOptionDefinition | null;
  summon?: HeritageOptionDefinition | null;
  cursedSeal?: HeritageOptionDefinition | null;
  sennin?: HeritageOptionDefinition | null;
  senninActive?: boolean;
}): HeritageResolvedModifiers {
  const summonMods = resolveOptionModifiers(input.summon, input.loadout);
  const penaltyScale =
    typeof summonMods.reducaoPenalidadePortoes === 'number' &&
    Number.isFinite(summonMods.reducaoPenalidadePortoes) &&
    summonMods.reducaoPenalidadePortoes > 0
      ? summonMods.reducaoPenalidadePortoes
      : 1;

  const rawGates = getActiveGateModifiers(input.loadout.openGateLevel);
  const gates = emptyMods();
  addMod(gates, rawGates, penaltyScale);

  const passives = emptyMods();
  addMod(passives, resolveOptionModifiers(input.cla, input.loadout));
  addMod(passives, summonMods);
  addMod(passives, resolveOptionModifiers(input.cursedSeal, input.loadout));

  const sennin = emptyMods();
  if (input.senninActive && input.sennin) {
    addMod(sennin, resolveOptionModifiers(input.sennin, input.loadout));
  }

  const mergeCombat = (...layers: HeritageModifiers[]): HeritageCombatExtras => {
    let attackSpeedPercent = 0;
    let criticalPercent = 0;
    let dropChancePercent = 0;
    let captureChancePercent = 0;
    let regenPerKill = 0;
    let regenPerSecond = 0;
    for (const layer of layers) {
      attackSpeedPercent += layer.velocidadeAtaque ?? 0;
      criticalPercent += layer.critico ?? 0;
      dropChancePercent += layer.chanceDrop ?? 0;
      captureChancePercent += layer.chanceCaptura ?? 0;
      regenPerKill += layer.regenPorKill ?? 0;
      regenPerSecond += layer.regenContinuoPorSegundo ?? 0;
    }
    return {
      attackSpeedPercent,
      criticalPercent,
      dropChancePercent,
      captureChancePercent,
      regenPerKill,
      regenPerSecond,
      gatePenaltyScale: penaltyScale,
    };
  };

  return {
    gates,
    passives,
    sennin,
    combat: mergeCombat(gates, passives, sennin),
  };
}

function applyLayer(values: AttributeValues, mods: HeritageModifiers): AttributeValues {
  const atk = 1 + (mods.ataque ?? 0);
  const def = 1 + (mods.defesa ?? 0);
  const hp = 1 + (mods.hp ?? 0);
  const crit = 1 + (mods.critico ?? 0);
  return {
    hp: values.hp * hp,
    strength: values.strength * atk,
    defense: values.defense * def,
    speed: values.speed,
    accuracy: values.accuracy,
    critical: values.critical * crit,
  };
}

/** Piso 10% do baseline — inclui ataque (strength) sob −atk acumulado. */
function applyFloor(values: AttributeValues, baseline: AttributeValues): AttributeValues {
  const floor = HERITAGE_STAT_FLOOR_RATIO;
  const floored = (base: number, value: number) =>
    Math.max(base * floor, Number.isFinite(value) ? value : 0);
  return {
    hp: floored(baseline.hp, values.hp),
    strength: floored(baseline.strength, values.strength),
    defense: floored(baseline.defense, values.defense),
    speed: floored(baseline.speed, values.speed),
    accuracy: floored(baseline.accuracy, values.accuracy),
    critical: Math.max(0, Number.isFinite(values.critical) ? values.critical : 0),
  };
}

/**
 * Aplica Herança sobre status já progressados (base→stars→level→quality→lineage→buffs).
 * Ordem: Portão ativo (único) → Clã+Invocação+Selo → Modo Sennin (se ativo).
 */
export function applyHeritageToAttributeValues(
  baseline: AttributeValues,
  resolved: HeritageResolvedModifiers,
): AttributeValues {
  let next = { ...baseline };
  next = applyLayer(next, resolved.gates);
  next = applyLayer(next, resolved.passives);
  next = applyLayer(next, resolved.sennin);
  return applyFloor(next, baseline);
}

export function formatStatDelta(before: number, after: number, digits = 0): string {
  const a = digits > 0 ? before.toFixed(digits) : String(Math.round(before));
  const b = digits > 0 ? after.toFixed(digits) : String(Math.round(after));
  return `${a} → ${b}`;
}
