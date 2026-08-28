import { NextResponse } from 'next/server';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import { patchCharacterAura } from '@/lib/dev/patch-character-source';
import { upsertDevCharacterAura } from '@/lib/dev/dev-runtime-registry';
import type { CharacterAuraDef } from '@/data/character-packs';

function deny() {
  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
}

function parseAura(raw: unknown): CharacterAuraDef | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') throw new Error('aura inválida');
  const value = raw as Record<string, unknown>;
  const vfxId = typeof value.vfxId === 'string' ? value.vfxId.trim() : '';
  const scale = Number(value.scale);
  const offsetX = Number(value.offsetX);
  const offsetY = Number(value.offsetY);
  if (!vfxId) throw new Error('VFX da aura obrigatório');
  if (![scale, offsetX, offsetY].every(Number.isFinite) || scale <= 0) {
    throw new Error('escala ou offset da aura inválido');
  }
  return {
    vfxId,
    enabled: value.enabled !== false,
    scale,
    offsetX,
    offsetY,
  };
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const body = (await request.json()) as {
      characterId?: string;
      aura?: unknown;
    };
    const characterId = body.characterId?.trim() ?? '';
    if (!characterId) {
      return NextResponse.json({ ok: false, error: 'characterId obrigatório' }, { status: 400 });
    }
    const aura = parseAura(body.aura);
    const result = patchCharacterAura(characterId, aura, { persist: false });
    writeDevSourceAfterResponse(result.absPath, result.source);
    upsertDevCharacterAura(characterId, aura);
    return NextResponse.json({
      ok: true,
      success: true,
      characterId,
      aura,
      file: result.relativePath,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, success: false, error: detail },
      { status: 400 },
    );
  }
}
