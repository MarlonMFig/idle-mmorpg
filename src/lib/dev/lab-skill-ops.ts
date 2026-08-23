import type { CharacterPack, CharacterSkillAnimDef, SkillVfxTargetMode } from '@/data/character-packs';
import type { SkillDefinition } from '@/types/skill';
import {
  applyPoseSheetToAnim,
  poseDurationMs,
  type LabPoseSheet,
} from '@/lib/dev/lab-pose-sheet';
import type { LabSaveChanges } from '@/lib/dev/lab-save-fields';
import { applyLabChangesToSkillAnim } from '@/lib/dev/lab-save-fields';

export type { CharacterSkillAnimDef } from '@/data/character-packs';

export const LAB_SKILL_ID_RE = /^[a-z][a-z0-9-]{1,62}$/;

export function normalizeLabSkillId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertLabSkillId(id: string): string {
  const normalized = normalizeLabSkillId(id);
  if (!LAB_SKILL_ID_RE.test(normalized)) {
    throw new Error('ID inválido. Use kebab-case, ex.: genkidama');
  }
  return normalized;
}

export function buildVisualSkillDefinition(id: string, name: string): SkillDefinition {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nome obrigatório');
  return {
    id: assertLabSkillId(id),
    name: trimmed,
    element: 'neutral',
    cooldownMs: 1000,
    damage: 0,
    icon: '/sprites/skills/neutral.svg',
    animation: { kind: 'character', durationMs: 600, scale: 1 },
    range: 80,
    description: 'Skill de teste visual (DEV Lab).',
    developmentStatus: 'visual-test',
  };
}

/** Folha mínima para `playSkillAnim` — não copia VFX/pose/targeting do doador. */
export function stubSkillAnimFromPack(pack: CharacterPack): CharacterSkillAnimDef {
  const donor =
    Object.values(pack.skillAnims)[0] ??
    ({
      ...pack.attack,
      durationMs: 600,
      hitDelayMs: 280,
    } satisfies CharacterSkillAnimDef);
  return {
    key: donor.key,
    url: donor.url,
    frameWidth: donor.frameWidth,
    frameHeight: donor.frameHeight,
    frameCount: donor.frameCount,
    contentHeight: donor.contentHeight,
    frameRate: donor.frameRate,
    originX: donor.originX,
    originY: donor.originY,
    offsetX: donor.offsetX,
    offsetY: donor.offsetY,
    durationMs: 'durationMs' in donor && typeof donor.durationMs === 'number' ? donor.durationMs : 600,
    hitDelayMs: 'hitDelayMs' in donor && typeof donor.hitDelayMs === 'number' ? donor.hitDelayMs : 280,
  };
}

export function fallbackSkillAnimStub(): CharacterSkillAnimDef {
  return {
    key: 'lab-pose',
    url: '',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 1,
    durationMs: 600,
    hitDelayMs: 280,
  };
}

export function buildLabVisualSkillAnim(input: {
  pack?: CharacterPack;
  existing?: CharacterSkillAnimDef;
  pose: LabPoseSheet | null;
  changes: LabSaveChanges;
  vfxId: string | null;
  targetMode: SkillVfxTargetMode;
  travelSpeed: number;
  vfxScale: number;
  vfxOffsetX: number;
  vfxOffsetY: number;
  spawnOffsetX: number;
  spawnOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  castDelayMs: number;
}): CharacterSkillAnimDef {
  const posed = applyPoseSheetToAnim(
    input.existing ?? (input.pack ? stubSkillAnimFromPack(input.pack) : fallbackSkillAnimStub()),
    input.pose,
  );
  const durationMs = input.pose ? poseDurationMs(input.pose) : posed.durationMs;
  return applyLabChangesToSkillAnim(
    {
      ...posed,
      durationMs,
      hitDelayMs: posed.hitDelayMs || durationMs,
    },
    {
      ...input.changes,
      vfxId: input.vfxId,
      targetMode: input.targetMode,
      travelSpeed: input.travelSpeed,
      vfxScale: input.vfxScale,
      vfxOffsetX: input.vfxOffsetX,
      vfxOffsetY: input.vfxOffsetY,
      spawnOffsetX: input.spawnOffsetX,
      spawnOffsetY: input.spawnOffsetY,
      targetOffsetX: input.targetOffsetX,
      targetOffsetY: input.targetOffsetY,
      castDelayMs: input.castDelayMs,
    },
  );
}
