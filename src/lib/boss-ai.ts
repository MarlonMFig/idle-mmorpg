import {
  createSkillRotationCursor,
  decideNextAction,
  noteSkillRotationUsed,
  type CombatAiSlot,
  type CombatAiSlotInput,
  type SkillRotationCursor,
} from '@/systems/combat-decision';
import { getSkill } from '@/data/skills';

export interface BossAiState {
  cursor: SkillRotationCursor;
  readyAt: Record<string, number>;
  lastSkillAt: number;
}

export function createBossAiState(): BossAiState {
  return {
    cursor: createSkillRotationCursor(1),
    readyAt: {},
    lastSkillAt: 0,
  };
}

export function bossSkillSlots(skillIds: readonly string[]): CombatAiSlotInput[] {
  const slots: CombatAiSlotInput[] = [];
  for (let i = 0; i < 4; i += 1) {
    const slot = (i + 1) as CombatAiSlot;
    const skillId = skillIds[i] ?? null;
    const skill = skillId ? getSkill(skillId) ?? null : null;
    slots.push({ slot, skillId, skill, animAi: undefined });
  }
  return slots;
}

export function decideBossAction(input: {
  now: number;
  state: BossAiState;
  skillIds: readonly string[];
  stunned: boolean;
  skillGapMs: number;
  selfHpRatio: number;
  targetHpRatio: number | null;
}): ReturnType<typeof decideNextAction> {
  const { now, state, skillIds } = input;
  const decision = decideNextAction({
    now,
    stunned: input.stunned,
    actionBlocked: false,
    skillGapBlocked: now - state.lastSkillAt < input.skillGapMs,
    selfHpRatio: input.selfHpRatio,
    targetHpRatio: input.targetHpRatio,
    energy: null,
    isSkillReady: (skillId) => (state.readyAt[skillId] ?? 0) <= now,
    getCooldownRemainingMs: (skillId) => Math.max(0, (state.readyAt[skillId] ?? 0) - now),
    hasStatus: () => false,
    slots: bossSkillSlots(skillIds),
    nextSkillSlot: state.cursor.nextSlot,
  });
  if (decision.action.kind === 'skill') {
    noteSkillRotationUsed(state.cursor, decision.action.slot, now);
    const skill = getSkill(decision.action.skillId);
    state.readyAt[decision.action.skillId] = now + (skill?.cooldownMs ?? 4000);
    state.lastSkillAt = now;
  }
  return decision;
}
