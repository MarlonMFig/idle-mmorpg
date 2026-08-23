import type { CharacterSkillAnimDef } from '@/data/character-packs';
import {
  mergeStatusOverrides,
  parseSkillStatusEffects,
  resolveStatusApplyMode,
  type SkillStatusApplication,
  type StatusApplicationMoment,
} from '@/data/status-effect-def';
import { getStatusDefinition } from '@/data/status/registry';
import type { Enemy } from '@/entities/enemy';
import { PLAYER_STATUS_UNIT_ID } from '@/systems/combat-stats';
import { getStatusRuntime } from '@/systems/status-runtime';
import type { SkillDefinition } from '@/types/skill';
import type Phaser from 'phaser';

export function resolveSkillStatusEffects(
  anim: CharacterSkillAnimDef | undefined,
  skill: SkillDefinition,
): SkillStatusApplication[] {
  if (anim?.statusEffects) return anim.statusEffects;
  return skill.statusEffects ?? [];
}

export function tryApplySkillStatuses(opts: {
  scene: Phaser.Scene;
  skill: SkillDefinition;
  anim: CharacterSkillAnimDef | undefined;
  moment: StatusApplicationMoment;
  executionId: string;
  rolledKeys: Set<string>;
  casterId: string;
  primaryTargetId: string | null;
  hitTargets: Enemy[];
  hitIndex?: number;
}): void {
  const entries = resolveSkillStatusEffects(opts.anim, opts.skill);
  if (entries.length === 0) return;
  const runtime = getStatusRuntime(opts.scene);

  for (const entry of entries) {
    if (entry.application !== opts.moment) continue;
    const def = getStatusDefinition(entry.statusId);
    if (!def) continue;
    const applyMode = resolveStatusApplyMode(entry);
    const destinations = destinationsFor(entry, opts.casterId, opts.primaryTargetId, opts.hitTargets);

    for (const targetId of destinations) {
      const rollKey =
        applyMode === 'once-per-skill'
          ? `${entry.statusId}:${entry.application}:${targetId}`
          : `${entry.statusId}:${entry.application}:${targetId}:hit:${opts.hitIndex ?? 0}`;
      if (opts.rolledKeys.has(rollKey)) continue;
      opts.rolledKeys.add(rollKey);
      if (Math.random() >= entry.chance) continue;
      runtime.apply({
        def: mergeStatusOverrides(def, entry),
        sourceId: opts.casterId,
        targetId,
      });
    }
  }
}

function destinationsFor(
  entry: SkillStatusApplication,
  casterId: string,
  primaryTargetId: string | null,
  hitTargets: Enemy[],
): string[] {
  if (entry.target === 'self') return [casterId];
  if (hitTargets.length > 0) {
    return hitTargets.filter((enemy) => enemy.isAlive).map((enemy) => enemy.id);
  }
  if (primaryTargetId) return [primaryTargetId];
  return [];
}

export function parseStatusEffectsField(raw: unknown): SkillStatusApplication[] {
  return parseSkillStatusEffects(raw);
}
