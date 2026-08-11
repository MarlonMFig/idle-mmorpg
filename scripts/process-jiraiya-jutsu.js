/**
 * Jiraiya — Kuchiyose no Jutsu (Summoning: toad + oil flame collab).
 *
 * Alpha-only PNG sequence (clean transparent, 23f single cast strip).
 * Body-lock packing: seals → toad appear → expanding fire VFX while feet/body
 * stay fixed. hitDelay near flame peak (late sequence).
 *
 * npm run jiraiya:jutsu
 * Input:  assets/naruto-source/nu/jiraiya/jutsu/frame_*.png
 * Output: public/sprites/player/jiraiya/kuchiyose.png
 */
const fs = require('fs');
const path = require('path');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  scaleFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'jiraiya', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'jiraiya');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'jiraiya');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const PAD = 2;
/** Fire burst window (0-based; frames 18–23 of sequence expand hard). */
const BURST_LOCK_FROM = 16;
const BURST_LOCK_TO = 22;
const BODY_CX_VAR_MAX = 1.5;

function isFireTrail(r, g, b) {
  if (r >= 200 && g >= 140 && b <= 110 && r >= b + 40) return true;
  if (r >= 180 && g >= 90 && b <= 100 && r > g && g >= b - 10 && r >= b + 50) return true;
  if (r >= 220 && g >= 180 && b <= 120 && r >= g - 5) return true;
  if (r >= 160 && g >= 60 && g <= 170 && b <= 95 && r >= g && g >= b && r - b >= 40) return true;
  if (r >= 140 && g >= 100 && b <= 70 && r >= g - 10 && g > b + 25) return true;
  // yellow flame core
  if (r >= 200 && g >= 180 && b <= 80 && r >= b + 80) return true;
  return false;
}

function isToadOrange(r, g, b) {
  // Gamabunta / toad skin (not pure flame)
  if (r >= 140 && r <= 230 && g >= 70 && g <= 160 && b <= 90 && r > g && g >= b) {
    if (!isFireTrail(r, g, b) || (g >= 90 && b <= 70)) return true;
  }
  if (r >= 120 && r <= 200 && g >= 50 && g <= 120 && b <= 70 && r > g + 20 && g > b) return true;
  return false;
}

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

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
  return false;
}

function isRedHaori(r, g, b) {
  if (isFireTrail(r, g, b)) return false;
  if (r >= 90 && r > g + 25 && r > b + 20 && g <= 110) return true;
  if (r >= 120 && g <= 80 && b <= 80 && r > g + 30) return true;
  if (r >= 140 && g >= 20 && g <= 90 && b <= 70 && r > g + 25) return true;
  return false;
}

function isSkin(r, g, b) {
  if (isFireTrail(r, g, b) || isToadOrange(r, g, b)) return false;
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  if (r >= 160 && g >= 100 && b >= 70 && r > g && g > b && r - b >= 30) return true;
  return false;
}

function isGreyMesh(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn <= 22 && mx >= 35 && mx <= 175 && (r + g + b) / 3 <= 160) return true;
  return false;
}

