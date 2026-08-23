import { NextResponse } from 'next/server';
import { listPublicVfxAssets } from '@/lib/dev/vfx-paths';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { readVfxImageMeta } from '@/lib/dev/vfx-image-meta';

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function GET(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  const url = new URL(request.url).searchParams.get('url');
  if (url) {
    try {
      const frameWidth = Number(new URL(request.url).searchParams.get('frameWidth') ?? 0) || undefined;
      const frameHeight = Number(new URL(request.url).searchParams.get('frameHeight') ?? 0) || undefined;
      const image = await readVfxImageMeta(url, frameWidth, frameHeight);
      return NextResponse.json({ ok: true, image });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ ok: false, error: detail }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true, items: listPublicVfxAssets() });
}
