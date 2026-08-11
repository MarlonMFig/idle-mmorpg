/**
 * Hyuga Neji — Hakkeshou Kaiten (yellow rotation dome, 20f).
 * Alpha-only PNG sequence. Body-lock while dome expands (sticky torso X +
 * feetY on strong body frames). contentH 48.
 *
 * Clean transparent: NO black key. Peak dome frames may fully cover black
 * hair (expected); residualGreen must stay 0.
 *
 * npm run neji:jutsu1
 * Input:  assets/naruto-source/nu/neji/jutsu/frame_*.png
 * Output: public/sprites/player/neji/kaiten.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  scaleFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  isChromaGreen,
  bbox,
  countOpaque,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'jutsu');
const WALK_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'neji', 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'neji');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'neji');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const PAD = 2;
const EXPECTED = 20;
/** Dome spin window (0-based) for body-lock drift QA. */
const DOME_LOCK_FROM = 3;
const DOME_LOCK_TO = 14;
const BODY_CX_VAR_MAX = 2.5;

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

function isYellowEnergy(r, g, b) {
  if (r >= 130 && g >= 85 && b <= 130 && r + g > b * 2) return true;
  if (r >= 160 && g >= 120 && b <= 100) return true;
  if (r >= 100 && g >= 60 && b <= 55 && r > b && g > b) return true;
  if (r >= 200 && g >= 180 && b >= 120 && r >= g - 10 && g > b) return true;
  return false;
}

function isSkin(r, g, b) {
  if (isYellowEnergy(r, g, b)) return false;
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  if (r >= 160 && g >= 100 && b >= 70 && r > g && g > b && r - b >= 30) return true;
  return false;
}

function isRobe(r, g, b) {
  if (isYellowEnergy(r, g, b)) return false;
  if (r >= 150 && g >= 110 && b >= 70 && r >= g - 10 && g >= b - 15 && r - b >= 15) return true;
  if (r >= 180 && g >= 150 && b >= 90 && r >= g && Math.abs(r - g) <= 50) return true;
  return false;
}

function isBodyPixel(r, g, b) {
  if (isYellowEnergy(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isSkin(r, g, b) || isRobe(r, g, b)) return true;
  if (Math.max(r, g, b) <= 20) return true;
  if (!isYellowEnergy(r, g, b) && Math.max(r, g, b) - Math.min(r, g, b) < 40) {
    if (Math.max(r, g, b) <= 100) return true;
  }
  return false;
}

function bodyAnchor(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let n = 0;
  let sumX = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
      n += 1;
      sumX += x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Mid-dome: no body pixels → fall back to full alpha (will sticky-replace).
  if (n < 40 || maxY - minY + 1 < 24) {
    minX = w;
    maxX = -1;
    minY = h;
    maxY = -1;
    n = 0;
    sumX = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        n += 1;
        sumX += x;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return {
      bodyCx: w / 2,
      feetY: h - 1,
      bodyH: h,
      mode: 'empty',
      n: 0,
    };
  }

  return {
    bodyCx: sumX / n,
    feetY: maxY,
    bodyH: maxY - minY + 1,
    mode: n >= 80 ? 'core' : 'weak',
    n,
  };
}

function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));
  const filled = anchors.map((a) => ({ ...a }));

  // Sticky bodyX/feetY through expanding dome using last/next strong body frames.
  let lastStrong = null;
  for (let i = 0; i < filled.length; i += 1) {
    if (filled[i].n >= 200 && filled[i].bodyH >= 60 && filled[i].mode === 'core') {
      lastStrong = { ...filled[i] };
    } else if (lastStrong && filled[i].n < 400) {
      filled[i] = {
        ...filled[i],
        bodyCx: lastStrong.bodyCx,
        feetY: lastStrong.feetY,
        bodyH: lastStrong.bodyH,
        sticky: true,
      };
    }
  }
  let nextStrong = null;
  for (let i = filled.length - 1; i >= 0; i -= 1) {
    if (
      filled[i].n >= 200 &&
      filled[i].bodyH >= 60 &&
      filled[i].mode === 'core' &&
      !filled[i].sticky
    ) {
      nextStrong = { ...filled[i] };
    } else if (filled[i].sticky === undefined && filled[i].n < 80 && nextStrong) {
      filled[i] = {
        ...filled[i],
        bodyCx: nextStrong.bodyCx,
        feetY: nextStrong.feetY,
        bodyH: nextStrong.bodyH,
        sticky: true,
      };
    }
  }

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

  const contentSrc =
    filled.find((a) => !a.sticky && a.n >= 200 && a.bodyH >= 60) || filled[0];
  const contentH = contentSrc.bodyH;

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
  };
}

