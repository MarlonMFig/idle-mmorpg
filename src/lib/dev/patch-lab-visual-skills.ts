import path from 'node:path';
import type { SkillDefinition } from '@/types/skill';
import { formatStatusEffectsLiteral } from '@/data/status-effect-def';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import { readDevSource, writeDevSource } from '@/lib/dev/write-dev-source';

const FILE_REL = 'src/data/lab-visual-skills.ts';

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

function formatDef(def: SkillDefinition): string {
  const lines = [
    '  {',
    `    id: '${def.id}',`,
    `    name: ${JSON.stringify(def.name)},`,
    `    element: '${def.element}',`,
    `    cooldownMs: ${def.cooldownMs},`,
    `    damage: ${def.damage},`,
    `    icon: '${def.icon}',`,
    `    animation: { kind: '${def.animation.kind}', durationMs: ${def.animation.durationMs ?? 600}, scale: ${def.animation.scale ?? 1} },`,
    `    range: ${def.range ?? 80},`,
    `    description: ${JSON.stringify(def.description ?? 'Skill de teste visual (DEV Lab).')},`,
    `    developmentStatus: '${def.developmentStatus ?? 'visual-test'}',`,
  ];
  if (def.statusEffects && def.statusEffects.length > 0) {
    lines.push(formatStatusEffectsLiteral(def.statusEffects, '    ', '      '));
  }
  lines.push('  },');
  return lines.join('\n');
}

export function insertLabVisualSkill(
  def: SkillDefinition,
  options?: { persist?: boolean },
): { relativePath: string; absPath: string; source: string; changed: boolean } {
  const absPath = path.join(process.cwd(), FILE_REL);
  assertWritableSourcePath(absPath);
  const source = readDevSource(absPath);
  if (new RegExp(`\\bid:\\s*['"]${def.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source)) {
    return { relativePath: FILE_REL, absPath, source, changed: false };
  }
  const match = /export const LAB_VISUAL_SKILLS(?:\s*:\s*SkillDefinition\[\])?\s*=\s*\[/.exec(source);
  if (!match || match.index == null) throw new Error('LAB_VISUAL_SKILLS não encontrado');
  // O `[` do array vem depois de `=`. indexOf('[') pegaria o `[]` do tipo.
  const open = match.index + match[0].length - 1;
  const end = matchingBracket(source, open);
  if (end < 0) throw new Error('LAB_VISUAL_SKILLS quebrado');
  const inner = source.slice(open + 1, end).trim();
  const entry = formatDef(def);
  const nextInner = inner.length === 0 ? `\n${entry}\n` : `\n${inner.replace(/,?\s*$/, ',')}\n${entry}\n`;
  const next = `${source.slice(0, open + 1)}${nextInner}${source.slice(end)}`;
  if (options?.persist !== false) writeDevSource(absPath, next);
  return { relativePath: FILE_REL, absPath, source: next, changed: true };
}

export function patchLabVisualSkillElement(
  skillId: string,
  element: string,
  options?: { persist?: boolean },
): { relativePath: string; absPath: string; source: string; changed: boolean } {
  const absPath = path.join(process.cwd(), FILE_REL);
  assertWritableSourcePath(absPath);
  const source = readDevSource(absPath);
  const escaped = skillId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idRe = new RegExp(`id:\\s*['"]${escaped}['"]`);
  const idMatch = idRe.exec(source);
  if (!idMatch || idMatch.index == null) {
    return { relativePath: FILE_REL, absPath, source, changed: false };
  }
  const open = source.lastIndexOf('{', idMatch.index);
  const end = matchingBracket(source, open);
  if (open < 0 || end < 0) return { relativePath: FILE_REL, absPath, source, changed: false };
  let block = source.slice(open, end + 1);
  const current = /\belement\s*:\s*['"]([^'"]*)['"]/.exec(block)?.[1];
  if (current === element) {
    return { relativePath: FILE_REL, absPath, source, changed: false };
  }
  if (/\belement\s*:/.test(block)) {
    block = block.replace(/(\belement\s*:\s*)['"][^'"]*['"]/, `$1'${element}'`);
  } else {
    block = block.replace(/(\bid:\s*['"][^'"]+['"],)/, `$1\n    element: '${element}',`);
  }
  const next = `${source.slice(0, open)}${block}${source.slice(end + 1)}`;
  if (options?.persist !== false) writeDevSource(absPath, next);
  return { relativePath: FILE_REL, absPath, source: next, changed: true };
}
