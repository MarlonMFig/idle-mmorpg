import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { readBufferImageSize } from '@/lib/dev/vfx-image-meta';
import { VFX_ASSET_EXTS } from '@/lib/dev/vfx-paths';
import {
  destPoseAssetAbs,
  destPoseSequenceDir,
  uniquePoseAssetAbs,
  toPublicPlayerUrl,
} from '@/lib/dev/player-sprite-paths';
import { suggestHorizontalFrameCount } from '@/data/vfx/types';

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

function fileExt(file: File): string {
  return path.extname(file.name).toLowerCase();
}

function sequenceName(index: number, ext: string): string {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `frame-${String(index + 1).padStart(3, '0')}${safeExt}`;
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const form = await request.formData();
    const characterId = String(form.get('characterId') ?? '').trim();
    if (!/^[a-z0-9-]+$/i.test(characterId)) {
      return NextResponse.json({ ok: false, error: 'characterId inválido' }, { status: 400 });
    }
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const single = form.get('file');
    if (single instanceof File) files.unshift(single);
    if (files.length < 1) {
      return NextResponse.json({ ok: false, error: 'Selecione um arquivo' }, { status: 400 });
    }

    if (files.length === 1) {
      const file = files[0];
      const ext = fileExt(file);
      if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
        throw new Error('Formato não suportado (PNG ou WEBP)');
      }
      const wanted = destPoseAssetAbs(characterId, file.name);
      fs.mkdirSync(path.dirname(wanted), { recursive: true });
      const dest = fs.existsSync(wanted) ? uniquePoseAssetAbs(characterId, file.name) : wanted;
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      const size = await readBufferImageSize(buffer);
      const url = toPublicPlayerUrl(dest);
      const stem = path.basename(dest, path.extname(dest));
      return NextResponse.json({
        ok: true,
        sourceType: 'spritesheet',
        url,
        key: `${characterId}-${stem}`,
        fileName: path.basename(dest),
        image: size,
        suggestedFrameCount: suggestHorizontalFrameCount(size.width, size.height, size.height, size.height),
      });
    }

    const buffers: { buffer: Buffer; ext: string; size: { width: number; height: number } }[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const ext = fileExt(files[i]);
      if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
        throw new Error(`Frame ${i + 1}: formato não suportado (PNG ou WEBP)`);
      }
      const buffer = Buffer.from(await files[i].arrayBuffer());
      const size = await readBufferImageSize(buffer);
      if (!(size.width > 0) || !(size.height > 0)) throw new Error(`Frame ${i + 1}: imagem inválida`);
      if (i > 0 && (size.width !== buffers[0].size.width || size.height !== buffers[0].size.height)) {
        throw new Error(
          `Frame ${i + 1}: ${size.width}×${size.height} difere de ${buffers[0].size.width}×${buffers[0].size.height}`,
        );
      }
      buffers.push({ buffer, ext, size });
    }

    const fromName = files[0].name.replace(/\.[^.]+$/, '') || 'pose';
    const stemSource = String(form.get('poseId') ?? fromName);
    const stem = stemSource.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'pose';
    const dir = destPoseSequenceDir(characterId, stem);
    fs.mkdirSync(dir, { recursive: true });
    const frames: string[] = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const dest = path.join(dir, sequenceName(i, buffers[i].ext));
      fs.writeFileSync(dest, buffers[i].buffer);
      frames.push(toPublicPlayerUrl(dest));
    }
    return NextResponse.json({
      ok: true,
      sourceType: 'sequence',
      url: frames[0],
      frames,
      key: `${characterId}-${stem}`,
      image: buffers[0].size,
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV lab-pose]', detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 400 });
  }
}
