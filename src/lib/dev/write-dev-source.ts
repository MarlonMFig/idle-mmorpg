import fs from 'node:fs';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import { saveLog } from '@/lib/dev/save-log';

const RETRY_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES']);

function sleepSync(ms: number): void {
  const end = Date.now() + Math.max(0, ms);
  while (Date.now() < end) {
    // Windows: open() pode falhar com UNKNOWN enquanto o watcher/HMR segura o arquivo.
  }
}

function withFsRetry<T>(label: string, fn: () => T, attempts = 6): T {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return fn();
    } catch (error) {
      last = error;
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (!RETRY_CODES.has(code) || i === attempts - 1) throw error;
      saveLog(`${label} retry ${i + 1}/${attempts} (${code})`);
      sleepSync(25 * (i + 1));
    }
  }
  throw last;
}

export function readDevSource(absPath: string): string {
  assertWritableSourcePath(absPath);
  return withFsRetry('filesystem read', () => fs.readFileSync(absPath, 'utf8'));
}

/**
 * Grava o Character Pack / catálogo no disco (TypeScript em src/data).
 * Sempre síncrono — `await writeFile` cede o loop e o Next recompila o POST.
 */
export function writeDevSource(absPath: string, contents: string): void {
  assertWritableSourcePath(absPath);
  try {
    const current = withFsRetry('filesystem read', () => fs.readFileSync(absPath, 'utf8'));
    if (current === contents) {
      saveLog('filesystem write skipped (unchanged)');
      return;
    }
  } catch {
    // arquivo novo / ilegível — segue para write
  }
  saveLog('filesystem write started');
  withFsRetry('filesystem write', () => {
    fs.writeFileSync(absPath, contents, 'utf8');
  });
  saveLog('filesystem write finished');
}

/**
 * Confirma a gravação antes de o endpoint responder.
 *
 * O Lab pode fechar e reiniciar a cena imediatamente depois de receber o 200.
 * Adiar a cópia para um processo separado fazia o estado temporário ser
 * descartado antes de o arquivo-fonte estar persistido.
 */
export function writeDevSourceAfterResponse(absPath: string, contents: string): void {
  writeDevSource(absPath, contents);
}
