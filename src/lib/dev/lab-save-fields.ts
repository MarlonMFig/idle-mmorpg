import type { CharacterSkillAnimDef, SkillVfxTargetMode } from '@/data/character-packs';
import { SKILL_VFX_TARGET_MODES } from '@/data/skill-vfx-targeting';
import { cloneExecutionDef, executionsEqual, parseSkillExecution, resolveExecutionType, SKILL_EXECUTION_TYPE_LABELS, type SkillExecutionDef } from '@/data/skill-execution-def';
import {
  cloneSkillAi,
  defaultSkillAi,
  parseSkillAi,
  resolveSkillAi,
  skillAiEqual,
  type SkillAiConfig,
} from '@/data/skill-ai-def';
import {
  cloneSkillStatusEffects,
  parseSkillStatusEffects,
  statusEffectsEqual,
  type SkillStatusApplication,
} from '@/data/status-effect-def';
import {
  DAMAGE_ELEMENT_LABELS,
  resolveSkillElement,
  type DamageElement,
} from '@/data/damage-elements';
import {
  cloneLabPoseSheet,
  poseSheetFromAnim,
  poseSheetsEqual,
  type LabPoseSheet,
} from '@/lib/dev/lab-pose-sheet';
import {
  normalizeSpriteAlignment,
  type SpriteAlignmentConfig,
} from '@/lib/sprite-alignment';

export const LAB_SAVEABLE_NUMBER_FIELDS = [
  'scaleX',
  'scaleY',
  'offsetX',
  'offsetY',
  'vfxScale',
  'vfxOffsetX',
  'vfxOffsetY',
  'frameRate',
  'hitDelayMs',
  'fxReleaseMs',
  'travelSpeed',
  'spawnOffsetX',
  'spawnOffsetY',
  'targetOffsetX',
  'targetOffsetY',
  'poseScale',
  'poseOffsetX',
  'poseOffsetY',
  'castDelayMs',
] as const;

export const LAB_SAVEABLE_STRING_FIELDS = ['targetMode', 'vfxId', 'poseVfxId', 'castAnimationId', 'element'] as const;

export const LAB_SAVEABLE_FIELDS = [...LAB_SAVEABLE_NUMBER_FIELDS, ...LAB_SAVEABLE_STRING_FIELDS, 'execution', 'statusEffects', 'ai'] as const;

export type LabSaveableNumberField = (typeof LAB_SAVEABLE_NUMBER_FIELDS)[number];
export type LabSaveableField = (typeof LAB_SAVEABLE_FIELDS)[number];

export type LabSaveChanges = Partial<Record<LabSaveableNumberField, number>> & {
  targetMode?: SkillVfxTargetMode;
  vfxId?: string | null;
  poseVfxId?: string | null;
  castAnimationId?: string | null;
  execution?: SkillExecutionDef;
  statusEffects?: SkillStatusApplication[];
  element?: DamageElement;
  ai?: SkillAiConfig;
  /** Alignment global Hub/Hunt — valores absolutos no Character Pack. */
  spriteAlignment?: SpriteAlignmentConfig;
};

/** Campos de sprite/animação do personagem — o único payload válido em `character-config` sem skillId. */
const LAB_SPRITE_SAVE_FIELDS = ['scaleX', 'scaleY', 'offsetX', 'offsetY', 'frameRate'] as const;

export function spriteOnlyLabChanges(changes: LabSaveChanges): LabSaveChanges {
  const next: LabSaveChanges = {};
  for (const field of LAB_SPRITE_SAVE_FIELDS) {
    const value = changes[field];
    if (value != null) next[field] = value;
  }
  return next;
}

export function hasLabSpriteChanges(changes: LabSaveChanges): boolean {
  return Object.keys(spriteOnlyLabChanges(changes)).length > 0;
}

export const DEFAULT_TRAVEL_SPEED_PX = 600;

export const TRAVEL_SPEED_PRESETS = [300, 600, 1000, 1600] as const;

export const CAST_DELAY_PRESETS_MS = [0, 250, 500, 850, 900, 1200] as const;

export const TARGET_MODE_LABELS: Record<SkillVfxTargetMode, string> = {
  caster: 'No personagem',
  'travel-to-target': 'Viajar até o alvo',
  'instant-target': 'Instantâneo no alvo',
};

