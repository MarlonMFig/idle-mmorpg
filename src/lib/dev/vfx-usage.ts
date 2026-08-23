import fs from 'node:fs';
import path from 'node:path';

export interface VfxUsageHit {
  characterId: string;
  skillId: string;
  file: string;
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function skillIdNear(text: string, index: number): string {
  const before = text.slice(Math.max(0, index - 1200), index);
  const matches = [...before.matchAll(/['"]([^'"]+)['"]\s*:\s*\{/g)];
  return matches.at(-1)?.[1] ?? '(skill)';
}

function packIdOf(text: string, file: string): string {
  return /\bid\s*:\s*['"]([a-z0-9-]+)['"]/.exec(text)?.[1] ?? path.basename(file, '.ts');
}

/** Procura `vfxId` em `src/data` (packs). Não lê bundle. */
export function findVfxUsages(vfxId: string): VfxUsageHit[] {
  const escaped = vfxId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needle = new RegExp(`vfxId\\s*:\\s*['"]${escaped}['"]`, 'g');
  const root = path.join(process.cwd(), 'src', 'data');
  const hits: VfxUsageHit[] = [];
  for (const abs of walkTsFiles(root)) {
    const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/');
    if (rel.startsWith('src/data/vfx/')) continue;
    const text = fs.readFileSync(abs, 'utf8');
    let match = needle.exec(text);
    while (match) {
      hits.push({
        characterId: packIdOf(text, rel),
        skillId: skillIdNear(text, match.index),
        file: rel,
      });
      match = needle.exec(text);
    }
  }
  return hits;
}
