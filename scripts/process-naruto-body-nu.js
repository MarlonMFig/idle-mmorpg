/**
 * Recorta idle / walk / combos do Naruto (fundo teal, labels em barra preta)
 * em strips uniformes sob public/sprites/player/naruto/.
 *
 * Uso:
 *   node scripts/process-naruto-body-nu.js
 *   node scripts/process-naruto-body-nu.js --analyze
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');

const TEAL = [48, 200, 152];
const TOL = 42;

const JOBS = [
  // Idle: npm run naruto:idle (assets/naruto-source/nu/naruto/idle/frame_001..006.png)
  // Walk: npm run naruto:walk (assets/naruto-source/nu/naruto/walk/frame_001..006.png)
  {
    key: 'naruto-combo1',
    file: 'combos.png',
    out: 'combo1.png',
    multiRow: true,
    rowIndex: 0,
    mode: 'content',
    gapMax: 10,
    minWidth: 18,
  },
  {
    key: 'naruto-combo2',
    file: 'combos.png',
    out: 'combo2.png',
    multiRow: true,
    rowIndex: 1,
    mode: 'content',
    gapMax: 10,
    minWidth: 18,
  },
  {
    key: 'naruto-combo3',
    file: 'combos.png',
    out: 'combo3.png',
    multiRow: true,
    rowIndex: 2,
    mode: 'content',
    gapMax: 10,
    minWidth: 18,
  },
];

function isTeal(r, g, b) {
  return (
    Math.abs(r - TEAL[0]) <= TOL &&
    Math.abs(g - TEAL[1]) <= TOL &&
    Math.abs(b - TEAL[2]) <= TOL
  );
}

function isCyanSeparator(r, g, b) {
  return r < 100 && g > 95 && b > 95 && Math.abs(g - b) <= 40 && (g + b) / 2 > r + 50;
}

function isBlackBar(r, g, b) {
  return r < 35 && g < 35 && b < 35;
}

function isKeyable(r, g, b) {
  return isTeal(r, g, b) || isCyanSeparator(r, g, b);
}

function findContentBounds(data, w, h, ch) {
  let first = -1;
  let last = -1;
  for (let y = 0; y < h; y += 1) {
    let teal = 0;
    let black = 0;
    let other = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBlackBar(r, g, b)) {
        black += 1;
        continue;
      }
      if (isTeal(r, g, b)) teal += 1;
      else if (!isCyanSeparator(r, g, b)) other += 1;
    }
    // Barra de título ("Idle", "Walking", "Combo N") — ignora.
    if (black / w >= 0.35) continue;
    // Linhas de frame (fundo teal da sheet de personagem).
    if (teal / w >= 0.15 || (other > 20 && teal / w >= 0.08)) {
      if (first < 0) first = y;
      last = y;
    }
  }
  if (first < 0) throw new Error('sem conteúdo teal');
  return { top: first, bottom: last + 1 };
}

function findRowBands(data, w, y0, y1, ch) {
  const dens = [];
  for (let y = y0; y < y1; y += 1) {
    let other = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isKeyable(r, g, b) && !isBlackBar(r, g, b)) other += 1;
    }
    dens.push(other);
  }
  const thr = Math.max(8, Math.floor(w * 0.01));
  const bands = [];
  let inBand = false;
  let start = 0;
  for (let i = 0; i <= dens.length; i += 1) {
    const filled = i < dens.length && dens[i] > thr;
    if (filled && !inBand) {
      inBand = true;
      start = i;
    } else if (!filled && inBand) {
      if (i - start >= 30) bands.push({ top: start + y0, bottom: i + y0 });
      inBand = false;
    }
  }
  return bands.length ? bands : [{ top: y0, bottom: y1 }];
}

function extractEqualFrames(data, w, h, ch, cols) {
  const fw = Math.floor(w / cols);
  const frameWidth = fw;
  const frameHeight = h;
  const frames = [];
  for (let c = 0; c < cols; c += 1) {
    const frame = Buffer.alloc(frameWidth * frameHeight * 4);
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const sx = c * fw + x;
        if (sx >= w) continue;
        const si = (y * w + sx) * ch;
        const r = data[si];
        const g = data[si + 1];
        const b = data[si + 2];
        const di = (y * frameWidth + x) * 4;
        if (isKeyable(r, g, b) || isBlackBar(r, g, b)) {
          frame[di + 3] = 0;
        } else {
          frame[di] = r;
          frame[di + 1] = g;
          frame[di + 2] = b;
          frame[di + 3] = 255;
        }
      }
    }
    frames.push(frame);
  }
  return { frames, frameWidth, frameHeight };
}

/**
 * Detecta células por colunas com conteúdo (evita cortar o personagem ao meio).
 */
