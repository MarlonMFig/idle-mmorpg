import { NextResponse } from 'next/server';
import { CharacterRegistry } from '@/data/characters';
import type { SkillEffect } from '@/types/skill';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { patchCharacterSource } from '@/lib/dev/patch-character-source';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import { upsertDevSkillAnim } from '@/lib/dev/dev-runtime-registry';

function deny() {
  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
}

function parseEffect(value: unknown): SkillEffect {
  if (value === 'damage' || value === 'heal' || value === 'buff') return value;
  throw new Error('efeito da skill inválido');
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const body = (await request.json()) as {
      characterId?: string;
      skillId?: string;
      effect?: unknown;
    };
    const characterId = body.characterId?.trim() ?? '';
    const skillId = body.skillId?.trim() ?? '';
    if (!characterId || !skillId) {
      return NextResponse.json({ ok: false, error: 'characterId e skillId são obrigatórios' }, { status: 400 });
    }
    const effect = parseEffect(body.effect);
    const current = CharacterRegistry.get(characterId)?.pack.skillAnims[skillId];
    if (!current) {
      return NextResponse.json({ ok: false, error: 'skill não encontrada no pack' }, { status: 404 });
    }
    const result = patchCharacterSource(
      { characterId, skillId, changes: { skillEffect: effect } },
      { persist: false },
    );
    writeDevSourceAfterResponse(result.absPath, result.source);
    upsertDevSkillAnim(characterId, skillId, { ...current, effect });
    return NextResponse.json({ ok: true, success: true, characterId, skillId, effect });
  } catch (error) {
    return NextResponse.json(
      { ok: false, success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