function countPalette(sheetData) {
  let residualGreen = 0;
  let black = 0;
  let opaque = 0;
  let yellow = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    opaque += 1;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isChromaGreen(r, g, b)) residualGreen += 1;
    if (r <= 12 && g <= 12 && b <= 12) black += 1;
    if (isYellowEnergy(r, g, b)) yellow += 1;
  }
  return { residualGreen, black, opaque, yellow };
}

function measureLockedCenters(frames, fw, fh, anchors) {
  return frames.map((frame, fi) => {
    // Prefer body pixels; mid-dome uses sticky anchor metrics for QA only.
    let sumX = 0;
    let n = 0;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (y > maxY) maxY = y;
        if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
        sumX += x;
        n += 1;
      }
    }
    if (n < 40 && anchors[fi] && anchors[fi].sticky) {
      return {
        bodyCx: anchors[fi].bodyCx,
        feetY: anchors[fi].feetY,
        n: anchors[fi].n,
        sticky: true,
      };
    }
    return {
      bodyCx: n ? sumX / n : fw / 2,
      feetY: maxY,
      n,
      sticky: false,
    };
  });
}

function variance(vals) {
  if (!vals.length) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 };
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v = vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
  return { mean, variance: v, std: Math.sqrt(v), min: Math.min(...vals), max: Math.max(...vals) };
}

