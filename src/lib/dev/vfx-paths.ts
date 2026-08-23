import fs from 'node:fs';
import path from 'node:path';
import { isVfxId, isVfxUniverse, type VfxUniverse } from '@/data/vfx/types';

const PUBLIC_VFX = path.join(process.cwd(), 'public', 'vfx');
const CATALOG_REL = 'src/data/vfx/catalog.ts';

export const VFX_ASSET_EXTS = ['.png', '.webp'] as const;

export function catalogSourceAbs(): string {
  return path.join(process.cwd(), 'src', 'data', 'vfx', 'catalog.ts');
}

export function catalogSourceRel(): string {
  return CATALOG_REL;
}

export function assertInside(absPath: string, root: string, label: string): void {
  const resolved = path.resolve(absPath);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Caminho fora de ${label}`);
  }
  const norm = resolved.replace(/\\/g, '/');
  if (norm.includes('/.next/') || norm.includes('/dist/') || norm.includes('/build/')) {
    throw new Error('Recusa escrever em bundle compilado');
  }
}

export function publicVfxRoot(): string {
  return PUBLIC_VFX;
}

/** `/vfx/naruto/rasengan.png` → abs path. Recusa `..` e URLs externas. */
export function resolvePublicVfxUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('/vfx/')) {
    throw new Error('Asset deve estar em /vfx/');
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes(':')) {
    throw new Error('Path de asset inválido');
  }
  const rel = trimmed.slice('/vfx/'.length);
  const abs = path.resolve(PUBLIC_VFX, rel);
  assertInside(abs, PUBLIC_VFX, 'public/vfx');
  const ext = path.extname(abs).toLowerCase();
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error('Formato não suportado (PNG ou WEBP)');
  }
  return abs;
}

export function toPublicVfxUrl(absPath: string): string {
  assertInside(absPath, PUBLIC_VFX, 'public/vfx');
  const rel = path.relative(PUBLIC_VFX, absPath).replace(/\\/g, '/');
  return `/vfx/${rel}`;
}

export function sanitizeAssetFileName(name: string): string {
  const base = path.basename(name).toLowerCase();
  const ext = path.extname(base);
  const stem = path.basename(base, ext).replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!stem) throw new Error('Nome de arquivo inválido');
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error('Formato não suportado (PNG ou WEBP)');
  }
  return `${stem}${ext}`;
}

export function destAssetAbs(universe: VfxUniverse, fileName: string): string {
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');
  const safe = sanitizeAssetFileName(fileName);
  const dir = path.join(PUBLIC_VFX, universe);
  const abs = path.resolve(dir, safe);
  assertInside(abs, PUBLIC_VFX, 'public/vfx');
  return abs;
}

export function uniqueAssetAbs(universe: VfxUniverse, fileName: string): string {
  const first = destAssetAbs(universe, fileName);
  if (!fs.existsSync(first)) return first;
  const ext = path.extname(first);
  const stem = path.basename(first, ext);
  const dir = path.dirname(first);
  for (let i = 2; i < 100; i += 1) {
    const next = path.join(dir, `${stem}-${i}${ext}`);
    assertInside(next, PUBLIC_VFX, 'public/vfx');
    if (!fs.existsSync(next)) return next;
  }
  throw new Error('Não foi possível gerar outro nome de arquivo');
}

/** Pasta exclusiva da sequência: `public/vfx/<universo>/<vfx-id>/`. */
export function destSequenceDir(universe: VfxUniverse, vfxId: string): string {
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');
  if (!isVfxId(vfxId)) throw new Error('ID inválido (use kebab-case, ex.: dimension-slash)');
  const dir = path.resolve(PUBLIC_VFX, universe, vfxId);
  assertInside(dir, PUBLIC_VFX, 'public/vfx');
  return dir;
}

export function sequenceFrameFileName(indexZeroBased: number, ext: string): string {
  const safeExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(safeExt)) {
    throw new Error('Formato não suportado (PNG ou WEBP)');
  }
  return `frame-${String(indexZeroBased + 1).padStart(3, '0')}${safeExt}`;
}

export function wipeSequenceImageFiles(dirAbs: string): void {
  assertInside(dirAbs, PUBLIC_VFX, 'public/vfx');
  if (!fs.existsSync(dirAbs)) return;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) continue;
    const abs = path.join(dirAbs, entry.name);
    assertInside(abs, PUBLIC_VFX, 'public/vfx');
    fs.unlinkSync(abs);
  }
}

export interface VfxAssetListItem {
  url: string;
  universe: string;
  fileName: string;
}

export function listPublicVfxAssets(): VfxAssetListItem[] {
  const out: VfxAssetListItem[] = [];
  if (!fs.existsSync(PUBLIC_VFX)) return out;
  for (const universe of fs.readdirSync(PUBLIC_VFX, { withFileTypes: true })) {
    if (!universe.isDirectory()) continue;
    if (!isVfxUniverse(universe.name)) continue;
    const dir = path.join(PUBLIC_VFX, universe.name);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) continue;
      out.push({
        url: `/vfx/${universe.name}/${entry.name}`,
        universe: universe.name,
        fileName: entry.name,
      });
    }
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}
