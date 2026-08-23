/**
 * Status Effects — definição estática e associação em Skills.
 * Distinto de `executionType: persistent` (VFX/execução da Skill).
 * Instâncias runtime NÃO entram em save / collection / CharacterDefinition.
 *
 * Resistência a dano elemental ≠ resistência a Status.
 * `element` no DoT (ex.: Burn → fire) só afeta o dano do tick, não imuniza o Status.
 */

import type { DamageElement, ElementResistanceMap } from '@/data/damage-elements';
import { isDamageElement, normalizeDamageElement } from '@/data/damage-elements';

export const STATUS_TYPES = [
  'burn',
  'poison',
  'bleed',
  'stun',
  'slow',
  'attack-up',
  'attack-down',
  'defense-up',
  'defense-down',
  'speed-up',
  'speed-down',
  'crit-up',
  'crit-down',
  'regen',
  'shield',
] as const;
export type StatusType = (typeof STATUS_TYPES)[number];

export const STATUS_CATEGORIES = [
  'damage-over-time',
  'heal-over-time',
  'stun',
  'modifier',
  'shield',
] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const STATUS_STACK_MODES = ['refresh-duration', 'stack', 'replace', 'ignore'] as const;
export type StatusStackMode = (typeof STATUS_STACK_MODES)[number];

export const STATUS_APPLICATION_MOMENTS = ['on-start', 'on-hit', 'on-end'] as const;
export type StatusApplicationMoment = (typeof STATUS_APPLICATION_MOMENTS)[number];

export const STATUS_APPLY_MODES = ['once-per-skill', 'per-hit'] as const;
export type StatusApplyMode = (typeof STATUS_APPLY_MODES)[number];

export const STATUS_TARGETS = ['self', 'target'] as const;
export type StatusTarget = (typeof STATUS_TARGETS)[number];

/** Mínimo técnico — evita loop de 1ms. Não é balanceamento. */
export const MIN_STATUS_TICK_INTERVAL_MS = 50;
export const MIN_STATUS_DURATION_MS = 1;
export const MAX_STATUS_DURATION_MS = 120_000;
export const MAX_STATUS_STACKS = 99;

export const STATUS_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

/**
 * Multiplicadores temporários. Ausente = 1 (sem alteração).
 * `movementSpeed` e `attackSpeed` são propriedades distintas.
 */
export interface StatusModifiers {
  attackMultiplier?: number;
  defenseMultiplier?: number;
  movementSpeedMultiplier?: number;
  attackSpeedMultiplier?: number;
  criticalChanceMultiplier?: number;
  /** Reservado — a fórmula global de crítico não muda neste item. */
  criticalDamageMultiplier?: number;
  /**
   * Modificador aditivo de resistência elemental (futuro: Fire Resistance Down).
   * Não criar conteúdo agora. Somado à resistência da entidade.
   */
  elementResistanceModifiers?: ElementResistanceMap;
}

export interface StatusEffectDefinition {
  id: string;
  name: string;
  type: StatusType;
  duration: number;
  tickInterval?: number;
  stackMode: StatusStackMode;
  maxStacks: number;
  modifiers?: StatusModifiers;
  damagePerTick?: number;
  healPerTick?: number;
  shieldAmount?: number;
  /** Se true, DoT/regen/shield escalam com stacks. Default false. */
  stackScalesValue?: boolean;
  /** VFX opcional do registry existente. Usa `renderLayer` do VFX. */
  vfxId?: string;
  /** Ícone DEV próximo do HP. Emoji ou texto curto. */
  icon?: string;
  /**
   * Elemento do dano periódico. Ausente = `neutral` (DoT ignora resistência elemental).
   * Fire Resistance não bloqueia a aplicação de Burn.
   */
  element?: DamageElement;
}

/**
 * Associação Skill → Status. Uma Skill pode aplicar 0, 1 ou vários.
 * Overrides opcionais: só o que a Skill quiser mudar da Definition.
 */
