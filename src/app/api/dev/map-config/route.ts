import { NextResponse } from 'next/server';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { saveLog } from '@/lib/dev/save-log';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import {
  patchMapSource,
  readMapConfigFromSource,
} from '@/lib/dev/patch-map-source';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

function deny() {
  return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
}

function isMapKey(value: string): value is MapKey {
  return Object.values(MAP_KEYS).includes(value as MapKey);
}

export async function GET(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  const url = new URL(request.url);
  const mapKey = url.searchParams.get('mapKey') ?? '';
  const target = url.searchParams.get('target') === 'hub' ? 'hub' : 'wonsr';
  if (target === 'wonsr' && !isMapKey(mapKey)) {
    return NextResponse.json({ success: false, error: 'mapKey inválido' }, { status: 400 });
  }
  const config = readMapConfigFromSource(target, mapKey || 'hub');
  return NextResponse.json({
    success: true,
    mapKey: target === 'hub' ? 'hub' : mapKey,
    target,
    ...config,
  });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  saveLog('API received', 'map-config');
  try {
    const body = (await request.json()) as {
      mapKey?: string;
      target?: 'wonsr' | 'hub';
      layoutScale?: number;
      cameraZoom?: number | null;
      lateralFloorY?: number;
    };
    const target = body.target === 'hub' ? 'hub' : 'wonsr';
    const mapKey = (body.mapKey ?? '').trim();
    if (target === 'wonsr' && !isMapKey(mapKey)) {
      return NextResponse.json({ success: false, error: 'mapKey inválido' }, { status: 400 });
    }
    if (body.layoutScale !== undefined) {
      if (!(typeof body.layoutScale === 'number') || !(body.layoutScale > 0) || body.layoutScale > 20) {
        return NextResponse.json({ success: false, error: 'layoutScale inválido' }, { status: 400 });
      }
    }
    if (body.cameraZoom !== undefined && body.cameraZoom !== null) {
      if (!(typeof body.cameraZoom === 'number') || body.cameraZoom < 0.1 || body.cameraZoom > 4) {
        return NextResponse.json({ success: false, error: 'cameraZoom inválido' }, { status: 400 });
      }
    }
    if (body.lateralFloorY !== undefined) {
      if (
        !(typeof body.lateralFloorY === 'number') ||
        !Number.isFinite(body.lateralFloorY) ||
        body.lateralFloorY < 0 ||
        body.lateralFloorY > 8000
      ) {
        return NextResponse.json({ success: false, error: 'lateralFloorY inválido' }, { status: 400 });
      }
    }

    const result = patchMapSource({
      mapKey: mapKey || 'hub',
      target,
      layoutScale: body.layoutScale,
      cameraZoom: body.cameraZoom,
      lateralFloorY: body.lateralFloorY,
    });
    writeDevSourceAfterResponse(result.absPath, result.source);

    saveLog('response sent', 'map-config');
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Configuração do mapa salva.',
      file: result.relativePath,
      applied: result.applied,
      mapKey: target === 'hub' ? 'hub' : mapKey,
      target,
      layoutScale: body.layoutScale,
      cameraZoom: body.cameraZoom,
      lateralFloorY: body.lateralFloorY,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV map-config]', detail);
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
