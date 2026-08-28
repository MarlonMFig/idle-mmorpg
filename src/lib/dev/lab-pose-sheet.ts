import type { CharacterPack, CharacterSkillAnimDef, SpriteSheetDef } from '@/data/character-packs';
import { getSkill } from '@/data/skills';
import {
  legacyLoopFromMode,
  loopModeFromLegacy,
  type FrameLoopMode,
} from '@/lib/frame-loop';

export interface LabPoseSheet {
  key: string;
  url: string;
  frames?: string[];
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
  /** Ausente = derivado de `loop` (false→none, true→full). */
  loopMode?: FrameLoopMode;
  /** 1-based inclusive. Só usado em `range`. */
  loopStartFrame?: number;
  loopEndFrame?: number;
  loopDurationMs?: number;
  loopUntilSkillEnd?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export function emptyLabPoseSheet(): LabPoseSheet {
  return {
    key: '',
    url: '',
    frameWidth: 0,
    frameHeight: 0,
    frameCount: 1,
    frameRate: 12,
    loop: false,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

export function poseSheetsEqual(a: LabPoseSheet | null, b: LabPoseSheet | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const framesA = a.frames?.join('|') ?? '';
  const framesB = b.frames?.join('|') ?? '';
  return (
    a.key === b.key &&
    a.url === b.url &&
    framesA === framesB &&
    a.frameWidth === b.frameWidth &&
    a.frameHeight === b.frameHeight &&
    a.frameCount === b.frameCount &&
    a.frameRate === b.frameRate &&
    a.loop === b.loop &&
    loopModeFromLegacy(a.loop, a.loopMode) === loopModeFromLegacy(b.loop, b.loopMode) &&
    (a.loopStartFrame ?? 1) === (b.loopStartFrame ?? 1) &&
    (a.loopEndFrame ?? a.frameCount) === (b.loopEndFrame ?? b.frameCount) &&
    (a.loopDurationMs ?? 0) === (b.loopDurationMs ?? 0) &&
    Boolean(a.loopUntilSkillEnd) === Boolean(b.loopUntilSkillEnd) &&
    Boolean(a.flipX) === Boolean(b.flipX) &&
    Boolean(a.flipY) === Boolean(b.flipY) &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY
  );
}

export function cloneLabPoseSheet(sheet: LabPoseSheet | null): LabPoseSheet | null {
  if (!sheet) return null;
  return {
    ...sheet,
    frames: sheet.frames ? [...sheet.frames] : undefined,
  };
}

export function poseSheetFromAnim(anim: CharacterSkillAnimDef | SpriteSheetDef | undefined): LabPoseSheet | null {
  if (!anim?.url && !anim?.frames?.length) return null;
  const skill = anim as CharacterSkillAnimDef;
  return {
    key: anim.key,
    url: anim.url,
    frames: anim.frames ? [...anim.frames] : undefined,
    frameWidth: anim.frameWidth,
    frameHeight: anim.frameHeight,
    frameCount: anim.frames?.length || anim.frameCount,
    frameRate: anim.frameRate ?? 12,
    loop: anim.loop ?? skill.cast?.loop ?? false,
    loopMode: loopModeFromLegacy(anim.loop ?? skill.cast?.loop, skill.cast?.loopMode ?? anim.loopMode),
    loopStartFrame: skill.cast?.loopStartFrame ?? anim.loopStartFrame,
    loopEndFrame: skill.cast?.loopEndFrame ?? anim.loopEndFrame,
    loopDurationMs: skill.cast?.loopDurationMs ?? anim.loopDurationMs,
    loopUntilSkillEnd: Boolean(skill.cast?.loopUntilSkillEnd ?? anim.loopUntilSkillEnd),
    flipX: Boolean(skill.cast?.flipX ?? anim.flipX),
    flipY: Boolean(skill.cast?.flipY ?? anim.flipY),
    scaleX: skill.cast?.scaleX ?? skill.cast?.scale ?? 1,
    scaleY: skill.cast?.scaleY ?? skill.cast?.scale ?? 1,
    offsetX: anim.offsetX ?? skill.cast?.offsetX ?? 0,
    offsetY: anim.offsetY ?? skill.cast?.offsetY ?? 0,
  };
}

export function poseDurationMs(sheet: LabPoseSheet | null): number {
  if (!sheet) return 600;
  const fps = Math.max(1, sheet.frameRate);
  const count = Math.max(1, sheet.frames?.length || sheet.frameCount);
  return Math.round((count / fps) * 1000);
}

export function slugifySkillName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function suggestLabSkillId(characterId: string, name: string): string {
  const slug = slugifySkillName(name);
  if (!slug) return '';
  const prefix = characterId.replace(/-classic$/, '');
  if (slug.startsWith(`${prefix}-`) || slug === prefix) return slug;
  return `${prefix}-${slug}`;
}

export interface CharacterPoseOption {
  id: string;
  label: string;
  sheet: SpriteSheetDef;
}

export const PACK_BODY_POSE_OPTION_IDS = ['idle', 'walk', 'attack', 'combo1', 'combo2', 'combo3'] as const;

export function isPackBodyPoseOptionId(id: string): boolean {
  return (PACK_BODY_POSE_OPTION_IDS as readonly string[]).includes(id);
}

/** Poses corporais padrão não são convertidas em FX pelo Lab. */
export const POSE_CHECKBOX_EXCLUDED_IDS = ['idle', 'walk', 'attack', 'combo1', 'combo2', 'combo3'] as const;

export function isPoseCheckboxExcluded(id: string | null | undefined): boolean {
  return id != null && (POSE_CHECKBOX_EXCLUDED_IDS as readonly string[]).includes(id);
}

/** Só poses corporais usam `cast.animationId`; Pose Attack fica sem cast corporal. */
export function poseOptionIdToCastAnimationId(id: string | null | undefined): string | null {
  return id && isPackBodyPoseOptionId(id) ? id : null;
}

export function inferPoseOptionId(
  skillId: string | null | undefined,
  anim: CharacterSkillAnimDef | undefined,
): string | null {
  if (!anim || !labPoseHasContent(poseSheetFromAnim(anim))) return null;
  const castId = anim.cast?.animationId;
  if (castId && isPackBodyPoseOptionId(castId)) return castId;
  return skillId ? `skill:${skillId}` : null;
}

export function listCharacterPoseOptions(pack: CharacterPack): CharacterPoseOption[] {
  const options: CharacterPoseOption[] = [];
  const push = (id: string, label: string, sheet: SpriteSheetDef | undefined) => {
    if (!sheet) return;
    options.push({ id, label, sheet });
  };
  push('idle', 'Idle', pack.idle ?? pack.walk);
  push('walk', 'Walk', pack.walk);
  push('attack', 'Attack', pack.attack);
  (pack.attackChain ?? []).forEach((sheet, index) => {
    push(`combo${index + 1}`, `Combo ${index + 1}`, sheet);
  });
  for (const [skillId, anim] of Object.entries(pack.skillAnims)) {
    push(`skill:${skillId}`, getSkill(skillId)?.name ?? skillId, anim);
  }
  return options;
}

export function getCharacterPoseSheet(
  pack: CharacterPack,
  optionId: string | null | undefined,
): SpriteSheetDef | null {
  if (!optionId) return null;
  return listCharacterPoseOptions(pack).find((option) => option.id === optionId)?.sheet ?? null;
}

export function applyPoseSheetToAnim(
  base: CharacterSkillAnimDef,
  pose: LabPoseSheet | null,
): CharacterSkillAnimDef {
  if (!pose || (!pose.url && !pose.frames?.length)) return base;
  const durationMs = poseDurationMs(pose);
  const next: CharacterSkillAnimDef = {
    ...base,
    key: pose.key || base.key,
    url: pose.frames?.length ? pose.frames[0] : pose.url,
    frameWidth: pose.frameWidth || base.frameWidth,
    frameHeight: pose.frameHeight || base.frameHeight,
    frameCount: pose.frames?.length || pose.frameCount || base.frameCount,
    frameRate: pose.frameRate,
    loop: pose.loop,
    loopMode: pose.loopMode,
    loopStartFrame: pose.loopStartFrame,
    loopEndFrame: pose.loopEndFrame,
    loopDurationMs: pose.loopDurationMs,
    loopUntilSkillEnd: pose.loopUntilSkillEnd,
    offsetX: pose.offsetX,
    offsetY: pose.offsetY,
    durationMs,
    hitDelayMs: base.hitDelayMs || durationMs,
    cast: {
      ...(base.cast ?? {}),
      scaleX: pose.scaleX,
      scaleY: pose.scaleY,
      scale: pose.scaleY,
      offsetX: pose.offsetX,
      offsetY: pose.offsetY,
      loop: pose.loop,
      loopMode: pose.loopMode,
      loopStartFrame: pose.loopStartFrame,
      loopEndFrame: pose.loopEndFrame,
      loopDurationMs: pose.loopDurationMs,
      loopUntilSkillEnd: pose.loopUntilSkillEnd,
      flipX: pose.flipX,
      flipY: pose.flipY,
    },
  };
  if (pose.frames?.length) next.frames = [...pose.frames];
  else delete next.frames;
  return next;
}

export function poseSheetToSpriteDef(pose: LabPoseSheet): SpriteSheetDef {
  return {
    key: pose.key,
    url: pose.url || pose.frames?.[0] || '',
    frames: pose.frames,
    frameWidth: Math.max(1, pose.frameWidth),
    frameHeight: Math.max(1, pose.frameHeight),
    frameCount: pose.frames?.length || Math.max(1, pose.frameCount),
    frameRate: pose.frameRate,
    loop: pose.loop,
    loopMode: pose.loopMode,
    loopStartFrame: pose.loopStartFrame,
    loopEndFrame: pose.loopEndFrame,
    loopDurationMs: pose.loopDurationMs,
    loopUntilSkillEnd: pose.loopUntilSkillEnd,
    flipX: pose.flipX,
    flipY: pose.flipY,
    offsetX: pose.offsetX,
    offsetY: pose.offsetY,
  };
}

export function parseLabPoseSheet(raw: unknown): LabPoseSheet | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') throw new Error('pose inválida');
  const value = raw as Record<string, unknown>;
  const frames = Array.isArray(value.frames)
    ? value.frames.filter((entry): entry is string => typeof entry === 'string' && entry.startsWith('/sprites/'))
    : undefined;
  const url = typeof value.url === 'string' ? value.url : (frames?.[0] ?? '');
  if (!url && !frames?.length) return null;
  if (url && !url.startsWith('/sprites/')) throw new Error('Asset de pose deve estar em /sprites/');
  return {
    key: typeof value.key === 'string' && value.key.trim() ? value.key.trim() : 'pose',
    url,
    frames: frames && frames.length > 0 ? frames : undefined,
    frameWidth: Math.max(1, Number(value.frameWidth) || 0),
    frameHeight: Math.max(1, Number(value.frameHeight) || 0),
    frameCount: Math.max(1, Number(value.frameCount) || frames?.length || 1),
    frameRate: Math.max(1, Number(value.frameRate) || 12),
    loop: Boolean(value.loop),
    loopMode: loopModeFromLegacy(
      Boolean(value.loop),
      value.loopMode === 'none' ||
        value.loopMode === 'full' ||
        value.loopMode === 'range' ||
        value.loopMode === 'persistent-range'
        ? value.loopMode
        : undefined,
    ),
    loopStartFrame: Number.isFinite(Number(value.loopStartFrame)) ? Number(value.loopStartFrame) : undefined,
    loopEndFrame: Number.isFinite(Number(value.loopEndFrame)) ? Number(value.loopEndFrame) : undefined,
    loopDurationMs: Number.isFinite(Number(value.loopDurationMs)) ? Number(value.loopDurationMs) : undefined,
    loopUntilSkillEnd: Boolean(value.loopUntilSkillEnd),
    flipX: Boolean(value.flipX),
    flipY: Boolean(value.flipY),
    scaleX: Number.isFinite(Number(value.scaleX)) ? Number(value.scaleX) : 1,
    scaleY: Number.isFinite(Number(value.scaleY)) ? Number(value.scaleY) : 1,
    offsetX: Number.isFinite(Number(value.offsetX)) ? Number(value.offsetX) : 0,
    offsetY: Number.isFinite(Number(value.offsetY)) ? Number(value.offsetY) : 0,
  };
}

export function labPoseHasContent(pose: LabPoseSheet | null | undefined): boolean {
  if (!pose) return false;
  return Boolean(pose.url || (pose.frames && pose.frames.length > 0));
}

/** Pose corporal da Skill. `nenhuma` é válido: a Skill segue só com Cast Delay + Effect. */
export function skillAnimHasPose(anim: CharacterSkillAnimDef | undefined): boolean {
  if (!anim) return false;
  const id = anim.cast?.animationId?.trim().toLowerCase();
  if (id === 'nenhuma' || id === 'none') return false;
  return labPoseHasContent(poseSheetFromAnim(anim));
}

export function labDraftHasVisual(pose: LabPoseSheet | null | undefined, vfxId: string | null | undefined): boolean {
  return labPoseHasContent(pose) || Boolean(vfxId);
}