function resolveWalkScale() {
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['neji-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) {
        return { scale: w.scale, source: 'meta.json neji-walk' };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function measureWalkSourceScale() {
  const walkKeyed = await loadAlphaFrames(WALK_DIR, 6);
  const maxH = Math.max(...walkKeyed.map((k) => k.box.height));
  return {
    scale: TARGET_BODY_H / Math.max(1, maxH),
    source: 'walk source max contentH',
  };
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);
  console.log(`loaded ${keyed.length} alpha frames from ${path.relative(ROOT, INPUT_DIR)}`);

  let walkScaleInfo = resolveWalkScale();
  if (!walkScaleInfo) {
    walkScaleInfo = await measureWalkSourceScale();
  }
  console.log(
    `walk-matched absoluteScale=${walkScaleInfo.scale.toFixed(6)} (${walkScaleInfo.source})`,
  );

  const rawFrames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  for (let i = 0; i < keyed.length; i += 1) {
    const a = bodyAnchor(rawFrames[i], widths[i], heights[i]);
    console.log(
      `anchor ${keyed[i].file} mode=${a.mode} n=${a.n} bodyCx=${a.bodyCx.toFixed(1)} feetY=${a.feetY} bodyH=${a.bodyH}`,
    );
  }

  const norm = normalizeBodyLock(rawFrames, widths, heights, PAD);
  console.log(
    `body-lock pack fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight} destBodyCx=${norm.destBodyCx} destFeetY=${norm.destFeetY}`,
  );
  for (let i = 0; i < norm.anchors.length; i += 1) {
    const a = norm.anchors[i];
    if (a.sticky) {
      console.log(
        `  sticky f${i + 1} bodyCx=${a.bodyCx.toFixed(1)} feetY=${a.feetY} bodyH=${a.bodyH}`,
      );
    }
  }

  // Scale standing body to TARGET_BODY_H (dome grows relatively).
  // Prefer walk-matched density only if it doesn't crush the dome below readable.
  let scale = TARGET_BODY_H / Math.max(1, norm.contentHeight);
  const maxHCap = 130;
  if (norm.frameHeight * scale > maxHCap) {
    scale = maxHCap / norm.frameHeight;
  }
  // Snap to walk scale when body scale is close (keeps character density consistent)
  const walkScale = walkScaleInfo.scale;
  if (Math.abs(scale - walkScale) / walkScale < 0.15) {
    scale = walkScale;
  }
  console.log(`scale=${scale.toFixed(6)} (walk=${walkScale.toFixed(6)})`);

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    TARGET_BODY_H,
  );
  // Override if scaleFrames used bodyH→48 but we want the capped scale above.
  // scaleFrames always uses contentHeight→target; re-scale if needed.
  let finalFrames = scaled.frames;
  let finalFw = scaled.frameWidth;
  let finalFh = scaled.frameHeight;
  let finalContent = scaled.contentHeight;
  let finalScale = scaled.scale;

  if (Math.abs(scaled.scale - scale) > 0.001) {
    const outW = Math.max(1, Math.round(norm.frameWidth * scale));
    const outH = Math.max(1, Math.round(norm.frameHeight * scale));
    const out = [];
    for (const frame of norm.frames) {
      const { data } = await sharp(frame, {
        raw: { width: norm.frameWidth, height: norm.frameHeight, channels: 4 },
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
    finalFrames = out;
    finalFw = outW;
    finalFh = outH;
    finalContent = Math.max(1, Math.round(norm.contentHeight * scale));
    finalScale = scale;
  }

  const sheet = stitch(finalFrames, finalFw, finalFh);
  const pal = countPalette(sheet.data);

  // Map sticky anchors into scaled cell for QA.
  const scaledAnchors = norm.anchors.map((a) => ({
    ...a,
    bodyCx: a.bodyCx * finalScale + (finalFw - norm.frameWidth * finalScale) / 2,
    feetY: a.feetY * finalScale + (finalFh - norm.frameHeight * finalScale) / 2,
  }));
  const centers = measureLockedCenters(finalFrames, finalFw, finalFh, scaledAnchors);
  const lockFrom = Math.min(DOME_LOCK_FROM, centers.length - 1);
  const lockTo = Math.min(DOME_LOCK_TO, centers.length - 1);
  const lockSlice = centers.slice(lockFrom, lockTo + 1);
  // Sticky anchors report identical bodyCx — good. Use non-sticky+sticky dest.
  const cxVals = lockSlice.map((c) => c.bodyCx);
  const cxStats = variance(cxVals);
  const feetStats = variance(lockSlice.map((c) => c.feetY).filter((y) => y >= 0));

  console.log(
    `QA residualGreen=${pal.residualGreen} opaque=${pal.opaque} pureBlack=${pal.black} yellow=${pal.yellow}`,
  );
  console.log(
    `QA body-lock f${lockFrom + 1}–${lockTo + 1} bodyCx mean=${cxStats.mean.toFixed(2)} std=${cxStats.std.toFixed(3)} range=[${cxStats.min.toFixed(2)},${cxStats.max.toFixed(2)}]`,
  );
  console.log(
    `QA body-lock feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(3)} range=[${feetStats.min},${feetStats.max}]`,
  );

  // Per-frame opacity QA (dome frames must stay dense)
  for (let i = 0; i < finalFrames.length; i += 1) {
    const op = countOpaque(finalFrames[i]);
    if (op < 80) throw new Error(`Frame ${i} too empty after pack (op=${op})`);
  }

  if (pal.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${pal.residualGreen}`);
  }
  // Startup/recovery frames carry hair black; mid-dome may hide it.
  if (pal.black < 100) {
    throw new Error(`QA fail: pure black too low on whole sheet (${pal.black})`);
  }
  if (pal.yellow < 500) {
    throw new Error(`QA fail: yellow dome nearly gone (${pal.yellow})`);
  }
  if (cxStats.std > BODY_CX_VAR_MAX) {
    throw new Error(
      `QA fail body-lock: bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'kaiten.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames: finalFrames, frameWidth: finalFw, frameHeight: finalFh },
    QA_DIR,
    'kaiten',
    3,
  );

  // Remove obsolete dual-jutsu outputs if present.
  for (const obsolete of ['hakke-kusho.png', 'rokujuyon-sho.png']) {
    const p = path.join(OUT_DIR, obsolete);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`removed obsolete ${obsolete}`);
    }
  }

  const durationMs = Math.round((finalFrames.length / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(durationMs * 0.45);
  // Report body bar as 48 so display scale matches walk (CHARACTER_DISPLAY_HEIGHT / 48).
  const reportContentH = TARGET_BODY_H;

  const entry = {
    image: '/sprites/player/neji/kaiten.png',
    frameWidth: finalFw,
    frameHeight: finalFh,
    frameCount: finalFrames.length,
    contentHeight: reportContentH,
    scale: finalScale,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    source: 'assets/naruto-source/nu/neji/jutsu/frame_001..020.png',
    residualGreen: pal.residualGreen,
    pureBlack: pal.black,
    yellow: pal.yellow,
    bodyLock: {
      destBodyCx: norm.destBodyCx,
      destFeetY: norm.destFeetY,
      bodyCxStd: +cxStats.std.toFixed(3),
      domeLock: [lockFrom, lockTo],
    },
    note: 'Hakkeshou Kaiten 20f; alpha-only; body-lock sticky through expanding yellow dome',
  };
  updateMeta(META_JSON, 'neji-kaiten', entry);
  updateMeta(META_JSON, 'skill-hakke-kaiten', entry);

  // Drop obsolete meta entries
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      delete meta['neji-hakke-kusho'];
      delete meta['neji-rokujuyon-sho'];
      delete meta['skill-hakke-kusho'];
      delete meta['skill-rokujuyon-sho'];
      fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
    } catch {
      /* ignore */
    }
  }

  console.log(
    `-> kaiten.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      key: 'neji-kaiten',
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      durationMs,
      hitDelayMs,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
