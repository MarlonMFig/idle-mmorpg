import fs from 'node:fs';
import path from 'node:path';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import type { HubEffect } from '@/data/hub-effects';
import { isHubBirdsEffect, isHubSmokeEffect } from '@/data/hub-effects';

const HUB_EFFECTS_REL = 'src/data/hub-effects.ts';

function absFromRel(rel: string): string {
  const abs = path.resolve(process.cwd(), rel);
  assertWritableSourcePath(abs);
  return abs;
}

function effectToSource(entry: HubEffect, indent = '  '): string {
  if (isHubSmokeEffect(entry)) {
    return `${indent}{
${indent}  id: ${JSON.stringify(entry.id)},
${indent}  kind: 'smoke',
${indent}  label: ${JSON.stringify(entry.label)},
${indent}  enabled: ${entry.enabled},
${indent}  x: ${Math.round(entry.x)},
${indent}  y: ${Math.round(entry.y)},
${indent}}`;
  }
  if (isHubBirdsEffect(entry)) {
    return `${indent}{
${indent}  id: ${JSON.stringify(entry.id)},
${indent}  kind: 'birds',
${indent}  label: ${JSON.stringify(entry.label)},
${indent}  enabled: ${entry.enabled},
${indent}}`;
  }
  throw new Error(`Tipo de efeito desconhecido: ${(entry as HubEffect).kind}`);
}

function serializeHubEffects(effects: HubEffect[]): string {
  const body = effects.map((entry) => effectToSource(entry)).join(',\n');
  return `export const HUB_EFFECTS: readonly HubEffect[] = [\n${body},\n] as const;`;
}

export function readHubEffectsFromSource(): HubEffect[] {
  const abs = absFromRel(HUB_EFFECTS_REL);
  const source = fs.readFileSync(abs, 'utf8');
  const marker = 'export const HUB_EFFECTS';
  const idx = source.indexOf(marker);
  if (idx < 0) throw new Error('HUB_EFFECTS não encontrado');
  const start = source.indexOf('[', idx);
  const end = source.indexOf('] as const;', start);
  if (start < 0 || end < 0) throw new Error('Array HUB_EFFECTS inválido');
  const arrayLiteral = source.slice(start, end + 1);
  // eslint-disable-next-line no-new-func -- dev-only: avalia array TS estático do repo
  const parsed = new Function(`return ${arrayLiteral}`)() as HubEffect[];
  return parsed;
}

export function patchHubEffectsSource(effects: HubEffect[]): {
  relativePath: string;
  absPath: string;
  source: string;
  applied: string[];
} {
  const abs = absFromRel(HUB_EFFECTS_REL);
  let source = fs.readFileSync(abs, 'utf8');
  const marker = 'export const HUB_EFFECTS: readonly HubEffect[] = [';
  const idx = source.indexOf(marker);
  if (idx < 0) throw new Error('HUB_EFFECTS não encontrado');
  const end = source.indexOf('] as const;', idx);
  if (end < 0) throw new Error('Fim de HUB_EFFECTS não encontrado');
  const replacement = serializeHubEffects(effects);
  source = source.slice(0, idx) + replacement + source.slice(end + '] as const;'.length);
  return {
    relativePath: HUB_EFFECTS_REL,
    absPath: abs,
    source,
    applied: effects.map((e) => `${e.id}(${e.kind})`),
  };
}
