/**
 * Naruto classic Part 1 walk — 6 frames, alpha-only pack.
 *
 * Sources are already clean sprites with true transparency (corner a=0).
 * Opaque pure black is outline / whiskers / pupils — NEVER flood-key or peel.
 * Previous exterior pure-black flood + fringe peel ate ankle/pants connectors
 * → floating feet (same class of bug as Hinata jutsu green/black over-key).
 *
 * Pipeline: preserve source RGBA → bbox a>threshold → floor-align →
 *   scale contentH≈48 → pack strip.
 *
 * npm run naruto:walk
 * Input:  assets/naruto-source/nu/naruto/walk/frame_001..006.png
 * Output: public/sprites/player/naruto/walk.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'naruto', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'naruto');
const TARGET_BODY_H = 48;
const FRAME_RATE = 10;
const EXPECTED = 6;
const ALPHA_KEEP = 16;

/** Residual pure chroma green (sources should have none). */
function isChromaGreen(r, g, b) {
  const gn = g - Math.max(r, b);
  if (g >= 28 && gn >= 12 && r <= 100 && b <= 95) return true;
  if (g >= 50 && g >= r + 28 && g >= b + 28 && r <= 110 && b <= 105) return true;
  return false;
}

/**
 * Pass-through: frames already have correct alpha. Do not key black.
 * Only zero true transparent / near-transparent; leave RGB for opaque.
 * Optionally strip residual chroma green if any (should be 0).
 */
function preserveFrame(data) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < ALPHA_KEEP) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(out[i], out[i + 1], out[i + 2])) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    // Binary alpha for pack consistency (sources are binary already)
    out[i + 3] = 255;
  }
  return out;
}

function bbox(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
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
}

/** Floor-align feet on shared cell (pad=2). */
function normalize(frames, widths, heights) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const pad = 2;
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  const contentH0 = Math.round(
    boxes.slice(0, Math.min(2, boxes.length)).reduce((s, b) => s + b.height, 0) /
      Math.min(2, boxes.length),
  );

  const out = frames.map((frame, index) => {
    const box = boxes[index];
    const srcW = widths[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = Math.floor((fw - box.width) / 2);
    const destY = fh - box.height - pad;
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

  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: contentH0 || boxes[0].height,
    boxes,
  };
}

async function scaleFrames(frames, fw, fh, contentHeight) {
  const scale = TARGET_BODY_H / Math.max(1, contentHeight);
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

    // Binary alpha after nearest — no black peel / hole fill
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i + 3] = 255;
        if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }
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

function listFrames(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^frame_\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = +(a.match(/frame_(\d+)/i) || [])[1] || 0;
      const nb = +(b.match(/frame_(\d+)/i) || [])[1] || 0;
      return na - nb;
    });
}

function componentSizes(frameData, w, h, sheetW, frameIndex, fw) {
  const n = fw * h;
  const seen = new Uint8Array(n);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const comps = [];
  for (let start = 0; start < n; start += 1) {
    const x0 = start % fw;
    const y0 = (start / fw) | 0;
    const i0 = (y0 * sheetW + frameIndex * fw + x0) * 4;
    if (seen[start] || frameData[i0 + 3] < ALPHA_KEEP) continue;
    const stack = [start];
    let size = 0;
    seen[start] = 1;
    while (stack.length) {
      const s = stack.pop();
      size += 1;
      const x = s % fw;
      const y = (s / fw) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= h) continue;
        const ni = ny * fw + nx;
        const ii = (ny * sheetW + frameIndex * fw + nx) * 4;
        if (seen[ni] || frameData[ii + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    comps.push(size);
  }
  comps.sort((a, b) => b - a);
  return comps;
}

function qaMetrics(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlackOutline = 0;
  let darkBlue = 0;
  let orange = 0;
  const footY = [];
  const frameComps = [];

  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let frameBlack = 0;
    let frameOrange = 0;
    let frameBlue = 0;

    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < ALPHA_KEEP) continue;
        opaque += 1;
        pix += 1;
        const r = sheetData[i];
        const g = sheetData[i + 1];
        const b = sheetData[i + 2];
        if (isChromaGreen(r, g, b)) residualGreen += 1;
        if (r <= 12 && g <= 12 && b <= 12) {
          pureBlackOutline += 1;
          frameBlack += 1;
        }
        if (r >= 140 && g >= 40 && g <= 160 && b <= 90 && r > b + 40) {
          orange += 1;
          frameOrange += 1;
        }
        if (b >= r + 8 && b >= g + 8 && b >= 40 && b <= 160 && r <= 100) {
          darkBlue += 1;
          frameBlue += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }

    const comps = componentSizes(sheetData, fw, fh, sheetW, f, fw);
    frameComps.push(comps);
    footY.push(maxFoot);

    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (frameBlack < 8) {
      throw new Error(`Frame ${f} pure black outline too low (${frameBlack}px)`);
    }
    if (frameOrange < 30) {
      throw new Error(`Frame ${f} orange jumpsuit nearly gone (${frameOrange}px)`);
    }
    if (frameBlue < 8) {
      throw new Error(`Frame ${f} dark blue garments missing (${frameBlue}px)`);
    }
    // Single body: no floating feet / detached sandals from black-key damage
    if (comps.length > 1) {
      const minor = comps.slice(1).reduce((s, c) => s + c, 0);
      throw new Error(
        `Frame ${f} disconnected limbs nComps=${comps.length} top=${comps[0]} minor=${minor} sizes=${comps.join(',')}`,
      );
    }
  }

  const feet = footY.filter((y) => y >= 0);
  return {
    residualGreen,
    residualExteriorBlack: 0, // not meaningful: outline/hair are pure #000 at edge
    opaque,
    pureBlackOutline,
    darkBlue,
    orange,
    footSpread: Math.max(...feet) - Math.min(...feet),
    footY,
    frameComps,
  };
}

