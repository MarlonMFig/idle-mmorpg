import type { CharacterSkillAnimDef } from '@/data/character-packs';
import { skillAnimHasPose } from '@/lib/dev/lab-pose-sheet';

/** FPS → duração em milissegundos. Nunca tratar FPS como frameDuration. */
export function framesDurationMs(frameCount: number | undefined, fps: number | undefined): number {
  const count = Math.max(1, Math.round(frameCount ?? 1));
  const rate = Math.max(1, fps ?? 12);
  return Math.round((count / rate) * 1000);
}

export function skillPoseDurationMs(anim: CharacterSkillAnimDef | undefined): number {
  if (!anim || !skillAnimHasPose(anim)) return 0;
  const count = anim.frames?.length || anim.frameCount;
  return framesDurationMs(count, anim.frameRate);
}

export function skillEffectDurationMs(anim: CharacterSkillAnimDef | undefined): number {
  const fx = anim?.fx;
  if (!fx) return 0;
  return framesDurationMs(fx.frameCount, fx.frameRate);
}

/** Início do Effect na timeline da Skill (ms desde o start). */
export function skillEffectStartMs(anim: CharacterSkillAnimDef | undefined): number {
  if (!anim) return 0;
  if (anim.targeting?.mode) return Math.max(0, Math.round(anim.castDelayMs ?? 0));
  if (anim.fxReleaseMs != null) return Math.max(0, Math.round(anim.fxReleaseMs));
  const hit = Math.max(0, Math.round(anim.hitDelayMs ?? 0));
  return Math.max(0, hit - 80);
}

/**
 * Tempo em que o personagem permanece ocupado (action lock).
 * A duração visual da pose é o piso — `durationMs` só segura o último frame se for maior.
 * Cooldown da Skill não entra aqui.
 */
export function skillActionLockMs(anim: CharacterSkillAnimDef | undefined): number {
  if (!anim) return 1;
  const pose = skillPoseDurationMs(anim);
  const cast = Math.max(0, Math.round(anim.castDelayMs ?? 0));
  const hit = Math.max(0, Math.round(anim.hitDelayMs ?? 0));
  const authoredHold = Math.max(0, Math.round(anim.durationMs ?? 0));
  return Math.max(pose, cast, hit, authoredHold, 1);
}

export interface SkillVisualTimeline {
  poseFps: number;
  poseDurationMs: number;
  castDelayMs: number;
  effectStartMs: number;
  effectFps: number;
  effectDurationMs: number;
  effectEndMs: number;
  travelSpeed: number | null;
  executionEndMs: number;
}

export function skillVisualTimeline(anim: CharacterSkillAnimDef | undefined): SkillVisualTimeline {
  const poseDurationMs = skillPoseDurationMs(anim);
  const effectStartMs = skillEffectStartMs(anim);
  const effectDurationMs = skillEffectDurationMs(anim);
  const effectEndMs = effectStartMs + effectDurationMs;
  return {
    poseFps: Math.max(1, anim?.frameRate ?? 12),
    poseDurationMs,
    castDelayMs: Math.max(0, Math.round(anim?.castDelayMs ?? 0)),
    effectStartMs,
    effectFps: Math.max(1, anim?.fx?.frameRate ?? 12),
    effectDurationMs,
    effectEndMs,
    travelSpeed: anim?.targeting?.travelSpeed ?? null,
    executionEndMs: skillActionLockMs(anim),
  };
}