export interface LabSkillOriginals {
  targetMode: SkillVfxTargetMode;
  hasOfficialTargetMode: boolean;
  travelSpeed: number;
  vfxId: string | null;
  vfxScale: number;
  vfxOffsetX: number;
  vfxOffsetY: number;
  spawnOffsetX: number;
  spawnOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  poseVfxId: string | null;
  poseScale: number;
  poseOffsetX: number;
  poseOffsetY: number;
  castDelayMs: number;
  castAnimationId: string | null;
  poseSheet: LabPoseSheet | null;
  execution: SkillExecutionDef;
  statusEffects: SkillStatusApplication[];
  skillElement: DamageElement;
  skillAi: SkillAiConfig;
}

export interface LabSaveDiffLine {
  group: 'Sprite' | 'Animation' | 'VFX' | 'Status' | 'Skill';
  label: string;
  from: string;
  to: string;
  field: LabSaveableField;
  value: number | SkillVfxTargetMode | string | null | SkillExecutionDef | SkillStatusApplication[] | DamageElement | SkillAiConfig;
}

function fmt(value: number, digits: number): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return digits === 0 ? String(rounded) : rounded.toFixed(digits);
}

export function isSkillVfxTargetMode(value: unknown): value is SkillVfxTargetMode {
  return typeof value === 'string' && (SKILL_VFX_TARGET_MODES as readonly string[]).includes(value);
}

/** Inferência só para o Lab. Hunt sem `targeting.mode` continua no legado. */
export function inferLabTargetMode(anim: CharacterSkillAnimDef | undefined): SkillVfxTargetMode {
  if (anim?.targeting?.mode) return anim.targeting.mode;
  if ((anim?.fxFlightFrameCount ?? 0) > 0) return 'travel-to-target';
  if (anim?.fxAttach === 'caster') return 'caster';
  if (anim?.fx && (anim.fxAttach === 'target' || anim.fxAttach == null)) return 'instant-target';
  return 'caster';
}

export function readLabSkillOriginals(
  anim: CharacterSkillAnimDef | undefined,
  skillStatusEffects?: readonly SkillStatusApplication[],
  skillElement?: string,
  skillAi?: SkillAiConfig,
  slot = 1,
): LabSkillOriginals {
  const targeting = anim?.targeting;
  return {
    targetMode: inferLabTargetMode(anim),
    hasOfficialTargetMode: Boolean(targeting?.mode),
    travelSpeed: targeting?.travelSpeed ?? DEFAULT_TRAVEL_SPEED_PX,
    vfxId: anim?.vfxId ?? null,
    vfxScale: anim?.fxScale ?? 1,
    vfxOffsetX: anim?.vfxId ? (anim.vfxOffsetX ?? anim.fx?.offsetX ?? 0) : (anim?.fx?.offsetX ?? 0),
    vfxOffsetY: anim?.vfxId ? (anim.vfxOffsetY ?? anim.fx?.offsetY ?? 0) : (anim?.fx?.offsetY ?? 0),
    spawnOffsetX: targeting?.spawnOffsetX ?? 0,
    spawnOffsetY: targeting?.spawnOffsetY ?? 0,
    targetOffsetX: targeting?.targetOffsetX ?? 0,
    targetOffsetY: targeting?.targetOffsetY ?? 0,
    poseVfxId: anim?.cast?.vfxId ?? null,
    poseScale: anim?.cast?.scaleX ?? anim?.cast?.scaleY ?? anim?.cast?.scale ?? 1,
    poseOffsetX: anim?.offsetX ?? anim?.cast?.offsetX ?? 0,
    poseOffsetY: anim?.offsetY ?? anim?.cast?.offsetY ?? 0,
    castDelayMs: anim?.castDelayMs ?? 0,
    castAnimationId: anim?.cast?.animationId ?? null,
    poseSheet: cloneLabPoseSheet(poseSheetFromAnim(anim)),
    execution: cloneExecutionDef(anim?.execution),
    statusEffects: cloneSkillStatusEffects(anim?.statusEffects ?? skillStatusEffects),
    skillElement: resolveSkillElement({ element: skillElement }, anim),
    skillAi: resolveSkillAi(anim?.ai, skillAi, slot),
  };
}

