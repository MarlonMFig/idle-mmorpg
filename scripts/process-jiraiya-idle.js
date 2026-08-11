/**
 * Jiraiya idle — alpha-only per-frame sequence (6f breath).
 * Clean transparent sources: NO black-key / green flood (white hair survives).
 * Body-lock (torso+feet) so hair sway does not deslizar.
 * absoluteScale matched to walk (walk max → 48); one nearest resize.
 *
 * npm run jiraiya:idle
 * Input:  assets/naruto-source/nu/jiraiya/idle/frame_*.png
 * Output: public/sprites/player/jiraiya/idle.png + preview
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
  bbox,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jiraiya', 'idle');
const WALK_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jiraiya', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'jiraiya');
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', 'jiraiya.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'jiraiya');
const TARGET_BODY_H = 48;
const FRAME_RATE = 8;
const EXPECTED = 6;
const PAD = 2;
const BODY_CX_VAR_MAX = 0.85;
const BODY_CX_RANGE_MAX = 1.5;

function isWhiteHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (avg >= 185 && mx - mn <= 36) return true;
  if (avg >= 160 && mx - mn <= 28 && Math.max(g - r, 0) < 12 && Math.max(g - b, 0) < 12) {
    return true;
  }
  if (r >= 200 && g >= 195 && b >= 185 && mx - mn <= 40) return true;
  if (avg >= 145 && mx - mn <= 30 && Math.max(g - r, 0) < 14 && Math.max(g - b, 0) < 14) {
    return true;
  }
  return false;
}

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

function isRedHaori(r, g, b) {
  if (r >= 90 && r > g + 25 && r > b + 20 && g <= 110) return true;
  if (r >= 120 && g <= 80 && b <= 80 && r > g + 30) return true;
  if (r >= 140 && g >= 20 && g <= 90 && b <= 70 && r > g + 25) return true;
  return false;
}

function isYellowEmblem(r, g, b) {
  if (r >= 160 && g >= 120 && b <= 90 && r >= g - 10 && g > b + 20) return true;
  if (r >= 180 && g >= 150 && b <= 100 && g > b + 30) return true;
  return false;
}

function isSkin(r, g, b) {
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  if (r >= 160 && g >= 100 && b >= 70 && r > g && g > b && r - b >= 30) return true;
  if (r >= 140 && g >= 95 && b >= 70 && r >= g && g >= b - 5 && r - b >= 25) return true;
  return false;
}

function isGreyMesh(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn <= 22 && mx >= 35 && mx <= 175 && (r + g + b) / 3 <= 160) return true;
  return false;
}

function isBodyPixel(r, g, b) {
  if (isWhiteHair(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isRedHaori(r, g, b) || isYellowEmblem(r, g, b) || isSkin(r, g, b) || isGreyMesh(r, g, b)) {
    return true;
  }
  if (Math.max(r, g, b) <= 22) return true;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 35 && Math.max(r, g, b) <= 95) return true;
  return false;
}

function bodyAnchor(frame, w, h) {
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) {
    return { bodyCx: w / 2, feetY: h - 1, bodyH: h, mode: 'empty', n: 0 };
  }

  const contentH = maxY - minY + 1;
  const bandTop = minY + Math.floor(contentH * 0.28);
  const bandBot = minY + Math.floor(contentH * 0.72);

  function massIn(predicate, yLo, yHi) {
    let sumX = 0;
    let n = 0;
    for (let y = yLo; y <= yHi; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!predicate(frame[i], frame[i + 1], frame[i + 2])) continue;
        n += 1;
        sumX += x;
      }
    }
    return { sumX, n };
  }

  let mode = 'torsoBand';
  let m = massIn(isBodyPixel, bandTop, bandBot);
  if (m.n < 80) {
    mode = 'body';
    m = massIn(isBodyPixel, minY, maxY);
  }
  if (m.n < 40) {
    mode = 'fullNoHair';
    m = massIn((r, g, b) => !isWhiteHair(r, g, b), minY, maxY);
  }
  if (m.n < 20) {
    mode = 'full';
    m = massIn(() => true, minY, maxY);
  }

  return {
    bodyCx: m.n ? m.sumX / m.n : w / 2,
    feetY: maxY,
    bodyH: contentH,
    mode,
    n: m.n,
  };
}

function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));

  let maxLeft = 0;
  let maxRight = 0;
  let maxUp = 0;
  let maxDown = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const a = anchors[i];
    const w = widths[i];
    const h = heights[i];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frames[i][(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        maxLeft = Math.max(maxLeft, a.bodyCx - x);
        maxRight = Math.max(maxRight, x - a.bodyCx);
        maxUp = Math.max(maxUp, a.feetY - y);
        maxDown = Math.max(maxDown, y - a.feetY);
      }
    }
  }

  const fw = Math.ceil(maxLeft + maxRight + 1) + pad * 2;
  const fh = Math.ceil(maxUp + maxDown + 1) + pad * 2;
  const destBodyCx = pad + Math.ceil(maxLeft);
  const destFeetY = pad + Math.ceil(maxUp);
  const contentH = Math.max(...anchors.map((a) => a.bodyH));

  const out = frames.map((frame, index) => {
    const a = anchors[index];
    const srcW = widths[index];
    const srcH = heights[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = Math.round(destBodyCx - a.bodyCx);
    const dy = Math.round(destFeetY - a.feetY);
    for (let y = 0; y < srcH; y += 1) {
      for (let x = 0; x < srcW; x += 1) {
        const si = (y * srcW + x) * 4;
        if (frame[si + 3] < ALPHA_KEEP) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= fw || ty >= fh) continue;
        const di = (ty * fw + tx) * 4;
        canvas[di] = frame[si];
        canvas[di + 1] = frame[si + 1];
        canvas[di + 2] = frame[si + 2];
        canvas[di + 3] = 255;
      }
    }
    return canvas;
  });

  return {
    frames: out,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: contentH,
    anchors,
    destBodyCx,
    destFeetY,
  };
}

async function scaleLockedCells(frames, fw, fh, absoluteScale) {
  const outW = Math.max(1, Math.round(fw * absoluteScale));
  const outH = Math.max(1, Math.round(fh * absoluteScale));
  const out = [];
  for (const frame of frames) {
    const { data } = await sharp(frame, {
      raw: { width: fw, height: fh, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

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
    contentHeight: TARGET_BODY_H,
    scale: absoluteScale,
  };
}

function measureBodyCenters(frames, fw, fh) {
  return frames.map((frame) => {
    const box = bbox(frame, fw, fh);
    const bandTop = box.minY + Math.floor(box.height * 0.28);
    const bandBot = box.minY + Math.floor(box.height * 0.72);
    let sumX = 0;
    let n = 0;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (y > maxY) maxY = y;
        if (y < bandTop || y > bandBot) continue;
        if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
        sumX += x;
        n += 1;
      }
    }
    return { bodyCx: n ? sumX / n : fw / 2, feetY: maxY, n };
  });
}

function variance(vals) {
  if (!vals.length) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 };
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
  return { mean, variance: v, std: Math.sqrt(v), min: Math.min(...vals), max: Math.max(...vals) };
}

function countWhiteHair(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isWhiteHair(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

function resolveWalkScale() {
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['jiraiya-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) {
        return {
          scale: w.scale,
          source: 'meta.json jiraiya-walk',
          walkMaxContentH: w.maxContentH ?? null,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function measureWalkSourceScale() {
  const walkKeyed = await loadAlphaFrames(WALK_DIR, 6);
  const heights = walkKeyed.map((k) => k.box.height);
  const maxH = Math.max(...heights);
  return {
    scale: TARGET_BODY_H / Math.max(1, maxH),
    source: 'walk source max contentH',
    walkMaxContentH: maxH,
  };
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  const beforeH = keyed.map((k) => k.box.height);
  console.log(
    `BEFORE contentH per frame: ${beforeH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...beforeH)} max=${Math.max(...beforeH)} Δ=${Math.max(...beforeH) - Math.min(...beforeH)})`,
  );

  let walkScaleInfo = resolveWalkScale();
  if (!walkScaleInfo) {
    walkScaleInfo = await measureWalkSourceScale();
  }
  const absoluteScale = walkScaleInfo.scale;
  console.log(
    `walk-matched absoluteScale=${absoluteScale.toFixed(6)} (${walkScaleInfo.source}` +
      (walkScaleInfo.walkMaxContentH != null
        ? `, walkMaxContentH≈${walkScaleInfo.walkMaxContentH}`
        : '') +
      `)`,
  );

  const rawFrames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  for (let i = 0; i < keyed.length; i += 1) {
    const a = bodyAnchor(rawFrames[i], widths[i], heights[i]);
    console.log(
      `anchor ${keyed[i].file} mode=${a.mode} n=${a.n} bodyCx=${a.bodyCx.toFixed(2)} feetY=${a.feetY} bodyH=${a.bodyH}`,
    );
  }

  const norm = normalizeBodyLock(rawFrames, widths, heights, PAD);
  console.log(
    `body-lock pack fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight} ` +
      `destBodyCx=${norm.destBodyCx} destFeetY=${norm.destFeetY}`,
  );

  const scaled = await scaleLockedCells(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    absoluteScale,
  );

  const afterH = scaled.frames.map((f) => bbox(f, scaled.frameWidth, scaled.frameHeight).height);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 6,
      minBlackPerFrame: 40,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 100,
    },
  );
  const whiteHair = countWhiteHair(sheet.data);
  const centers = measureBodyCenters(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const cxStats = variance(centers.map((c) => c.bodyCx));
  const feetStats = variance(centers.map((c) => c.feetY).filter((y) => y >= 0));

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} whiteHair=${whiteHair} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA body-lock bodyCx mean=${cxStats.mean.toFixed(2)} std=${cxStats.std.toFixed(3)} ` +
      `range=[${cxStats.min.toFixed(2)},${cxStats.max.toFixed(2)}] Δ=${(cxStats.max - cxStats.min).toFixed(2)}`,
  );
  console.log(
    `QA feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(3)} ` +
      `range=[${feetStats.min},${feetStats.max}] Δ=${feetStats.max - feetStats.min}`,
  );
  console.log(
    `AFTER contentH per frame: ${afterH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(Δ=${Math.max(...afterH) - Math.min(...afterH)})`,
  );
  centers.forEach((c, i) => {
    console.log(`  f${i} bodyCx=${c.bodyCx.toFixed(2)} feetY=${c.feetY} bodyN=${c.n}`);
  });

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (whiteHair < 40) {
    throw new Error(`QA fail: white hair nearly gone (${whiteHair})`);
  }
  if (qa.pureBlack < 120) {
    throw new Error(`QA fail: pure black outline nearly gone (${qa.pureBlack})`);
  }
  if (cxStats.std > BODY_CX_VAR_MAX) {
    throw new Error(
      `QA fail body-lock: bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px`,
    );
  }
  if (cxStats.max - cxStats.min > BODY_CX_RANGE_MAX) {
    throw new Error(
      `QA fail body-lock: bodyCx range Δ=${(cxStats.max - cxStats.min).toFixed(2)}px > ${BODY_CX_RANGE_MAX}px`,
    );
  }
  if (feetStats.max - feetStats.min > 1) {
    throw new Error(
      `QA fail body-lock: feetY Δ=${feetStats.max - feetStats.min}px (need ≤ 1)`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'idle.png'), sheet.data, sheet.width, sheet.height);

  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
  await writePng(PREVIEW, scaled.frames[0], scaled.frameWidth, scaled.frameHeight);

  await writeFrameCrops(sheet, scaled, QA_DIR, 'idle', 4);

  const entry = {
    image: '/sprites/player/jiraiya/idle.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: absoluteScale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/jiraiya/idle/frame_001..006.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    whiteHair,
    walkMatchedScale: absoluteScale,
    contentHeights: afterH,
    bodyLock: {
      destBodyCx: norm.destBodyCx,
      destFeetY: norm.destFeetY,
      bodyCxStd: +cxStats.std.toFixed(3),
      bodyCxRange: +(cxStats.max - cxStats.min).toFixed(3),
      feetYDelta: feetStats.max - feetStats.min,
    },
    note: '6-frame idle; alpha-only; body-lock torso+feet; nearest scale matched walk; white hair preserved',
  };
  updateMeta(META_JSON, 'jiraiya-idle', entry);

  console.log(
    `-> idle.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(6)} kernel=nearest`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      scale: entry.scale,
    }),
  );
  console.log(
    'METRICS:',
    JSON.stringify({
      packId: 'jiraiya',
      lookType: 9009,
      sheet: `${sheet.width}x${sheet.height}`,
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      scale: entry.scale,
      scaleMethod: 'nearest-walk-matched',
      residualGreen: qa.residualGreen,
      whiteHair,
      bodyCxStd: entry.bodyLock.bodyCxStd,
      bodyCxRange: entry.bodyLock.bodyCxRange,
      feetYDelta: entry.bodyLock.feetYDelta,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
