/**
 * Gaara damage / death — green-screen horizontal strip (5 frames).
 *
 * Frame plan:
 *   1–2 = hurt (receive damage)
 *   3–5 = death (kill → hold final)
 *
 * Exterior chroma green only (NOT black key) — preserves dark hair / outfit / gourd.
 *
 * npm run gaara:damage
 * Input:  assets/naruto-source/nu/gaara/damage-source.png
 * Output: public/sprites/player/gaara/hurt.png + death.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  keyGreenBackground,
  isContent,
  isGreenBg,
  isLabelPixel,
  fillInteriorHoles,
} = require('./lib/chroma-green-bg');
const {
  normalize,
  scaleFrames,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
  ALPHA_KEEP,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const CURSOR_SRC = path.join(
  ROOT,
  '..',
  '.cursor',
  'projects',
  'c-Users-marlo-Projects-idle-mmorpg',
  'assets',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-7838cd46-b3fc-4bc7-9025-334fadc6fadd.png',
);
// Prefer workspace-local copy; fall back to Cursor assets attachment path.
const LOCAL_SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara', 'damage-source.png');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'gaara');
const TARGET_BODY_H = 48;
const EXPECTED = 5;
const HURT_FRAME_RATE = 9;
const DEATH_FRAME_RATE = 8;

function resolveSource() {
  if (fs.existsSync(LOCAL_SRC)) return LOCAL_SRC;
  // Parent of Projects may differ; absolute path from task:
  const abs = path.normalize(
    'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-7838cd46-b3fc-4bc7-9025-334fadc6fadd.png',
  );
  if (fs.existsSync(abs)) return abs;
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(`Missing damage sheet. Expected ${LOCAL_SRC}`);
}

function isRedHair(r, g, b) {
  return r >= 90 && r >= g + 25 && r >= b + 15;
}

function isSand(r, g, b) {
  return r >= 130 && g >= 90 && b >= 50 && r >= b && Math.abs(r - g) < 90 && g >= b - 10;
}

function countPalette(sheetData) {
  let red = 0;
  let sand = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isRedHair(r, g, b)) red += 1;
    if (isSand(r, g, b)) sand += 1;
  }
  return { red, sand };
}

function findBand(data, w, h) {
  const dy = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (isContent(data, (y * w + x) * 4)) dy[y] += 1;
    }
  }
  let t = 0;
  let b = h;
  for (let y = 0; y < h; y += 1) {
    if (dy[y] > 8) {
      t = y;
      break;
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    if (dy[y] > 4) {
      b = y + 1;
      break;
    }
  }
  return { t, b };
}

/** Split horizontal strip into content columns (gulfs of green / empty). */
function cellsInBand(data, w, band, expected) {
  const dens = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    for (let y = band.t; y < band.b; y += 1) {
      if (isContent(data, (y * w + x) * 4)) dens[x] += 1;
    }
  }
  const thr = Math.max(2, Math.floor((band.b - band.t) * 0.035));
  const raw = [];
  let xs = -1;
  for (let x = 0; x <= w; x += 1) {
    const filled = x < w && dens[x] > thr;
    if (filled && xs < 0) xs = x;
    if (!filled && xs >= 0) {
      if (x - xs >= 10) raw.push({ l: xs, r: x, t: band.t, b: band.b });
      xs = -1;
    }
  }

  if (raw.length === expected) return raw;

  // Force equal splits across first→last content span
  const nonempty = dens.map((d, x) => (d > thr ? x : -1)).filter((x) => x >= 0);
  if (!nonempty.length) throw new Error('No content columns for cell split');
  const L = nonempty[0];
  const R = nonempty[nonempty.length - 1] + 1;
  const span = R - L;
  const forced = [];
  for (let i = 0; i < expected; i += 1) {
    forced.push({
      l: Math.round(L + (i * span) / expected),
      r: Math.round(L + ((i + 1) * span) / expected),
      t: band.t,
      b: band.b,
    });
  }
  console.warn(
    `cells auto=${raw.length} → forced ${expected} equal (${span}px span)`,
  );
  return forced;
}

