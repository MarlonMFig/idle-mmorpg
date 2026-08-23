import { NextResponse } from 'next/server';
import { isSequenceVfx, type SharedVfxDefinition } from '@/data/vfx/types';
import { resolveVfxRenderLayer } from '@/data/vfx/types';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { saveLog } from '@/lib/dev/save-log';
import { SaveClock } from '@/lib/dev/save-timing';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import { readVfxImageMeta } from '@/lib/dev/vfx-image-meta';
import { removeVfxCatalogEntry, upsertVfxCatalogEntry } from '@/lib/dev/patch-vfx-catalog';
import { findVfxUsages } from '@/lib/dev/vfx-usage';

function deny() {
  return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
}

function parseDef(body: Record<string, unknown>): SharedVfxDefinition {
  const sourceType = body.sourceType === 'sequence' ? 'sequence' : 'spritesheet';
  const frames = Array.isArray(body.frames) ? body.frames.map((frame) => String(frame)) : undefined;
  return {
    id: String(body.id ?? ''),
    name: String(body.name ?? ''),
    universe: body.universe as SharedVfxDefinition['universe'],
    url: String(body.url ?? ''),
    sourceType,
    frames,
    frameWidth: Number(body.frameWidth),
    frameHeight: Number(body.frameHeight),
    frameCount: Number(body.frameCount),
    frameRate: Number(body.frameRate),
    loop: Boolean(body.loop),
    defaultScale: Number(body.defaultScale ?? 1),
    defaultOffsetX: Number(body.defaultOffsetX ?? 0),
    defaultOffsetY: Number(body.defaultOffsetY ?? 0),
    renderLayer: resolveVfxRenderLayer(body.renderLayer as SharedVfxDefinition['renderLayer']),
  };
}

async function persistDef(def: SharedVfxDefinition, mode: 'create' | 'update') {
  const imageHint = isSequenceVfx(def)
    ? { width: def.frameWidth, height: def.frameHeight, url: def.url }
    : await readVfxImageMeta(def.url, def.frameWidth, def.frameHeight);
  const result = upsertVfxCatalogEntry(def, {
    mode,
    image: { width: imageHint.width, height: imageHint.height },
    persist: false,
  });
  writeDevSourceAfterResponse(result.absPath, result.source);
  return { result, image: imageHint, vfx: result.vfx };
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  const clock = new SaveClock();
  saveLog('request received: 0ms', 'vfx/save');
  try {
    const raw = await request.text();
    clock.mark('request body');
    saveLog(`payload bytes ${raw.length}`);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const action = String(body.action ?? '');

    if (action === 'create' || action === 'update') {
      const def = parseDef(body);
      const { result, image, vfx } = await persistDef(def, action);
      clock.mark('write');
      const elapsed = clock.done();
      return NextResponse.json(
        {
          success: true,
          ok: true,
          file: result.relativePath,
          id: def.id,
          vfx,
          image,
        },
        { headers: { 'x-dev-save-ms': String(elapsed) } },
      );
    }

    if (action === 'duplicate') {
      const def = parseDef(body);
      const { result, image, vfx } = await persistDef(def, 'create');
      saveLog('response sent', 'duplicate');
      return NextResponse.json({
        success: true,
        ok: true,
        file: result.relativePath,
        id: def.id,
        vfx,
        image,
      });
    }

    if (action === 'delete') {
      const id = String(body.id ?? '');
      const usedBy = findVfxUsages(id);
      if (usedBy.length > 0) {
        return NextResponse.json(
          {
            success: false,
            ok: false,
            error: 'Este VFX é utilizado por skills. Remova as referências primeiro.',
            usedBy,
          },
          { status: 409 },
        );
      }
      const result = removeVfxCatalogEntry(id, { persist: false });
      writeDevSourceAfterResponse(result.absPath, result.source);
      saveLog('response sent', 'delete');
      return NextResponse.json({ success: true, ok: true, file: result.relativePath, id });
    }

    return NextResponse.json({ success: false, ok: false, error: 'action inválida' }, { status: 400 });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV vfx save]', detail);
    return NextResponse.json({ success: false, ok: false, error: detail }, { status: 400 });
  }
}
