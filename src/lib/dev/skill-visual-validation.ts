import { isDevMode } from '@/config/devConfig';
import type { CharacterPack } from '@/data/character-packs';
import { getVfxDefinition } from '@/data/vfx/registry';
import { getSkill } from '@/data/skills';
import { skillAnimHasPose } from '@/lib/dev/lab-pose-sheet';
import { officialSkillSlots } from '@/lib/dev/lab-skill-slots';

const warned = new Set<string>();

function logOnce(key: string, detail: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[SkillValidation] ${detail}`);
}

/** Avisos DEV — não quebra a Hunt. */
export function warnSkillVisualIssues(pack: CharacterPack, skillId: string | null | undefined): void {
  if (!isDevMode() || !skillId) return;
  const skill = getSkill(skillId);
  if (!skill) {
    logOnce(`${pack.id}:${skillId}:missing`, `slot referencia Skill inexistente: ${skillId}`);
    return;
  }
  const anim = pack.skillAnims[skillId];
  if (!anim) {
    logOnce(`${pack.id}:${skillId}:no-anim`, `${skillId} has no pose/effect.`);
    return;
  }
  const hasPose = skillAnimHasPose(anim);
  const hasEffect = Boolean(anim.vfxId || anim.fx);
  if (!hasPose && !hasEffect) {
    logOnce(`${pack.id}:${skillId}:empty`, `${skillId} has no pose/effect.`);
  }
  if (anim.vfxId && !getVfxDefinition(anim.vfxId)) {
    logOnce(`${pack.id}:${skillId}:vfx`, `VFX ID not found: ${anim.vfxId}`);
  }
  if (anim.targeting?.mode === 'travel-to-target' && !(anim.targeting.travelSpeed && anim.targeting.travelSpeed > 0)) {
    logOnce(`${pack.id}:${skillId}:speed`, `Travel to Target sem Travel Speed (${skillId})`);
  }
  if (anim.cast?.animationId) {
    const known = Object.values(pack.skillAnims).some((entry) => entry.key === anim.cast?.animationId);
    if (!known && anim.cast.animationId !== anim.key) {
      logOnce(`${pack.id}:${skillId}:pose`, `poseAnimationId não encontrado: ${anim.cast.animationId}`);
    }
  }
  const exec = anim.execution ?? skill.execution;
  const type = exec?.type ?? 'single-hit';
  if (type === 'multi-hit') {
    const hits = exec?.hits ?? [];
    if (hits.some((hit) => hit.delay < 0)) {
      logOnce(`${pack.id}:${skillId}:hits`, `Multi-hit com delay < 0 (${skillId})`);
    }
  }
  if (type === 'beam') {
    if (!(exec?.beamDuration && exec.beamDuration > 0) || !(exec.tickInterval && exec.tickInterval > 0)) {
      logOnce(`${pack.id}:${skillId}:beam`, `Beam exige beamDuration > 0 e tickInterval > 0 (${skillId})`);
    }
  }
  if (type === 'persistent' && exec?.tickInterval != null) {
    if (!(exec.duration && exec.duration > 0) || exec.tickInterval <= 0) {
      logOnce(`${pack.id}:${skillId}:persistent`, `Persistent exige duration > 0 e tickInterval > 0 (${skillId})`);
    }
  }
}

export function warnHotbarSlotIssues(pack: CharacterPack): void {
  if (!isDevMode()) return;
  const slots = officialSkillSlots(pack);
  for (const slot of [1, 2, 3, 4] as const) {
    const id = slots[slot];
    if (!id) continue;
    if (!getSkill(id)) logOnce(`${pack.id}:slot${slot}`, `slot referencia Skill inexistente: ${id}`);
  }
}
