import fs from 'node:fs';
import {
  formatSequenceDimensionError,
  isSequenceVfx,
  isVfxId,
  isVfxUniverse,
  resolveVfxRenderLayer,
  type SharedVfxDefinition,
} from '@/data/vfx/types';
import { catalogSourceAbs, catalogSourceRel, resolvePublicVfxUrl } from '@/lib/dev/vfx-paths';

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

function recordRange(source: string): { start: number; end: number } {
  const match = /export const VFX_BY_ID[^=]*=\s*\{/.exec(source);
  if (!match || match.index == null) throw new Error('Catálogo VFX_BY_ID não encontrado');
  const open = source.indexOf('{', match.index);
  const end = matchingBrace(source, open);
  if (end < 0) throw new Error('Catálogo VFX_BY_ID quebrado');
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

function formatDef(def: SharedVfxDefinition, indent: string): string {
  const inner = `${indent}  `;
  const sourceType = def.sourceType ?? 'spritesheet';
  const lines = [
    `${indent}'${def.id}': {`,
    `${inner}id: '${def.id}',`,
    `${inner}name: ${JSON.stringify(def.name)},`,
    `${inner}universe: '${def.universe}',`,
    `${inner}url: '${def.url}',`,
    `${inner}sourceType: '${sourceType}',`,
  ];
  if (sourceType === 'sequence' && def.frames && def.frames.length > 0) {
    lines.push(`${inner}frames: [`);
    for (const frame of def.frames) {
      lines.push(`${inner}  '${frame}',`);
    }
    lines.push(`${inner}],`);
  }
  lines.push(
    `${inner}frameWidth: ${def.frameWidth},`,
    `${inner}frameHeight: ${def.frameHeight},`,
    `${inner}frameCount: ${def.frameCount},`,
    `${inner}frameRate: ${def.frameRate},`,
    `${inner}loop: ${def.loop ? 'true' : 'false'},`,
    `${inner}defaultScale: ${def.defaultScale},`,
    `${inner}defaultOffsetX: ${def.defaultOffsetX},`,
    `${inner}defaultOffsetY: ${def.defaultOffsetY},`,
    `${inner}renderLayer: '${def.renderLayer ?? 'front-of-characters'}',`,
    `${indent}},`,
  );
  return lines.join('\n');
}

function validateDef(raw: SharedVfxDefinition, image?: { width: number; height: number }): SharedVfxDefinition {
  if (!isVfxId(raw.id)) throw new Error('ID inválido (use kebab-case, ex.: dimension-slash)');
  const name = raw.name.trim();
  if (!name) throw new Error('Nome obrigatório');
  if (!isVfxUniverse(raw.universe)) throw new Error('Universo inválido');
  const sourceType = raw.sourceType === 'sequence' ? 'sequence' : 'spritesheet';
  const frames =
    sourceType === 'sequence'
      ? (raw.frames ?? []).map((frame) => frame.trim()).filter(Boolean)
      : undefined;
  if (sourceType === 'sequence') {
    if (!frames || frames.length < 1) throw new Error('Sequência precisa de pelo menos 1 frame');
    for (const frame of frames) resolvePublicVfxUrl(frame);
  } else {
    resolvePublicVfxUrl(raw.url);
  }
  const url = (sourceType === 'sequence' ? frames![0] : raw.url).trim();
  const frameCount = sourceType === 'sequence' ? frames!.length : raw.frameCount;
  if (!(raw.frameWidth > 0) || !(raw.frameHeight > 0) || !(frameCount > 0) || !(raw.frameRate > 0)) {
    throw new Error('Frames e FPS devem ser maiores que zero');
  }
  if (!Number.isInteger(raw.frameWidth) || !Number.isInteger(raw.frameHeight) || !Number.isInteger(frameCount)) {
    throw new Error('Largura, altura e frameCount devem ser inteiros');
  }
  if (!(raw.defaultScale > 0)) throw new Error('Scale inicial deve ser maior que zero');
  if (image && !isSequenceVfx({ sourceType })) {
    const cols = Math.floor(image.width / raw.frameWidth);
    const rows = Math.floor(image.height / raw.frameHeight);
    const maxFrames = Math.max(0, cols * rows);
    if (raw.frameWidth > image.width || raw.frameHeight > image.height) {
      throw new Error(`Frame ${raw.frameWidth}×${raw.frameHeight} não cabe em ${image.width}×${image.height}`);
    }
    if (frameCount > maxFrames) {
      throw new Error(`frameCount ${frameCount} não cabe na imagem (${maxFrames} frames de ${raw.frameWidth}×${raw.frameHeight})`);
    }
  }
  if (image && isSequenceVfx({ sourceType })) {
    if (image.width !== raw.frameWidth || image.height !== raw.frameHeight) {
      throw new Error(formatSequenceDimensionError(0, { width: raw.frameWidth, height: raw.frameHeight }, image));
    }
  }
  return {
    id: raw.id,
    name,
    universe: raw.universe,
    url,
    sourceType,
    frames,
    frameWidth: raw.frameWidth,
    frameHeight: raw.frameHeight,
    frameCount,
    frameRate: raw.frameRate,
    loop: Boolean(raw.loop),
    defaultScale: raw.defaultScale,
    defaultOffsetX: raw.defaultOffsetX,
    defaultOffsetY: raw.defaultOffsetY,
    renderLayer: resolveVfxRenderLayer(raw.renderLayer),
  };
}

export function readCatalogSource(): string {
  const abs = catalogSourceAbs();
  if (!fs.existsSync(abs)) throw new Error('src/data/vfx/catalog.ts ausente');
  return fs.readFileSync(abs, 'utf8');
}

export function upsertVfxCatalogEntry(
  def: SharedVfxDefinition,
  options: { mode: 'create' | 'update'; image?: { width: number; height: number }; persist?: boolean },
): { relativePath: string; source: string; absPath: string; vfx: SharedVfxDefinition } {
  const next = validateDef(def, options.image);
  let source = readCatalogSource();
  const existing = entryRange(source, next.id);
  if (options.mode === 'create' && existing) {
    throw new Error('ID duplicado.');
  }
  if (options.mode === 'update' && !existing) {
    throw new Error(`VFX ${next.id} não encontrado`);
  }

  if (existing) {
    const blockEnd = existing.end;
    let replaceEnd = blockEnd;
    if (source[blockEnd + 1] === ',') replaceEnd = blockEnd + 1;
    const lineStart = source.lastIndexOf('\n', existing.start) + 1;
    const indent = source.slice(lineStart, existing.start) || '  ';
    source = `${source.slice(0, lineStart)}${formatDef(next, indent)}${source.slice(replaceEnd + 1)}`;
  } else {
    const record = recordRange(source);
    const insert = `\n${formatDef(next, '  ')}`;
    source = source.slice(0, record.end) + insert + source.slice(record.end);
  }

  const check = recordRange(source);
  if (check.end < 0) throw new Error('Validação falhou: catálogo quebrado');
  const absPath = catalogSourceAbs();
  if (options.persist !== false) fs.writeFileSync(absPath, source, 'utf8');
  return { relativePath: catalogSourceRel(), source, absPath, vfx: next };
}

export function removeVfxCatalogEntry(
  id: string,
  options?: { persist?: boolean },
): { relativePath: string; source: string; absPath: string } {
  if (!isVfxId(id)) throw new Error('ID inválido');
  let source = readCatalogSource();
  const existing = entryRange(source, id);
  if (!existing) throw new Error(`VFX ${id} não encontrado`);
  let from = existing.start;
  while (from > 0 && source[from - 1] === ' ') from -= 1;
  if (source[from - 1] === '\n') from -= 1;
  if (source[from - 1] === '\r') from -= 1;
  let to = existing.end + 1;
  if (source[to] === ',') to += 1;
  if (source[to] === '\r') to += 1;
  if (source[to] === '\n') to += 1;
  source = source.slice(0, from) + source.slice(to);
  const absPath = catalogSourceAbs();
  if (options?.persist !== false) fs.writeFileSync(absPath, source, 'utf8');
  return { relativePath: catalogSourceRel(), source, absPath };
}
