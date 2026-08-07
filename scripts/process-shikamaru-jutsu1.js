/**
 * Jutsu 1 Shikamaru — Kage Mane / especial (folha multi + FX).
 * Personagem: bandas ~70–560 px · explosão: banda inferior.
 *
 * npm run shikamaru:jutsu1
 * Fonte: assets/naruto-source/nu/shikamaru-jutsu1-sheet.png
 * → public/sprites/player/shikamaru/kage-mane.png
 * → public/sprites/player/shikamaru/kage-mane-fx.png (explosão)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru-jutsu1-sheet.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const MAX_SHEET_W = 4096;

const BG = [115, 140, 214];
const BG_DIST2 = 48 * 48;

function isBg(r, g, b) {
  const dr = r - BG[0];
  const dg = g - BG[1];
  const db = b - BG[2];
  return dr * dr + dg * dg + db * db <= BG_DIST2;
}

function findBands(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (!isBg(data[i], data[i + 1], data[i + 2])) dy[y] += 1;
    }
  }
  const thr = Math.max(5, Math.floor(w * 0.03));
  const bands = [];
  let start = -1;
  for (let y = 0; y <= h; y += 1) {
    const filled = y < h && dy[y] > thr;
    if (filled && start < 0) start = y;
    if (!filled && start >= 0) {
      bands.push({ t: start, b: y });
      start = -1;
    }
  }
  return bands;
}

function cellsInBand(data, w, band, minWidth) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      const i = (y * w + x) * 4;
      if (!isBg(data[i], data[i + 1], data[i + 2])) dens[x] += 1;
    }
  }
  const thrX = Math.max(2, Math.floor((band.b - band.t) * 0.07));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thrX;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }
  const merged = [];
  for (const c of raw) {
    if (c.r - c.l < minWidth) continue;
    const prev = merged[merged.length - 1];
    if (prev && c.l - prev.r <= 3) prev.r = c.r;
    else merged.push({ ...c });
  }
  return merged;
}

function extractCell(data, w, cell) {
  const fw = cell.r - cell.l;
  const fh = cell.b - cell.t;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * fw + x) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      if (isBg(r, g, b)) {
        frame[di + 3] = 0;
        continue;
      }
      frame[di] = r;
      frame[di + 1] = g;
      frame[di + 2] = b;
      frame[di + 3] = 255;
    }
  }
  let minX = fw;
  let maxX = -1;
  let minY = fh;
  let maxY = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      if (frame[(y * fw + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { frame, fw, fh, minX: 0, maxX: 0, minY: 0, maxY: 0, bw: 1, bh: 1 };
  }
  return {
    frame,
    fw,
    fh,
    minX,
    maxX,
    minY,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
  };
}

function normalizeFrames(cut, standingCount = 4) {
  const pad = 1;
  const cellW = Math.max(...cut.map((c) => c.bw)) + pad * 2;
  const cellH = Math.max(...cut.map((c) => c.bh)) + pad * 2;
  const standing = cut.slice(0, Math.min(standingCount, cut.length));
  const contentH0 = Math.round(
    standing.reduce((s, c) => s + c.bh, 0) / Math.max(1, standing.length),
  );

  const frames = cut.map((box) => {
    const canvas = Buffer.alloc(cellW * cellH * 4);
    const dx = Math.floor((cellW - box.bw) / 2);
    const dy = cellH - box.bh - pad;
    for (let y = 0; y < box.bh; y += 1) {
      for (let x = 0; x < box.bw; x += 1) {
        const si = ((box.minY + y) * box.fw + (box.minX + x)) * 4;
        const di = ((dy + y) * cellW + dx + x) * 4;
        canvas[di] = box.frame[si];
        canvas[di + 1] = box.frame[si + 1];
        canvas[di + 2] = box.frame[si + 2];
        canvas[di + 3] = box.frame[si + 3];
      }
    }
    return canvas;
  });
  return { frames, cellW, cellH, contentHeight: contentH0 || cut[0].bh };
}

async function scaleFrames(frames, cellW, cellH, contentHeight, targetBody) {
  const scale = Math.min(1, targetBody / Math.max(1, contentHeight));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < d.length; i += 4) {
      if (isBg(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
    }
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, contentHeight: outContent, scale };
}

/** Scale for FX (no body-height rule — keep size readable). */
async function scaleFxFrames(frames, cellW, cellH, maxSide = 64) {
  const scale = Math.min(1, maxSide / Math.max(cellW, cellH));
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const out = [];
  for (const frame of frames) {
    const { data: d } = await sharp(frame, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < d.length; i += 4) {
      if (isBg(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0;
    }
    out.push(d);
  }
  return { frames: out, frameWidth: outW, frameHeight: outH, scale };
}

function stitch(frames, fw, fh) {
  const cols = fw * frames.length <= MAX_SHEET_W
    ? frames.length
    : Math.max(1, Math.floor(MAX_SHEET_W / fw));
  const rows = Math.ceil(frames.length / cols);
  const outW = cols * fw;
  const outH = rows * fh;
  const out = Buffer.alloc(outW * outH * 4);
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let y = 0; y < fh; y += 1) {
      frame.copy(
        out,
        ((row * fh + y) * outW + col * fw) * 4,
        y * fw * 4,
        (y + 1) * fw * 4,
      );
    }
  });
  return { data: out, width: outW, height: outH, cols, rows };
}

