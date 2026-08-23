import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SKIP_DIRS = new Set(['vfx', 'status']);

export interface CharacterSourceHit {
  /** Caminho relativo ao repo, ex.: `src/data/black-clover-packs.ts`. */
  relativePath: string;
  absPath: string;
}

const sourceCache = new Map<string, CharacterSourceHit>();

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkTsFiles(full, out);
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function idPattern(characterId: string): RegExp {
  const escaped = characterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bid\\s*:\\s*['"]${escaped}['"]`);
}

function packSort(a: string, b: string): number {
  const score = (file: string) => (file.replace(/\\/g, '/').includes('packs') ? 0 : 1);
  return score(a) - score(b);
}

/**
 * Resolve slug de catálogo (`itachi`) → id permanente (`uchiha-itachi`) lendo o
 * fonte em disco — sem importar `character-packs.ts`.
 *
 * Importar o pack no writer faz o Next recompilar a API no meio do POST
 * (timeout / "tempo limite excedido").
 */
function resolveSlugAliasFromDisk(slug: string): string | null {
  const packsPath = path.join(DATA_DIR, 'character-packs.ts');
  if (!fs.existsSync(packsPath)) return null;
  const text = fs.readFileSync(packsPath, 'utf8');
  const marker = 'const CURATED_BY_SLUG';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const brace = text.indexOf('{', idx);
  if (brace < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = brace; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const block = text.slice(brace, end + 1);
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entry = new RegExp(
    `(?:^|,)\\s*(?:'${escaped}'|"${escaped}"|${escaped})\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)`,
    'm',
  ).exec(block);
  if (!entry) return null;
  const constName = entry[1]!;
  const constRe = new RegExp(
    `(?:const|export const)\\s+${constName}\\b[\\s\\S]*?\\bid\\s*:\\s*['"]([^'"]+)['"]`,
  );
  return constRe.exec(text)?.[1] ?? null;
}

/**
 * Slug de catálogo (`itachi`) → id permanente do pack (`uchiha-itachi`).
 * Sem isso o writer procura `id: 'itachi'` e falha — o preview até funciona,
 * mas o Character Pack nunca é gravado.
 */
export function resolveWritableCharacterId(characterId: string): string {
  if (!/^[a-z0-9-]+$/i.test(characterId)) return characterId;
  if (findCharacterSourceFileExact(characterId)) return characterId;
  return resolveSlugAliasFromDisk(characterId) ?? characterId;
}

function findCharacterSourceFileExact(characterId: string): CharacterSourceHit | null {
  const cached = sourceCache.get(characterId);
  if (cached && fs.existsSync(cached.absPath)) {
    const text = fs.readFileSync(cached.absPath, 'utf8');
    if (idPattern(characterId).test(text)) return cached;
    sourceCache.delete(characterId);
  }

  const needle = idPattern(characterId);
  const files = walkTsFiles(DATA_DIR).sort(packSort);
  for (const absPath of files) {
    const text = fs.readFileSync(absPath, 'utf8');
    if (!needle.test(text)) continue;
    const relativePath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
    if (!relativePath.startsWith('src/data/')) continue;
    if (!text.includes('CharacterPack')) continue;
    const hit = { relativePath, absPath };
    sourceCache.set(characterId, hit);
    return hit;
  }
  return null;
}

/**
 * Localiza o arquivo-fonte do pack pelo `id` permanente.
 * Só deve ser chamado no servidor DEV.
 *
 * Não importa `@/data/character-packs` — gravar esse arquivo não pode
 * invalidar a rota `/api/dev/character-config` no meio do POST.
 */
export function findCharacterSourceFile(characterId: string): CharacterSourceHit | null {
  if (!/^[a-z0-9-]+$/i.test(characterId)) return null;
  const id = resolveWritableCharacterId(characterId);
  const hit = findCharacterSourceFileExact(id);
  if (hit) {
    sourceCache.set(characterId, hit);
    sourceCache.set(id, hit);
  }
  return hit;
}

export function assertWritableSourcePath(absPath: string): void {
  const resolved = path.resolve(absPath);
  const root = path.resolve(process.cwd(), 'src', 'data');
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Caminho fora de src/data');
  }
  if (resolved.includes(`${path.sep}.next${path.sep}`) || resolved.includes(`${path.sep}dist${path.sep}`)) {
    throw new Error('Recusa escrever em bundle compilado');
  }
}