export function collectLabSaveChanges(input: {
  characterName?: string;
  skillName?: string;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  animationSpeed: number;
  vfxScale: number;
  vfxOffsetX: number;
  vfxOffsetY: number;
  targetMode: SkillVfxTargetMode;
  travelSpeed: number;
  vfxId: string | null;
  spawnOffsetX: number;
  spawnOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  poseVfxId: string | null;
  poseScale: number;
  poseOffsetX: number;
  poseOffsetY: number;
  castDelayMs: number;
  castAnimationId: string | null;
  original: LabSkillOriginals;
  execution: SkillExecutionDef;
  statusEffects: SkillStatusApplication[];
  skillElement: DamageElement;
  skillAi: SkillAiConfig;
}): { header: string; lines: LabSaveDiffLine[]; changes: LabSaveChanges } {
  const lines: LabSaveDiffLine[] = [];
  const orig = input.original;

  const pushNum = (
    group: LabSaveDiffLine['group'],
    label: string,
    field: LabSaveableNumberField,
    from: number,
    to: number,
    digits: number,
  ) => {
    if (from === to) return;
    lines.push({
      group,
      label,
      from: field === 'travelSpeed' ? `${fmt(from, 0)}` : fmt(from, digits),
      to: field === 'travelSpeed' ? `${fmt(to, 0)}` : fmt(to, digits),
      field,
      value: to,
    });
  };

  pushNum('Sprite', 'Scale X', 'scaleX', 1, input.scaleX, 2);
  pushNum('Sprite', 'Scale Y', 'scaleY', 1, input.scaleY, 2);
  pushNum('Sprite', 'Offset X', 'offsetX', 0, input.offsetX, 0);
  pushNum('Sprite', 'Offset Y', 'offsetY', 0, input.offsetY, 0);
  pushNum('Animation', 'animationSpeed/frameRate', 'frameRate', 1, input.animationSpeed, 2);

  if (input.targetMode !== orig.targetMode) {
    lines.push({
      group: 'VFX',
      label: 'Target Mode',
      from: TARGET_MODE_LABELS[orig.targetMode],
      to: TARGET_MODE_LABELS[input.targetMode],
      field: 'targetMode',
      value: input.targetMode,
    });
  }
  if ((input.vfxId ?? null) !== (orig.vfxId ?? null)) {
    lines.push({
      group: 'VFX',
      label: 'VFX Efeito',
      from: orig.vfxId ?? 'nenhum',
      to: input.vfxId ?? 'nenhum',
      field: 'vfxId',
      value: input.vfxId,
    });
  }
  if ((input.poseVfxId ?? null) !== (orig.poseVfxId ?? null)) {
    lines.push({
      group: 'VFX',
      label: 'VFX Pose',
      from: orig.poseVfxId ?? 'nenhum',
      to: input.poseVfxId ?? 'nenhum',
      field: 'poseVfxId',
      value: input.poseVfxId,
    });
  }
  if ((input.castAnimationId ?? null) !== (orig.castAnimationId ?? null)) {
    lines.push({
      group: 'VFX',
      label: 'Animação Pose',
      from: orig.castAnimationId ?? 'nenhuma',
      to: input.castAnimationId ?? 'nenhuma',
      field: 'castAnimationId',
      value: input.castAnimationId,
    });
  }
  pushNum('VFX', 'Travel Speed', 'travelSpeed', orig.travelSpeed, input.travelSpeed, 0);
  pushNum('VFX', 'Effect Scale', 'vfxScale', orig.vfxScale, input.vfxScale, 2);
  pushNum('VFX', 'Effect Offset X', 'vfxOffsetX', orig.vfxOffsetX, input.vfxOffsetX, 0);
  pushNum('VFX', 'Effect Offset Y', 'vfxOffsetY', orig.vfxOffsetY, input.vfxOffsetY, 0);
  pushNum('VFX', 'Pose Scale', 'poseScale', orig.poseScale, input.poseScale, 2);
  pushNum('VFX', 'Pose Offset X', 'poseOffsetX', orig.poseOffsetX, input.poseOffsetX, 0);
  pushNum('VFX', 'Pose Offset Y', 'poseOffsetY', orig.poseOffsetY, input.poseOffsetY, 0);
  pushNum('Skill', 'Cast Delay', 'castDelayMs', orig.castDelayMs, input.castDelayMs, 0);
  if (!executionsEqual(input.execution, orig.execution)) {
    lines.push({
      group: 'Skill',
      label: 'Execution Type',
      from: SKILL_EXECUTION_TYPE_LABELS[resolveExecutionType(orig.execution)],
      to: SKILL_EXECUTION_TYPE_LABELS[resolveExecutionType(input.execution)],
      field: 'execution',
      value: input.execution,
    });
  }
  if (!statusEffectsEqual(input.statusEffects, orig.statusEffects)) {
    lines.push({
      group: 'Status',
      label: 'Status Effects',
      from: orig.statusEffects.map((entry) => entry.statusId).join(', ') || 'nenhum',
      to: input.statusEffects.map((entry) => entry.statusId).join(', ') || 'nenhum',
      field: 'statusEffects',
      value: cloneSkillStatusEffects(input.statusEffects),
    });
  }
  if (input.skillElement !== orig.skillElement) {
    lines.push({
      group: 'Skill',
      label: 'Elemento',
      from: DAMAGE_ELEMENT_LABELS[orig.skillElement],
      to: DAMAGE_ELEMENT_LABELS[input.skillElement],
      field: 'element',
      value: input.skillElement,
    });
  }
  if (!skillAiEqual(input.skillAi, orig.skillAi)) {
    lines.push({
      group: 'Skill',
      label: 'IA',
      from: `P${orig.skillAi.priority ?? '-'} ${orig.skillAi.autoUse === false ? 'off' : 'on'}`,
      to: `P${input.skillAi.priority ?? '-'} ${input.skillAi.autoUse === false ? 'off' : 'on'}`,
      field: 'ai',
      value: cloneSkillAi(input.skillAi) ?? input.skillAi,
    });
  }
  pushNum('VFX', 'Spawn Offset X', 'spawnOffsetX', orig.spawnOffsetX, input.spawnOffsetX, 0);
  pushNum('VFX', 'Spawn Offset Y', 'spawnOffsetY', orig.spawnOffsetY, input.spawnOffsetY, 0);
  pushNum('VFX', 'Target Offset X', 'targetOffsetX', orig.targetOffsetX, input.targetOffsetX, 0);
  pushNum('VFX', 'Target Offset Y', 'targetOffsetY', orig.targetOffsetY, input.targetOffsetY, 0);

  const changes: LabSaveChanges = {};
  for (const line of lines) {
    if (line.field === 'targetMode') {
      changes.targetMode = line.value as SkillVfxTargetMode;
    } else if (line.field === 'vfxId') {
      changes.vfxId = (line.value as string | null) ?? null;
    } else if (line.field === 'poseVfxId') {
      changes.poseVfxId = (line.value as string | null) ?? null;
    } else if (line.field === 'castAnimationId') {
      changes.castAnimationId = (line.value as string | null) ?? null;
    } else if (line.field === 'execution') {
      changes.execution = line.value as SkillExecutionDef;
    } else if (line.field === 'statusEffects') {
      changes.statusEffects = line.value as SkillStatusApplication[];
    } else if (line.field === 'element') {
      changes.element = line.value as DamageElement;
    } else if (line.field === 'ai') {
      changes.ai = line.value as SkillAiConfig;
    } else {
      changes[line.field as LabSaveableNumberField] = line.value as number;
    }
  }

  const header = [input.characterName, input.skillName].filter(Boolean).join(' — ');
  return { header, lines, changes };
}

