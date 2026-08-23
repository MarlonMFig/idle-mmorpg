import { COMBAT_ENERGY } from '@/constants/combat-energy';

/**
 * Configuração de IA por Skill/slot do personagem.
 * Não é regra por characterId. Ausente = legado (autoUse on, prioridade = índice do slot).
 */

export const SKILL_AI_PRIORITIES = [1, 2, 3, 4] as const;
export type SkillAiPriority = (typeof SKILL_AI_PRIORITIES)[number];

export const SKILL_AI_CONDITION_TYPES = [
  'always',
  'self-hp-below',
  'target-hp-below',
  'target-hp-above',
  'status-present',
  'status-absent',
] as const;
export type SkillAiConditionType = (typeof SKILL_AI_CONDITION_TYPES)[number];

export const SKILL_AI_CONDITION_LABELS: Record<SkillAiConditionType, string> = {
  always: 'Always',
  'self-hp-below': 'Self HP ≤',
  'target-hp-below': 'Enemy HP ≤',
  'target-hp-above': 'Enemy HP ≥',
  'status-present': 'Status presente',
  'status-absent': 'Status ausente',
};

export interface SkillAiCondition {
  type: SkillAiConditionType;
  /** Fração 0–1 para HP. */
  value?: number;
  /** ID de StatusDefinition. */
  statusId?: string;
  /**
   * Quem checar para status-present / status-absent.
   * Default: present → target, absent → self.
   */
  target?: 'self' | 'target';
}

export interface SkillAiConfig {
  /** Default true. false = IA ignora; Lab/manual ainda podem usar. */
  autoUse?: boolean;
  /** 1 = maior prioridade. Ausente = número do slot atual. */
  priority?: number;
  /** AND. Ausente / vazio = always. */
  conditions?: SkillAiCondition[];
  /**
   * Custo de Energia (Item 41). Ausente → DEFAULT_SKILL_ENERGY_COST.
   * `0` explícito = grátis.
   */
  energyCost?: number;
  /**
   * @deprecated Item 41 — use `energyCost`. Ainda lido como fallback.
   */
  chakraCost?: number;
}

export function isSkillAiConditionType(value: unknown): value is SkillAiConditionType {
  return typeof value === 'string' && (SKILL_AI_CONDITION_TYPES as readonly string[]).includes(value);
}

export function defaultSkillAi(slot: number): Required<Pick<SkillAiConfig, 'autoUse' | 'priority'>> & SkillAiConfig {
  const n = Math.min(4, Math.max(1, Math.round(slot)));
  return { autoUse: true, priority: n, conditions: [] };
}

export function resolveSkillEnergyCost(ai: SkillAiConfig | undefined): number {
  if (!ai) return COMBAT_ENERGY.defaultSkillEnergyCost;
  if (ai.energyCost != null && Number.isFinite(ai.energyCost)) {
    return Math.max(0, Math.floor(ai.energyCost));
  }
  if (ai.chakraCost != null && Number.isFinite(ai.chakraCost)) {
    return Math.max(0, Math.floor(ai.chakraCost));
  }
  return COMBAT_ENERGY.defaultSkillEnergyCost;
}

export function cloneSkillAi(ai: SkillAiConfig | undefined): SkillAiConfig | undefined {
  if (!ai) return undefined;
  return {
    autoUse: ai.autoUse,
    priority: ai.priority,
    energyCost: ai.energyCost,
    chakraCost: ai.chakraCost,
    conditions: (ai.conditions ?? []).map((row) => ({ ...row })),
  };
}

export function skillAiEqual(a: SkillAiConfig | undefined, b: SkillAiConfig | undefined): boolean {
  return JSON.stringify(normalizeSkillAi(a, 1)) === JSON.stringify(normalizeSkillAi(b, 1));
}