function extractContentFrames(data, w, h, ch, gapMax, minWidth) {
  const colHits = new Array(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isKeyable(r, g, b) || isBlackBar(r, g, b)) continue;
      colHits[x] += 1;
    }
  }
  const thr = Math.max(3, Math.floor(h * 0.08));
  const raw = [];
  let start = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && colHits[x] > thr;
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      raw.push({ left: start, right: x });
      start = -1;
    }
  }
  const merged = [];
  for (const run of raw) {
    const prev = merged[merged.length - 1];
    if (prev && run.left - prev.right <= gapMax) prev.right = run.right;
    else merged.push({ ...run });
  }
  const cells = merged.filter((c) => c.right - c.left >= minWidth);
  if (cells.length === 0) throw new Error('nenhuma célula de conteúdo detectada');

  const frames = cells.map((cell) => {
    // Recorta com 1 px de folga se couber.
    const left = Math.max(0, cell.left - 1);
    const right = Math.min(w, cell.right + 1);
    const fw = right - left;
    const frame = Buffer.alloc(fw * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const si = (y * w + left + x) * ch;
        const di = (y * fw + x) * 4;
        const r = data[si];
        const g = data[si + 1];
        const b = data[si + 2];
        if (isKeyable(r, g, b) || isBlackBar(r, g, b)) {
          frame[di + 3] = 0;
        } else {
          frame[di] = r;
          frame[di + 1] = g;
          frame[di + 2] = b;
          frame[di + 3] = 255;
        }
      }
    }
    return frame;
  });

  // widths diferentes — normalizeFrames unifica.
  const frameWidth = Math.max(...frames.map((f, i) => {
    const left = Math.max(0, cells[i].left - 1);
    const right = Math.min(w, cells[i].right + 1);
    return right - left;
  }));
  // Re-pad to same width before normalize (normalize expects equal input width)
  const padded = frames.map((frame, i) => {
    const left = Math.max(0, cells[i].left - 1);
    const right = Math.min(w, cells[i].right + 1);
    const curW = right - left;
    if (curW === frameWidth) return frame;
    const out = Buffer.alloc(frameWidth * h * 4);
    const xOff = Math.floor((frameWidth - curW) / 2);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < curW; x += 1) {
        const si = (y * curW + x) * 4;
        const di = (y * frameWidth + xOff + x) * 4;
        out[di] = frame[si];
        out[di + 1] = frame[si + 1];
        out[di + 2] = frame[si + 2];
        out[di + 3] = frame[si + 3];
      }
    }
    return out;
  });

  return { frames: padded, frameWidth, frameHeight: h, cells: cells.length };
}

/**
 * Por frame: recorta o desenho e recenteia no peito do pé (bottom-center).
 * Assim o personagem não “desliza” no combo wide nem no walk.
 */
function normalizeFrames(frames, frameWidth, frameHeight) {
  const boxes = frames.map((frame) => {
    let minX = frameWidth;
    let maxX = -1;
    let minY = frameHeight;
    let maxY = -1;
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        if (frame[(y * frameWidth + x) * 4 + 3] < 16) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
    }
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  });

  const pad = 1;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  const normalized = frames.map((frame, index) => {
    const box = boxes[index];
    const out = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - pad;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * frameWidth + (box.minX + x)) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        out[di] = frame[si];
        out[di + 1] = frame[si + 1];
        out[di + 2] = frame[si + 2];
        out[di + 3] = frame[si + 3];
      }
    }
    return out;
  });

  // Altura do corpo no frame 0 (para escala em jogo).
  const firstBox = boxes[0];
  return {
    frames: normalized,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: firstBox.height,
  };
}

function stitch(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh };
}

async function run(job, analyzeOnly) {
  const input = path.join(SRC, job.file);
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bounds = findContentBounds(data, w, h, ch);
  const bands = job.multiRow
    ? findRowBands(data, w, bounds.top, bounds.bottom, ch)
    : [{ top: bounds.top, bottom: bounds.bottom }];

  console.log(
    `${job.key}: ${w}x${h} content y=${bounds.top}..${bounds.bottom - 1} bands=${bands.length}`,
  );
  bands.forEach((b, i) =>
    console.log(`  band${i} y=${b.top}..${b.bottom - 1} h=${b.bottom - b.top}`),
  );

  const band = job.multiRow ? bands[job.rowIndex] : bands[0];
  if (!band) throw new Error(`${job.key}: banda ${job.rowIndex} ausente`);

  const rowH = band.bottom - band.top;
  const slice = Buffer.alloc(w * rowH * ch);
  for (let y = 0; y < rowH; y += 1) {
    data.copy(slice, y * w * ch, ((band.top + y) * w) * ch, ((band.top + y + 1) * w) * ch);
  }

  let extracted;
  if (job.mode === 'content') {
    extracted = extractContentFrames(
      slice,
      w,
      rowH,
      ch,
      job.gapMax ?? 10,
      job.minWidth ?? 18,
    );
    console.log(`  content-cells=${extracted.cells}`);
  } else {
    extracted = extractEqualFrames(slice, w, rowH, ch, job.cols);
  }
  extracted = normalizeFrames(extracted.frames, extracted.frameWidth, extracted.frameHeight);
  console.log(
    `  frames=${extracted.frames.length} size=${extracted.frameWidth}x${extracted.frameHeight} contentH=${extracted.contentHeight}`,
  );

  if (analyzeOnly) return null;

  const sheet = stitch(extracted.frames, extracted.frameWidth, extracted.frameHeight);
  fs.mkdirSync(OUT, { recursive: true });
  const outPath = path.join(OUT, job.out);
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);
  console.log(`  -> ${path.relative(ROOT, outPath)} ${sheet.width}x${sheet.height}`);

  return {
    image: `/sprites/player/naruto/${job.out}`,
    frameWidth: extracted.frameWidth,
    frameHeight: extracted.frameHeight,
    frameCount: extracted.frames.length,
    contentHeight: extracted.contentHeight,
    source: job.file,
  };
}

async function main() {
  const analyzeOnly = process.argv.includes('--analyze');
  // Mantém meta dos jutsus se existir.
  const metaPath = path.join(OUT, 'meta.json');
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : {};
  for (const job of JOBS) {
    const entry = await run(job, analyzeOnly);
    if (entry) meta[job.key] = entry;
  }
  if (analyzeOnly) return;
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log('\nmeta:', path.relative(ROOT, metaPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
