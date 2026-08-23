import fs from 'node:fs';
import path from 'node:path';
import {
  formatStatusDefinitionLiteral,
  isStatusId,
  parseStatusEffectDefinition,
  type StatusEffectDefinition,
} from '@/data/status-effect-def';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';

const FILE_REL = 'src/data/status/catalog.ts';

function catalogAbs(): string {
  return path.join(process.cwd(), FILE_REL);
}

function matchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function recordRange(source: string): { start: number; end: number } {
  const match = /export const STATUS_BY_ID[^=]*=\s*\{/.exec(source);
  if (!match || match.index == null) throw new Error('Catálogo STATUS_BY_ID não encontrado');
  const open = source.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  if (end < 0) throw new Error('Catálogo STATUS_BY_ID quebrado');
  return { start: open, end };
}

function entryRange(source: string, id: string): { start: number; end: number } | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`['"]${escaped}['"]\\s*:\\s*\\{`);
  const match = re.exec(source);
  if (!match || match.index == null) return null;
  const open = source.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  if (end < 0) return null;
  return { start: match.index, end };
}

export function upsertStatusCatalogEntry(
  raw: StatusEffectDefinition,
  mode: 'create' | 'update',
): { relativePath: string } {
  const next = parseStatusEffectDefinition(raw);
  const abs = catalogAbs();
  assertWritableSourcePath(abs);
  let source = fs.readFileSync(abs, 'utf8');
  const existing = entryRange(source, next.id);
  if (mode === 'create' && existing) throw new Error('Status ID already exists');
  if (mode === 'update' && !existing) throw new Error(`Status ${next.id} não encontrado`);

  if (existing) {
    let replaceEnd = existing.end;
    if (source[replaceEnd + 1] === ',') replaceEnd = existing.end + 1;
    const lineStart = source.lastIndexOf('\n', existing.start) + 1;
    const indent = source.slice(lineStart, existing.start) || '  ';
    source = `${source.slice(0, lineStart)}${formatStatusDefinitionLiteral(next, indent)}${source.slice(replaceEnd + 1)}`;
  } else {
    const record = recordRange(source);
    source = `${source.slice(0, record.end)}\n${formatStatusDefinitionLiteral(next, '  ')}${source.slice(record.end)}`;
  }
  fs.writeFileSync(abs, source, 'utf8');
  return { relativePath: FILE_REL };
}

export function removeStatusCatalogEntry(id: string): { relativePath: string } {
  if (!isStatusId(id)) throw new Error('ID inválido');
  const abs = catalogAbs();
  assertWritableSourcePath(abs);
  let source = fs.readFileSync(abs, 'utf8');
  const existing = entryRange(source, id);
  if (!existing) throw new Error(`Status ${id} não encontrado`);
  let from = existing.start;
  while (from > 0 && source[from - 1] === ' ') from -= 1;
  if (source[from - 1] === '\n') from -= 1;
  if (source[from - 1] === '\r') from -= 1;
  let to = existing.end + 1;
  if (source[to] === ',') to += 1;
  if (source[to] === '\r') to += 1;
  if (source[to] === '\n') to += 1;
  source = source.slice(0, from) + source.slice(to);
  fs.writeFileSync(abs, source, 'utf8');
  return { relativePath: FILE_REL };
}
