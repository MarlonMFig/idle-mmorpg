import { NextResponse } from 'next/server';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { saveLog } from '@/lib/dev/save-log';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import {
  patchHubEffectsSource,
  readHubEffectsFromSource,
} from '@/lib/dev/patch-hub-effects-source';
import type { HubEffect } from '@/data/hub-effects';
import { isHubBirdsEffect, isHubSmokeEffect } from '@/data/hub-effects';

function deny() {
  return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
}

function validateEffect(entry: unknown): entry is HubEffect {
  if (!entry || typeof entry !== 'object') return false;
  const row = entry as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id.trim()) return false;
  if (typeof row.label !== 'string') return false;
  if (typeof row.enabled !== 'boolean') return false;
  if (row.kind === 'smoke') {
    return (
      typeof row.x === 'number' &&
      Number.isFinite(row.x) &&
      typeof row.y === 'number' &&
      Number.isFinite(row.y)
    );
  }
  if (row.kind === 'birds') return true;
  return false;
}

export async function GET() {
  if (!isDevWriteAllowed()) return deny();
  const effects = readHubEffectsFromSource();
  return NextResponse.json({ success: true, effects });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  saveLog('API received', 'hub-effects');
  try {
    const body = (await request.json()) as { effects?: unknown[] };
    if (!Array.isArray(body.effects) || body.effects.length === 0) {
      return NextResponse.json({ success: false, error: 'effects inválido' }, { status: 400 });
    }
    const effects: HubEffect[] = [];
    for (const entry of body.effects) {
      if (!validateEffect(entry)) {
        return NextResponse.json({ success: false, error: 'efeito inválido' }, { status: 400 });
      }
      if (isHubSmokeEffect(entry)) {
        if (entry.x < 0 || entry.x > 8192 || entry.y < 0 || entry.y > 4320) {
          return NextResponse.json({ success: false, error: 'coordenada fora do hub' }, { status: 400 });
        }
      }
      effects.push(entry);
    }
    const birds = effects.filter(isHubBirdsEffect);
    if (birds.length > 1) {
      return NextResponse.json({ success: false, error: 'só um efeito birds permitido' }, { status: 400 });
    }

    const result = patchHubEffectsSource(effects);
    writeDevSourceAfterResponse(result.absPath, result.source);

    saveLog('response sent', 'hub-effects');
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Efeitos do hub salvos.',
      file: result.relativePath,
      applied: result.applied,
      effects,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV hub-effects]', detail);
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