/** Body pixel: character (+ toad chassis), excluding pure fire trail expansion. */
function isBodyPixel(r, g, b) {
  if (isFireTrail(r, g, b) && !isToadOrange(r, g, b) && !isRedHaori(r, g, b)) {
    // pure fire streaks shouldn't drag Cx
    if (r >= 200 && g >= 160 && b <= 100) return false;
  }
  if (isBlackInk(r, g, b)) return true;
  if (
    isWhiteHair(r, g, b) ||
    isRedHaori(r, g, b) ||
    isSkin(r, g, b) ||
    isGreyMesh(r, g, b) ||
    isToadOrange(r, g, b)
  ) {
    return true;
  }
  if (Math.max(r, g, b) <= 20) return true;
  if (!isFireTrail(r, g, b) && Math.max(r, g, b) - Math.min(r, g, b) < 40) {
    if (Math.max(r, g, b) <= 100) return true;
  }
  return false;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualGreen(r, g, b) {
  if (isFireTrail(r, g, b) || isToadOrange(r, g, b) || isWhiteHair(r, g, b)) return false;
  const gn = greenness(r, g, b);
  if (gn < 14) return false;
  if (g >= 50 && gn >= 18 && r <= 95 && b <= 95) return true;
  if (g >= 70 && g >= r + 22 && g >= b + 22 && r <= 110 && b <= 100) return true;
  if (isChromaGreen(r, g, b)) return true;
  return false;
}

/**
 * Body/feet anchor for lock packing.
 * Prefer black outline island; else body mask; else full content.
 */
function bodyAnchor(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let feetBodyY = -1;

  // Prefer non-fire body mass for feet Y
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (isFireTrail(r, g, b) && !isToadOrange(r, g, b) && !isRedHaori(r, g, b) && !isBlackInk(r, g, b)) {
        continue;
      }
      if (y > feetBodyY) feetBodyY = y;
    }
  }

  // Pass 1: black outline
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (!isBlackInk(frame[i], frame[i + 1], frame[i + 2])) continue;
      n += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Pass 2: body core if black sparse
  if (n < 80 || maxY - minY + 1 < 40) {
    minX = w;
    maxX = -1;
    minY = h;
    maxY = -1;
    n = 0;
    sumX = 0;
    sumY = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
        n += 1;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Pass 3: fire-dominated — full opaque bbox
  if (n < 40 || maxY - minY + 1 < 24) {
    minX = w;
    maxX = -1;
    minY = h;
    maxY = -1;
    n = 0;
    sumX = 0;
    sumY = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        n += 1;
        sumX += x;
        sumY += y;
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
      bodyMinX: 0,
      bodyMaxX: w - 1,
      bodyMinY: 0,
      bodyMaxY: h - 1,
      bodyH: h,
      mode: 'empty',
      n: 0,
    };
  }

  const feetY = feetBodyY >= 0 ? feetBodyY : maxY;

  return {
    bodyCx: sumX / n,
    feetY,
    bodyMinX: minX,
    bodyMaxX: maxX,
    bodyMinY: minY,
    bodyMaxY: maxY,
    bodyH: feetY - minY + 1,
    mode: 'core',
    n,
  };
}

function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));

  const filled = anchors.map((a) => ({ ...a }));
  let lastStrong = null;
  for (let i = 0; i < filled.length; i += 1) {
    if (filled[i].n >= 150 && filled[i].bodyH >= 50) {
      lastStrong = filled[i];
    } else if (lastStrong) {
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
    if (filled[i].n >= 150 && filled[i].bodyH >= 50 && !filled[i].sticky) {
      nextStrong = filled[i];
    } else if (filled[i].n < 40 && nextStrong) {
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

  // Standing body: first seal frame before crouch (f0 height ~169; crouch ~116)
  const contentSrc =
    filled.find((a, i) => i === 0 && a.n >= 80) ||
    filled.find((a) => !a.sticky && a.n >= 150 && a.bodyH >= 50) ||
    filled[0];
  // Prefer Jiraiya standing-ish height — use max of early non-toad frames for body scale.
  // Frames 0-5 are seals alone; use frame 0 bodyH as content.
  const contentH = filled[0].bodyH || contentSrc.bodyH;

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

function scrubFrame(frame, fw, fh) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (isResidualGreen(r, g, b) && !isFireTrail(r, g, b) && r <= 95 && b <= 95) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(r, g, b)) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const i = (y * fw + x) * 4;
      if (d[i + 3] < ALPHA_KEEP) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isFireTrail(r, g, b) || isToadOrange(r, g, b) || isWhiteHair(r, g, b)) continue;
      if (!isResidualGreen(r, g, b) && !(greenness(r, g, b) >= 10 && g > Math.max(r, b) + 6)) {
        continue;
      }
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) {
          edge = true;
          break;
        }
        if (d[(ny * fw + nx) * 4 + 3] < ALPHA_KEEP) {
          edge = true;
          break;
        }
      }
      if (edge && isResidualGreen(r, g, b) && r <= 90 && b <= 90 && greenness(r, g, b) >= 22) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
      } else if (g > Math.max(r, b) + 6 && !isToadOrange(r, g, b)) {
        d[i + 1] = Math.max(r, b);
      }
    }
  }
  return d;
}

