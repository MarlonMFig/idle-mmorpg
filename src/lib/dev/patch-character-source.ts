import fs from 'node:fs';
import type { SkillVfxTargetMode } from '@/data/skill-vfx-targeting';
import { SKILL_VFX_TARGET_MODES } from '@/data/skill-vfx-targeting';
import {
  formatExecutionLiteral,
  parseSkillExecution,
  resolveExecutionType,
  type SkillExecutionDef,
} from '@/data/skill-execution-def';
import {
  formatStatusEffectsLiteral,
  parseSkillStatusEffects,
  type SkillStatusApplication,
} from '@/data/status-effect-def';
import { isDamageElement } from '@/data/damage-elements';
import { formatSkillAiLiteral, parseSkillAi } from '@/data/skill-ai-def';
import {
  assertWritableSourcePath,
  findCharacterSourceFile,
  resolveWritableCharacterId,
} from '@/lib/dev/find-character-source';
import {
  LAB_SAVEABLE_NUMBER_FIELDS,
  type LabSaveChanges,
  type LabSaveableNumberField,
  isSkillVfxTargetMode,
} from '@/lib/dev/lab-save-fields';
import { canonicalizeLoopMode, isFrameLoopMode, legacyLoopFromMode, type FrameLoopMode, type FrameLoopModeInput } from '@/lib/frame-loop';
import {
  normalizeSpriteAlignment,
  type SpriteAlignmentConfig,
} from '@/lib/sprite-alignment';

export interface LabSourcePatch {
  characterId: string;
  skillId?: string | null;
  changes: LabSaveChanges;
}

export interface LabPatchResult {
  relativePath: string;
  applied: Record<string, string | number>;
  source: string;
  absPath: string;
}

export interface LabPatchOptions {
  source?: string;
  persist?: boolean;
}

function loadCharacterSource(characterId: string, source?: string): {
  hit: NonNullable<ReturnType<typeof findCharacterSourceFile>>;
  source: string;
  characterId: string;
} {
  const id = resolveWritableCharacterId(characterId);
  const hit = findCharacterSourceFile(id);
  if (!hit) throw new Error(`Fonte não encontrada para ${characterId} (pack id: ${id})`);
  assertWritableSourcePath(hit.absPath);
  return { hit, source: source ?? fs.readFileSync(hit.absPath, 'utf8'), characterId: id };
}

/** Lê `spriteAlignment` literal do bloco do pack (fonte persistida). */
export function readSpriteAlignmentFromSource(
  source: string,
  characterId: string,
): SpriteAlignmentConfig | null {
  const id = resolveWritableCharacterId(characterId);
  const range = packObjectRange(source, id);
  if (!range) return null;
  const packBlock = source.slice(range.start, range.end + 1);
  const existing = firstPropAssignment(packBlock, 'spriteAlignment');
  if (!existing) return null;
  const literal = packBlock.slice(existing.start, existing.end + 1);
  const hub = /hub:\s*\{\s*x:\s*(-?\d+)\s*,\s*y:\s*(-?\d+)\s*\}/.exec(literal);
  const hunt = /hunt:\s*\{\s*x:\s*(-?\d+)\s*,\s*y:\s*(-?\d+)\s*\}/.exec(literal);
  if (!hub && !hunt) return null;
  return normalizeSpriteAlignment({
    hub: hub ? { x: Number(hub[1]), y: Number(hub[2]) } : undefined,
    hunt: hunt ? { x: Number(hunt[1]), y: Number(hunt[2]) } : undefined,
  });
}

function persistSource(absPath: string, source: string, persist?: boolean): void {
  if (persist === false) return;
  fs.writeFileSync(absPath, source, 'utf8');
}

function matchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function packObjectRange(source: string, characterId: string): { start: number; end: number } | null {
  const re = new RegExp(`\\bid\\s*:\\s*['"]${characterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  const match = re.exec(source);
  if (!match || match.index == null) return null;
  let open = match.index;
  while (open > 0 && source[open] !== '{') open -= 1;
  if (source[open] !== '{') return null;
  const end = matchingBrace(source, open);
  if (end < 0) return null;
  return { start: open, end };
}

function formatNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function setNumericProp(block: string, key: string, value: number): string {
  const re = new RegExp(`(${key}\\s*:\\s*)-?\\d+(?:\\.\\d+)?`);
  if (re.test(block)) return block.replace(re, `$1${formatNum(value)}`);
  return insertBeforeLastBrace(block, `${key}: ${formatNum(value)},`);
}

function setStringProp(block: string, key: string, value: string): string {
  const re = new RegExp(`(${key}\\s*:\\s*)['"][^'"]*['"]`);
  if (re.test(block)) return block.replace(re, `$1'${value}'`);
  return insertBeforeLastBrace(block, `${key}: '${value}',`);
}

function removeProp(block: string, key: string): string {
  return block.replace(new RegExp(`(?:^|,|\\n)([ \\t]*${key}\\s*:[^\\n,]*,?)`, 'm'), '\n');
}

function insertBeforeLastBrace(block: string, line: string): string {
  return block.replace(/(\r?\n)([ \t]*)\}(\s*)$/, `$1$2  ${line}$1$2}$3`);
}

function firstPropAssignment(block: string, key: string): { start: number; end: number } | null {
  const re = new RegExp(`(?:^|,|\\n)\\s*${key}\\s*:`);
  const match = re.exec(block);
  if (!match || match.index == null) return null;
  const colon = block.indexOf(':', match.index);
  let i = colon + 1;
  while (i < block.length && /\s/.test(block[i])) i += 1;
  if (block[i] === '{') {
    const end = matchingBrace(block, i);
    return end >= 0 ? { start: i, end } : null;
  }
  if (block[i] === '[') {
    const end = matchingBracket(block, i);
    return end >= 0 ? { start: i, end } : null;
  }
  const ident = /^[A-Z_][A-Z0-9_]*/i.exec(block.slice(i));
  if (!ident) return null;
  return { start: i, end: i + ident[0].length - 1 };
}

function resolveNamedObject(source: string, name: string): { start: number; end: number } | null {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=]+)?=\\s*\\{`);
  const match = re.exec(source);
  if (!match || match.index == null) return null;
  const open = source.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  if (end < 0) return null;
  return { start: open, end };
}

function patchRange(source: string, start: number, end: number, nextBlock: string): string {
  return source.slice(0, start) + nextBlock + source.slice(end + 1);
}

function namedOrInlineObject(
  source: string,
  packStart: number,
  packEnd: number,
  key: string,
): { start: number; end: number } | null {
  const pack = source.slice(packStart, packEnd + 1);
  const assign = firstPropAssignment(pack, key);
  if (!assign) return null;
  const absStart = packStart + assign.start;
  if (source[absStart] === '{') {
    const end = matchingBrace(source, absStart);
    return end >= 0 ? { start: absStart, end } : null;
  }
  const name = source.slice(absStart, packStart + assign.end + 1).trim();
  return resolveNamedObject(source, name);
}

function sheetRange(
  source: string,
  packStart: number,
  packEnd: number,
  key: 'idle' | 'walk',
): { start: number; end: number } | null {
  return namedOrInlineObject(source, packStart, packEnd, key);
}

function skillRange(
  source: string,
  packStart: number,
  packEnd: number,
  skillId: string,
): { start: number; end: number } | null {
  const anims = namedOrInlineObject(source, packStart, packEnd, 'skillAnims');
  if (!anims) return null;
  const block = source.slice(anims.start, anims.end + 1);
  const escaped = skillId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`['"]${escaped}['"]\\s*:\\s*\\{`);
  const match = re.exec(block);
  if (!match || match.index == null) return null;
  const open = anims.start + block.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  return end >= 0 ? { start: open, end } : null;
}

