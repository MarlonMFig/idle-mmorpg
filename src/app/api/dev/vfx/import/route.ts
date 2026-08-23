import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isVfxId, isVfxUniverse, formatSequenceDimensionError } from '@/data/vfx/types';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import {
  destAssetAbs,
  destSequenceDir,
  publicVfxRoot,
  sequenceFrameFileName,
  toPublicVfxUrl,
  uniqueAssetAbs,
  VFX_ASSET_EXTS,
  wipeSequenceImageFiles,
} from '@/lib/dev/vfx-paths';
import { readBufferImageSize, readVfxImageMeta } from '@/lib/dev/vfx-image-meta';

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

function fileExt(file: File, hint = ''): string {
  const originalName = hint || file.name;
  return path.extname(originalName).toLowerCase() || path.extname(file.name).toLowerCase();
}

async function importSpritesheet(form: FormData, file: File) {
  const universe = String(form.get('universe') ?? '');
  const conflict = String(form.get('conflict') ?? 'ask');
  const fileNameHint = String(form.get('fileName') ?? '');
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');

  const originalName = fileNameHint || file.name;
  const ext = fileExt(file, fileNameHint);
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error('Formato não suportado (PNG ou WEBP)');
  }

  const wanted = destAssetAbs(universe, originalName.endsWith(ext) ? originalName : `${originalName}${ext}`);
  fs.mkdirSync(path.dirname(wanted), { recursive: true });

  if (fs.existsSync(wanted) && conflict === 'ask') {
    return NextResponse.json(
      {
        ok: false,
        exists: true,
        error: 'Arquivo já existe.',
        url: toPublicVfxUrl(wanted),
        fileName: path.basename(wanted),
      },
      { status: 409 },
    );
  }

  const dest =
    conflict === 'rename' || (fs.existsSync(wanted) && conflict === 'rename')
      ? uniqueAssetAbs(universe, path.basename(wanted))
      : wanted;

  if (fs.existsSync(dest) && conflict !== 'replace') {
    return NextResponse.json(
      {
        ok: false,
        exists: true,
        error: 'Arquivo já existe.',
        url: toPublicVfxUrl(dest),
        fileName: path.basename(dest),
      },
      { status: 409 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await fsp.writeFile(dest, buffer);
  const url = toPublicVfxUrl(dest);
  const image = await readVfxImageMeta(url);
  return NextResponse.json({
    ok: true,
    url,
    fileName: path.basename(dest),
    image,
    replaced: conflict === 'replace',
    root: publicVfxRoot(),
  });
}

async function importSequence(form: FormData, files: File[]) {
  const universe = String(form.get('universe') ?? '');
  const vfxId = String(form.get('vfxId') ?? '');
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');
  if (!isVfxId(vfxId)) throw new Error('ID obrigatório para salvar a sequência (ex.: dimension-slash)');
  if (files.length < 1) throw new Error('Selecione pelo menos um frame');

  const buffers: { buffer: Buffer; ext: string; size: { width: number; height: number } }[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const ext = fileExt(file);
    if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
      throw new Error(`Frame ${i + 1}: formato não suportado (PNG ou WEBP)`);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const size = await readBufferImageSize(buffer);
    if (!(size.width > 0) || !(size.height > 0)) {
      throw new Error(`Frame ${i + 1}: imagem inválida`);
    }
    if (i > 0 && (size.width !== buffers[0].size.width || size.height !== buffers[0].size.height)) {
      throw new Error(formatSequenceDimensionError(i, buffers[0].size, size));
    }
    buffers.push({ buffer, ext, size });
  }

  const dir = destSequenceDir(universe, vfxId);
  fs.mkdirSync(dir, { recursive: true });
  wipeSequenceImageFiles(dir);

  const urls: string[] = [];
  for (let i = 0; i < buffers.length; i += 1) {
    const dest = path.join(dir, sequenceFrameFileName(i, buffers[i].ext));
    await fsp.writeFile(dest, buffers[i].buffer);
    urls.push(toPublicVfxUrl(dest));
  }

  const { width, height } = buffers[0].size;
  return NextResponse.json({
    ok: true,
    sourceType: 'sequence',
    urls,
    frames: urls,
    frameCount: urls.length,
    url: urls[0],
    image: { width, height, url: urls[0], suggestedFrameCount: urls.length },
    root: publicVfxRoot(),
  });
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  try {
    const form = await request.formData();
    const listed = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const single = form.get('file');
    const files = listed.length > 0 ? listed : single instanceof File ? [single] : [];
    if (files.length < 1) throw new Error('Arquivo obrigatório');

    const sourceType = String(form.get('sourceType') ?? '');
    if (sourceType === 'sequence' || files.length > 1) {
      return await importSequence(form, files);
    }
    return await importSpritesheet(form, files[0]);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV vfx import]', detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 400 });
  }
}
