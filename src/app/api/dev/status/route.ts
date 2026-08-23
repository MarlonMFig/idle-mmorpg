import { NextResponse } from 'next/server';
import { listStatusDefinitions } from '@/data/status';
import { parseStatusEffectDefinition } from '@/data/status-effect-def';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { removeStatusCatalogEntry, upsertStatusCatalogEntry } from '@/lib/dev/patch-status-catalog';

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function GET() {
  if (!isDevWriteAllowed()) return deny();
  return NextResponse.json({ ok: true, items: listStatusDefinitions() });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? '');
    if (action === 'create' || action === 'update') {
      const def = parseStatusEffectDefinition(body);
      const result = upsertStatusCatalogEntry(def, action);
      return NextResponse.json({ ok: true, file: result.relativePath, id: def.id, status: def });
    }
    if (action === 'delete') {
      const id = String(body.id ?? '');
      const result = removeStatusCatalogEntry(id);
      return NextResponse.json({ ok: true, file: result.relativePath, id });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'falha' },
      { status: 400 },
    );
  }
}
