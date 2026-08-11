/**
 * Might Guy combo attack — alpha-only frames (20f → 5+5+10).
 * NO green flood / black key. Olive gi + black outline preserved.
 *
 * npm run guy:combo
 * Fonte: assets/naruto-source/nu/guy/_src/combo/frame_*.png
 * Output: public/sprites/player/guy/{combo1,combo2,combo3,attack,combo}.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'guy', '_src', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'guy');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'guy');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const MAX_SHEET_W = 4096;
const PAD = 2;
/** Multi-hit chain: 5 + 5 + remainder. */
const SEG = [5, 5];
const HINT_EXPECTED = 20;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualScreenGreen(r, g, b) {
  return greenness(r, g, b) >= 40 && g >= 60 && r <= 50 && b <= 50;
}

function despeckleExterior(data, w, h, maxComp = 2) {
  const n = w * h;
  const lab = new Int32Array(n);
  lab.fill(-1);
  let comp = 0;
  const sizes = [];
  for (let i = 0; i < n; i += 1) {
    if (data[i * 4 + 3] < 16 || lab[i] >= 0) continue;
    const stack = [i];
    lab[i] = comp;
    let size = 0;
    while (stack.length) {
      const p = stack.pop();
      size += 1;
      const x = p % w;
      const y = (p / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (lab[ni] >= 0 || data[ni * 4 + 3] < 16) continue;
        lab[ni] = comp;
        stack.push(ni);
      }
    }
    sizes.push(size);
    comp += 1;
  }
  if (comp <= 1) return 0;
  let maxSize = 0;
  let mainId = 0;
  for (let c = 0; c < sizes.length; c += 1) {
    if (sizes[c] > maxSize) {
      maxSize = sizes[c];
      mainId = c;
    }
  }
  let removed = 0;
  for (let i = 0; i < n; i += 1) {
    const c = lab[i];
    if (c < 0 || c === mainId || sizes[c] > maxComp) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const warm = (r > 160 && g > 100 && b < 80) || (r > 200 && g > 180 && b < 120);
    if (warm || sat >= 40) continue;
    data[i * 4 + 3] = 0;
    removed += 1;
  }
  return removed;
}

function bbox(data, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function bodyContentHeight(data, w, h, box) {
  let minY = h;
  let maxY = -1;
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 220 && g > 220 && b > 220) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return box.height;
  return Math.max(1, maxY - minY + 1);
}

function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const fw = Math.max(...boxes.map((b) => b.width)) + PAD * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + PAD * 2;
  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - PAD;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * srcW + (box.minX + x)) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = frame[si + 3];
      }
    }
    return canvas;
  });
  // Standing height from early combo frames (avoid crouch/jump bloating scale).
  const sampleN = Math.min(6, frames.length);
  let bodyH = 0;
  for (let i = 0; i < sampleN; i += 1) {
    bodyH += bodyContentHeight(frames[i], widths[i], heights[i], boxes[i]);
  }
  bodyH = Math.round(bodyH / sampleN);
  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: bodyH || boxes[0].height,
  };
}

async function scaleFrames(frames, fw, fh, contentHeight) {
  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentHeight));
  if (scale >= 0.995) {
    return { frames, frameWidth: fw, frameHeight: fh, contentHeight, scale: 1 };
  }
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    out.push(data);
  }
  return {
    frames: out,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outContent,
    scale,
  };
}