function extractCell(data, w, cell) {
  const fw = cell.r - cell.l;
  const fh = cell.b - cell.t;
  const frame = Buffer.alloc(fw * fh * 4);
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const si = ((cell.t + y) * w + cell.l + x) * 4;
      const di = (y * fw + x) * 4;
      if (!isContent(data, si)) {
        frame[di + 3] = 0;
        continue;
      }
      frame[di] = data[si];
      frame[di + 1] = data[si + 1];
      frame[di + 2] = data[si + 2];
      frame[di + 3] = 255;
    }
  }
  return { frame, width: fw, height: fh };
}

async function scrubResidualGreen(frames, fw, fh) {
  const out = [];
  for (const frame of frames) {
    const d = Buffer.from(frame);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < ALPHA_KEEP) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
        continue;
      }
      if (isLabelPixel(d[i], d[i + 1], d[i + 2])) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
        continue;
      }
      if (isGreenBg(d[i], d[i + 1], d[i + 2])) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
      }
    }
    fillInteriorHoles(d, fw, fh, Math.max(20, Math.floor(fw * fh * 0.06)));
    out.push(d);
  }
  return out;
}

async function packSlice(name, frames, widths, heights, contentFromN, frameRate) {
  const norm = normalize(frames, widths, heights, { contentFromN, pad: 2 });
  console.log(
    `${name} normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight}`,
  );

  const scrubbed = await scrubResidualGreen(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
  );

  const scaled = await scaleFrames(
    scrubbed,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    TARGET_BODY_H,
  );
  const cleaned = await scrubResidualGreen(
    scaled.frames,
    scaled.frameWidth,
    scaled.frameHeight,
  );
  const sheet = stitch(cleaned, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    cleaned.length,
    {
      requireSingleComponent: false,
      minBlackPerFrame: 10,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
    },
  );
  const pal = countPalette(sheet.data);

  console.log(
    `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} red=${pal.red} sand=${pal.sand} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA ${name} comps: ${qa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail ${name}: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 40) {
    throw new Error(`QA fail ${name}: pure black outline nearly gone (${qa.pureBlack})`);
  }
  if (pal.red < 20) {
    throw new Error(`QA fail ${name}: red hair nearly gone (${pal.red})`);
  }
  if (Math.abs(scaled.contentHeight - TARGET_BODY_H) > 2) {
    console.warn(
      `WARN ${name} contentH=${scaled.contentHeight} (want ~${TARGET_BODY_H})`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${name}.png`);
  await writePng(outFile, sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { ...scaled, frames: cleaned },
    QA_DIR,
    name,
    4,
  );

  const entry = {
    image: `/sprites/player/gaara/${name}.png`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: cleaned.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate,
    source: path.relative(ROOT, resolveSource()).replace(/\\/g, '/'),
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    red: pal.red,
    sand: pal.sand,
    note:
      name === 'hurt'
        ? 'frames 1–2 receive damage; play once on hit'
        : 'frames 3–5 death; play once on kill, hold last',
  };
  updateMeta(META_JSON, `gaara-${name}`, entry);

  console.log(
    `-> ${name}.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)} fps=${frameRate}`,
  );

  return entry;
}

