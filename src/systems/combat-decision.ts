/**
 * Combat Decision Engine — escolha automática de Slot vs ataque básico.
 *
 * Cadência: o CombatSystem só chama isto quando o ciclo idle já permite
 * agir (`isBusy`, stun, `lastActionAt`, gap entre jutsus). Não cria timers.
 *
 * Rotação: busca circular a partir de `nextSkillSlot` (memória no CombatSystem).
 * aiPriority não fura a fila. autoUse off / vazio / cooldown / condição falsa
 * são pulados. Falta de Energia NÃO pula: Skill fica pendente → Basic Attack.
 * Basic Attack não avança o cursor. Kill/respawn não resetam; Hunt nova ou
 * troca de personagem resetam para Slot 1.
 *
 * Cooldown da Skill começa no *início* do cast (comportamento atual).
 * Gap entre Skills: `PLAYER_JUTSU_GAP_MS` (não é balanceamento novo).
 *
 * Energia (Item 41): `energyCost` via resolveSkillAi. `energy: null` = infinito
 * (DEV). Caso contrário exige currentEnergy >= cost.
 */

import {
  resolveSkillAi,
  type SkillAiCondition,
  type SkillAiConfig,
} from '@/data/skill-ai-def';
import type { SkillDefinition } from '@/types/skill';

export type CombatAiSlot = 1 | 2 | 3 | 4;

export type CombatAiAction =
  | { kind: 'wait' }
  | { kind: 'basic-attack' }
  | { kind: 'skill'; slot: CombatAiSlot; skillId: string };

export interface CombatAiReject {
  slot: CombatAiSlot;
  skillId: string | null;
  reason: string;
}

export interface CombatAiSlotStatus {
  slot: CombatAiSlot;
  status: string;
}

export interface CombatSkillRotationDebug {
  nextSlot: CombatAiSlot;
  lastUsedSlot: CombatAiSlot | null;
  slots: CombatAiSlotStatus[];
  decision: string;
}

export interface CombatAiDecision {
  action: CombatAiAction;
  rejects: CombatAiReject[];
  warnings: string[];
  /** Cursor no início desta avaliação (não avança em Basic Attack). */
  nextSkillSlot: CombatAiSlot;
  slotStatuses: CombatAiSlotStatus[];
}

export function nextSkillSlotAfter(slot: CombatAiSlot): CombatAiSlot {
  return (slot === 4 ? 1 : ((slot + 1) as CombatAiSlot));
}

/** Ordem circular a partir do cursor: ex. 3 → 3,4,1,2. */
export function skillRotationOrder(start: CombatAiSlot): CombatAiSlot[] {
  const order: CombatAiSlot[] = [];
  let slot = start;
  for (let i = 0; i < 4; i += 1) {
    order.push(slot);
    slot = nextSkillSlotAfter(slot);
  }
  return order;
}

export interface SkillRotationCursor {
  nextSlot: CombatAiSlot;
  lastUsedSlot: CombatAiSlot | null;
  lastUsedAt: Record<CombatAiSlot, number>;
}

export function createSkillRotationCursor(start: CombatAiSlot = 1): SkillRotationCursor {
  return {
    nextSlot: start,
    lastUsedSlot: null,
    lastUsedAt: { 1: 0, 2: 0, 3: 0, 4: 0 },
  };
}

/** Avança o cursor para o slot seguinte ao que foi executado. Basic Attack não chama isto. */
export function noteSkillRotationUsed(
  cursor: SkillRotationCursor,
  slot: CombatAiSlot,
  now: number,
): void {
  cursor.lastUsedSlot = slot;
  cursor.lastUsedAt[slot] = now;
  cursor.nextSlot = nextSkillSlotAfter(slot);
}

export interface CombatAiSlotInput {
  slot: CombatAiSlot;
  skillId: string | null;
  skill: SkillDefinition | null;
  animAi?: SkillAiConfig;
}

export interface CombatAiContext {
  now: number;
  stunned: boolean;
  actionBlocked: boolean;
  skillGapBlocked: boolean;
  selfHpRatio: number;
  targetHpRatio: number | null;
  /**
   * Energia atual. `null` = custo ignorado (Energia Infinita DEV).
   */
  energy: number | null;
  /** @deprecated Item 41 — use `energy`. */
  chakra?: number | null;
  /**
   * Reserva para Silence futuro: bloqueia Skills, mantém Basic Attack.
   * Não ligar a status até existir Silence no catálogo.
   */
  skillsSilenced?: boolean;
  isSkillReady: (skillId: string) => boolean;
  getCooldownRemainingMs?: (skillId: string) => number;
  hasStatus: (target: 'self' | 'target', statusId: string) => boolean;
  slots: CombatAiSlotInput[];
  /**
   * Próximo slot da rotação (1–4). A busca é circular a partir daqui.
   * Ausente = Slot 1. Basic Attack não altera o cursor no CombatSystem.
   */
  nextSkillSlot?: CombatAiSlot;
}