export interface SkillStatusApplication {
  statusId: string;
  /** 0–1. Ex.: 0.35 = 35%. Sem chance global hardcoded. */
  chance: number;
  target: StatusTarget;
  application: StatusApplicationMoment;
  /**
   * Multi-hit / beam / persistent:
   * `once-per-skill` = um teste por execução;
   * `per-hit` = um teste por hit/tick.
   * Ausente = once-per-skill (não testa todos os ticks em silêncio).
   */
  applyMode?: StatusApplyMode;
  duration?: number;
  tickInterval?: number;
  damagePerTick?: number;
  healPerTick?: number;
  shieldAmount?: number;
  modifiers?: StatusModifiers;
}

export const STATUS_TYPE_LABELS: Record<StatusType, string> = {
  burn: 'Burn',
  poison: 'Poison',
  bleed: 'Bleed',
  stun: 'Stun',
  slow: 'Slow',
  'attack-up': 'Attack Up',
  'attack-down': 'Attack Down',
  'defense-up': 'Defense Up',
  'defense-down': 'Defense Down',
  'speed-up': 'Speed Up',
  'speed-down': 'Speed Down',
  'crit-up': 'Crit Up',
  'crit-down': 'Crit Down',
  regen: 'Regen',
  shield: 'Shield',
};

export const STATUS_STACK_MODE_LABELS: Record<StatusStackMode, string> = {
  'refresh-duration': 'Refresh Duration',
  stack: 'Stack',
  replace: 'Replace',
  ignore: 'Ignore',
};

export const STATUS_APPLICATION_LABELS: Record<StatusApplicationMoment, string> = {
  'on-start': 'On Start',
  'on-hit': 'On Impact',
  'on-end': 'On End',
};

export const STATUS_APPLY_MODE_LABELS: Record<StatusApplyMode, string> = {
  'once-per-skill': 'Uma vez por Skill',
  'per-hit': 'Uma vez por hit',
};

export const STATUS_TARGET_LABELS: Record<StatusTarget, string> = {
  self: 'Self',
  target: 'Enemy',
};

export const DEFAULT_STATUS_ICONS: Record<StatusType, string> = {
  burn: '🔥',
  poison: '☠',
  bleed: '💧',
  stun: '⚡',
  slow: '🐌',
  'attack-up': '⬆',
  'attack-down': '⬇',
  'defense-up': '🛡',
  'defense-down': '🛡',
  'speed-up': '💨',
  'speed-down': '🐢',
  'crit-up': '✨',
  'crit-down': '✨',
  regen: '💚',
  shield: '🔵',
};

export function isStatusType(value: unknown): value is StatusType {
  return typeof value === 'string' && (STATUS_TYPES as readonly string[]).includes(value);
}

export function isStatusStackMode(value: unknown): value is StatusStackMode {
  return typeof value === 'string' && (STATUS_STACK_MODES as readonly string[]).includes(value);
}

export function isStatusApplicationMoment(value: unknown): value is StatusApplicationMoment {
  return typeof value === 'string' && (STATUS_APPLICATION_MOMENTS as readonly string[]).includes(value);
}

export function isStatusApplyMode(value: unknown): value is StatusApplyMode {
  return typeof value === 'string' && (STATUS_APPLY_MODES as readonly string[]).includes(value);
}

export function isStatusTarget(value: unknown): value is StatusTarget {
  return typeof value === 'string' && (STATUS_TARGETS as readonly string[]).includes(value);
}

export function isStatusId(value: unknown): value is string {
  return typeof value === 'string' && STATUS_ID_PATTERN.test(value);
}

