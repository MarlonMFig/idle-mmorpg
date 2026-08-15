/**
 * Ino Yamanaka — Shinranshin (Mind Transfer) jutsu.
 *
 * Alpha-only PNG sequence (clean transparent). Body-lock packing so the
 * pink beam may expand while Ino's body stays fixed (shared floor Y +
 * shared body-core X). Fixes frame 12–17 character jump from per-frame
 * full-content center packing.
 *
 * npm run ino:jutsu
 * Input:  assets/naruto-source/nu/ino/jutsu/frame_*.png
 * Output:
 *   public/sprites/player/ino/shinranshin.png
 *   (optional legacy FX kept if shinranshin-fx.png already exists)
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
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'ino', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'ino');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'ino');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'ino-idle' } };
const FRAME_RATE = 12;
const PAD = 2;
/** Burst frames where body lock is critical (0-based; frames 12–17 of sequence). */
const BURST_LOCK_FROM = 11;
const BURST_LOCK_TO = 16;
/** Max allowed mean body-center X variance (px) across lock range after pack. */
const BODY_CX_VAR_MAX = 1.0;

function isPinkVfx(r, g, b) {
  if (r >= 145 && b >= 90 && r >= g + 8 && (b >= g - 5 || r >= 200)) return true;
  if (r >= 180 && g >= 120 && b >= 150 && r >= g && Math.min(r, g, b) >= 110) return true;
  if (r >= 210 && g >= 170 && b >= 190 && r >= 160) return true;
  if (r >= 120 && b >= 100 && g <= 95 && r > g && b > g) return true;
  if (r >= 160 && b >= 80 && r > g + 20 && b > g) return true;
  if (r >= 200 && g >= 100 && b >= 140 && r >= g) return true;
  return false;
}

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

function isBlondeHair(r, g, b) {
  if (r >= 160 && g >= 120 && b >= 60 && b <= 160 && r >= b + 20 && g >= b + 10) return true;
  if (r >= 190 && g >= 150 && b >= 80 && b <= 170 && r >= g - 10 && g >= b) return true;
  return false;
}

function isPurpleOutfit(r, g, b) {
  if (r >= 60 && b >= 80 && g <= 90 && b >= g + 8 && r >= g - 5) return true;
  if (r >= 80 && b >= 100 && g <= 100 && Math.max(r, b) > g + 20) return true;
  if (r >= 100 && b >= 110 && g <= 120 && r > g && b > g) return true;
  return false;
}

function isSkin(r, g, b) {
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  return false;
}

/** Body pixel: opaque character core, excluding pure pink beam / starburst. */
function isBodyPixel(r, g, b) {
  if (isPinkVfx(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isPurpleOutfit(r, g, b) || isBlondeHair(r, g, b) || isSkin(r, g, b)) return true;
  // residual non-pink clothing / shading
  if (Math.max(r, g, b) <= 20) return true;
  if (!isPinkVfx(r, g, b) && Math.max(r, g, b) - Math.min(r, g, b) < 40) {
    // near-grey body/outline anti-alias
    if (Math.max(r, g, b) <= 90) return true;
  }
  return false;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualGreen(r, g, b) {
  if (isPinkVfx(r, g, b)) return false;
  if (isBlondeHair(r, g, b) || isPurpleOutfit(r, g, b)) return false;
  const gn = greenness(r, g, b);
  if (gn < 14) return false;
  if (g >= 50 && gn >= 18 && r <= 95 && b <= 95) return true;
  if (g >= 70 && g >= r + 22 && g >= b + 22 && r <= 110 && b <= 100) return true;
  if (isChromaGreen(r, g, b)) return true;
  return false;
}

/**
 * Body/feet anchor for lock packing.
 * Prefer black outline island; else non-pink body mask; else full content (pink-fill frames).
 */
function bodyAnchor(frame, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let n = 0;
  let sumX = 0;
  let sumY = 0;

  // Pass 1: black outline (most stable silhouette)
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

  // Pass 2: non-pink body core if black too sparse
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

  // Pass 3: pink-dominated (full silhouette) — use full opaque bbox (pre-burst size)
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

  return {
    bodyCx: sumX / n,
    feetY: maxY,
    bodyMinX: minX,
    bodyMaxX: maxX,
    bodyMinY: minY,
    bodyMaxY: maxY,
    bodyH: maxY - minY + 1,
    mode: 'core',
    n,
  };
}

/**
 * Pack all frames into a shared cell keyed on body core center-X and feet-Y.
 * Beam VFX may extend any direction without sliding the character.
 */
function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));

  // Sticky anchor fill for weak frames: borrow from nearest strong frame
  const filled = anchors.map((a) => ({ ...a }));
  let lastStrong = null;
  for (let i = 0; i < filled.length; i += 1) {
    if (filled[i].n >= 200 && filled[i].bodyH >= 60) {
      lastStrong = filled[i];
    } else if (lastStrong) {
      // pink-fill frames: keep feetY / bodyCx from last strong (geometry lock)
      filled[i] = {
        ...filled[i],
        bodyCx: lastStrong.bodyCx,
        feetY: lastStrong.feetY,
        bodyH: lastStrong.bodyH,
        sticky: true,
      };
    }
  }
  // back-fill early weak if any
  let nextStrong = null;
  for (let i = filled.length - 1; i >= 0; i -= 1) {
    if (filled[i].n >= 200 && filled[i].bodyH >= 60 && !filled[i].sticky) {
      nextStrong = filled[i];
    } else if (filled[i].sticky && nextStrong) {
      // prefer nearest preceding; already set
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

  // Standing content height from first non-sticky strong body
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
    if (isResidualGreen(r, g, b) && !isPinkVfx(r, g, b) && r <= 95 && b <= 95) {
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
  // edge despill residual green only
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const i = (y * fw + x) * 4;
      if (d[i + 3] < ALPHA_KEEP) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isPinkVfx(r, g, b)) continue;
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
      } else if (g > Math.max(r, b) + 6) {
        d[i + 1] = Math.max(r, b);
      }
    }
  }
  return d;
}