async function writeSheet(name, frames, fw, fh, metaExtra) {
  const sheet = stitch(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = `${name}.png`;
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, file));
  const entry = {
    image: `/sprites/player/shikamaru/${file}`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    source: 'shikamaru-jutsu1-sheet.png',
    frameRate: FRAME_RATE,
    ...metaExtra,
  };
  console.log(
    `-> ${file} ${sheet.width}x${sheet.height} fw=${fw} fh=${fh} n=${frames.length}`,
    metaExtra.contentHeight != null ? `contentH=${metaExtra.contentHeight}` : '',
  );
  return entry;
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Sheet não encontrada: ${INPUT}`);
  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bands = findBands(data, info.width, info.height);

  // Personagem: bandas altas acima dos assets de FX/texto.
  const charBands = bands.filter(
    (b) => b.b - b.t >= 60 && b.b - b.t <= 100 && b.t < 560 && b.t > 50,
  );
  const charCells = [];
  for (const band of charBands) {
    charCells.push(...cellsInBand(data, info.width, band, 20));
  }
  if (!charCells.length) throw new Error('sem frames de personagem');
  console.log(`body frames: ${charCells.length}`);
  const bodyCut = charCells.map((c) => extractCell(data, info.width, c));
  const bodyNorm = normalizeFrames(bodyCut, 5);
  const bodyScaled = await scaleFrames(
    bodyNorm.frames,
    bodyNorm.cellW,
    bodyNorm.cellH,
    bodyNorm.contentHeight,
    TARGET_BODY_H,
  );

  // Explosão: maior banda abaixo de y=700 com células largas/laranja.
  const fxBands = bands.filter((b) => b.t >= 700 && b.b - b.t >= 40);
  let fxEntry = null;
  if (fxBands.length) {
    const band = fxBands.sort((a, b) => b.b - b.t - (a.b - a.t))[0];
    const cells = cellsInBand(data, info.width, band, 12);
    // Filtra celulas minúsculas; se a última for enorme (texto), corta.
    const usable = cells.filter((c) => {
      const w = c.r - c.l;
      return w >= 12 && w <= 80;
    });
    console.log(`fx band y=${band.t}..${band.b} cells=${usable.length}`);
    if (usable.length >= 3) {
      const cut = usable.map((c) => extractCell(data, info.width, c));
      const norm = normalizeFrames(cut, cut.length);
      // contentHeight = full height for fx normalize pad
      const scaled = await scaleFxFrames(norm.frames, norm.cellW, norm.cellH, 72);
      fxEntry = await writeSheet(
        'kage-mane-fx',
        scaled.frames,
        scaled.frameWidth,
        scaled.frameHeight,
        {},
      );
    }
  }

  const durationMs = Math.round((bodyScaled.frames.length / FRAME_RATE) * 1000);
  // Kunai ~frame 17–18; explosão / selo nos finals — hit no final do salto.
  const hitDelayMs = Math.round(durationMs * 0.58);

  const bodyEntry = await writeSheet(
    'kage-mane',
    bodyScaled.frames,
    bodyScaled.frameWidth,
    bodyScaled.frameHeight,
    {
      contentHeight: bodyScaled.contentHeight,
      scale: bodyScaled.scale,
      durationMs,
      hitDelayMs,
    },
  );

  const metaPath = path.join(OUT_DIR, 'meta.json');
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['shikamaru-kage-mane'] = bodyEntry;
  if (fxEntry) meta['shikamaru-kage-mane-fx'] = fxEntry;
  meta['skill-kage-mane'] = {
    ...bodyEntry,
    note: 'Jutsu 1 Shikamaru — único skill',
    fx: fxEntry ? fxEntry.image : undefined,
  };

  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        skillId: 'skill-kage-mane',
        frameWidth: bodyScaled.frameWidth,
        frameHeight: bodyScaled.frameHeight,
        frameCount: bodyScaled.frames.length,
        contentHeight: bodyScaled.contentHeight,
        durationMs,
        hitDelayMs,
        frameRate: FRAME_RATE,
        fx: fxEntry
          ? {
              frameWidth: fxEntry.frameWidth,
              frameHeight: fxEntry.frameHeight,
              frameCount: fxEntry.frameCount,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
