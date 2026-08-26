import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isVfxId, isVfxUniverse, detectSpritesheetLayout } from '@/data/vfx/types';
import { gifBufferToPngFrames } from '@/lib/dev/gif-pose-frames';
import { padImagesToCommonCanvas } from '@/lib/dev/pad-sequence-frames';
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

const VFX_IMPORT_EXTS = [...VFX_ASSET_EXTS, '.gif'] as const;

function deny() {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

function fileExt(file: File, hint = ''): string {
  const originalName = hint || file.name;
  return path.extname(originalName).toLowerCase() || path.extname(file.name).toLowerCase();
}

function slugifyFileStem(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function writeSequencePngs(
  universe: string,
  vfxId: string,
  pngBuffers: Buffer[],
): Promise<{ urls: string[]; width: number; height: number }> {
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');
  if (!isVfxId(vfxId)) throw new Error('ID obrigatório para salvar a sequência (ex.: dimension-slash)');
  if (pngBuffers.length < 1) throw new Error('Sequência sem frames');

  const sizes = await Promise.all(pngBuffers.map((buffer) => readBufferImageSize(buffer)));
  const width = Math.max(...sizes.map((size) => size.width));
  const height = Math.max(...sizes.map((size) => size.height));

  const dir = destSequenceDir(universe, vfxId);
  fs.mkdirSync(dir, { recursive: true });
  wipeSequenceImageFiles(dir);

  const urls: string[] = [];
  for (let i = 0; i < pngBuffers.length; i += 1) {
    const dest = path.join(dir, sequenceFrameFileName(i, '.png'));
    await fsp.writeFile(dest, pngBuffers[i]);
    urls.push(toPublicVfxUrl(dest));
  }
  return { urls, width, height };
}

async function importSpritesheet(form: FormData, file: File) {
  const universe = String(form.get('universe') ?? '');
  const conflict = String(form.get('conflict') ?? 'ask');
  const fileNameHint = String(form.get('fileName') ?? '');
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');

  const originalName = fileNameHint || file.name;
  const ext = fileExt(file, fileNameHint);
  if (ext === '.gif') {
    throw new Error('GIF animado vira sequência de frames — use sourceType=gif');
  }
  if (!(VFX_ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error('Formato não suportado (PNG, WEBP ou GIF)');
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
  const layout = detectSpritesheetLayout(image.width, image.height);
  return NextResponse.json({
    ok: true,
    url,
    fileName: path.basename(dest),
    image: {
      ...image,
      suggestedFrameCount: layout?.frameCount ?? image.suggestedFrameCount,
    },
    layout,
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

  if (files.some((file) => fileExt(file) === '.gif')) {
    throw new Error('GIF deve ser um arquivo só. Para vários frames use PNG ou WEBP.');
  }

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
    buffers.push({ buffer, ext, size });
  }

  const padded = await padImagesToCommonCanvas(
    buffers.map((entry) => entry.buffer),
    'center',
  );
  const { urls, width, height } = await writeSequencePngs(universe, vfxId, padded.buffers);

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

/** GIF animado → sequência PNG em /vfx/<universo>/<id>/ (Phaser não toca GIF). */
async function importGif(form: FormData, file: File) {
  const universe = String(form.get('universe') ?? '');
  let vfxId = String(form.get('vfxId') ?? '').trim();
  const append = String(form.get('append') ?? '') === '1';
  if (!isVfxUniverse(universe)) throw new Error('Universo inválido');
  if (!isVfxId(vfxId)) {
    const fromFile = slugifyFileStem(file.name);
    if (isVfxId(fromFile)) vfxId = fromFile;
    else throw new Error('Defina um ID válido (kebab-case) antes de importar o GIF');
  }

  const decoded = await gifBufferToPngFrames(Buffer.from(await file.arrayBuffer()), 'center');
  let pngBuffers = decoded.frames;
  if (append) {
    const dir = destSequenceDir(universe, vfxId);
    if (fs.existsSync(dir)) {
        const existing = fs
        .readdirSync(dir)
        .filter((name) => /^frame-\d+\.(png|webp)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const prior: Buffer[] = [];
      for (const name of existing) {
        prior.push(await fsp.readFile(path.join(dir, name)));
      }
      pngBuffers = [...prior, ...decoded.frames];
    }
  }
  const { urls, width, height } = await writeSequencePngs(universe, vfxId, pngBuffers);

  return NextResponse.json({
    ok: true,
    sourceType: 'sequence',
    fromGif: true,
    urls,
    frames: urls,
    frameCount: urls.length,
    frameRate: decoded.frameRate,
    url: urls[0],
    image: { width, height, url: urls[0], suggestedFrameCount: urls.length },
    vfxId,
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
    const onlyGif = files.length === 1 && fileExt(files[0]) === '.gif';
    if (sourceType === 'gif' || onlyGif) {
      if (files.length !== 1) throw new Error('Importe um GIF por vez');
      if (fileExt(files[0]) !== '.gif') throw new Error('Arquivo não é GIF');
      return await importGif(form, files[0]);
    }
    if (sourceType === 'sequence' || files.length > 1) {
      return await importSequence(form, files);
    }
    const ext = fileExt(files[0]);
    if (!(VFX_IMPORT_EXTS as readonly string[]).includes(ext)) {
      throw new Error('Formato não suportado (PNG, WEBP ou GIF)');
    }
    return await importSpritesheet(form, files[0]);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV vfx import]', detail);
    return NextResponse.json({ ok: false, error: detail }, { status: 400 });
  }
}
