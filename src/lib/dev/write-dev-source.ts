import fs from 'node:fs';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import { saveLog } from '@/lib/dev/save-log';

/**
 * Grava o Character Pack / catálogo no disco (TypeScript em src/data).
 * Sempre síncrono — `await writeFile` cede o loop e o Next recompila o POST.
 */
export function writeDevSource(absPath: string, contents: string): void {
  assertWritableSourcePath(absPath);
  saveLog('filesystem write started');
  fs.writeFileSync(absPath, contents, 'utf8');
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
  assertWritableSourcePath(absPath);
  saveLog('filesystem write started');
  fs.writeFileSync(absPath, contents, 'utf8');
  saveLog('filesystem write finished');
}