function fxRange(source: string, skillStart: number, skillEnd: number): { start: number; end: number } | null {
  const skill = source.slice(skillStart, skillEnd + 1);
  const match = /\bfx\s*:\s*\{/.exec(skill);
  if (!match || match.index == null) return null;
  const open = skillStart + skill.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  return end >= 0 ? { start: open, end } : null;
}

function targetingRange(skillBlock: string): { start: number; end: number } | null {
  const match = /\btargeting\s*:\s*\{/.exec(skillBlock);
  if (!match || match.index == null) return null;
  const open = skillBlock.indexOf('{', match.index);
  const end = matchingBrace(skillBlock, open);
  return end >= 0 ? { start: open, end } : null;
}

function readCurrentNumber(block: string, key: string, fallback: number): number {
  const match = new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(block);
  if (!match) return fallback;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : fallback;
}

function skillKeyIndent(skillBlock: string): string {
  const match = /\n([ \t]+)\w+\s*:/.exec(skillBlock);
  return match?.[1] ?? '      ';
}

function upsertTargeting(
  skillBlock: string,
  fields: Partial<{
    mode: SkillVfxTargetMode;
    travelSpeed: number;
    spawnOffsetX: number;
    spawnOffsetY: number;
    targetOffsetX: number;
    targetOffsetY: number;
  }>,
): string {
  const indent = skillKeyIndent(skillBlock);
  const innerIndent = `${indent}  `;
  const existing = targetingRange(skillBlock);
  if (existing) {
    let inner = skillBlock.slice(existing.start, existing.end + 1);
    if (fields.mode) inner = setStringProp(inner, 'mode', fields.mode);
    if (fields.travelSpeed != null) inner = setNumericProp(inner, 'travelSpeed', fields.travelSpeed);
    if (fields.spawnOffsetX != null) inner = setNumericProp(inner, 'spawnOffsetX', fields.spawnOffsetX);
    if (fields.spawnOffsetY != null) inner = setNumericProp(inner, 'spawnOffsetY', fields.spawnOffsetY);
    if (fields.targetOffsetX != null) inner = setNumericProp(inner, 'targetOffsetX', fields.targetOffsetX);
    if (fields.targetOffsetY != null) inner = setNumericProp(inner, 'targetOffsetY', fields.targetOffsetY);
    return skillBlock.slice(0, existing.start) + inner + skillBlock.slice(existing.end + 1);
  }

  const lines = [`targeting: {`];
  if (fields.mode) lines.push(`${innerIndent}mode: '${fields.mode}',`);
  if (fields.travelSpeed != null) lines.push(`${innerIndent}travelSpeed: ${formatNum(fields.travelSpeed)},`);
  if (fields.spawnOffsetX != null) lines.push(`${innerIndent}spawnOffsetX: ${formatNum(fields.spawnOffsetX)},`);
  if (fields.spawnOffsetY != null) lines.push(`${innerIndent}spawnOffsetY: ${formatNum(fields.spawnOffsetY)},`);
  if (fields.targetOffsetX != null) lines.push(`${innerIndent}targetOffsetX: ${formatNum(fields.targetOffsetX)},`);
  if (fields.targetOffsetY != null) lines.push(`${innerIndent}targetOffsetY: ${formatNum(fields.targetOffsetY)},`);
  lines.push(`${indent}},`);
  return insertBeforeLastBrace(skillBlock, lines.join('\n'));
}

function upsertExecution(skillBlock: string, execution: SkillExecutionDef): string {
  const indent = skillKeyIndent(skillBlock);
  const innerIndent = `${indent}  `;
  const match = /\bexecution\s*:\s*\{/.exec(skillBlock);
  const existing =
    match && match.index != null
      ? (() => {
          const open = skillBlock.indexOf('{', match.index);
          const end = matchingBrace(skillBlock, open);
          return end >= 0 ? { start: open, end, keyStart: match.index } : null;
        })()
      : null;
  if (resolveExecutionType(execution) === 'single-hit') {
    if (!existing) return skillBlock;
    return `${skillBlock.slice(0, existing.keyStart)}${skillBlock.slice(existing.end + 1)}`.replace(/,\s*,/g, ',');
  }
  const literal = formatExecutionLiteral(execution, indent, innerIndent);
  if (existing) {
    const objStart = literal.indexOf('{');
    const obj = literal.slice(objStart).replace(/,\s*$/, '');
    return skillBlock.slice(0, existing.start) + obj + skillBlock.slice(existing.end + 1);
  }
  return insertBeforeLastBrace(skillBlock, literal);
}

function upsertStatusEffects(skillBlock: string, statusEffects: SkillStatusApplication[]): string {
  const indent = skillKeyIndent(skillBlock);
  const innerIndent = `${indent}  `;
  const match = /\bstatusEffects\s*:\s*\[/.exec(skillBlock);
  const existing =
    match && match.index != null
      ? (() => {
          const open = skillBlock.indexOf('[', match.index);
          let depth = 0;
          for (let i = open; i < skillBlock.length; i += 1) {
            if (skillBlock[i] === '[') depth += 1;
            else if (skillBlock[i] === ']') {
              depth -= 1;
              if (depth === 0) return { start: open, end: i, keyStart: match.index };
            }
          }
          return null;
        })()
      : null;
  if (statusEffects.length === 0) {
    if (!existing) return skillBlock;
    return `${skillBlock.slice(0, existing.keyStart)}${skillBlock.slice(existing.end + 1)}`.replace(/,\s*,/g, ',');
  }
  const literal = formatStatusEffectsLiteral(statusEffects, indent, innerIndent);
  if (existing) {
    const objStart = literal.indexOf('[');
    const obj = literal.slice(objStart).replace(/,\s*$/, '');
    return skillBlock.slice(0, existing.start) + obj + skillBlock.slice(existing.end + 1);
  }
  return insertBeforeLastBrace(skillBlock, literal);
}

function upsertAi(skillBlock: string, ai: NonNullable<LabSaveChanges['ai']>): string {
  const indent = skillKeyIndent(skillBlock);
  const match = /\bai\s*:\s*\{/.exec(skillBlock);
  const existing =
    match && match.index != null
      ? (() => {
          const open = skillBlock.indexOf('{', match.index);
          const end = matchingBrace(skillBlock, open);
          return end >= 0 ? { start: open, end, keyStart: match.index } : null;
        })()
      : null;
  const literal = formatSkillAiLiteral(ai, indent);
  if (existing) {
    const objStart = literal.indexOf('{');
    const obj = literal.slice(objStart).replace(/,\s*$/, '');
    return skillBlock.slice(0, existing.start) + obj + skillBlock.slice(existing.end + 1);
  }
  return insertBeforeLastBrace(skillBlock, literal);
}

function upsertCast(
  skillBlock: string,
  fields: Partial<{
    vfxId: string | null;
    animationId: string | null;
    scale: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    loop: boolean;
    loopMode?: FrameLoopMode;
    loopStartFrame?: number;
    loopEndFrame?: number;
    loopDurationMs?: number;
    loopUntilSkillEnd?: boolean;
    flipX?: boolean;
    flipY?: boolean;
  }>,
): string {
  const indent = skillKeyIndent(skillBlock);
  const innerIndent = `${indent}  `;
  const match = /\bcast\s*:\s*\{/.exec(skillBlock);
  const existing =
    match && match.index != null
      ? (() => {
          const open = skillBlock.indexOf('{', match.index);
          const end = matchingBrace(skillBlock, open);
          return end >= 0 ? { start: open, end } : null;
        })()
      : null;

  const applyFields = (inner: string) => {
    let next = inner;
    if (fields.vfxId !== undefined) {
      if (fields.vfxId) next = setStringProp(next, 'vfxId', fields.vfxId);
      else next = removeProp(next, 'vfxId');
    }
    if (fields.animationId !== undefined) {
      if (fields.animationId) next = setStringProp(next, 'animationId', fields.animationId);
      else next = removeProp(next, 'animationId');
    }
    if (fields.scale != null) next = setNumericProp(next, 'scale', fields.scale);
    if (fields.scaleX != null) next = setNumericProp(next, 'scaleX', fields.scaleX);
    if (fields.scaleY != null) next = setNumericProp(next, 'scaleY', fields.scaleY);
    if (fields.offsetX != null) next = setNumericProp(next, 'offsetX', fields.offsetX);
    if (fields.offsetY != null) next = setNumericProp(next, 'offsetY', fields.offsetY);
    if (fields.loop !== undefined) {
      if (fields.loop) next = setBooleanProp(next, 'loop', true);
      else next = removeProp(next, 'loop');
    }
    if (fields.loopMode) next = setStringProp(next, 'loopMode', canonicalizeLoopMode(fields.loopMode) ?? fields.loopMode);
    if (fields.loopStartFrame != null) next = setNumericProp(next, 'loopStartFrame', fields.loopStartFrame);
    if (fields.loopEndFrame != null) next = setNumericProp(next, 'loopEndFrame', fields.loopEndFrame);
    if (fields.loopDurationMs != null) next = setNumericProp(next, 'loopDurationMs', fields.loopDurationMs);
    if (fields.loopUntilSkillEnd != null) next = setBooleanProp(next, 'loopUntilSkillEnd', fields.loopUntilSkillEnd);
    if (fields.flipX != null) next = setBooleanProp(next, 'flipX', fields.flipX);
    if (fields.flipY != null) next = setBooleanProp(next, 'flipY', fields.flipY);
    return next;
  };

  if (existing) {
    const inner = applyFields(skillBlock.slice(existing.start, existing.end + 1));
    const emptied = !/\b(?:vfxId|animationId|scaleX?|scaleY|offsetX|offsetY|loop)\s*:/.test(inner);
    if (emptied) {
      return skillBlock.slice(0, match!.index) + skillBlock.slice(existing.end + 1).replace(/^,?\s*/, '');
    }
    return skillBlock.slice(0, existing.start) + inner + skillBlock.slice(existing.end + 1);
  }

  const lines = ['cast: {'];
  if (fields.vfxId) lines.push(`${innerIndent}vfxId: '${fields.vfxId}',`);
  if (fields.animationId) lines.push(`${innerIndent}animationId: '${fields.animationId}',`);
  if (fields.scaleX != null) lines.push(`${innerIndent}scaleX: ${formatNum(fields.scaleX)},`);
  if (fields.scaleY != null) lines.push(`${innerIndent}scaleY: ${formatNum(fields.scaleY)},`);
  if (fields.scale != null) lines.push(`${innerIndent}scale: ${formatNum(fields.scale)},`);
  if (fields.offsetX != null) lines.push(`${innerIndent}offsetX: ${formatNum(fields.offsetX)},`);
  if (fields.offsetY != null) lines.push(`${innerIndent}offsetY: ${formatNum(fields.offsetY)},`);
  if (fields.loop) lines.push(`${innerIndent}loop: true,`);
  if (fields.loopMode) lines.push(`${innerIndent}loopMode: '${fields.loopMode}',`);
  if (fields.loopStartFrame != null) {
    lines.push(`${innerIndent}loopStartFrame: ${Math.round(fields.loopStartFrame)},`);
  }
  if (fields.loopEndFrame != null) {
    lines.push(`${innerIndent}loopEndFrame: ${Math.round(fields.loopEndFrame)},`);
  }
  if (fields.loopDurationMs != null) {
    lines.push(`${innerIndent}loopDurationMs: ${Math.round(fields.loopDurationMs)},`);
  }
  if (fields.loopUntilSkillEnd) lines.push(`${innerIndent}loopUntilSkillEnd: true,`);
  if (fields.flipX) lines.push(`${innerIndent}flipX: true,`);
  if (fields.flipY) lines.push(`${innerIndent}flipY: true,`);
  if (lines.length === 1) return skillBlock;
  lines.push(`${indent}},`);
  return insertBeforeLastBrace(skillBlock, lines.join('\n'));
}

function matchingBracket(source: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function formatHotbarLiteral(ids: readonly (string | null)[]): string {
  const items = ids.map((id) => (id ? `'${id}'` : 'null'));
  if (ids.length <= 4 && ids.every((id) => id)) {
    return `[${items.join(', ')}]`;
  }
  return `[\n    ${items.join(',\n    ')},\n  ]`;
}

export function patchCharacterHotbar(
  characterId: string,
  slots: readonly (string | null)[],
  options?: LabPatchOptions,
): LabPatchResult {
  const loaded = loadCharacterSource(characterId, options?.source);
  const id = loaded.characterId;
  const { hit } = loaded;
  let source = loaded.source;
  const pack = packObjectRange(source, id);
  if (!pack) throw new Error(`Bloco do pack não encontrado: ${id}`);
  const packBlock = source.slice(pack.start, pack.end + 1);
  const assign = firstPropAssignment(packBlock, 'hotbarSkillIds');
  if (!assign) throw new Error(`hotbarSkillIds não encontrado em ${id}`);
  const absStart = pack.start + assign.start;
  if (source[absStart] !== '[') {
    throw new Error(`hotbarSkillIds de ${id} não é um array literal`);
  }
  const end = matchingBracket(source, absStart);
  if (end < 0) throw new Error(`hotbarSkillIds quebrado em ${id}`);
  const extras: (string | null)[] = [];
  const current = source.slice(absStart + 1, end);
  const extraRe = /'([^']+)'|"([^"]+)"|null/g;
  const parsed: (string | null)[] = [];
  let match: RegExpExecArray | null = extraRe.exec(current);
  while (match) {
    parsed.push(match[1] ?? match[2] ?? null);
    match = extraRe.exec(current);
  }
  for (let i = 4; i < parsed.length; i += 1) extras.push(parsed[i]);
  const next = formatHotbarLiteral([...slots.slice(0, 4), ...extras]);
  source = patchRange(source, absStart, end, next);
  persistSource(hit.absPath, source, options?.persist);
  return { relativePath: hit.relativePath, applied: { hotbarSkillIds: next }, source, absPath: hit.absPath };
}

export function insertSkillAnimStub(
  characterId: string,
  skillId: string,
  anim: {
    key: string;
    url: string;
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    contentHeight?: number;
    frameRate?: number;
    originX?: number;
    originY?: number;
    offsetX?: number;
    offsetY?: number;
    durationMs: number;
    hitDelayMs: number;
  },
  options?: LabPatchOptions,
): LabPatchResult {
  const loaded = loadCharacterSource(characterId, options?.source);
  const id = loaded.characterId;
  const { hit } = loaded;
  let source = loaded.source;
  const pack = packObjectRange(source, id);
  if (!pack) throw new Error(`Bloco do pack não encontrado: ${id}`);
  const existing = skillRange(source, pack.start, pack.end, skillId);
  if (existing) {
    return {
      relativePath: hit.relativePath,
      applied: { skillAnims: 'já existia' },
      source,
      absPath: hit.absPath,
    };
  }
  const anims = namedOrInlineObject(source, pack.start, pack.end, 'skillAnims');
  if (!anims) throw new Error(`skillAnims não encontrado em ${id}`);
  const block = source.slice(anims.start, anims.end + 1);
  const indentMatch = /\n([ \t]+)'[^']+'\s*:/.exec(block) ?? /\n([ \t]+)\w+\s*:/.exec(block);
  const indent = indentMatch?.[1] ?? '    ';
  const inner = `${indent}  `;
  const lines = [
    `'${skillId}': {`,
    `${inner}key: '${anim.key}',`,
    `${inner}url: '${anim.url}',`,
    `${inner}frameWidth: ${anim.frameWidth},`,
    `${inner}frameHeight: ${anim.frameHeight},`,
    `${inner}frameCount: ${anim.frameCount},`,
  ];
  if (anim.contentHeight != null) lines.push(`${inner}contentHeight: ${anim.contentHeight},`);
  if (anim.frameRate != null) lines.push(`${inner}frameRate: ${anim.frameRate},`);
  if (anim.originX != null) lines.push(`${inner}originX: ${anim.originX},`);
  if (anim.originY != null) lines.push(`${inner}originY: ${anim.originY},`);
  if (anim.offsetX != null) lines.push(`${inner}offsetX: ${anim.offsetX},`);
  if (anim.offsetY != null) lines.push(`${inner}offsetY: ${anim.offsetY},`);
  lines.push(`${inner}durationMs: ${anim.durationMs},`);
  lines.push(`${inner}hitDelayMs: ${anim.hitDelayMs},`);
  lines.push(`${indent}},`);
  const stub = lines.join('\n');
  const nextBlock = insertBeforeLastBrace(block, stub);
  source = patchRange(source, anims.start, anims.end, nextBlock);
  persistSource(hit.absPath, source, options?.persist);
  return { relativePath: hit.relativePath, applied: { skillAnims: skillId }, source, absPath: hit.absPath };
}

function formatSkillAnimLiteral(
  skillId: string,
  anim: {
    key: string;
    url: string;
    frames?: readonly string[];
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    contentHeight?: number;
    frameRate?: number;
    originX?: number;
    originY?: number;
    offsetX?: number;
    offsetY?: number;
    loop?: boolean;
    durationMs: number;
    hitDelayMs: number;
    vfxId?: string;
    fxScale?: number;
    vfxOffsetX?: number;
    vfxOffsetY?: number;
    vfxLoopMode?: FrameLoopModeInput;
    vfxLoopStartFrame?: number;
    vfxLoopEndFrame?: number;
    vfxLoopDurationMs?: number;
    vfxLoopUntilSkillEnd?: boolean;
    vfxFlipX?: boolean;
    vfxFlipY?: boolean;
    loopMode?: FrameLoopModeInput;
    loopStartFrame?: number;
    loopEndFrame?: number;
    loopDurationMs?: number;
    loopUntilSkillEnd?: boolean;
    castDelayMs?: number;
    targeting?: {
      mode?: string;
      travelSpeed?: number;
      spawnOffsetX?: number;
      spawnOffsetY?: number;
      targetOffsetX?: number;
      targetOffsetY?: number;
    };
    execution?: SkillExecutionDef;
    statusEffects?: SkillStatusApplication[];
    cast?: {
      scaleX?: number;
      scaleY?: number;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
      loop?: boolean;
      animationId?: string;
    };
  },
  indent: string,
): string {
  const inner = `${indent}  `;
  const nested = `${indent}    `;
  const lines = [
    `'${skillId}': {`,
    `${inner}key: '${anim.key}',`,
    `${inner}url: '${anim.url}',`,
  ];
  if (anim.frames && anim.frames.length > 0) {
    lines.push(`${inner}frames: [`);
    for (const frame of anim.frames) lines.push(`${nested}'${frame}',`);
    lines.push(`${inner}],`);
  }
  lines.push(
    `${inner}frameWidth: ${anim.frameWidth},`,
    `${inner}frameHeight: ${anim.frameHeight},`,
    `${inner}frameCount: ${anim.frameCount},`,
  );
  if (anim.contentHeight != null) lines.push(`${inner}contentHeight: ${anim.contentHeight},`);
  if (anim.frameRate != null) lines.push(`${inner}frameRate: ${anim.frameRate},`);
  if (anim.originX != null) lines.push(`${inner}originX: ${anim.originX},`);
  if (anim.originY != null) lines.push(`${inner}originY: ${anim.originY},`);
  if (anim.offsetX != null) lines.push(`${inner}offsetX: ${anim.offsetX},`);
  if (anim.offsetY != null) lines.push(`${inner}offsetY: ${anim.offsetY},`);
  if (anim.loop) lines.push(`${inner}loop: true,`);
  lines.push(`${inner}durationMs: ${anim.durationMs},`);
  lines.push(`${inner}hitDelayMs: ${anim.hitDelayMs},`);
  if (anim.vfxId) lines.push(`${inner}vfxId: '${anim.vfxId}',`);
  if (anim.fxScale != null) lines.push(`${inner}fxScale: ${formatNum(anim.fxScale)},`);
  if (anim.vfxOffsetX != null) lines.push(`${inner}vfxOffsetX: ${formatNum(anim.vfxOffsetX)},`);
  if (anim.vfxOffsetY != null) lines.push(`${inner}vfxOffsetY: ${formatNum(anim.vfxOffsetY)},`);
  if (anim.vfxLoopMode) {
    const mode = canonicalizeLoopMode(anim.vfxLoopMode) ?? anim.vfxLoopMode;
    lines.push(`${inner}vfxLoopMode: '${mode}',`);
  }
  if (anim.vfxLoopStartFrame != null) lines.push(`${inner}vfxLoopStartFrame: ${Math.round(anim.vfxLoopStartFrame)},`);
  if (anim.vfxLoopEndFrame != null) lines.push(`${inner}vfxLoopEndFrame: ${Math.round(anim.vfxLoopEndFrame)},`);
  if (anim.vfxLoopDurationMs != null) lines.push(`${inner}vfxLoopDurationMs: ${Math.round(anim.vfxLoopDurationMs)},`);
  if (anim.vfxLoopUntilSkillEnd) lines.push(`${inner}vfxLoopUntilSkillEnd: true,`);
  if (anim.vfxFlipX) lines.push(`${inner}vfxFlipX: true,`);
  if (anim.vfxFlipY) lines.push(`${inner}vfxFlipY: true,`);
  if (anim.loopMode) {
    const mode = canonicalizeLoopMode(anim.loopMode) ?? anim.loopMode;
    lines.push(`${inner}loopMode: '${mode}',`);
  }
  if (anim.loopStartFrame != null) lines.push(`${inner}loopStartFrame: ${Math.round(anim.loopStartFrame)},`);
  if (anim.loopEndFrame != null) lines.push(`${inner}loopEndFrame: ${Math.round(anim.loopEndFrame)},`);
  if (anim.loopDurationMs != null) lines.push(`${inner}loopDurationMs: ${Math.round(anim.loopDurationMs)},`);
  if (anim.loopUntilSkillEnd) lines.push(`${inner}loopUntilSkillEnd: true,`);
  if (anim.castDelayMs != null) lines.push(`${inner}castDelayMs: ${Math.round(anim.castDelayMs)},`);
  if (anim.targeting?.mode) {
    lines.push(`${inner}targeting: {`);
    lines.push(`${nested}mode: '${anim.targeting.mode}',`);
    if (anim.targeting.travelSpeed != null) {
      lines.push(`${nested}travelSpeed: ${formatNum(anim.targeting.travelSpeed)},`);
    }
    if (anim.targeting.spawnOffsetX != null) {
      lines.push(`${nested}spawnOffsetX: ${formatNum(anim.targeting.spawnOffsetX)},`);
    }
    if (anim.targeting.spawnOffsetY != null) {
      lines.push(`${nested}spawnOffsetY: ${formatNum(anim.targeting.spawnOffsetY)},`);
    }
    if (anim.targeting.targetOffsetX != null) {
      lines.push(`${nested}targetOffsetX: ${formatNum(anim.targeting.targetOffsetX)},`);
    }
    if (anim.targeting.targetOffsetY != null) {
      lines.push(`${nested}targetOffsetY: ${formatNum(anim.targeting.targetOffsetY)},`);
    }
    lines.push(`${inner}},`);
  }
  if (anim.execution && resolveExecutionType(anim.execution) !== 'single-hit') {
    lines.push(formatExecutionLiteral(anim.execution, inner, nested).replace(/\n$/, ''));
  }
  if (anim.statusEffects && anim.statusEffects.length > 0) {
    lines.push(formatStatusEffectsLiteral(anim.statusEffects, inner, nested).replace(/\n$/, ''));
  }
  const cast = anim.cast;
  if (
    cast &&
    (cast.scaleX != null ||
      cast.scaleY != null ||
      cast.scale != null ||
      cast.offsetX != null ||
      cast.offsetY != null ||
      cast.loop ||
      cast.animationId)
  ) {
    lines.push(`${inner}cast: {`);
    if (cast.animationId) lines.push(`${nested}animationId: '${cast.animationId}',`);
    if (cast.scaleX != null) lines.push(`${nested}scaleX: ${formatNum(cast.scaleX)},`);
    if (cast.scaleY != null) lines.push(`${nested}scaleY: ${formatNum(cast.scaleY)},`);
    if (cast.scale != null) lines.push(`${nested}scale: ${formatNum(cast.scale)},`);
    if (cast.offsetX != null) lines.push(`${nested}offsetX: ${formatNum(cast.offsetX)},`);
    if (cast.offsetY != null) lines.push(`${nested}offsetY: ${formatNum(cast.offsetY)},`);
    if (cast.loop) lines.push(`${nested}loop: true,`);
    lines.push(`${inner}},`);
  }
  lines.push(`${indent}},`);
  return lines.join('\n');
}

export function upsertSkillAnimSource(
  characterId: string,
  skillId: string,
  anim: Parameters<typeof formatSkillAnimLiteral>[1],
  options?: LabPatchOptions,
): LabPatchResult {
  const loaded = loadCharacterSource(characterId, options?.source);
  const id = loaded.characterId;
  const { hit } = loaded;
  let source = loaded.source;
  const pack = packObjectRange(source, id);
  if (!pack) throw new Error(`Bloco do pack não encontrado: ${id}`);
  const existing = skillRange(source, pack.start, pack.end, skillId);
  const anims = namedOrInlineObject(source, pack.start, pack.end, 'skillAnims');
  if (!anims) throw new Error(`skillAnims não encontrado em ${id}`);
  const block = source.slice(anims.start, anims.end + 1);
  const indentMatch = /\n([ \t]+)'[^']+'\s*:/.exec(block) ?? /\n([ \t]+)\w+\s*:/.exec(block);
  const indent = indentMatch?.[1] ?? '    ';
  const literal = formatSkillAnimLiteral(skillId, anim, indent);
  if (existing) {
    const objStart = literal.indexOf('{');
    const obj = literal.slice(objStart).replace(/,\s*$/, '');
    source = patchRange(source, existing.start, existing.end, obj);
  } else {
    source = patchRange(source, anims.start, anims.end, insertBeforeLastBrace(block, literal));
  }
  persistSource(hit.absPath, source, options?.persist);
  return { relativePath: hit.relativePath, applied: { skillAnims: skillId }, source, absPath: hit.absPath };
}

export function patchSkillPoseSheet(
  characterId: string,
  skillId: string,
  pose: {
    key: string;
    url: string;
    frames?: readonly string[];
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    frameRate: number;
    loop: boolean;
    loopMode?: FrameLoopMode;
    loopStartFrame?: number;
    loopEndFrame?: number;
    loopDurationMs?: number;
    loopUntilSkillEnd?: boolean;
    flipX?: boolean;
    flipY?: boolean;
    offsetX: number;
    offsetY: number;
    durationMs: number;
    scaleX: number;
    scaleY: number;
  },
  options?: LabPatchOptions,
): LabPatchResult {
  const loaded = loadCharacterSource(characterId, options?.source);
  const id = loaded.characterId;
  const { hit } = loaded;
  let source = loaded.source;
  const pack = packObjectRange(source, id);
  if (!pack) throw new Error(`Bloco do pack não encontrado: ${id}`);
  const existing = skillRange(source, pack.start, pack.end, skillId);
  if (!existing) throw new Error(`Skill ${skillId} não encontrada no fonte (skillAnims).`);
  let skillBlock = source.slice(existing.start, existing.end + 1);
  skillBlock = setStringProp(skillBlock, 'key', pose.key);
  skillBlock = setStringProp(skillBlock, 'url', pose.url);
  skillBlock = setNumericProp(skillBlock, 'frameWidth', pose.frameWidth);
  skillBlock = setNumericProp(skillBlock, 'frameHeight', pose.frameHeight);
  skillBlock = setNumericProp(skillBlock, 'frameCount', pose.frameCount);
  skillBlock = setNumericProp(skillBlock, 'frameRate', pose.frameRate);
  skillBlock = setNumericProp(skillBlock, 'offsetX', pose.offsetX);
  skillBlock = setNumericProp(skillBlock, 'offsetY', pose.offsetY);
  skillBlock = setNumericProp(skillBlock, 'durationMs', pose.durationMs);
  skillBlock = upsertStringArrayProp(skillBlock, 'frames', pose.frames ?? null);
  const poseMode = canonicalizeLoopMode(pose.loopMode) ?? (pose.loop ? 'full' : 'none');
  if (legacyLoopFromMode(poseMode)) skillBlock = setBooleanProp(skillBlock, 'loop', true);
  else skillBlock = removeProp(skillBlock, 'loop');
  skillBlock = setStringProp(skillBlock, 'loopMode', poseMode);
  if (pose.loopStartFrame != null) skillBlock = setNumericProp(skillBlock, 'loopStartFrame', pose.loopStartFrame);
  if (pose.loopEndFrame != null) skillBlock = setNumericProp(skillBlock, 'loopEndFrame', pose.loopEndFrame);
  if (pose.loopDurationMs != null) skillBlock = setNumericProp(skillBlock, 'loopDurationMs', pose.loopDurationMs);
  if (pose.loopUntilSkillEnd != null) skillBlock = setBooleanProp(skillBlock, 'loopUntilSkillEnd', pose.loopUntilSkillEnd);
  if (pose.flipX != null) skillBlock = setBooleanProp(skillBlock, 'flipX', pose.flipX);
  if (pose.flipY != null) skillBlock = setBooleanProp(skillBlock, 'flipY', pose.flipY);
  skillBlock = upsertCast(skillBlock, {
    scaleX: pose.scaleX,
    scaleY: pose.scaleY,
    scale: pose.scaleY,
    offsetX: pose.offsetX,
    offsetY: pose.offsetY,
    loop: legacyLoopFromMode(poseMode),
    loopMode: poseMode,
    loopStartFrame: pose.loopStartFrame,
    loopEndFrame: pose.loopEndFrame,
    loopDurationMs: pose.loopDurationMs,
    loopUntilSkillEnd: pose.loopUntilSkillEnd,
    flipX: pose.flipX,
    flipY: pose.flipY,
  });
  source = patchRange(source, existing.start, existing.end, skillBlock);
  persistSource(hit.absPath, source, options?.persist);
  return { relativePath: hit.relativePath, applied: { skillAnims: skillId }, source, absPath: hit.absPath };
}

function setBooleanProp(block: string, key: string, value: boolean): string {
  const re = new RegExp(`(${key}\\s*:\\s*)(?:true|false)`);
  if (re.test(block)) return block.replace(re, `$1${value ? 'true' : 'false'}`);
  return insertBeforeLastBrace(block, `${key}: ${value ? 'true' : 'false'},`);
}

function upsertStringArrayProp(block: string, key: string, values: readonly string[] | null): string {
  const re = new RegExp(`(?:^|,|\\n)([ \\t]*${key}\\s*:)`);
  const match = re.exec(block);
  const literal =
    values && values.length > 0 ? `[${values.map((value) => `'${value}'`).join(', ')}]` : null;
  if (!match || match.index == null) {
    if (!literal) return block;
    return insertBeforeLastBrace(block, `${key}: ${literal},`);
  }
  const colon = block.indexOf(':', match.index);
  let i = colon + 1;
  while (i < block.length && /\s/.test(block[i])) i += 1;
  if (block[i] !== '[') {
    const without = removeProp(block, key);
    if (!literal) return without;
    return insertBeforeLastBrace(without, `${key}: ${literal},`);
  }
  const end = matchingBracket(block, i);
  if (end < 0) throw new Error(`Array ${key} quebrado`);
  if (!literal) {
    const keyStart = match.index + (block[match.index] === ',' || block[match.index] === '\n' ? 1 : 0);
    return `${block.slice(0, keyStart)}${block.slice(end + 1)}`.replace(/,\s*,/g, ',');
  }
  return `${block.slice(0, i)}${literal}${block.slice(end + 1)}`;
}

export function parseLabSaveChanges(raw: Record<string, unknown>): LabSaveChanges {
  return sanitizeChanges(raw);
}

function sanitizeChanges(raw: Record<string, unknown>): LabSaveChanges {
  const allowedNums = new Set<string>(LAB_SAVEABLE_NUMBER_FIELDS);
  const out: LabSaveChanges = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'targetMode') {
      if (!isSkillVfxTargetMode(value)) throw new Error(`targetMode inválido: ${String(value)}`);
      out.targetMode = value;
      continue;
    }
    if (key === 'vfxId') {
      if (value === null || value === '') {
        out.vfxId = null;
        continue;
      }
      if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{1,62}$/.test(value)) {
        throw new Error(`vfxId inválido: ${String(value)}`);
      }
      out.vfxId = value;
      continue;
    }
    if (key === 'poseVfxId') {
      if (value === null || value === '') {
        out.poseVfxId = null;
        continue;
      }
      if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{1,62}$/.test(value)) {
        throw new Error(`poseVfxId inválido: ${String(value)}`);
      }
      out.poseVfxId = value;
      continue;
    }
    if (key === 'castAnimationId') {
      if (value === null || value === '') {
        out.castAnimationId = null;
        continue;
      }
      if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(value)) {
        throw new Error(`castAnimationId inválido: ${String(value)}`);
      }
      out.castAnimationId = value;
      continue;
    }
    if (key === 'vfxLoopMode') {
      if (!isFrameLoopMode(value)) throw new Error(`vfxLoopMode inválido: ${String(value)}`);
      out.vfxLoopMode = canonicalizeLoopMode(value) ?? 'none';
      continue;
    }
    if (key === 'vfxFlipX' || key === 'vfxFlipY' || key === 'vfxLoopUntilSkillEnd') {
      out[key] = Boolean(value);
      continue;
    }
    if (key === 'vfxLoopStartFrame' || key === 'vfxLoopEndFrame' || key === 'vfxLoopDurationMs') {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`${key} inválido`);
      out[key] = Math.round(n);
      continue;
    }
    if (key === 'execution') {
      out.execution = parseSkillExecution(value);
      continue;
    }
    if (key === 'statusEffects') {
      out.statusEffects = parseSkillStatusEffects(value);
      continue;
    }
    if (key === 'element') {
      if (!isDamageElement(value)) throw new Error(`unknown element: ${String(value)}`);
      out.element = value;
      continue;
    }
    if (key === 'ai') {
      out.ai = parseSkillAi(value);
      continue;
    }
    if (key === 'spriteAlignment') {
      if (!value || typeof value !== 'object') {
        throw new Error('spriteAlignment inválido');
      }
      const raw = value as Record<string, unknown>;
      const point = (entry: unknown) => {
        if (!entry || typeof entry !== 'object') return { x: 0, y: 0 };
        const obj = entry as Record<string, unknown>;
        const x = Number(obj.x);
        const y = Number(obj.y);
        return {
          x: Number.isFinite(x) ? Math.round(x) : 0,
          y: Number.isFinite(y) ? Math.round(y) : 0,
        };
      };
      // Contextos omitidos ficam undefined → merge com o valor já persistido.
      out.spriteAlignment = {
        ...(raw.hub !== undefined ? { hub: point(raw.hub) } : {}),
        ...(raw.hunt !== undefined ? { hunt: point(raw.hunt) } : {}),
      };
      continue;
    }
    if (!allowedNums.has(key)) {
      throw new Error(`Campo não permitido: ${key}`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Valor inválido para ${key}`);
    }
    out[key as LabSaveableNumberField] = value;
  }
  if (out.targetMode && !(SKILL_VFX_TARGET_MODES as readonly string[]).includes(out.targetMode)) {
    throw new Error(`targetMode inválido: ${out.targetMode}`);
  }
  return out;
}

/**
 * Aplica deltas do Test Lab no arquivo-fonte (sem reformatar o arquivo inteiro).
 * Sprite `scale*` / `offset*` são relativos; campos de VFX/targeting são absolutos.
 */
export function patchCharacterSource(input: LabSourcePatch, options?: LabPatchOptions): LabPatchResult {
  const changes = sanitizeChanges(input.changes as Record<string, unknown>);
  const loaded = loadCharacterSource(input.characterId, options?.source);
  const characterId = loaded.characterId;
  const { hit } = loaded;
  let source = loaded.source;
  if (!packObjectRange(source, characterId)) {
    throw new Error(`Bloco do pack não encontrado: ${characterId}`);
  }

  const applied: Record<string, string | number> = {};
  const scaleY = changes.scaleY ?? 1;
  const scaleX = changes.scaleX ?? 1;

  const currentPack = () => {
    const next = packObjectRange(source, characterId);
    if (!next) throw new Error('Bloco do pack perdido durante o patch.');
    return next;
  };

  if (changes.spriteAlignment) {
    const range = currentPack();
    let packBlock = source.slice(range.start, range.end + 1);
    const previous = readSpriteAlignmentFromSource(source, characterId);
    // Merge seguro: só os contextos enviados; o restante do pack (skills/VFX) fica intacto.
    const incoming = changes.spriteAlignment;
    const alignment = normalizeSpriteAlignment({
      hub: incoming.hub ?? previous?.hub,
      hunt: incoming.hunt ?? previous?.hunt,
    });
    const literal = [
      'spriteAlignment: {',
      `  hub: { x: ${alignment.hub.x}, y: ${alignment.hub.y} },`,
      `  hunt: { x: ${alignment.hunt.x}, y: ${alignment.hunt.y} },`,
      '},',
    ].join('\n  ');
    const existing = firstPropAssignment(packBlock, 'spriteAlignment');
    if (existing) {
      // Replace from key start through object end (include trailing comma if present).
      const keyMatch = /spriteAlignment\s*:/.exec(packBlock);
      if (!keyMatch || keyMatch.index == null) throw new Error('spriteAlignment key lost');
      let end = existing.end;
      let i = end + 1;
      while (i < packBlock.length && /\s/.test(packBlock[i])) i += 1;
      if (packBlock[i] === ',') end = i;
      packBlock = `${packBlock.slice(0, keyMatch.index)}${literal}${packBlock.slice(end + 1)}`;
    } else {
      packBlock = insertBeforeLastBrace(packBlock, literal);
    }
    source = patchRange(source, range.start, range.end, packBlock);
    applied['spriteAlignment.hub.x'] = alignment.hub.x;
    applied['spriteAlignment.hub.y'] = alignment.hub.y;
    applied['spriteAlignment.hunt.x'] = alignment.hunt.x;
    applied['spriteAlignment.hunt.y'] = alignment.hunt.y;
  }

  if (changes.scaleY != null && changes.scaleY !== 1) {
    const range = currentPack();
    const packBlock = source.slice(range.start, range.end + 1);
    const current = readCurrentNumber(packBlock, 'displayScale', 1);
    const next = current * changes.scaleY;
    source = patchRange(source, range.start, range.end, setNumericProp(packBlock, 'displayScale', next));
    applied.displayScale = next;
  }

  if (changes.scaleX != null && (changes.scaleX !== 1 || (changes.scaleY != null && changes.scaleY !== 1))) {
    const range = currentPack();
    const packBlock = source.slice(range.start, range.end + 1);
    const current = readCurrentNumber(packBlock, 'displayScaleX', 1);
    const ratio = scaleY !== 0 ? scaleX / scaleY : scaleX;
    const next = current * ratio;
    if (Math.abs(next - current) > 0.0001) {
      source = patchRange(source, range.start, range.end, setNumericProp(packBlock, 'displayScaleX', next));
      applied.displayScaleX = next;
    }
  }

  const spriteOffset = (key: 'offsetX' | 'offsetY') => changes[key] != null && changes[key] !== 0;
  if (spriteOffset('offsetX') || spriteOffset('offsetY')) {
    for (const sheet of ['idle', 'walk'] as const) {
      const range = currentPack();
      const sheetPos = sheetRange(source, range.start, range.end, sheet);
      if (!sheetPos) continue;
      let block = source.slice(sheetPos.start, sheetPos.end + 1);
      if (spriteOffset('offsetX')) {
        const next = readCurrentNumber(block, 'offsetX', 0) + (changes.offsetX ?? 0);
        block = setNumericProp(block, 'offsetX', next);
        applied[`${sheet}.offsetX`] = next;
      }
      if (spriteOffset('offsetY')) {
        const next = readCurrentNumber(block, 'offsetY', 0) + (changes.offsetY ?? 0);
        block = setNumericProp(block, 'offsetY', next);
        applied[`${sheet}.offsetY`] = next;
      }
      source = patchRange(source, sheetPos.start, sheetPos.end, block);
    }
  }

  if (changes.frameRate != null && changes.frameRate !== 1) {
    for (const sheet of ['idle', 'walk'] as const) {
      const range = currentPack();
      const sheetPos = sheetRange(source, range.start, range.end, sheet);
      if (!sheetPos) continue;
      const block = source.slice(sheetPos.start, sheetPos.end + 1);
      const current = readCurrentNumber(block, 'frameRate', sheet === 'idle' ? 8 : 12);
      const next = Math.max(1, Math.round(current * changes.frameRate));
      source = patchRange(source, sheetPos.start, sheetPos.end, setNumericProp(block, 'frameRate', next));
      applied[`${sheet}.frameRate`] = next;
    }
  }

  const skillId = input.skillId?.trim();
  const wantsSkill =
    changes.vfxScale != null ||
    changes.vfxOffsetX != null ||
    changes.vfxOffsetY != null ||
    changes.hitDelayMs != null ||
    changes.fxReleaseMs != null ||
    changes.targetMode != null ||
    changes.travelSpeed != null ||
    changes.spawnOffsetX != null ||
    changes.spawnOffsetY != null ||
    changes.targetOffsetX != null ||
    changes.targetOffsetY != null ||
    changes.vfxId !== undefined ||
    changes.poseVfxId !== undefined ||
    changes.poseScale != null ||
    changes.poseOffsetX != null ||
    changes.poseOffsetY != null ||
    changes.castAnimationId !== undefined ||
    changes.castDelayMs != null ||
    changes.execution != null ||
    changes.statusEffects != null ||
    changes.vfxLoopMode != null ||
    changes.vfxLoopStartFrame != null ||
    changes.vfxLoopEndFrame != null ||
    changes.vfxLoopDurationMs != null ||
    changes.vfxLoopUntilSkillEnd != null ||
    changes.vfxFlipX != null ||
    changes.vfxFlipY != null;

  if (wantsSkill) {
    if (!skillId) throw new Error('Selecione uma skill para salvar VFX/targeting.');
    const packRange = currentPack();
    const skill = skillRange(source, packRange.start, packRange.end, skillId);
    if (!skill) throw new Error(`Skill ${skillId} não encontrada no fonte (skillAnims).`);
    let skillBlock = source.slice(skill.start, skill.end + 1);

    if (changes.hitDelayMs != null) {
      skillBlock = setNumericProp(skillBlock, 'hitDelayMs', changes.hitDelayMs);
      applied.hitDelayMs = changes.hitDelayMs;
    }
    if (changes.fxReleaseMs != null) {
      skillBlock = setNumericProp(skillBlock, 'fxReleaseMs', changes.fxReleaseMs);
      applied.fxReleaseMs = changes.fxReleaseMs;
    }
    if (changes.vfxScale != null) {
      skillBlock = setNumericProp(skillBlock, 'fxScale', changes.vfxScale);
      applied.fxScale = changes.vfxScale;
    }
    if (changes.castDelayMs != null) {
      skillBlock = setNumericProp(skillBlock, 'castDelayMs', Math.max(0, Math.round(changes.castDelayMs)));
      applied.castDelayMs = Math.max(0, Math.round(changes.castDelayMs));
    }

    if (changes.vfxLoopMode) {
      const mode = canonicalizeLoopMode(changes.vfxLoopMode) ?? changes.vfxLoopMode;
      skillBlock = setStringProp(skillBlock, 'vfxLoopMode', mode);
      applied.vfxLoopMode = mode;
    }
    if (changes.vfxLoopStartFrame != null) {
      skillBlock = setNumericProp(skillBlock, 'vfxLoopStartFrame', changes.vfxLoopStartFrame);
      applied.vfxLoopStartFrame = changes.vfxLoopStartFrame;
    }
    if (changes.vfxLoopEndFrame != null) {
      skillBlock = setNumericProp(skillBlock, 'vfxLoopEndFrame', changes.vfxLoopEndFrame);
      applied.vfxLoopEndFrame = changes.vfxLoopEndFrame;
    }
    if (changes.vfxLoopDurationMs != null) {
      skillBlock = setNumericProp(skillBlock, 'vfxLoopDurationMs', changes.vfxLoopDurationMs);
      applied.vfxLoopDurationMs = changes.vfxLoopDurationMs;
    }
    if (changes.vfxLoopUntilSkillEnd != null) {
      skillBlock = setBooleanProp(skillBlock, 'vfxLoopUntilSkillEnd', changes.vfxLoopUntilSkillEnd);
      applied.vfxLoopUntilSkillEnd = changes.vfxLoopUntilSkillEnd ? 'true' : 'false';
    }
    if (changes.vfxFlipX != null) {
      skillBlock = setBooleanProp(skillBlock, 'vfxFlipX', changes.vfxFlipX);
      applied.vfxFlipX = changes.vfxFlipX ? 'true' : 'false';
    }
    if (changes.vfxFlipY != null) {
      skillBlock = setBooleanProp(skillBlock, 'vfxFlipY', changes.vfxFlipY);
      applied.vfxFlipY = changes.vfxFlipY ? 'true' : 'false';
    }

    if (changes.vfxId !== undefined) {
      if (changes.vfxId) {
        skillBlock = setStringProp(skillBlock, 'vfxId', changes.vfxId);
        applied.vfxId = changes.vfxId;
      } else {
        skillBlock = removeProp(skillBlock, 'vfxId');
        applied.vfxId = 'nenhum';
      }
    }

    const catalogSkill =
      changes.vfxId !== null && (Boolean(changes.vfxId) || /\bvfxId\s*:/.test(skillBlock));

    const targetingFields: Parameters<typeof upsertTargeting>[1] = {};
    if (changes.targetMode) targetingFields.mode = changes.targetMode;
    if (changes.travelSpeed != null) targetingFields.travelSpeed = changes.travelSpeed;
    if (changes.spawnOffsetX != null) targetingFields.spawnOffsetX = changes.spawnOffsetX;
    if (changes.spawnOffsetY != null) targetingFields.spawnOffsetY = changes.spawnOffsetY;
    if (changes.targetOffsetX != null) targetingFields.targetOffsetX = changes.targetOffsetX;
    if (changes.targetOffsetY != null) targetingFields.targetOffsetY = changes.targetOffsetY;
    if (Object.keys(targetingFields).length > 0) {
      skillBlock = upsertTargeting(skillBlock, targetingFields);
      if (targetingFields.mode) applied['targeting.mode'] = targetingFields.mode;
      if (targetingFields.travelSpeed != null) applied['targeting.travelSpeed'] = targetingFields.travelSpeed;
      if (targetingFields.spawnOffsetX != null) applied['targeting.spawnOffsetX'] = targetingFields.spawnOffsetX;
      if (targetingFields.spawnOffsetY != null) applied['targeting.spawnOffsetY'] = targetingFields.spawnOffsetY;
      if (targetingFields.targetOffsetX != null) applied['targeting.targetOffsetX'] = targetingFields.targetOffsetX;
      if (targetingFields.targetOffsetY != null) applied['targeting.targetOffsetY'] = targetingFields.targetOffsetY;
    }

    const wantsCast =
      changes.poseVfxId !== undefined ||
      changes.castAnimationId !== undefined ||
      changes.poseScale != null ||
      changes.poseOffsetX != null ||
      changes.poseOffsetY != null;
    if (wantsCast) {
      skillBlock = upsertCast(skillBlock, {
        vfxId: changes.poseVfxId,
        animationId: changes.castAnimationId,
        scale: changes.poseScale,
        offsetX: changes.poseOffsetX,
        offsetY: changes.poseOffsetY,
      });
      if (changes.poseVfxId !== undefined) applied.poseVfxId = changes.poseVfxId ?? 'nenhum';
      if (changes.castAnimationId !== undefined) applied.castAnimationId = changes.castAnimationId ?? 'nenhuma';
      if (changes.poseScale != null) applied.poseScale = changes.poseScale;
      if (changes.poseOffsetX != null) applied.poseOffsetX = changes.poseOffsetX;
      if (changes.poseOffsetY != null) applied.poseOffsetY = changes.poseOffsetY;
    }

    if (changes.execution) {
      skillBlock = upsertExecution(skillBlock, changes.execution);
      applied.execution = resolveExecutionType(changes.execution);
    }
    if (changes.statusEffects) {
      skillBlock = upsertStatusEffects(skillBlock, changes.statusEffects);
      applied.statusEffects = changes.statusEffects.map((entry) => entry.statusId).join(',') || 'nenhum';
    }
    if (changes.element) {
      skillBlock = setStringProp(skillBlock, 'element', changes.element);
      applied.element = changes.element;
    }
    if (changes.ai) {
      skillBlock = upsertAi(skillBlock, changes.ai);
      applied.ai = `P${changes.ai.priority ?? '?'} ${changes.ai.autoUse === false ? 'off' : 'on'}`;
    }

    source = patchRange(source, skill.start, skill.end, skillBlock);

    if (changes.vfxOffsetX != null || changes.vfxOffsetY != null) {
      const packAfter = currentPack();
      const skillAfter = skillRange(source, packAfter.start, packAfter.end, skillId);
      if (!skillAfter) throw new Error(`Skill ${skillId} não encontrada após patch.`);
      let nextSkill = source.slice(skillAfter.start, skillAfter.end + 1);
      if (catalogSkill) {
        if (changes.vfxOffsetX != null) {
          nextSkill = setNumericProp(nextSkill, 'vfxOffsetX', changes.vfxOffsetX);
          applied.vfxOffsetX = changes.vfxOffsetX;
        }
        if (changes.vfxOffsetY != null) {
          nextSkill = setNumericProp(nextSkill, 'vfxOffsetY', changes.vfxOffsetY);
          applied.vfxOffsetY = changes.vfxOffsetY;
        }
        source = patchRange(source, skillAfter.start, skillAfter.end, nextSkill);
      } else {
        const fx = fxRange(source, skillAfter.start, skillAfter.end);
        if (!fx) throw new Error(`A skill ${skillId} não tem bloco fx para offset visual.`);
        let fxBlock = source.slice(fx.start, fx.end + 1);
        if (changes.vfxOffsetX != null) {
          fxBlock = setNumericProp(fxBlock, 'offsetX', changes.vfxOffsetX);
          applied['fx.offsetX'] = changes.vfxOffsetX;
        }
        if (changes.vfxOffsetY != null) {
          fxBlock = setNumericProp(fxBlock, 'offsetY', changes.vfxOffsetY);
          applied['fx.offsetY'] = changes.vfxOffsetY;
        }
        source = patchRange(source, fx.start, fx.end, fxBlock);
      }
    }
  }

  if (Object.keys(applied).length === 0 && options?.persist !== false) {
    throw new Error('Nenhuma alteração visual para gravar.');
  }

  const check = packObjectRange(source, characterId);
  if (!check) throw new Error('Validação falhou: pack quebrado após o patch.');
  persistSource(hit.absPath, source, options?.persist);
  return { relativePath: hit.relativePath, applied, source, absPath: hit.absPath };
}
