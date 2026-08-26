import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { gifBufferToPngFrames } from '@/lib/dev/gif-pose-frames';
import { padImagesToCommonCanvas } from '@/lib/dev/pad-sequence-frames';
import { readBufferImageSize } from '@/lib/dev/vfx-image-meta';
import { VFX_ASSET_EXTS } from '@/lib/dev/vfx-paths';
import {
  destPoseAssetAbs,
  destPoseSequenceDir,
  uniquePoseAssetAbs,
  toPublicPlayerUrl,
  wipePoseSequenceImages,
} from '@/lib/dev/player-sprite-paths';
import { naturalNameSort, suggestHorizontalFrameCount, detectSpritesheetLayout } from '@/data/vfx/types';

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

function poseStem(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'pose';
}

function writeSequence(
  characterId: string,
  stem: string,
  frames: { buffer: Buffer; ext: string }[],
  size: { width: number; height: number },
  frameRate: number,
) {
  const dir = destPoseSequenceDir(characterId, stem);
  fs.mkdirSync(dir, { recursive: true });
  wipePoseSequenceImages(dir);
  const urls: string[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const dest = path.join(dir, sequenceName(i, frames[i].ext));
    fs.writeFileSync(dest, frames[i].buffer);
    urls.push(toPublicPlayerUrl(dest));
  }
  return NextResponse.json({
    ok: true,
    sourceType: 'sequence',
    url: urls[0],
    frames: urls,
    key: `${characterId}-${stem}`,
    image: size,
    frameRate,
  });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const form = await request.formData();
    const characterId = String(form.get('characterId') ?? '').trim();
    if (!/^[a-z0-9-]+$/i.test(characterId)) {
      return NextResponse.json({ ok: false, error: 'characterId inválido' }, { status: 400 });
    }
    const listed = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const single = form.get('file');
    const files =
      listed.length > 0 ? [...listed] : single instanceof File ? [single] : [];
    files.sort((a, b) => naturalNameSort(a.name, b.name));
    if (files.length < 1) {
      return NextResponse.json({ ok: false, error: 'Selecione um arquivo' }, { status: 400 });
    }

    if (files.length === 1 && fileExt(files[0]) === '.gif') {
      const decoded = await gifBufferToPngFrames(Buffer.from(await files[0].arrayBuffer()));
      const fromName = files[0].name.replace(/\.[^.]+$/, '') || 'pose';
      const stem = poseStem(String(form.get('poseId') ?? fromName));
      return writeSequence(
        characterId,
        stem,
        decoded.frames.map((buffer) => ({ buffer, ext: '.png' })),
        { width: decoded.width, height: decoded.height },
        decoded.frameRate,
      );
    }

    if (files.length === 1) {
      const file = files[0];
      const ext = fileExt(file);
      if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
        throw new Error('Formato não suportado (PNG, WEBP ou GIF)');
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
        suggestedFrameCount: suggestHorizontalFrameCount(size.width, size.height, size.height, size.height) ??
          detectSpritesheetLayout(size.width, size.height)?.frameCount ??
          1,
        frameRate: 12,
      });
    }

    if (files.some((file) => fileExt(file) === '.gif')) {
      throw new Error('GIF deve ser um arquivo só. Para vários frames use PNG ou WEBP.');
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
      buffers.push({ buffer, ext, size });
    }

    const padded = await padImagesToCommonCanvas(
      buffers.map((entry) => entry.buffer),
      'feet',
    );
    const fromName = files[0].name.replace(/\.[^.]+$/, '') || 'pose';
    const stem = poseStem(String(form.get('poseId') ?? fromName));
    return writeSequence(
      characterId,
      stem,
      padded.buffers.map((buffer) => ({ buffer, ext: '.png' })),
      { width: padded.width, height: padded.height },
      12,
    );
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV lab-pose]', detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 400 });
  }
}