function resolveContextEnergy(context: CombatAiContext): number | null {
  if (context.energy !== undefined) return context.energy;
  if (context.chakra !== undefined) return context.chakra ?? null;
  return null;
}

export function decideNextAction(context: CombatAiContext): CombatAiDecision {
  const rejects: CombatAiReject[] = [];
  const warnings: string[] = [];
  const nextSkillSlot = context.nextSkillSlot ?? 1;
  const ordered = orderedSlots(context.slots, nextSkillSlot);
  const energy = resolveContextEnergy(context);

  const finish = (action: CombatAiAction): CombatAiDecision => ({
    action,
    rejects,
    warnings,
    nextSkillSlot,
    slotStatuses: availabilityStatuses(context, energy),
  });

  if (context.stunned) {
    return finish({ kind: 'wait' });
  }
  if (context.actionBlocked) {
    return finish({ kind: 'wait' });
  }

  if (context.skillsSilenced) {
    for (const entry of ordered) {
      rejects.push({
        slot: entry.slot,
        skillId: entry.skillId,
        reason: entry.skillId ? 'silence' : 'empty',
      });
    }
    return finish({ kind: 'basic-attack' });
  }

  if (!context.skillGapBlocked) {
    for (const entry of ordered) {
      const verdict = evaluateSlot(entry, context, warnings, energy);
      if (verdict.ok) {
        return {
          action: { kind: 'skill', slot: entry.slot, skillId: entry.skillId as string },
          rejects,
          warnings,
          nextSkillSlot,
          slotStatuses: availabilityStatuses(context, energy),
        };
      }
      rejects.push({ slot: entry.slot, skillId: entry.skillId, reason: verdict.reason });
      // Item 41: falta de Energia NÃO avança a rotação — Skill fica pendente.
      if (verdict.reason === 'energy') {
        return finish({ kind: 'basic-attack' });
      }
    }
  } else {
    for (const entry of ordered) {
      if (!entry.skillId) {
        rejects.push({ slot: entry.slot, skillId: null, reason: 'empty' });
        continue;
      }
      rejects.push({ slot: entry.slot, skillId: entry.skillId, reason: 'global gap' });
    }
  }

  return finish({ kind: 'basic-attack' });
}

function orderedSlots(slots: CombatAiSlotInput[], start: CombatAiSlot): CombatAiSlotInput[] {
  const bySlot = new Map<CombatAiSlot, CombatAiSlotInput>();
  for (const entry of slots) bySlot.set(entry.slot, entry);
  return skillRotationOrder(start).map(
    (slot) => bySlot.get(slot) ?? { slot, skillId: null, skill: null },
  );
}

function availabilityStatuses(
  context: CombatAiContext,
  energy: number | null,
): CombatAiSlotStatus[] {
  const bySlot = new Map<CombatAiSlot, CombatAiSlotInput>();
  for (const entry of context.slots) bySlot.set(entry.slot, entry);
  const ignoreWarnings: string[] = [];
  return ([1, 2, 3, 4] as CombatAiSlot[]).map((slot) => {
    const entry = bySlot.get(slot) ?? { slot, skillId: null, skill: null };
    if (context.skillsSilenced && entry.skillId) {
      return { slot, status: 'SILENCE' };
    }
    if (context.skillGapBlocked && entry.skillId) {
      return { slot, status: 'GLOBAL GAP' };
    }
    const verdict = evaluateSlot(entry, context, ignoreWarnings, energy);
    if (verdict.ok) return { slot, status: 'READY' };
    if (verdict.reason === 'cooldown') {
      const ms = entry.skillId ? context.getCooldownRemainingMs?.(entry.skillId) ?? 0 : 0;
      return { slot, status: ms > 0 ? `COOLDOWN ${(ms / 1000).toFixed(1)}s` : 'COOLDOWN' };
    }
    if (verdict.reason === 'empty') return { slot, status: 'EMPTY' };
    if (verdict.reason === 'autoUse OFF') return { slot, status: 'AUTO USE OFF' };
    if (verdict.reason === 'energy') return { slot, status: 'ENERGY' };
    return { slot, status: verdict.reason };
  });
}