export function skillLogicDirty(
  test: Pick<
    Omit<LabSkillOriginals, 'hasOfficialTargetMode'>,
    'castDelayMs' | 'execution' | 'statusEffects' | 'skillElement' | 'skillAi'
  >,
  original: LabSkillOriginals,
): boolean {
  return (
    test.castDelayMs !== original.castDelayMs ||
    !executionsEqual(test.execution, original.execution) ||
    !statusEffectsEqual(test.statusEffects, original.statusEffects) ||
    test.skillElement !== original.skillElement ||
    !skillAiEqual(test.skillAi, original.skillAi)
  );
}

export function skillVisualDirty(
  test: Omit<LabSkillOriginals, 'hasOfficialTargetMode'>,
  original: LabSkillOriginals,
): boolean {
  return (
    test.targetMode !== original.targetMode ||
    (test.vfxId ?? null) !== (original.vfxId ?? null) ||
    test.travelSpeed !== original.travelSpeed ||
    test.vfxScale !== original.vfxScale ||
    test.vfxOffsetX !== original.vfxOffsetX ||
    test.vfxOffsetY !== original.vfxOffsetY ||
    test.spawnOffsetX !== original.spawnOffsetX ||
    test.spawnOffsetY !== original.spawnOffsetY ||
    test.targetOffsetX !== original.targetOffsetX ||
    test.targetOffsetY !== original.targetOffsetY ||
    (test.poseVfxId ?? null) !== (original.poseVfxId ?? null) ||
    test.poseScale !== original.poseScale ||
    test.poseOffsetX !== original.poseOffsetX ||
    test.poseOffsetY !== original.poseOffsetY ||
    (test.castAnimationId ?? null) !== (original.castAnimationId ?? null) ||
    !poseSheetsEqual(test.poseSheet ?? null, original.poseSheet ?? null)
  );
}