function countPalette(sheetData) {
  let residualGreen = 0;
  let fire = 0;
  let white = 0;
  let toad = 0;
  let black = 0;
  let opaque = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    opaque += 1;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isResidualGreen(r, g, b) || isChromaGreen(r, g, b)) residualGreen += 1;
    if (isFireTrail(r, g, b)) fire += 1;
    if (isWhiteHair(r, g, b)) white += 1;
    if (isToadOrange(r, g, b)) toad += 1;
    if (r <= 12 && g <= 12 && b <= 12) black += 1;
  }
  return { residualGreen, fire, white, toad, black, opaque };
}

function measureBodyCenters(frames, fw, fh) {
  return frames.map((frame) => {
    let sumX = 0;
    let n = 0;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
        sumX += x;
        n += 1;
        if (y > maxY) maxY = y;
      }
    }
    if (n < 20) {
      sumX = 0;
      n = 0;
      for (let y = 0; y < fh; y += 1) {
        for (let x = 0; x < fw; x += 1) {
          const i = (y * fw + x) * 4;
          if (frame[i + 3] < ALPHA_KEEP) continue;
          sumX += x;
          n += 1;
        }
      }
    }
    return {
      bodyCx: n ? sumX / n : fw / 2,
      feetY: maxY,
      n,
    };
  });
}