function evaluateSlot(
  entry: CombatAiSlotInput,
  context: CombatAiContext,
  warnings: string[],
  energy: number | null,
): { ok: true } | { ok: false; reason: string } {
  if (!entry.skillId) return { ok: false, reason: 'empty' };
  if (!entry.skill) {
    warnings.push(`unknown skill: ${entry.skillId}`);
    return { ok: false, reason: 'invalid skill' };
  }

  const ai = resolveSkillAi(entry.animAi, entry.skill.ai, entry.slot);
  if (!ai.autoUse) return { ok: false, reason: 'autoUse OFF' };
  if (!context.isSkillReady(entry.skillId)) return { ok: false, reason: 'cooldown' };
  if (entry.skill.cooldownMs <= 0) {
    warnings.push(`slot ${entry.slot} cooldown=0 — pode dominar a rotação`);
  }
  if (ai.energyCost > 0 && energy != null && energy < ai.energyCost) {
    return { ok: false, reason: 'energy' };
  }

  if (entry.skill.effect === 'heal' && !hasHpCondition(ai.conditions) && context.selfHpRatio >= 1) {
    return { ok: false, reason: 'heal not needed' };
  }

  for (const condition of ai.conditions) {
    const cond = evaluateCondition(condition, context);
    if (!cond.ok) return { ok: false, reason: cond.reason };
  }

  return { ok: true };
}

function hasHpCondition(conditions: SkillAiCondition[]): boolean {
  return conditions.some(
    (row) => row.type === 'self-hp-below' || row.type === 'target-hp-below' || row.type === 'target-hp-above',
  );
}

function evaluateCondition(
  condition: SkillAiCondition,
  context: CombatAiContext,
): { ok: true } | { ok: false; reason: string } {
  switch (condition.type) {
    case 'always':
      return { ok: true };
    case 'self-hp-below': {
      const threshold = condition.value ?? 1;
      if (context.selfHpRatio <= threshold) return { ok: true };
      return { ok: false, reason: `self HP ${(context.selfHpRatio * 100).toFixed(0)}% > ${threshold * 100}%` };
    }
    case 'target-hp-below': {
      const threshold = condition.value ?? 1;
      if (context.targetHpRatio == null) return { ok: false, reason: 'no target' };
      if (context.targetHpRatio <= threshold) return { ok: true };
      return { ok: false, reason: `enemy HP ${(context.targetHpRatio * 100).toFixed(0)}% > ${threshold * 100}%` };
    }
    case 'target-hp-above': {
      const threshold = condition.value ?? 0;
      if (context.targetHpRatio == null) return { ok: false, reason: 'no target' };
      if (context.targetHpRatio >= threshold) return { ok: true };
      return { ok: false, reason: `enemy HP ${(context.targetHpRatio * 100).toFixed(0)}% < ${threshold * 100}%` };
    }
    case 'status-present': {
      if (!condition.statusId) return { ok: false, reason: 'status-present sem statusId' };
      const who = condition.target ?? 'target';
      if (context.hasStatus(who, condition.statusId)) return { ok: true };
      return { ok: false, reason: `status ${condition.statusId} absent` };
    }
    case 'status-absent': {
      if (!condition.statusId) return { ok: false, reason: 'status-absent sem statusId' };
      const who = condition.target ?? 'self';
      if (context.hasStatus(who, condition.statusId)) {
        return { ok: false, reason: `status ${condition.statusId} present` };
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: `unknown condition` };
  }
}

export function formatCombatAiDecision(decision: CombatAiDecision): string[] {
  const lines = [
    '[AI] evaluating actions',
    `[AI] rotation next Slot ${decision.nextSkillSlot} order ${skillRotationOrder(decision.nextSkillSlot).join(' → ')}`,
  ];
  for (const row of decision.slotStatuses) {
    lines.push(`[AI] Slot ${row.slot} ${row.status}`);
  }
  for (const row of decision.rejects) {
    const name = row.skillId ?? 'empty';
    lines.push(`[AI] Slot ${row.slot} skipped: ${row.reason}${row.skillId ? ` (${name})` : ''}`);
  }
  if (decision.action.kind === 'skill') {
    lines.push(`[AI] Slot ${decision.action.slot} selected (${decision.action.skillId})`);
  } else if (decision.action.kind === 'basic-attack') {
    lines.push('[AI] Basic Attack selected');
  } else {
    lines.push('[AI] wait');
  }
  for (const warning of decision.warnings) lines.push(`[AI] ${warning}`);
  return lines;
}
