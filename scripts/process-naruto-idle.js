/**
 * Naruto classic Part 1 idle — 6 frames, exterior pure-black key only.
 *
 * Sources already have corner alpha but residual opaque canvas black.
 * Outline / pupils / whiskers are pure black and must NOT be flood-keyed
 * when adjacent to body colour (same lesson as Sasuke / Hinata: never
 * global black key; never strip dark blue headband/collar/sandals).
 *
 * npm run naruto:idle
 * Input:  assets/naruto-source/nu/naruto/idle/frame_001..006.png
 * Output: public/sprites/player/naruto/idle.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { fillInteriorHoles } = require('./lib/chroma-green-bg');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'naruto', 'idle');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'naruto');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'naruto.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'naruto');
const TARGET_BODY_H = 48;
const FRAME_RATE = 8;
const EXPECTED = 6;
const EDGE_PEEL_PASSES = 1;

/** Pure canvas black / outline stroke (NOT dark blue garments). */
function isPureBlack(r, g, b) {
  return r <= 12 && g <= 12 && b <= 12;
}

/** Residual chroma green (sources should have none). */
function isChromaGreen(r, g, b) {
  const gn = g - Math.max(r, b);
  if (g >= 28 && gn >= 12 && r <= 100 && b <= 95) return true;
  if (g >= 50 && g >= r + 28 && g >= b + 28 && r <= 110 && b <= 105) return true;
  return false;
}

function isBodyColor(r, g, b) {
  if (isPureBlack(r, g, b)) return false;
  if (isChromaGreen(r, g, b)) return false;
  return true;
}

/**
 * Free exterior black: pure black with no body-color 8-neighbor.
 * Protects black outline painted against orange/blue/skin.
 */
function isFreeBackgroundBlack(data, w, h, x, y) {
  const si = (y * w + x) * 4;
  if (data[si + 3] < 12) return false;
  if (!isPureBlack(data[si], data[si + 1], data[si + 2])) return false;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = (ny * w + nx) * 4;
      if (data[ni + 3] < 12) continue;
      if (isBodyColor(data[ni], data[ni + 1], data[ni + 2])) return false;
    }
  }
  return true;
}

function isFloodKey(data, w, h, x, y) {
  const si = (y * w + x) * 4;
  const a = data[si + 3];
  if (a < 12) return true;
  if (isChromaGreen(data[si], data[si + 1], data[si + 2])) return true;
  return isFreeBackgroundBlack(data, w, h, x, y);
}

function floodKeyMask(data, w, h) {
  const n = w * h;
  const marked = new Uint8Array(n);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (marked[i]) return;
    if (!isFloodKey(data, w, h, x, y)) return;
    marked[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return marked;
}

/** Drop solitary exterior pure-black fringe with no body core. */
function peelFringe(frame, w, h, passes) {
  let cur = frame;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = Buffer.from(cur);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (cur[i + 3] < 16) continue;
        const r = cur[i];
        const g = cur[i + 1];
        const b = cur[i + 2];
        if (isChromaGreen(r, g, b)) {
          next[i + 3] = 0;
          continue;
        }
        if (!isPureBlack(r, g, b)) continue;
        let emptyN = 0;
        let bodyN = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              emptyN += 1;
              continue;
            }
            const ni = (ny * w + nx) * 4;
            if (cur[ni + 3] < 16) emptyN += 1;
            else if (isBodyColor(cur[ni], cur[ni + 1], cur[ni + 2])) bodyN += 1;
          }
        }
        if (emptyN >= 3 && bodyN <= 1) next[i + 3] = 0;
      }
    }
    cur = next;
  }
  return cur;
}

function keepLargestComponent(frame, w, h) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const components = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let start = 0; start < n; start += 1) {
    if (seen[start] || frame[start * 4 + 3] < 16) continue;
    const stack = [start];
    const component = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      component.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < 16) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    components.push(component);
  }
  if (!components.length) return frame;
  components.sort((a, b) => b.length - a.length);
  const keep = components[0];
  // Keep secondary flecks only if large (e.g. detached pouch edge) — thresh high
  const minKeep = Math.max(40, Math.floor(keep.length * 0.02));
  const out = Buffer.alloc(n * 4);
  for (const component of components) {
    if (component !== keep && component.length < minKeep) continue;
    for (const i of component) {
      const si = i * 4;
      out[si] = frame[si];
      out[si + 1] = frame[si + 1];
      out[si + 2] = frame[si + 2];
      out[si + 3] = frame[si + 3];
    }
  }
  return out;
}

function keyFrame(data, w, h) {
  const marked = floodKeyMask(data, w, h);
  const n = w * h;
  let out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i += 1) {
    const si = i * 4;
    const r = data[si];
    const g = data[si + 1];
    const b = data[si + 2];
    if (marked[i] || isChromaGreen(r, g, b)) {
      out[si + 3] = 0;
      continue;
    }
    if (data[si + 3] < 12) {
      out[si + 3] = 0;
      continue;
    }
    out[si] = r;
    out[si + 1] = g;
    out[si + 2] = b;
    out[si + 3] = 255;
  }
  fillInteriorHoles(out, w, h, Math.max(8, Math.floor(w * h * 0.002)));
  out = peelFringe(out, w, h, EDGE_PEEL_PASSES);
  out = keepLargestComponent(out, w, h);
  return out;
}