function countPalette(sheetData) {
  let residualGreen = 0;
  let pink = 0;
  let purple = 0;
  let blonde = 0;
  let black = 0;
  let opaque = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    opaque += 1;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isResidualGreen(r, g, b) || isChromaGreen(r, g, b)) residualGreen += 1;
    if (isPinkVfx(r, g, b)) pink += 1;
    if (isPurpleOutfit(r, g, b)) purple += 1;
    if (isBlondeHair(r, g, b)) blonde += 1;
    if (r <= 12 && g <= 12 && b <= 12) black += 1;
  }
  return { residualGreen, pink, purple, blonde, black, opaque };
}

/** Mean body-center X per frame using body-only mask (post-pack sheet). */
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
      // pink-fill fallback: full content cx
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
  if (!vals.length) return 0;
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
    HQ,
  );
  const cleaned = scaled.frames.map((f) =>
    scrubFrame(f, scaled.frameWidth, scaled.frameHeight),
  );
  const sheet = stitch(cleaned, scaled.frameWidth, scaled.frameHeight);
  const pal = countPalette(sheet.data);

  // Automated body lock check on scaled output (frames 12–17 = indices 11–16)
  const centers = measureBodyCenters(cleaned, scaled.frameWidth, scaled.frameHeight);
  const lockSlice = centers.slice(BURST_LOCK_FROM, BURST_LOCK_TO + 1);
  const cxStats = variance(lockSlice.map((c) => c.bodyCx));
  const feetStats = variance(lockSlice.map((c) => c.feetY).filter((y) => y >= 0));
  // also compare to frame 11 (index 10)
  const ref11 = centers[BURST_LOCK_FROM - 1] || centers[0];
  const maxDriftVs11 = Math.max(
    ...lockSlice.map((c) => Math.abs(c.bodyCx - ref11.bodyCx)),
  );

  console.log(
    `QA residualGreen=${pal.residualGreen} opaque=${pal.opaque} pink=${pal.pink} purple=${pal.purple} blonde=${pal.blonde} black=${pal.black}`,
  );
  console.log(
    `QA body-lock f12–17 bodyCx mean=${cxStats.mean.toFixed(2)} std=${cxStats.std.toFixed(3)} range=[${cxStats.min.toFixed(2)},${cxStats.max.toFixed(2)}] maxDriftVsF11=${maxDriftVs11.toFixed(2)}`,
  );
  console.log(
    `QA body-lock f12–17 feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(3)} range=[${feetStats.min},${feetStats.max}]`,
  );
  for (let i = BURST_LOCK_FROM - 1; i <= BURST_LOCK_TO; i += 1) {
    const c = centers[i];
    console.log(
      `  f${i + 1} bodyCx=${c.bodyCx.toFixed(2)} feetY=${c.feetY} bodyN=${c.n}`,
    );
  }

  if (pal.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${pal.residualGreen}`);
  }
  if (pal.pink < 200) {
    throw new Error(`QA fail: pink VFX nearly gone (${pal.pink})`);
  }
  if (pal.purple < 30) {
    throw new Error(`QA fail: purple outfit nearly gone (${pal.purple})`);
  }
  if (pal.black < 80) {
    throw new Error(`QA fail: pure black outline nearly gone (${pal.black})`);
  }
  // Mean body-center X variance ≤ 1px across frames 12–17
  if (cxStats.std > BODY_CX_VAR_MAX) {
    throw new Error(
      `QA fail body-lock: f12–17 bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px (range ${cxStats.min.toFixed(2)}–${cxStats.max.toFixed(2)})`,
    );
  }
  if (maxDriftVs11 > BODY_CX_VAR_MAX + 0.5) {
    throw new Error(
      `QA fail body-lock: max bodyCx drift vs f11 = ${maxDriftVs11.toFixed(2)}px (need ≤ ${BODY_CX_VAR_MAX + 0.5})`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'shinranshin.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    { ...scaled, frames: cleaned },
    QA_DIR,
    'shinranshin',
    3,
  );

  const durationMs = Math.round((cleaned.length / FRAME_RATE) * 1000);
  // Peak starburst late in sequence (near end of beam expansion)
  const hitDelayMs = Math.round(durationMs * 0.82);

  const bodyEntry = {
    image: '/sprites/player/ino/shinranshin.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: cleaned.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    residualGreen: pal.residualGreen,
    pink: pal.pink,
    purple: pal.purple,
    blonde: pal.blonde,
    pureBlack: pal.black,
    source: 'assets/naruto-source/nu/ino/jutsu/frame_*.png',
    durationMs,
    hitDelayMs,
    note: `Shinranshin cast ${cleaned.length}f body-lock (shared feetY + bodyCx); beam expands in-cell`,
    inventory: {
      sourceBody: keyed.length,
      bakedFrameCount: cleaned.length,
      bodyLock: {
        destBodyCx: norm.destBodyCx,
        destFeetY: norm.destFeetY,
        burstStdPx: +cxStats.std.toFixed(3),
        burstMaxDriftVsF11: +maxDriftVs11.toFixed(3),
      },
    },
  };

  const fxPath = path.join(OUT_DIR, 'shinranshin-fx.png');
  let fxMeta = null;
  if (fs.existsSync(fxPath) && fs.existsSync(META_JSON)) {
    try {
      const prev = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      if (prev['ino-shinranshin-fx']) {
        fxMeta = prev['ino-shinranshin-fx'];
        console.log(
          `kept legacy FX ${fxMeta.frameWidth}x${fxMeta.frameHeight} n=${fxMeta.frameCount}`,
        );
      }
    } catch {
      /* ignore */
    }
  }

  updateMeta(META_JSON, 'ino-shinranshin', bodyEntry);
  updateMeta(META_JSON, 'skill-shinranshin', {
    ...bodyEntry,
    fx: fxMeta ? fxMeta.image : undefined,
    note: 'skill-shinranshin — Mind Transfer / Shinranshin (body-lock pack)',
  });

  console.log(
    `-> shinranshin.png fw=${bodyEntry.frameWidth} fh=${bodyEntry.frameHeight} n=${bodyEntry.frameCount} contentH=${bodyEntry.contentHeight} scale=${bodyEntry.scale.toFixed(4)} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        skillId: 'skill-shinranshin',
        frameWidth: bodyEntry.frameWidth,
        frameHeight: bodyEntry.frameHeight,
        frameCount: bodyEntry.frameCount,
        contentHeight: bodyEntry.contentHeight,
        durationMs,
        hitDelayMs,
        frameRate: FRAME_RATE,
        residualGreen: bodyEntry.residualGreen,
        bodyLockStd: cxStats.std,
        fx: fxMeta
          ? {
              image: fxMeta.image,
              frameWidth: fxMeta.frameWidth,
              frameHeight: fxMeta.frameHeight,
              frameCount: fxMeta.frameCount,
            }
          : null,
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