export function categoryForStatusType(type: StatusType): StatusCategory {
  if (type === 'burn' || type === 'poison' || type === 'bleed') return 'damage-over-time';
  if (type === 'regen') return 'heal-over-time';
  if (type === 'stun') return 'stun';
  if (type === 'shield') return 'shield';
  return 'modifier';
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function clampStatusDuration(ms: number): number {
  return Math.min(MAX_STATUS_DURATION_MS, Math.max(MIN_STATUS_DURATION_MS, Math.round(ms)));
}

export function clampStatusTickInterval(ms: number): number {
  return Math.min(MAX_STATUS_DURATION_MS, Math.max(MIN_STATUS_TICK_INTERVAL_MS, Math.round(ms)));
}

export function clampStatusStacks(value: number): number {
  return Math.min(MAX_STATUS_STACKS, Math.max(1, Math.round(value)));
}

export function identityModifiers(): Required<StatusModifiers> {
  return {
    attackMultiplier: 1,
    defenseMultiplier: 1,
    movementSpeedMultiplier: 1,
    attackSpeedMultiplier: 1,
    criticalChanceMultiplier: 1,
    criticalDamageMultiplier: 1,
    elementResistanceModifiers: {},
  };
}

export function cloneModifiers(modifiers: StatusModifiers | undefined): StatusModifiers | undefined {
  if (!modifiers) return undefined;
  const next: StatusModifiers = {};
  if (modifiers.attackMultiplier != null) next.attackMultiplier = modifiers.attackMultiplier;
  if (modifiers.defenseMultiplier != null) next.defenseMultiplier = modifiers.defenseMultiplier;
  if (modifiers.movementSpeedMultiplier != null) {
    next.movementSpeedMultiplier = modifiers.movementSpeedMultiplier;
  }
  if (modifiers.attackSpeedMultiplier != null) next.attackSpeedMultiplier = modifiers.attackSpeedMultiplier;
  if (modifiers.criticalChanceMultiplier != null) {
    next.criticalChanceMultiplier = modifiers.criticalChanceMultiplier;
  }
  if (modifiers.criticalDamageMultiplier != null) {
    next.criticalDamageMultiplier = modifiers.criticalDamageMultiplier;
  }
  if (modifiers.elementResistanceModifiers) {
    next.elementResistanceModifiers = { ...modifiers.elementResistanceModifiers };
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseModifiers(raw: unknown): StatusModifiers | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw !== 'object') throw new Error('modifiers inválidos');
  const value = raw as Record<string, unknown>;
  const allowed = new Set([
    'attackMultiplier',
    'defenseMultiplier',
    'movementSpeedMultiplier',
    'attackSpeedMultiplier',
    'criticalChanceMultiplier',
    'criticalDamageMultiplier',
    'elementResistanceModifiers',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo de modifier não permitido: ${key}`);
  }
  const next: StatusModifiers = {};
  const read = (key: Exclude<keyof StatusModifiers, 'elementResistanceModifiers'>) => {
    if (value[key] == null) return;
    const n = asFiniteNumber(value[key], 1);
    if (n <= 0) throw new Error(`${key} deve ser > 0`);
    next[key] = n;
  };
  read('attackMultiplier');
  read('defenseMultiplier');
  read('movementSpeedMultiplier');
  read('attackSpeedMultiplier');
  read('criticalChanceMultiplier');
  read('criticalDamageMultiplier');
  if (value.elementResistanceModifiers != null) {
    if (typeof value.elementResistanceModifiers !== 'object') {
      throw new Error('elementResistanceModifiers inválido');
    }
    const map: ElementResistanceMap = {};
    for (const [key, rawValue] of Object.entries(value.elementResistanceModifiers as Record<string, unknown>)) {
      if (!isDamageElement(key)) throw new Error(`unknown element: ${key}`);
      const n = asFiniteNumber(rawValue, 0);
      map[key] = n;
    }
    next.elementResistanceModifiers = map;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function parseStatusEffectDefinition(raw: unknown): StatusEffectDefinition {
  if (raw == null || typeof raw !== 'object') throw new Error('StatusDefinition inválida');
  const value = raw as Record<string, unknown>;
  const allowed = new Set([
    'id',
    'name',
    'type',
    'duration',
    'tickInterval',
    'stackMode',
    'maxStacks',
    'modifiers',
    'damagePerTick',
    'healPerTick',
    'shieldAmount',
    'stackScalesValue',
    'vfxId',
    'icon',
    'element',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo de Status não permitido: ${key}`);
  }
  const id = String(value.id ?? '').trim();
  if (!isStatusId(id)) throw new Error('ID inválido (use kebab-case, ex.: lab-burn)');
  const name = String(value.name ?? '').trim();
  if (!name) throw new Error('Nome obrigatório');
  if (!isStatusType(value.type)) throw new Error('Tipo de Status inválido');
  if (!isStatusStackMode(value.stackMode)) throw new Error('Stack Mode inválido');
  const duration = clampStatusDuration(asFiniteNumber(value.duration, 5000));
  const maxStacks = clampStatusStacks(asFiniteNumber(value.maxStacks, 1));
  const category = categoryForStatusType(value.type);
  const next: StatusEffectDefinition = {
    id,
    name,
    type: value.type,
    duration,
    stackMode: value.stackMode,
    maxStacks,
  };
  if (category === 'damage-over-time' || category === 'heal-over-time') {
    next.tickInterval = clampStatusTickInterval(asFiniteNumber(value.tickInterval, 1000));
    if (next.tickInterval <= 0) throw new Error('tickInterval deve ser > 0');
  } else if (value.tickInterval != null) {
    next.tickInterval = clampStatusTickInterval(asFiniteNumber(value.tickInterval, 1000));
  }
  if (category === 'damage-over-time') {
    next.damagePerTick = Math.max(0, asFiniteNumber(value.damagePerTick, 0));
  }
  if (category === 'heal-over-time') {
    next.healPerTick = Math.max(0, asFiniteNumber(value.healPerTick, 0));
  }
  if (category === 'shield') {
    next.shieldAmount = Math.max(0, asFiniteNumber(value.shieldAmount, 0));
  }
  const modifiers = parseModifiers(value.modifiers);
  if (modifiers) next.modifiers = modifiers;
  if (value.stackScalesValue === true) next.stackScalesValue = true;
  if (typeof value.vfxId === 'string' && value.vfxId.trim()) {
    const vfxId = value.vfxId.trim();
    if (!STATUS_ID_PATTERN.test(vfxId)) throw new Error('vfxId inválido');
    next.vfxId = vfxId;
  }
  if (typeof value.icon === 'string' && value.icon.trim()) {
    next.icon = value.icon.trim().slice(0, 8);
  }
  if (value.element != null && value.element !== '') {
    const parsed = normalizeDamageElement(value.element);
    if (typeof value.element !== 'string' || parsed.unknown) {
      throw new Error(`unknown element: ${String(value.element)}`);
    }
    next.element = parsed.element;
  }
  return next;
}

export function parseSkillStatusApplication(raw: unknown): SkillStatusApplication {
  if (raw == null || typeof raw !== 'object') throw new Error('statusEffect inválido');
  const value = raw as Record<string, unknown>;
  const allowed = new Set([
    'statusId',
    'chance',
    'target',
    'application',
    'applyMode',
    'duration',
    'tickInterval',
    'damagePerTick',
    'healPerTick',
    'shieldAmount',
    'modifiers',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo de statusEffect não permitido: ${key}`);
  }
  const statusId = String(value.statusId ?? '').trim();
  if (!isStatusId(statusId)) throw new Error('statusId inválido');
  const chance = asFiniteNumber(value.chance, 1);
  if (chance < 0 || chance > 1) throw new Error('chance deve estar entre 0 e 1');
  if (!isStatusTarget(value.target)) throw new Error('target de Status inválido');
  if (!isStatusApplicationMoment(value.application)) throw new Error('application de Status inválida');
  const next: SkillStatusApplication = {
    statusId,
    chance,
    target: value.target,
    application: value.application,
  };
  if (value.applyMode != null) {
    if (!isStatusApplyMode(value.applyMode)) throw new Error('applyMode inválido');
    next.applyMode = value.applyMode;
  }
  if (value.duration != null) next.duration = clampStatusDuration(asFiniteNumber(value.duration, 5000));
  if (value.tickInterval != null) {
    next.tickInterval = clampStatusTickInterval(asFiniteNumber(value.tickInterval, 1000));
  }
  if (value.damagePerTick != null) next.damagePerTick = Math.max(0, asFiniteNumber(value.damagePerTick, 0));
  if (value.healPerTick != null) next.healPerTick = Math.max(0, asFiniteNumber(value.healPerTick, 0));
  if (value.shieldAmount != null) next.shieldAmount = Math.max(0, asFiniteNumber(value.shieldAmount, 0));
  const modifiers = parseModifiers(value.modifiers);
  if (modifiers) next.modifiers = modifiers;
  return next;
}

export function parseSkillStatusEffects(raw: unknown): SkillStatusApplication[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error('statusEffects deve ser um array');
  return raw.map((entry) => parseSkillStatusApplication(entry));
}

export function cloneStatusDefinition(def: StatusEffectDefinition): StatusEffectDefinition {
  return {
    ...def,
    modifiers: cloneModifiers(def.modifiers),
  };
}

export function cloneSkillStatusApplication(entry: SkillStatusApplication): SkillStatusApplication {
  return {
    ...entry,
    modifiers: cloneModifiers(entry.modifiers),
  };
}

export function cloneSkillStatusEffects(
  entries: readonly SkillStatusApplication[] | undefined,
): SkillStatusApplication[] {
  return (entries ?? []).map(cloneSkillStatusApplication);
}

export function statusEffectsEqual(
  a: readonly SkillStatusApplication[] | undefined,
  b: readonly SkillStatusApplication[] | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((entry, index) => JSON.stringify(entry) === JSON.stringify(right[index]));
}

export function resolveStatusApplyMode(entry: SkillStatusApplication): StatusApplyMode {
  return entry.applyMode ?? 'once-per-skill';
}

export function mergeStatusOverrides(
  def: StatusEffectDefinition,
  override: SkillStatusApplication,
): StatusEffectDefinition {
  return {
    ...def,
    duration: override.duration ?? def.duration,
    tickInterval: override.tickInterval ?? def.tickInterval,
    damagePerTick: override.damagePerTick ?? def.damagePerTick,
    healPerTick: override.healPerTick ?? def.healPerTick,
    shieldAmount: override.shieldAmount ?? def.shieldAmount,
    modifiers: override.modifiers ? { ...def.modifiers, ...override.modifiers } : def.modifiers,
  };
}

function formatModifiersLiteral(modifiers: StatusModifiers, indent: string): string {
  const lines = [`${indent}modifiers: {`];
  const inner = `${indent}  `;
  if (modifiers.attackMultiplier != null) {
    lines.push(`${inner}attackMultiplier: ${modifiers.attackMultiplier},`);
  }
  if (modifiers.defenseMultiplier != null) {
    lines.push(`${inner}defenseMultiplier: ${modifiers.defenseMultiplier},`);
  }
  if (modifiers.movementSpeedMultiplier != null) {
    lines.push(`${inner}movementSpeedMultiplier: ${modifiers.movementSpeedMultiplier},`);
  }
  if (modifiers.attackSpeedMultiplier != null) {
    lines.push(`${inner}attackSpeedMultiplier: ${modifiers.attackSpeedMultiplier},`);
  }
  if (modifiers.criticalChanceMultiplier != null) {
    lines.push(`${inner}criticalChanceMultiplier: ${modifiers.criticalChanceMultiplier},`);
  }
  if (modifiers.criticalDamageMultiplier != null) {
    lines.push(`${inner}criticalDamageMultiplier: ${modifiers.criticalDamageMultiplier},`);
  }
  if (modifiers.elementResistanceModifiers) {
    const entries = Object.entries(modifiers.elementResistanceModifiers)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    lines.push(`${inner}elementResistanceModifiers: { ${entries} },`);
  }
  lines.push(`${indent}},`);
  return lines.join('\n');
}

export function formatStatusDefinitionLiteral(def: StatusEffectDefinition, indent: string): string {
  const inner = `${indent}  `;
  const lines = [
    `${indent}'${def.id}': {`,
    `${inner}id: '${def.id}',`,
    `${inner}name: ${JSON.stringify(def.name)},`,
    `${inner}type: '${def.type}',`,
    `${inner}duration: ${Math.round(def.duration)},`,
    `${inner}stackMode: '${def.stackMode}',`,
    `${inner}maxStacks: ${Math.round(def.maxStacks)},`,
  ];
  if (def.tickInterval != null) lines.push(`${inner}tickInterval: ${Math.round(def.tickInterval)},`);
  if (def.damagePerTick != null) lines.push(`${inner}damagePerTick: ${def.damagePerTick},`);
  if (def.healPerTick != null) lines.push(`${inner}healPerTick: ${def.healPerTick},`);
  if (def.shieldAmount != null) lines.push(`${inner}shieldAmount: ${def.shieldAmount},`);
  if (def.stackScalesValue) lines.push(`${inner}stackScalesValue: true,`);
  if (def.vfxId) lines.push(`${inner}vfxId: '${def.vfxId}',`);
  if (def.icon) lines.push(`${inner}icon: ${JSON.stringify(def.icon)},`);
  if (def.element) lines.push(`${inner}element: '${def.element}',`);
  if (def.modifiers) lines.push(formatModifiersLiteral(def.modifiers, inner));
  lines.push(`${indent}},`);
  return lines.join('\n');
}

export function formatStatusEffectsLiteral(
  entries: readonly SkillStatusApplication[],
  indent: string,
  innerIndent: string,
): string {
  if (entries.length === 0) return `${indent}statusEffects: [],`;
  const lines = [`${indent}statusEffects: [`];
  for (const entry of entries) {
    lines.push(`${innerIndent}{`);
    lines.push(`${innerIndent}  statusId: '${entry.statusId}',`);
    lines.push(`${innerIndent}  chance: ${entry.chance},`);
    lines.push(`${innerIndent}  target: '${entry.target}',`);
    lines.push(`${innerIndent}  application: '${entry.application}',`);
    if (entry.applyMode) lines.push(`${innerIndent}  applyMode: '${entry.applyMode}',`);
    if (entry.duration != null) lines.push(`${innerIndent}  duration: ${Math.round(entry.duration)},`);
    if (entry.tickInterval != null) {
      lines.push(`${innerIndent}  tickInterval: ${Math.round(entry.tickInterval)},`);
    }
    if (entry.damagePerTick != null) lines.push(`${innerIndent}  damagePerTick: ${entry.damagePerTick},`);
    if (entry.healPerTick != null) lines.push(`${innerIndent}  healPerTick: ${entry.healPerTick},`);
    if (entry.shieldAmount != null) lines.push(`${innerIndent}  shieldAmount: ${entry.shieldAmount},`);
    if (entry.modifiers) lines.push(formatModifiersLiteral(entry.modifiers, `${innerIndent}  `));
    lines.push(`${innerIndent}},`);
  }
  lines.push(`${indent}],`);
  return lines.join('\n');
}

export function defaultStatusDraft(type: StatusType): Omit<StatusEffectDefinition, 'id' | 'name'> {
  const base = {
    type,
    duration: 5000,
    stackMode: 'refresh-duration' as const,
    maxStacks: 1,
  };
  const category = categoryForStatusType(type);
  if (category === 'damage-over-time') {
    return { ...base, tickInterval: 1000, damagePerTick: 8 };
  }
  if (category === 'heal-over-time') {
    return { ...base, tickInterval: 1000, healPerTick: 8 };
  }
  if (type === 'stun') return { ...base, duration: 2000 };
  if (type === 'shield') return { ...base, shieldAmount: 40 };
  if (type === 'slow') {
    return {
      ...base,
      modifiers: { movementSpeedMultiplier: 0.7, attackSpeedMultiplier: 0.7 },
    };
  }
  if (type === 'speed-up') {
    return {
      ...base,
      duration: 8000,
      modifiers: { movementSpeedMultiplier: 1.2, attackSpeedMultiplier: 1.2 },
    };
  }
  if (type === 'speed-down') {
    return {
      ...base,
      modifiers: { movementSpeedMultiplier: 0.8, attackSpeedMultiplier: 0.8 },
    };
  }
  if (type === 'attack-up') return { ...base, duration: 10000, modifiers: { attackMultiplier: 1.25 } };
  if (type === 'attack-down') return { ...base, modifiers: { attackMultiplier: 0.8 } };
  if (type === 'defense-up') return { ...base, duration: 8000, modifiers: { defenseMultiplier: 1.25 } };
  if (type === 'defense-down') return { ...base, modifiers: { defenseMultiplier: 0.5 } };
  if (type === 'crit-up') return { ...base, duration: 8000, modifiers: { criticalChanceMultiplier: 1.25 } };
  if (type === 'crit-down') return { ...base, modifiers: { criticalChanceMultiplier: 0.8 } };
  return base;
}
