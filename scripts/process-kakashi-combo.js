/**
 * Kakashi combo attack — transparent HQ frames (13f → 5+4+4).
 * Alpha-only when already transparent; exterior chroma-green keyed only if present.
 * NO forced nearest pixelation — soft HQ downscale (lanczos3).
 * Body-lock (torso+feet, fire/slash FX excluded from feet/body mass).
 *
 * Scale policy:
 * Prefer walk absoluteScale when projected standing body lands within ~2px of 48;
 * else body-match lanczos3 → TARGET_BODY_H (one soft pass, silver hair preserved).
 * contentHeight packed = 48 so walk baseScale matches on-screen size.
 *
 * npm run kakashi:combo
 * Input:  assets/naruto-source/nu/kakashi/combo/frame_*.png
 * Output: public/sprites/player/kakashi/{combo1,combo2,combo3,attack}.png
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kakashi', 'combo');
const WALK_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kakashi', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kakashi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'kakashi');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const EXPECTED = 13;
const PAD = 2;
const BODY_CX_VAR_MAX = 1.35;
const BODY_CX_RANGE_MAX = 2.5;

/** Three multi-hit beats: hit1 | hit2 | finisher (5+4+4). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first strike' },
  { name: 'combo2', from: 5, to: 9, note: 'second strike' },
  { name: 'combo3', from: 9, to: 13, note: 'finisher / recovery' },
];

function isSilverHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (mx >= 18 && mx <= 175 && mx - mn <= 32 && b >= g - 10 && b >= r - 6) return true;
  if (r >= 35 && r <= 145 && g >= 35 && g <= 150 && b >= 45 && b <= 170 && Math.abs(r - g) <= 22) {
    return true;
  }
  if (avg >= 145 && mx - mn <= 30 && Math.max(g - r, 0) < 14 && Math.max(g - b, 0) < 14) {
    return true;
  }
  return false;
}

function isFireTrail(r, g, b) {
  if (r >= 200 && g >= 140 && b <= 110 && r >= b + 40) return true;
  if (r >= 180 && g >= 90 && b <= 100 && r > g && g >= b - 10 && r >= b + 50) return true;
  if (r >= 220 && g >= 180 && b <= 120 && r >= g - 5) return true;
  if (r >= 160 && g >= 60 && g <= 170 && b <= 95 && r >= g && g >= b && r - b >= 40) return true;
  if (r >= 140 && g >= 100 && b <= 70 && r >= g - 10 && g > b + 25) return true;
  return false;
}

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isOliveVest(r, g, b) {
  if (isChromaGreen(r, g, b)) return false;
  if (
    g >= 45 &&
    g <= 145 &&
    r >= 30 &&
    r <= 120 &&
    b >= 15 &&
    b <= 95 &&
    g >= r - 8 &&
    g >= b + 4 &&
    greenness(r, g, b) < 40
  ) {
    return true;
  }
  if (g >= 50 && g <= 120 && r >= 40 && r <= 100 && b >= 25 && b <= 80 && Math.abs(r - g) <= 25 && g >= b) {
    return true;
  }
  return false;
}

function isBlueMask(r, g, b) {
  if (b >= 35 && b <= 120 && b >= r + 5 && b >= g - 5 && Math.max(r, g, b) <= 130) return true;
  if (b >= 28 && b <= 90 && r <= 70 && g <= 75 && b >= r && b >= g - 8) return true;
  return false;
}

function isSkin(r, g, b) {
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  if (r >= 160 && g >= 100 && b >= 70 && r > g && g > b && r - b >= 30) return true;
  if (r >= 140 && g >= 95 && b >= 70 && r >= g && g >= b - 5 && r - b >= 25) return true;
  return false;
}

function isMetalGrey(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn <= 18 && mx >= 70 && mx <= 190;
}

function isBodyPixel(r, g, b) {
  if (isSilverHair(r, g, b) || isFireTrail(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isOliveVest(r, g, b) || isBlueMask(r, g, b) || isSkin(r, g, b) || isMetalGrey(r, g, b)) {
    return true;
  }
  if (Math.max(r, g, b) <= 22) return true;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 35 && Math.max(r, g, b) <= 95) return true;
  return false;
}

function bodyAnchor(frame, w, h) {
  let minY = h;
  let maxY = -1;
  let feetBodyY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (!isFireTrail(r, g, b) && y > feetBodyY) feetBodyY = y;
    }
  }
  if (maxY < 0) {
    return { bodyCx: w / 2, feetY: h - 1, bodyH: h, mode: 'empty', n: 0 };
  }
  if (feetBodyY < 0) feetBodyY = maxY;

  const contentH = feetBodyY - minY + 1;
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
  if (m.n < 60) {
    mode = 'body';
    m = massIn(isBodyPixel, minY, feetBodyY);
  }
  if (m.n < 30) {
    mode = 'fullNoHairFire';
    m = massIn((r, g, b) => !isSilverHair(r, g, b) && !isFireTrail(r, g, b), minY, feetBodyY);
  }
  if (m.n < 15) {
    mode = 'full';
    m = massIn(() => true, minY, maxY);
  }

  return {
    bodyCx: m.n ? m.sumX / m.n : w / 2,
    feetY: feetBodyY,
    bodyH: contentH,
    mode,
    n: m.n,
  };
}

function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));

  // Mid-combo poses lean into swings; lock CX to median of prep/standing so the
  // body does not deslizar while arms/FX expand around feet.
  const standN = Math.min(5, anchors.length);
  const cxs = anchors.slice(0, standN).map((a) => a.bodyCx).sort((a, b) => a - b);
  const mid = Math.floor(cxs.length / 2);
  const lockBodyCx =
    cxs.length % 2 ? cxs[mid] : (cxs[mid - 1] + cxs[mid]) / 2;
  const filled = anchors.map((a) => ({
    ...a,
    bodyCx: lockBodyCx,
  }));

  let maxLeft = 0;
  let maxRight = 0;
  let maxUp = 0;
  let maxDown = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const a = filled[i];
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
  const contentH = Math.round(
    anchors.slice(0, standN).reduce((s, a) => s + a.bodyH, 0) / standN,
  );

  const out = frames.map((frame, index) => {
    const a = filled[index];
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
    anchors: filled,
    destBodyCx,
    destFeetY,
    lockBodyCx,
  };
}

/** Soft HQ downscale (lanczos3). Never nearest — keeps test-art smoothness. */
async function scaleLockedCells(frames, fw, fh, absoluteScale) {
  const skipResize = Math.abs(absoluteScale - 1) < 1e-6;
  const outW = skipResize ? fw : Math.max(1, Math.round(fw * absoluteScale));
  const outH = skipResize ? fh : Math.max(1, Math.round(fh * absoluteScale));
  const out = [];
  for (const frame of frames) {
    let data;
    if (skipResize) {
      data = Buffer.from(frame);
    } else {
      const res = await sharp(frame, {
        raw: { width: fw, height: fh, channels: 4 },
      })
        .resize(outW, outH, { kernel: sharp.kernel.lanczos3 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      data = res.data;
    }

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
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (isFireTrail(frame[i], frame[i + 1], frame[i + 2])) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const contentH = maxY >= 0 ? maxY - minY + 1 : fh;
    const bandTop = minY + Math.floor(contentH * 0.28);
    const bandBot = minY + Math.floor(contentH * 0.72);
    let sumX = 0;
    let n = 0;
    for (let y = bandTop; y <= bandBot; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
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

function countSilverHair(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isSilverHair(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

function countFire(sheetData) {
  let n = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    if (isFireTrail(sheetData[i], sheetData[i + 1], sheetData[i + 2])) n += 1;
  }
  return n;
}

function resolveWalkScale() {
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['kakashi-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) {
        return {
          scale: w.scale,
          source: 'meta.json kakashi-walk',
          walkMaxContentH: w.maxContentH ?? null,
        };
      }
      const idle = meta['kakashi-idle'];
      if (idle && typeof idle.scale === 'number' && idle.scale > 0) {
        return { scale: idle.scale, source: 'meta.json kakashi-idle', walkMaxContentH: null };
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

/**
 * Prefer walk scale if standing body lands near 48; else body-match lanczos3.
 */
function resolveAbsoluteScale(standingContentH, walkScaleInfo) {
  const bodyMatch = TARGET_BODY_H / Math.max(1, standingContentH);
  if (walkScaleInfo) {
    const projected = standingContentH * walkScaleInfo.scale;
    if (Math.abs(projected - TARGET_BODY_H) <= 2) {
      return {
        scale: walkScaleInfo.scale,
        source: walkScaleInfo.source,
        projectedBodyH: projected,
        bodyMatch,
        kernel: 'lanczos3',
      };
    }
    console.log(
      `NOTE: walk scale ${walkScaleInfo.scale.toFixed(6)} → body≈${projected.toFixed(1)}px ` +
        `(need ~${TARGET_BODY_H}); using body-match lanczos3 ${bodyMatch.toFixed(6)}`,
    );
  }
  return {
    scale: bodyMatch,
    source: `body-match-lanczos3→${TARGET_BODY_H}`,
    projectedBodyH: standingContentH * bodyMatch,
    bodyMatch,
    walkScale: walkScaleInfo ? walkScaleInfo.scale : null,
    kernel: 'lanczos3',
  };
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  const beforeH = keyed.map((k) => k.box.height);
  console.log(
    `BEFORE contentH per frame: ${beforeH.map((h, i) => `f${i}=${h}`).join(' ')} ` +
      `(min=${Math.min(...beforeH)} max=${Math.max(...beforeH)} Δ=${Math.max(...beforeH) - Math.min(...beforeH)})`,
  );
  console.log(
    `phase split: ${SLICES.map((s) => `${s.name}=${s.to - s.from}f[${s.from}..${s.to})`).join(' + ')} ` +
      `(total ${keyed.length})`,
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
    `body-lock pack fw=${norm.frameWidth} fh=${norm.frameHeight} standingContentH=${norm.contentHeight} ` +
      `destBodyCx=${norm.destBodyCx} destFeetY=${norm.destFeetY}`,
  );

  let walkScaleInfo = resolveWalkScale();
  if (!walkScaleInfo) {
    walkScaleInfo = await measureWalkSourceScale();
  }
  const scaleInfo = resolveAbsoluteScale(norm.contentHeight, walkScaleInfo);
  console.log(
    `absoluteScale=${scaleInfo.scale.toFixed(6)} (${scaleInfo.source}` +
      (walkScaleInfo ? `, walkScale=${walkScaleInfo.scale.toFixed(6)}` : '') +
      `)`,
  );

  const scaled = await scaleLockedCells(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    scaleInfo.scale,
  );

  const afterH = scaled.frames.map((f) => bbox(f, scaled.frameWidth, scaled.frameHeight).height);
  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      // Kunai/slash motion trails leave a few satellite flecks after soft↓
      maxMinorComponent: 48,
      // Lanczos3 softens pure #000 into dark greys — no pixel-art black quota
      minBlackPerFrame: 0,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
    },
  );
  const silverHair = countSilverHair(fullSheet.data);
  const fire = countFire(fullSheet.data);
  const centers = measureBodyCenters(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const cxStats = variance(centers.map((c) => c.bodyCx));
  const feetStats = variance(centers.map((c) => c.feetY).filter((y) => y >= 0));

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} silverHair=${silverHair} fire=${fire} footSpread=${qa.footSpread}`,
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
      `(min=${Math.min(...afterH)} max=${Math.max(...afterH)})`,
  );
  centers.forEach((c, i) => {
    console.log(`  f${i} bodyCx=${c.bodyCx.toFixed(2)} feetY=${c.feetY} bodyN=${c.n}`);
  });

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green pixels = ${qa.residualGreen}`);
  }
  if (silverHair < 30) {
    throw new Error(`QA fail: silver hair nearly gone (${silverHair})`);
  }
  if (feetStats.max - feetStats.min > 2) {
    throw new Error(
      `QA fail body-lock: feetY Δ=${feetStats.max - feetStats.min}px (need ≤ 2)`,
    );
  }
  if (cxStats.std > BODY_CX_VAR_MAX) {
    console.warn(
      `WARN body-lock: bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px (attacks may shift)`,
    );
  }
  if (cxStats.max - cxStats.min > BODY_CX_RANGE_MAX) {
    console.warn(
      `WARN body-lock: bodyCx range Δ=${(cxStats.max - cxStats.min).toFixed(2)}px > ${BODY_CX_RANGE_MAX}px`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'attack.png'), fullSheet.data, fullSheet.width, fullSheet.height);
  await writeFrameCrops(fullSheet, scaled, QA_DIR, 'combo', 3);

  const wire = {};
  for (const slice of SLICES) {
    const frames = scaled.frames.slice(slice.from, slice.to);
    const contentHeights = afterH.slice(slice.from, slice.to);
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const sliceQa = qaSheet(
      sheet.data,
      sheet.width,
      scaled.frameHeight,
      scaled.frameWidth,
      frames.length,
      {
        requireSingleComponent: true,
        maxMinorComponent: 48,
        minBlackPerFrame: 0,
        minOlivePerFrame: 0,
        minBluePerFrame: 0,
        minOpaquePerFrame: 80,
      },
    );
    if (sliceQa.residualGreen > 0) {
      throw new Error(`${slice.name} residual green = ${sliceQa.residualGreen}`);
    }
    await writePng(path.join(OUT_DIR, `${slice.name}.png`), sheet.data, sheet.width, sheet.height);
    const entry = {
      image: `/sprites/player/kakashi/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/kakashi/combo/frame_001..013.png',
      range: [slice.from, slice.to],
      residualGreen: sliceQa.residualGreen,
      pureBlack: sliceQa.pureBlack,
      bodyHeightVariance: Math.max(...contentHeights) - Math.min(...contentHeights),
      contentHeights,
      note: `${slice.note} (${frames.length}f); alpha-only; body-lock; lanczos3→${TARGET_BODY_H} contentH=${scaled.contentHeight}`,
    };
    updateMeta(META_JSON, `kakashi-${slice.name}`, entry);
    wire[slice.name] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(
      `-> ${slice.name}.png ${sheet.width}x${sheet.height} n=${entry.frameCount} residualGreen=${sliceQa.residualGreen}`,
    );
  }

  updateMeta(META_JSON, 'kakashi-attack', {
    image: '/sprites/player/kakashi/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/kakashi/combo/frame_001..013.png',
    residualGreen: qa.residualGreen,
    silverHair,
    fire,
    pureBlack: qa.pureBlack,
    walkMatchedScale: walkScaleInfo ? walkScaleInfo.scale : null,
    absoluteScaleSource: scaleInfo.source,
    contentHeights: afterH,
    phaseSplit: SLICES.map((s) => s.to - s.from),
    bodyLock: {
      destBodyCx: norm.destBodyCx,
      destFeetY: norm.destFeetY,
      bodyCxStd: +cxStats.std.toFixed(3),
      bodyCxRange: +(cxStats.max - cxStats.min).toFixed(3),
      feetYDelta: feetStats.max - feetStats.min,
    },
    note:
      `full combo strip (${scaled.frames.length}f); split ${SLICES.map((s) => s.to - s.from).join('+')}; ` +
      `alpha-only; body-lock; lanczos3 scale=${scaled.scale.toFixed(4)} contentH=${scaled.contentHeight}`,
  });

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${scaled.frameWidth} fh=${scaled.frameHeight} ` +
      `n=${scaled.frames.length} contentH=${scaled.contentHeight} scale=${scaled.scale.toFixed(6)} kernel=lanczos3`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
  console.log(
    'METRICS:',
    JSON.stringify({
      packId: 'kakashi',
      lookType: 9008,
      sheet: `${fullSheet.width}x${fullSheet.height}`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: scaled.frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      scaleMethod: Math.abs(scaled.scale - 1) < 1e-6 ? '1:1-noscale' : 'lanczos3-body-match',
      residualGreen: qa.residualGreen,
      silverHair,
      fire,
      footSpread: qa.footSpread,
      bodyCxStd: +cxStats.std.toFixed(3),
      bodyCxRange: +(cxStats.max - cxStats.min).toFixed(3),
      feetYDelta: feetStats.max - feetStats.min,
      phaseSplit: SLICES.map((s) => s.to - s.from),
      absoluteScaleSource: scaleInfo.source,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