export function resolveSkillAi(
  overlay: SkillAiConfig | undefined,
  catalog: SkillAiConfig | undefined,
  slot: number,
): {
  autoUse: boolean;
  priority: number;
  conditions: SkillAiCondition[];
  energyCost: number;
  /** @deprecated alias de energyCost */
  chakraCost: number;
} {
  const merged: SkillAiConfig = { ...catalog, ...overlay };
  if (overlay?.conditions) merged.conditions = overlay.conditions;
  const fallback = defaultSkillAi(slot);
  const priority = Number.isFinite(merged.priority) ? Math.max(1, Math.round(merged.priority as number)) : fallback.priority;
  const energyCost = resolveSkillEnergyCost(merged);
  return {
    autoUse: merged.autoUse !== false,
    priority,
    conditions: (merged.conditions ?? []).filter((row) => isSkillAiConditionType(row.type)),
    energyCost,
    chakraCost: energyCost,
  };
}

export function normalizeSkillAi(ai: SkillAiConfig | undefined, slot: number): ReturnType<typeof resolveSkillAi> {
  return resolveSkillAi(ai, undefined, slot);
}

export function parseSkillAi(raw: unknown): SkillAiConfig | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw !== 'object') throw new Error('ai inválido');
  const value = raw as Record<string, unknown>;
  const allowed = new Set(['autoUse', 'priority', 'conditions', 'energyCost', 'chakraCost']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo de IA não permitido: ${key}`);
  }
  const next: SkillAiConfig = {};
  if (value.autoUse != null) {
    if (typeof value.autoUse !== 'boolean') throw new Error('autoUse deve ser boolean');
    next.autoUse = value.autoUse;
  }
  if (value.priority != null) {
    const n = Number(value.priority);
    if (!Number.isFinite(n) || n < 1) throw new Error('priority inválida');
    next.priority = Math.round(n);
  }
  if (value.energyCost != null) {
    const n = Number(value.energyCost);
    if (!Number.isFinite(n) || n < 0) throw new Error('energyCost inválido');
    next.energyCost = n;
  }
  if (value.chakraCost != null) {
    const n = Number(value.chakraCost);
    if (!Number.isFinite(n) || n < 0) throw new Error('chakraCost inválido');
    next.chakraCost = n;
  }
  if (value.conditions != null) {
    if (!Array.isArray(value.conditions)) throw new Error('conditions deve ser um array');
    next.conditions = value.conditions.map((entry) => parseSkillAiCondition(entry));
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function parseSkillAiCondition(raw: unknown): SkillAiCondition {
  if (raw == null || typeof raw !== 'object') throw new Error('condition inválida');
  const value = raw as Record<string, unknown>;
  if (!isSkillAiConditionType(value.type)) throw new Error(`unknown AI condition: ${String(value.type)}`);
  const next: SkillAiCondition = { type: value.type };
  if (value.value != null) {
    const n = Number(value.value);
    if (!Number.isFinite(n)) throw new Error('condition.value inválido');
    next.value = Math.min(1, Math.max(0, n));
  }
  if (value.statusId != null) {
    if (typeof value.statusId !== 'string' || !value.statusId.trim()) throw new Error('condition.statusId inválido');
    next.statusId = value.statusId.trim();
  }
  if (value.target != null) {
    if (value.target !== 'self' && value.target !== 'target') throw new Error('condition.target inválido');
    next.target = value.target;
  }
  return next;
}

export function formatSkillAiLiteral(ai: SkillAiConfig, indent: string): string {
  const inner = `${indent}  `;
  const lines = [`${indent}ai: {`];
  if (ai.autoUse != null) lines.push(`${inner}autoUse: ${ai.autoUse},`);
  if (ai.priority != null) lines.push(`${inner}priority: ${Math.round(ai.priority)},`);
  if (ai.energyCost != null) lines.push(`${inner}energyCost: ${ai.energyCost},`);
  else if (ai.chakraCost != null && ai.chakraCost > 0) lines.push(`${inner}energyCost: ${ai.chakraCost},`);
  if (ai.conditions && ai.conditions.length > 0) {
    lines.push(`${inner}conditions: [`);
    for (const row of ai.conditions) {
      const parts = [`type: '${row.type}'`];
      if (row.value != null) parts.push(`value: ${row.value}`);
      if (row.statusId) parts.push(`statusId: '${row.statusId}'`);
      if (row.target) parts.push(`target: '${row.target}'`);
      lines.push(`${inner}  { ${parts.join(', ')} },`);
    }
    lines.push(`${inner}],`);
  }
  lines.push(`${indent}},`);
  return lines.join('\n');
}
