import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { findCharacterSourceFile, resolveWritableCharacterId } from '@/lib/dev/find-character-source';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { saveLog } from '@/lib/dev/save-log';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import {
  patchCharacterSource,
  readSpriteAlignmentFromSource,
} from '@/lib/dev/patch-character-source';
import type { LabSaveChanges } from '@/lib/dev/lab-save-fields';
import { alignmentsEqual, normalizeSpriteAlignment } from '@/lib/sprite-alignment';

function deny() {
  return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
}

export async function GET(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  const characterId = new URL(request.url).searchParams.get('characterId') ?? '';
  const packId = resolveWritableCharacterId(characterId);
  const hit = findCharacterSourceFile(packId);
  if (!hit) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  const source = fs.readFileSync(hit.absPath, 'utf8');
  const spriteAlignment = readSpriteAlignmentFromSource(source, packId);
  return NextResponse.json({
    success: true,
    characterId: packId,
    requestedId: characterId,
    source: hit.relativePath,
    spriteAlignment: spriteAlignment ? normalizeSpriteAlignment(spriteAlignment) : null,
  });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  saveLog('API received', 'character-config');
  try {
    const body = (await request.json()) as {
      characterId?: string;
      skillId?: string | null;
      changes?: LabSaveChanges;
    };
    const requestedId = body.characterId?.trim() ?? '';
    if (!requestedId) {
      return NextResponse.json({ success: false, error: 'characterId obrigatório' }, { status: 400 });
    }
    const characterId = resolveWritableCharacterId(requestedId);
    const result = patchCharacterSource(
      {
        characterId,
        skillId: body.skillId,
        changes: body.changes ?? {},
      },
      { persist: false },
    );

    let confirmedAlignment = null as ReturnType<typeof normalizeSpriteAlignment> | null;
    if (body.changes?.spriteAlignment) {
      const fromSource = readSpriteAlignmentFromSource(result.source, characterId);
      if (!fromSource) {
        throw new Error('Patch sem spriteAlignment no fonte gerado.');
      }
      confirmedAlignment = normalizeSpriteAlignment(fromSource);
      const expected = normalizeSpriteAlignment({
        hub: body.changes.spriteAlignment.hub ?? fromSource.hub,
        hunt: body.changes.spriteAlignment.hunt ?? fromSource.hunt,
      });
      if (!alignmentsEqual(confirmedAlignment, expected)) {
        throw new Error(
          `Releitura divergiu do valor pedido (esperado hunt.y=${expected.hunt.y}, lido=${confirmedAlignment.hunt.y}).`,
        );
      }
    }

    writeDevSourceAfterResponse(result.absPath, result.source);

    saveLog('response sent', 'character-config');
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Alterações salvas com sucesso.',
      file: result.relativePath,
      applied: result.applied,
      characterId,
      requestedId,
      skillId: body.skillId ?? null,
      spriteAlignment: confirmedAlignment,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV character-config]', detail);
    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: 'Não foi possível salvar. Nenhuma alteração foi aplicada.',
        detail,
      },
      { status: 400 },
    );
  }
}