function stitchRow(frames, fw, fh) {
  const outW = fw * frames.length;
  const out = Buffer.alloc(outW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(out, (y * outW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: out, width: outW, height: fh, cols: frames.length, rows: 1 };
}

function stitchGrid(frames, fw, fh, maxCols) {
  const cols = Math.min(maxCols, frames.length);
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

function stitchAuto(frames, fw, fh) {
  if (fw * frames.length <= MAX_SHEET_W) return stitchRow(frames, fw, fh);
  const maxCols = Math.max(1, Math.floor(MAX_SHEET_W / fw));
  return stitchGrid(frames, fw, fh, maxCols);
}

function qaMetrics(sheetData, sheetW, fh, fw, n, sheetCols) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let oliveGi = 0;
  const cols = sheetCols || n;
  for (let f = 0; f < n; f += 1) {
    const col = f % cols;
    const row = Math.floor(f / cols);
    let pix = 0;
    let maxVrun = 0;
    let frameBlack = 0;
    const ox = col * fw;
    const oy = row * fh;
    for (let x = 1; x < fw - 1; x += 1) {
      let run = 0;
      for (let y = 0; y < fh; y += 1) {
        const mid = sheetData[((oy + y) * sheetW + ox + x) * 4 + 3] < 16;
        const left = sheetData[((oy + y) * sheetW + ox + x - 1) * 4 + 3] >= 16;
        const right = sheetData[((oy + y) * sheetW + ox + x + 1) * 4 + 3] >= 16;
        if (mid && left && right) run += 1;
        else {
          maxVrun = Math.max(maxVrun, run);
          run = 0;
        }
      }
      maxVrun = Math.max(maxVrun, run);
    }
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = ((oy + y) * sheetW + ox + x) * 4;
        if (sheetData[i + 3] < 16) continue;
        opaque += 1;
        pix += 1;
        const r = sheetData[i];
        const g = sheetData[i + 1];
        const b = sheetData[i + 2];
        if (isResidualScreenGreen(r, g, b)) residualGreen += 1;
        if (r <= 20 && g <= 20 && b <= 20) {
          pureBlack += 1;
          frameBlack += 1;
        }
        if (g >= 50 && g > r + 5 && g >= b - 10 && greenness(r, g, b) < 30) {
          oliveGi += 1;
        }
      }
    }
    if (pix < 60) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 8) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
    if (frameBlack < 6) {
      throw new Error(`Frame ${f} pure black outline too low (${frameBlack})`);
    }
  }
  return { residualGreen, opaque, pureBlack, oliveGi };
}

async function writeMagenta(sheet, outPath) {
  const mag = Buffer.alloc(sheet.width * sheet.height * 4);
  for (let i = 0; i < sheet.width * sheet.height; i += 1) {
    const j = i * 4;
    if (sheet.data[j + 3] < 16) {
      mag[j] = 255;
      mag[j + 1] = 0;
      mag[j + 2] = 255;
      mag[j + 3] = 255;
    } else {
      mag[j] = sheet.data[j];
      mag[j + 1] = sheet.data[j + 1];
      mag[j + 2] = sheet.data[j + 2];
      mag[j + 3] = 255;
    }
  }
  await sharp(mag, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);
}