function variance(vals) {
  if (!vals.length) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 };
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v =
    vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
  return { mean, variance: v, std: Math.sqrt(v), min: Math.min(...vals), max: Math.max(...vals) };
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, null);
  console.log(`loaded ${keyed.length} alpha frames from ${path.relative(ROOT, INPUT_DIR)}`);

  const rawFrames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  for (let i = 0; i < keyed.length; i += 1) {
    const a = bodyAnchor(rawFrames[i], widths[i], heights[i]);
    console.log(
      `anchor ${keyed[i].file} n=${a.n} bodyCx=${a.bodyCx.toFixed(1)} feetY=${a.feetY} bodyH=${a.bodyH} box=${a.bodyMaxX - a.bodyMinX + 1}x${a.bodyH}@${a.bodyMinX},${a.bodyMinY}`,
    );
  }

  const norm = normalizeBodyLock(rawFrames, widths, heights, PAD);
  console.log(
    `body-lock pack fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight} destBodyCx=${norm.destBodyCx} destFeetY=${norm.destFeetY}`,
  );

  const scrubbed = norm.frames.map((f) => scrubFrame(f, norm.frameWidth, norm.frameHeight));

  const scaled = await scaleFrames(
    scrubbed,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    TARGET_BODY_H,
  );
  const cleaned = scaled.frames.map((f) =>
    scrubFrame(f, scaled.frameWidth, scaled.frameHeight),
  );
  const sheet = stitch(cleaned, scaled.frameWidth, scaled.frameHeight);
  const pal = countPalette(sheet.data);

  const centers = measureBodyCenters(cleaned, scaled.frameWidth, scaled.frameHeight);
  const lockSlice = centers.slice(BURST_LOCK_FROM, BURST_LOCK_TO + 1);
  const cxStats = variance(lockSlice.map((c) => c.bodyCx));
  const feetStats = variance(lockSlice.map((c) => c.feetY).filter((y) => y >= 0));
  const ref = centers[BURST_LOCK_FROM - 1] || centers[0];
  const maxDriftVsRef = Math.max(
    ...lockSlice.map((c) => Math.abs(c.bodyCx - ref.bodyCx)),
  );

  console.log(
    `QA residualGreen=${pal.residualGreen} opaque=${pal.opaque} fire=${pal.fire} whiteHair=${pal.white} toad=${pal.toad} black=${pal.black}`,
  );
  console.log(
    `QA body-lock f${BURST_LOCK_FROM + 1}–${BURST_LOCK_TO + 1} bodyCx mean=${cxStats.mean.toFixed(2)} std=${cxStats.std.toFixed(3)} range=[${cxStats.min.toFixed(2)},${cxStats.max.toFixed(2)}] maxDriftVsPrev=${maxDriftVsRef.toFixed(2)}`,
  );
  console.log(
    `QA body-lock feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(3)} range=[${feetStats.min},${feetStats.max}]`,
  );
  for (let i = Math.max(0, BURST_LOCK_FROM - 1); i <= BURST_LOCK_TO; i += 1) {
    const c = centers[i];
    console.log(
      `  f${i + 1} bodyCx=${c.bodyCx.toFixed(2)} feetY=${c.feetY} bodyN=${c.n}`,
    );
  }

  if (pal.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${pal.residualGreen}`);
  }
  if (pal.fire < 80 && pal.toad < 200) {
    throw new Error(`QA fail: fire/toad VFX nearly gone (fire=${pal.fire} toad=${pal.toad})`);
  }
  if (pal.black < 80) {
    throw new Error(`QA fail: pure black outline nearly gone (${pal.black})`);
  }
  if (cxStats.std > BODY_CX_VAR_MAX + 0.5) {
    console.warn(
      `WARN body-lock: bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px (VFX may pull mass)`,
    );
  }
  if (maxDriftVsRef > BODY_CX_VAR_MAX + 2) {
    console.warn(
      `WARN body-lock: max bodyCx drift = ${maxDriftVsRef.toFixed(2)}px`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'kuchiyose.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    { ...scaled, frames: cleaned },
    QA_DIR,
    'kuchiyose',
    3,
  );

  const durationMs = Math.round((cleaned.length / FRAME_RATE) * 1000);
  // Flame peak starts ~frame 18 (index 17) → ~74% of cast
  const hitDelayMs = Math.round(durationMs * (17 / Math.max(1, cleaned.length - 1)));

  const bodyEntry = {
    image: '/sprites/player/jiraiya/kuchiyose.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: cleaned.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    residualGreen: pal.residualGreen,
    fire: pal.fire,
    whiteHair: pal.white,
    toad: pal.toad,
    pureBlack: pal.black,
    source: 'assets/naruto-source/nu/jiraiya/jutsu/frame_*.png',
    durationMs,
    hitDelayMs,
    note: `Kuchiyose cast ${cleaned.length}f body-lock (shared feetY + bodyCx); toad+fire expands in-cell`,
    inventory: {
      sourceBody: keyed.length,
      bakedFrameCount: cleaned.length,
      bodyLock: {
        destBodyCx: norm.destBodyCx,
        destFeetY: norm.destFeetY,
        burstStdPx: +cxStats.std.toFixed(3),
        burstMaxDrift: +maxDriftVsRef.toFixed(3),
      },
    },
  };

  updateMeta(META_JSON, 'jiraiya-kuchiyose', bodyEntry);
  updateMeta(META_JSON, 'skill-kuchiyose', {
    ...bodyEntry,
    note: 'skill-kuchiyose — Kuchiyose no Jutsu / Gamabunta oil-flame collab (body-lock pack)',
  });

  console.log(
    `-> kuchiyose.png fw=${bodyEntry.frameWidth} fh=${bodyEntry.frameHeight} n=${bodyEntry.frameCount} contentH=${bodyEntry.contentHeight} scale=${bodyEntry.scale.toFixed(4)} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        skillId: 'skill-kuchiyose',
        frameWidth: bodyEntry.frameWidth,
        frameHeight: bodyEntry.frameHeight,
        frameCount: bodyEntry.frameCount,
        contentHeight: bodyEntry.contentHeight,
        durationMs,
        hitDelayMs,
        frameRate: FRAME_RATE,
        residualGreen: bodyEntry.residualGreen,
        bodyLockStd: cxStats.std,
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
