import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'next/server';
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

function writeFromTemp(absPath: string, tmpPath: string): void {
  assertWritableSourcePath(absPath);
  fs.copyFileSync(tmpPath, absPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* temp já limpo */
  }
}

/**
 * Agenda a gravação para DEPOIS do JSON 200 sair.
 *
 * Gravar no meio do POST faz o watcher recompilar a rota com o pedido aberto
 * → o browser fica em "Salvando..." para sempre.
 *
 * `after()` do Next em `next dev` (webpack) muitas vezes não corre o callback.
 * Timers do Route Handler também morrem com o pedido. Por isso o write real
 * vai num processo Node separado.
 */
export function writeDevSourceAfterResponse(absPath: string, contents: string): void {
  assertWritableSourcePath(absPath);
  const tmpPath = path.join(
    os.tmpdir(),
    `idle-lab-write-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
  );
  fs.writeFileSync(tmpPath, contents, 'utf8');
  saveLog(`filesystem write scheduled ${path.basename(absPath)}`);

  const run = () => {
    try {
      if (fs.existsSync(tmpPath)) writeFromTemp(absPath, tmpPath);
    } catch (error) {
      console.error('[DEV write]', absPath, error);
    }
  };

  try {
    after(run);
  } catch {
    /* after() só existe dentro de um request */
  }

  try {
    const child = spawn(
      process.execPath,
      [
        '-e',
        [
          'const fs=require("fs");',
          'setTimeout(()=>{',
          '  const abs=process.env.IDLE_LAB_WRITE_ABS;',
          '  const tmp=process.env.IDLE_LAB_WRITE_TMP;',
          '  if(!abs||!tmp||!fs.existsSync(tmp)) process.exit(0);',
          '  fs.copyFileSync(tmp, abs);',
          '  try{fs.unlinkSync(tmp)}catch(e){}',
          '}, 150);',
        ].join(''),
      ],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...process.env,
          IDLE_LAB_WRITE_ABS: absPath,
          IDLE_LAB_WRITE_TMP: tmpPath,
        },
      },
    );
    child.unref();
  } catch (error) {
    console.error('[DEV write spawn]', error);
    setTimeout(run, 150);
  }
}