async function writeSheet(name, frames, fw, fh, contentHeight, scale, extra = {}) {
  const sheet = stitchAuto(frames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, `${name}.png`));

  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    fh,
    fw,
    frames.length,
    sheet.cols,
  );
  if (qa.residualGreen > 0) {
    throw new Error(`${name}: residual green ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 20) throw new Error(`${name}: pure black too low`);
  if (qa.oliveGi < 20) throw new Error(`${name}: olive gi too low`);

  fs.mkdirSync(QA_DIR, { recursive: true });
  await writeMagenta(sheet, path.join(QA_DIR, `${name}-magenta-bg.png`));
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(QA_DIR, `${name}-full.png`));

  // Per-frame x6 mag for visual QA (first + last + mid of each strip)
  const samples = new Set([0, Math.floor(frames.length / 2), frames.length - 1]);
  for (const fi of samples) {
    const frame = frames[fi];
    const magF = Buffer.alloc(fw * fh * 4);
    for (let i = 0; i < fw * fh; i += 1) {
      const j = i * 4;
      if (frame[j + 3] < 16) {
        magF[j] = 255;
        magF[j + 1] = 0;
        magF[j + 2] = 255;
        magF[j + 3] = 255;
      } else {
        magF[j] = frame[j];
        magF[j + 1] = frame[j + 1];
        magF[j + 2] = frame[j + 2];
        magF[j + 3] = 255;
      }
    }
    await sharp(magF, { raw: { width: fw, height: fh, channels: 4 } })
      .resize(fw * 6, fh * 6, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(QA_DIR, `${name}-frame-${fi}-mag-x6.png`));
  }

  console.log(
    `  QA ${name}: residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} oliveGi=${qa.oliveGi}`,
  );

  return {
    image: `/sprites/player/guy/${name}.png`,
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    contentHeight,
    scale,
    source: 'assets/naruto-source/nu/guy/_src/combo (frame_001…020)',
    frameRate: FRAME_RATE,
    sheetCols: sheet.cols,
    sheetRows: sheet.rows,
    residualGreen: qa.residualGreen,
    pureBlack: qa.pureBlack,
    oliveGi: qa.oliveGi,
    ...extra,
  };
}

async function loadSequence(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Pasta não encontrada: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (files.length === 0) throw new Error(`Sem PNGs em ${dir}`);

  const frames = [];
  const widths = [];
  const heights = [];
  let fleckRemoved = 0;
  for (const file of files) {
    const { data, info } = await sharp(path.join(dir, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    fleckRemoved += despeckleExterior(data, info.width, info.height);
    frames.push(data);
    widths.push(info.width);
    heights.push(info.height);
    const box = bbox(data, info.width, info.height);
    console.log(`  ${file}: content=${box.width}x${box.height}`);
  }
  if (fleckRemoved) console.log(`  despeckle removed ${fleckRemoved} exterior fleck px`);
  return { frames, widths, heights };
}

async function main() {
  console.log('guy combo (alpha-only, 5+5+x):');
  const seq = await loadSequence(INPUT_DIR);
  if (seq.frames.length !== HINT_EXPECTED) {
    throw new Error(`Expected ${HINT_EXPECTED} combo frames, got ${seq.frames.length}`);
  }

  const norm = normalize(seq.frames, seq.widths, seq.heights);
  console.log(
    `  normalized fw=${norm.frameWidth} fh=${norm.frameHeight} bodyH≈${norm.contentHeight}`,
  );
  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
  );
  console.log(`  scale=${scaled.scale.toFixed(3)}`);

  const n = scaled.frames.length;
  const i1 = SEG[0];
  const i2 = SEG[0] + SEG[1];
  if (i2 >= n) throw new Error(`SEG [${SEG}] doesn't fit n=${n}`);
  const ranges = [
    { name: 'combo1', start: 0, end: i1, note: 'punch setup + first hits (5f); alpha-only' },
    { name: 'combo2', start: i1, end: i2, note: 'mid combo (5f); alpha-only' },
    { name: 'combo3', start: i2, end: n, note: `finisher + recovery (${n - i2}f); alpha-only` },
  ];

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }

  const attack = await writeSheet(
    'attack',
    scaled.frames,
    scaled.frameWidth,
    scaled.frameHeight,
    scaled.contentHeight,
    scaled.scale,
    { note: `full combo strip (${n}f); ${i1}+${SEG[1]}+${n - i2} splits` },
  );
  meta['guy-attack'] = attack;

  // Alias full strip as combo.png
  await sharp(path.join(OUT_DIR, 'attack.png')).toFile(path.join(OUT_DIR, 'combo.png'));
  meta['guy-combo'] = {
    ...attack,
    image: '/sprites/player/guy/combo.png',
    note: `full combo strip (${n}f); alias of attack`,
  };

  const pack = [];
  for (const range of ranges) {
    const slice = scaled.frames.slice(range.start, range.end);
    const entry = await writeSheet(
      range.name,
      slice,
      scaled.frameWidth,
      scaled.frameHeight,
      scaled.contentHeight,
      scaled.scale,
      { range: [range.start, range.end], note: range.note },
    );
    meta[`guy-${range.name}`] = entry;
    pack.push({
      name: range.name,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: slice.length,
      contentHeight: scaled.contentHeight,
      frames: `${range.start}..${range.end - 1}`,
    });
  }

  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  console.log('Pack wire:', JSON.stringify(pack, null, 2));
  console.log(
    `-> combo 5+5+${n - i2} fw=${scaled.frameWidth} fh=${scaled.frameHeight} contentH=${scaled.contentHeight}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
