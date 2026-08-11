/**
 * Might Guy idle — alpha-only per-frame sequence (6f breath).
 * NO green flood / black key. Sources already have clean alpha.
 *
 * npm run guy:idle
 * Fonte: assets/naruto-source/nu/guy/_src/idle/frame_*.png
 * Output: public/sprites/player/guy/idle.png + preview
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'guy', '_src', 'idle');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'guy');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'guy.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'guy');
const TARGET_BODY_H = 48;
const FRAME_RATE = 7;
const HINT_EXPECTED = 6;
const PAD = 2;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualScreenGreen(r, g, b) {
  return greenness(r, g, b) >= 40 && g >= 60 && r <= 50 && b <= 50;
}

/** Drop only tiny exterior gray/JPEG flecks (not olive gi, not warm VFX). */
function despeckleExterior(data, w, h, maxComp = 2) {
  const n = w * h;
  const lab = new Int32Array(n);
  lab.fill(-1);
  let comp = 0;
  const sizes = [];
  const seeds = [];
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
    seeds.push(i);
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
      // Ignore pure white sparkles when measuring standing body.
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
  const sampleN = Math.min(4, frames.length);
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
  // Prefer nearest single downscale toward contentH 48; never upscale junk.
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

function stitch(frames, fw, fh) {
  const sheetW = fw * frames.length;
  const sheet = Buffer.alloc(sheetW * fh * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < fh; y += 1) {
      frame.copy(sheet, (y * sheetW + index * fw) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  return { data: sheet, width: sheetW, height: fh };
}

function qaMetrics(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let oliveGi = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let maxVrun = 0;
    let frameBlack = 0;
    for (let x = 1; x < fw - 1; x += 1) {
      let run = 0;
      for (let y = 0; y < fh; y += 1) {
        const mid = sheetData[(y * sheetW + f * fw + x) * 4 + 3] < 16;
        const left = sheetData[(y * sheetW + f * fw + x - 1) * 4 + 3] >= 16;
        const right = sheetData[(y * sheetW + f * fw + x + 1) * 4 + 3] >= 16;
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
        const i = (y * sheetW + f * fw + x) * 4;
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
        if (y > maxFoot) maxFoot = y;
      }
    }
    footY.push(maxFoot);
    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 6) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
    if (frameBlack < 8) {
      throw new Error(`Frame ${f} pure black outline too low (${frameBlack})`);
    }
  }
  const feet = footY.filter((y) => y >= 0);
  return {
    residualGreen,
    opaque,
    pureBlack,
    oliveGi,
    footSpread: Math.max(...feet) - Math.min(...feet),
    footY,
  };
}

async function writeQaCrops(sheet, scaled, qaDir) {
  fs.mkdirSync(qaDir, { recursive: true });
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
    .toFile(path.join(qaDir, 'idle-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, 'idle-full.png'));

  for (let fi = 0; fi < scaled.frames.length; fi += 1) {
    const crop = Buffer.alloc(scaled.frameWidth * scaled.frameHeight * 4);
    for (let y = 0; y < scaled.frameHeight; y += 1) {
      sheet.data.copy(
        crop,
        y * scaled.frameWidth * 4,
        (y * sheet.width + fi * scaled.frameWidth) * 4,
        (y * sheet.width + fi * scaled.frameWidth + scaled.frameWidth) * 4,
      );
    }
    await sharp(crop, {
      raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
    })
      .resize(scaled.frameWidth * 4, scaled.frameHeight * 4, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `idle-frame-${fi}-x4.png`));

    const magF = Buffer.alloc(scaled.frameWidth * scaled.frameHeight * 4);
    for (let i = 0; i < scaled.frameWidth * scaled.frameHeight; i += 1) {
      const j = i * 4;
      if (crop[j + 3] < 16) {
        magF[j] = 255;
        magF[j + 1] = 0;
        magF[j + 2] = 255;
        magF[j + 3] = 255;
      } else {
        magF[j] = crop[j];
        magF[j + 1] = crop[j + 1];
        magF[j + 2] = crop[j + 2];
        magF[j + 3] = 255;
      }
    }
    await sharp(magF, {
      raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
    })
      .resize(scaled.frameWidth * 6, scaled.frameHeight * 6, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(path.join(qaDir, `idle-frame-${fi}-mag-x6.png`));
  }
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
  return { frames, widths, heights, files };
}

async function main() {
  console.log('guy idle (alpha-only, no chroma key):');
  const seq = await loadSequence(INPUT_DIR);
  if (seq.frames.length !== HINT_EXPECTED) {
    throw new Error(`Expected ${HINT_EXPECTED} idle frames, got ${seq.frames.length}`);
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

  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} oliveGi=${qa.oliveGi} footSpread=${qa.footSpread}`,
  );
  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 40) {
    throw new Error(`QA fail: pure black nearly gone (${qa.pureBlack})`);
  }
  if (qa.oliveGi < 40) {
    throw new Error(`QA fail: olive gi nearly gone (${qa.oliveGi})`);
  }
  if (qa.footSpread > 3) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, 'idle.png'));

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await sharp(scaled.frames[0], {
    raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  const entry = {
    image: '/sprites/player/guy/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    source: 'assets/naruto-source/nu/guy/_src/idle (frame_001…006)',
    frameRate: FRAME_RATE,
    residualGreen: qa.residualGreen,
    pureBlack: qa.pureBlack,
    oliveGi: qa.oliveGi,
    note: '6-frame idle breath; alpha-only (no green flood); olive gi preserved',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['guy-idle'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  await writeQaCrops(sheet, scaled, QA_DIR);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(3)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'guy-idle',
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