async function writeQa(sheet, scaled) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const mag = Buffer.alloc(sheet.width * sheet.height * 4);
  for (let i = 0; i < sheet.width * sheet.height; i += 1) {
    const j = i * 4;
    if (sheet.data[j + 3] < ALPHA_KEEP) {
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
    .toFile(path.join(QA_DIR, 'walk-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(QA_DIR, 'walk-full.png'));

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
      .resize(scaled.frameWidth * 4, scaled.frameHeight * 4, {
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toFile(path.join(QA_DIR, `walk-frame-${fi}-x4.png`));
  }
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Missing input dir: ${INPUT_DIR}`);
  }
  const files = listFrames(INPUT_DIR);
  if (files.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} frames in ${INPUT_DIR}, got ${files.length}`);
  }

  const keyed = [];
  for (const file of files) {
    const full = path.join(INPUT_DIR, file);
    const { data, info } = await sharp(full)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Confirm alpha corners (diagnostic only)
    const c = [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ].map(([x, y]) => data[(y * info.width + x) * 4 + 3]);
    const alphaCorners = c.every((a) => a < ALPHA_KEEP);

    const frame = preserveFrame(data);
    const box = bbox(frame, info.width, info.height);
    let opaque = 0;
    for (let i = 3; i < frame.length; i += 4) if (frame[i] >= ALPHA_KEEP) opaque += 1;
    if (opaque < 200 || box.width < 8 || box.height < 16) {
      throw new Error(`${file} empty after preserve (opaque=${opaque} box=${box.width}x${box.height})`);
    }
    console.log(
      `KEEP ${file} ${info.width}x${info.height} → content ${box.width}x${box.height} opaque=${opaque} alphaCorners=${alphaCorners}`,
    );
    keyed.push({ file, frame, width: info.width, height: info.height, box, opaque });
  }

  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
  );
  console.log(
    `normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight}`,
  );

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
  );
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaMetrics(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlackOutline} darkBlue=${qa.darkBlue} orange=${qa.orange} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlackOutline < 60) {
    throw new Error(`QA fail: pure black outline nearly gone (${qa.pureBlackOutline})`);
  }
  if (qa.darkBlue < 40) {
    throw new Error(`QA fail: dark blue garments missing (${qa.darkBlue})`);
  }
  if (qa.footSpread > 4) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'walk.png');
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  await writeQa(sheet, scaled);

  const entry = {
    image: '/sprites/player/naruto/walk.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/naruto/walk/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: qa.residualExteriorBlack,
    pureBlackOutline: qa.pureBlackOutline,
    darkBlue: qa.darkBlue,
    orange: qa.orange,
    note: '6-frame classic Part 1 walk; alpha-only (no black flood/peel); outline preserved',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['naruto-walk'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'naruto-walk',
      url: entry.image,
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      pack: 'naruto-classic',
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