function bbox(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < 16) continue;
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

    // Hard alpha threshold after nearest scale
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i + 3] = 255;
      }
    }
    // Drop residual green fringe only (unlikely)
    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        const i = (y * outW + x) * 4;
        if (data[i + 3] < 16) continue;
        if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
          data[i + 3] = 0;
        }
      }
    }
    fillInteriorHoles(data, outW, outH, Math.max(4, Math.floor(outW * outH * 0.02)));
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

function qaMetrics(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let residualExteriorBlack = 0;
  let opaque = 0;
  let pureBlackOutline = 0;
  let headInteriorHoles = 0;
  let darkBlue = 0;
  let orange = 0;
  const footY = [];

  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let maxVrun = 0;
    let frameBlack = 0;
    let frameHeadHoles = 0;
    let frameOrange = 0;
    let frameBlue = 0;

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

    const headY1 = Math.max(8, Math.floor(fh * 0.38));
    for (let y = 0; y < headY1; y += 1) {
      for (let x = 1; x < fw - 1; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] >= 16) continue;
        let near = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= fw || ny >= headY1) continue;
            if (sheetData[(ny * sheetW + f * fw + nx) * 4 + 3] >= 16) near += 1;
          }
        }
        if (near >= 6) frameHeadHoles += 1;
      }
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
        if (isChromaGreen(r, g, b)) residualGreen += 1;
        if (isPureBlack(r, g, b)) {
          pureBlackOutline += 1;
          frameBlack += 1;
          // Exterior residual black: pure black on sheet edge with empty outer neighbor
          if (x === 0 || y === 0 || x === fw - 1 || y === fh - 1) {
            residualExteriorBlack += 1;
          }
        }
        // orange jumpsuit
        if (r >= 140 && g >= 40 && g <= 160 && b <= 90 && r > b + 40) {
          orange += 1;
          frameOrange += 1;
        }
        // dark blue headband / collar / sandals
        if (b >= r + 8 && b >= g + 8 && b >= 40 && b <= 160 && r <= 100) {
          darkBlue += 1;
          frameBlue += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }

    footY.push(maxFoot);
    headInteriorHoles += frameHeadHoles;
    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (maxVrun >= 5) throw new Error(`Frame ${f} vertical gash run=${maxVrun}`);
    if (frameBlack < 8) {
      throw new Error(`Frame ${f} pure black outline too low (${frameBlack}px)`);
    }
    if (frameHeadHoles > 4) {
      throw new Error(`Frame ${f} head interior holes=${frameHeadHoles}`);
    }
    if (frameOrange < 30) {
      throw new Error(`Frame ${f} orange jumpsuit nearly gone (${frameOrange}px)`);
    }
    if (frameBlue < 8) {
      throw new Error(`Frame ${f} dark blue garments missing (${frameBlue}px)`);
    }
  }

  const feet = footY.filter((y) => y >= 0);
  return {
    residualGreen,
    residualExteriorBlack,
    opaque,
    pureBlackOutline,
    headInteriorHoles,
    darkBlue,
    orange,
    footSpread: Math.max(...feet) - Math.min(...feet),
    footY,
  };
}

async function writeQa(sheet, scaled) {
  fs.mkdirSync(QA_DIR, { recursive: true });
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
    .toFile(path.join(QA_DIR, 'idle-magenta-bg.png'));

  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(QA_DIR, 'idle-full.png'));

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
      .toFile(path.join(QA_DIR, `idle-frame-${fi}-x4.png`));
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
    const frame = keyFrame(data, info.width, info.height);
    const box = bbox(frame, info.width, info.height);
    let opaque = 0;
    for (let i = 3; i < frame.length; i += 4) if (frame[i] >= 16) opaque += 1;
    if (opaque < 200 || box.width < 8 || box.height < 16) {
      throw new Error(`${file} empty after key (opaque=${opaque} box=${box.width}x${box.height})`);
    }
    console.log(
      `KEEP ${file} ${info.width}x${info.height} → content ${box.width}x${box.height} opaque=${opaque}`,
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
    `QA residualGreen=${qa.residualGreen} residualExteriorBlack=${qa.residualExteriorBlack} opaque=${qa.opaque} pureBlack=${qa.pureBlackOutline} headHoles=${qa.headInteriorHoles} darkBlue=${qa.darkBlue} orange=${qa.orange} footSpread=${qa.footSpread}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.headInteriorHoles > 6) {
    throw new Error(`QA fail: head interior holes = ${qa.headInteriorHoles}`);
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
  const outPath = path.join(OUT_DIR, 'idle.png');
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await sharp(scaled.frames[0], {
    raw: { width: scaled.frameWidth, height: scaled.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);

  await writeQa(sheet, scaled);

  const entry = {
    image: '/sprites/player/naruto/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/naruto/idle/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: qa.residualExteriorBlack,
    pureBlackOutline: qa.pureBlackOutline,
    headInteriorHoles: qa.headInteriorHoles,
    darkBlue: qa.darkBlue,
    orange: qa.orange,
    note: '6-frame classic Part 1 idle; exterior pure-black flood (outline-safe); no green key',
  };

  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta['naruto-idle'] = entry;
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'naruto-idle',
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