async function main() {
  const src = resolveSource();
  fs.mkdirSync(path.dirname(LOCAL_SRC), { recursive: true });
  if (path.resolve(src) !== path.resolve(LOCAL_SRC)) {
    fs.copyFileSync(src, LOCAL_SRC);
    console.log(`copied source → ${path.relative(ROOT, LOCAL_SRC)}`);
  }

  const { data: raw, info } = await sharp(LOCAL_SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = keyGreenBackground(raw, info.width, info.height, {
    stripLabels: true,
  });
  console.log(`source ${info.width}x${info.height} keyed`);

  const band = findBand(keyed, info.width, info.height);
  const cells = cellsInBand(keyed, info.width, band, EXPECTED);
  console.log(
    `band ${band.t}-${band.b} cells=${cells.length}`,
    cells.map((c) => `${c.r - c.l}px`).join(' '),
  );
  if (cells.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} frames, got ${cells.length}`);
  }

  const extracted = cells.map((c) => extractCell(keyed, info.width, c));
  // Shared content height from standing hurt frames (1–2) so death scale matches body
  const allFrames = extracted.map((e) => e.frame);
  const allW = extracted.map((e) => e.width);
  const allH = extracted.map((e) => e.height);

  // Pre-normalize once for shared standing content, then slice
  const pre = normalize(allFrames, allW, allH, { contentFromN: 2, pad: 2 });
  console.log(
    `shared contentH0=${pre.contentHeight} cell ${pre.frameWidth}x${pre.frameHeight}`,
  );

  // Re-pack hurt + death with that contentHeight baked via contentFromN=2 on full set:
  // For death-only, pass standing content by normalizing all 5 then slicing scaled frames.
  const scrubbed = await scrubResidualGreen(
    pre.frames,
    pre.frameWidth,
    pre.frameHeight,
  );
  const scaled = await scaleFrames(
    scrubbed,
    pre.frameWidth,
    pre.frameHeight,
    pre.contentHeight,
    TARGET_BODY_H,
  );
  const cleaned = await scrubResidualGreen(
    scaled.frames,
    scaled.frameWidth,
    scaled.frameHeight,
  );

  async function writeNamed(name, slice, frameRate) {
    const frames = cleaned.slice(slice[0], slice[1]);
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const qa = qaSheet(
      sheet.data,
      sheet.width,
      scaled.frameHeight,
      scaled.frameWidth,
      frames.length,
      {
        requireSingleComponent: false,
        minBlackPerFrame: 10,
        minOlivePerFrame: 0,
        minBluePerFrame: 0,
        minOpaquePerFrame: 80,
      },
    );
    const pal = countPalette(sheet.data);
    console.log(
      `QA ${name} residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} red=${pal.red} sand=${pal.sand}`,
    );
    if (qa.residualGreen > 0) {
      throw new Error(`QA fail ${name}: residual green = ${qa.residualGreen}`);
    }
    if (qa.pureBlack < 40) {
      throw new Error(`QA fail ${name}: pure black nearly gone (${qa.pureBlack})`);
    }
    if (pal.red < 15) {
      throw new Error(`QA fail ${name}: red hair nearly gone (${pal.red})`);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    await writePng(
      path.join(OUT_DIR, `${name}.png`),
      sheet.data,
      sheet.width,
      sheet.height,
    );
    await writeFrameCrops(
      sheet,
      {
        frames,
        frameWidth: scaled.frameWidth,
        frameHeight: scaled.frameHeight,
        contentHeight: scaled.contentHeight,
      },
      QA_DIR,
      name,
      4,
    );

    const entry = {
      image: `/sprites/player/gaara/${name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate,
      source: path.relative(ROOT, LOCAL_SRC).replace(/\\/g, '/'),
      residualGreen: qa.residualGreen,
      residualExteriorBlack: 0,
      pureBlack: qa.pureBlack,
      red: pal.red,
      sand: pal.sand,
      note:
        name === 'hurt'
          ? 'frames 1–2 hit reaction; play once on damage'
          : 'frames 3–5 death; play once on kill, hold last frame',
    };
    updateMeta(META_JSON, `gaara-${name}`, entry);
    console.log(
      `-> ${name}.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)} fps=${frameRate}`,
    );
    return entry;
  }

  const hurt = await writeNamed('hurt', [0, 2], HURT_FRAME_RATE);
  const death = await writeNamed('death', [2, 5], DEATH_FRAME_RATE);

  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        hurt: {
          key: 'gaara-hurt',
          frameWidth: hurt.frameWidth,
          frameHeight: hurt.frameHeight,
          frameCount: hurt.frameCount,
          contentHeight: hurt.contentHeight,
          frameRate: hurt.frameRate,
        },
        death: {
          key: 'gaara-death',
          frameWidth: death.frameWidth,
          frameHeight: death.frameHeight,
          frameCount: death.frameCount,
          contentHeight: death.contentHeight,
          frameRate: death.frameRate,
        },
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
