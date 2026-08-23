import fs from 'node:fs';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import { saveLog } from '@/lib/dev/save-log';

/**
 * Grava o fonte. Síncrono: `await writeFile` cede o loop e o Next recompila
 * o POST no meio do caminho.
 */
export function writeDevSource(absPath: string, contents: string): void {
  assertWritableSourcePath(absPath);
  saveLog('filesystem write started');
  fs.writeFileSync(absPath, contents, 'utf8');
  saveLog('filesystem write finished');
}

/**
 * Persistência do Lab: o arquivo precisa estar em disco antes do JSON 200.
 * Adiar com `after()` + timeout fazia o save parecer ok (registry em RAM)
 * e o F5 restaurar o fonte antigo — o callback muitas vezes não rodava
 * porque o HMR invalidava o processo no meio da espera.
 *
 * Se o watcher recompilar no meio do POST, o cliente já trata HTML e tenta de novo.
 */
export function writeDevSourceAfterResponse(absPath: string, contents: string): void {
  writeDevSource(absPath, contents);
}
