import fs from 'node:fs';
import path from 'node:path';
import { assertInside, VFX_ASSET_EXTS } from '@/lib/dev/vfx-paths';

const PUBLIC_SPRITES = path.join(process.cwd(), 'public', 'sprites', 'player');

export function publicPlayerRoot(): string {
  return PUBLIC_SPRITES;
}

export function sanitizePoseFileName(name: string): string {
  const base = path.basename(name).toLowerCase();
  const ext = path.extname(base);
  const stem = path.basename(base, ext).replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!stem) throw new Error('Nome de arquivo inválido');
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error('Formato não suportado (PNG ou WEBP)');
  }
  return `${stem}${ext}`;
}

export function poseDirAbs(characterId: string): string {
  if (!/^[a-z0-9-]+$/i.test(characterId)) throw new Error('characterId inválido');
  const abs = path.resolve(PUBLIC_SPRITES, characterId, 'poses');
  assertInside(abs, PUBLIC_SPRITES, 'public/sprites/player');
  return abs;
}

export function destPoseAssetAbs(characterId: string, fileName: string): string {
  const abs = path.resolve(poseDirAbs(characterId), sanitizePoseFileName(fileName));
  assertInside(abs, PUBLIC_SPRITES, 'public/sprites/player');
  return abs;
}

export function destPoseSequenceDir(characterId: string, stem: string): string {
  const safe = stem.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) throw new Error('Nome de sequência inválido');
  const abs = path.resolve(poseDirAbs(characterId), safe);
  assertInside(abs, PUBLIC_SPRITES, 'public/sprites/player');
  return abs;
}

export function toPublicPlayerUrl(absPath: string): string {
  assertInside(absPath, path.join(process.cwd(), 'public'), 'public');
  const rel = path.relative(path.join(process.cwd(), 'public'), absPath).replace(/\\/g, '/');
  return `/${rel}`;
}

export function uniquePoseAssetAbs(characterId: string, fileName: string): string {
  const first = destPoseAssetAbs(characterId, fileName);
  if (!fs.existsSync(first)) return first;
  const ext = path.extname(first);
  const stem = path.basename(first, ext);
  const dir = path.dirname(first);
  for (let i = 2; i < 100; i += 1) {
    const candidate = path.join(dir, `${stem}-${i}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Não foi possível gerar nome único para o asset');
}

export function resolvePublicSpriteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('/sprites/')) {
    throw new Error('Asset de pose deve estar em /sprites/');
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes(':')) {
    throw new Error('Path de asset inválido');
  }
  const abs = path.resolve(process.cwd(), 'public', trimmed.slice(1));
  assertInside(abs, path.join(process.cwd(), 'public', 'sprites'), 'public/sprites');
  return abs;
}