export function skillFieldsDirty(
  test: Omit<LabSkillOriginals, 'hasOfficialTargetMode'>,
  original: LabSkillOriginals,
): boolean {
  return skillLogicDirty(test, original) || skillVisualDirty(test, original);
}

export function applyLabChangesToSkillAnim(
  anim: CharacterSkillAnimDef,
  changes: LabSaveChanges,
): CharacterSkillAnimDef {
  const next: CharacterSkillAnimDef = {
    ...anim,
    fx: anim.fx ? { ...anim.fx } : anim.fx,
    targeting: anim.targeting ? { ...anim.targeting } : anim.targeting,
    cast: anim.cast ? { ...anim.cast } : anim.cast,
    execution: anim.execution ? cloneExecutionDef(anim.execution) : anim.execution,
    statusEffects: cloneSkillStatusEffects(anim.statusEffects),
    element: anim.element,
    ai: cloneSkillAi(anim.ai),
  };
  if (changes.execution) {
    const parsed = parseSkillExecution(changes.execution);
    if (resolveExecutionType(parsed) === 'single-hit') delete next.execution;
    else next.execution = parsed;
  }
  if (changes.statusEffects) {
    next.statusEffects = cloneSkillStatusEffects(changes.statusEffects);
  }
  if (changes.element) {
    next.element = changes.element;
  }
  if (changes.ai) {
    next.ai = cloneSkillAi(parseSkillAi(changes.ai)) ?? cloneSkillAi(changes.ai);
  }
  if (changes.vfxId !== undefined) {
    if (changes.vfxId) next.vfxId = changes.vfxId;
    else delete next.vfxId;
  }
  if (changes.vfxScale != null) next.fxScale = changes.vfxScale;
  if (changes.vfxOffsetX != null) next.vfxOffsetX = changes.vfxOffsetX;
  if (changes.vfxOffsetY != null) next.vfxOffsetY = changes.vfxOffsetY;
  if (changes.hitDelayMs != null) next.hitDelayMs = changes.hitDelayMs;
  if (changes.fxReleaseMs != null) next.fxReleaseMs = changes.fxReleaseMs;
  if (changes.castDelayMs != null) next.castDelayMs = changes.castDelayMs;

  const wantsCast =
    changes.poseVfxId !== undefined ||
    changes.poseScale != null ||
    changes.poseOffsetX != null ||
    changes.poseOffsetY != null ||
    changes.castAnimationId !== undefined;
  if (wantsCast) {
    const cast = { ...(next.cast ?? {}) };
    if (changes.poseVfxId !== undefined) {
      if (changes.poseVfxId) cast.vfxId = changes.poseVfxId;
      else delete cast.vfxId;
    }
    if (changes.poseScale != null) {
      cast.scale = changes.poseScale;
      cast.scaleY = changes.poseScale;
    }
    if (changes.poseOffsetX != null) cast.offsetX = changes.poseOffsetX;
    if (changes.poseOffsetY != null) cast.offsetY = changes.poseOffsetY;
    if (changes.castAnimationId !== undefined) {
      if (changes.castAnimationId) cast.animationId = changes.castAnimationId;
      else delete cast.animationId;
    }
    if (cast.vfxId || cast.animationId || cast.scale != null || cast.offsetX != null || cast.offsetY != null) {
      next.cast = cast;
    } else {
      delete next.cast;
    }
  }

  const wantsTargeting =
    changes.targetMode != null ||
    changes.travelSpeed != null ||
    changes.spawnOffsetX != null ||
    changes.spawnOffsetY != null ||
    changes.targetOffsetX != null ||
    changes.targetOffsetY != null;
  if (wantsTargeting) {
    next.targeting = {
      mode: changes.targetMode ?? next.targeting?.mode ?? inferLabTargetMode(next),
      travelSpeed: changes.travelSpeed ?? next.targeting?.travelSpeed,
      spawnOffsetX: changes.spawnOffsetX ?? next.targeting?.spawnOffsetX,
      spawnOffsetY: changes.spawnOffsetY ?? next.targeting?.spawnOffsetY,
      targetOffsetX: changes.targetOffsetX ?? next.targeting?.targetOffsetX,
      targetOffsetY: changes.targetOffsetY != null ? changes.targetOffsetY : next.targeting?.targetOffsetY,
    };
  }
  return next;
}
