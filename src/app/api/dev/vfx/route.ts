import { NextResponse } from 'next/server';
import { listVfxDefinitions } from '@/data/vfx';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { findVfxUsages } from '@/lib/dev/vfx-usage';

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

/** Somente leitura. Escritas vão para POST /api/dev/vfx/save (sem importar catalog.ts). */
export async function POST() {
  return NextResponse.json(
    { success: false, ok: false, error: 'Use POST /api/dev/vfx/save' },
    { status: 405 },
  );
}

export async function GET() {
  if (!isDevWriteAllowed()) return deny();
  const items = listVfxDefinitions().map((def) => ({
    ...def,
    usedBy: findVfxUsages(def.id),
  }));
  return NextResponse.json({ ok: true, items });
}
