/**
 * Kakashi Hatake — Raikiri (Lightning Blade) jutsu.
 *
 * Alpha-only PNG sequence (HQ transparent single cast strip).
 * Body-lock packing so lightning VFX may expand while Kakashi's body stays
 * fixed (shared floor Y + shared body-core X).
 * Soft HQ downscale (lanczos3 body-match upright→48) — matches walk on-screen
 * body height. Prefer walk absoluteScale when projection lands near 48.
 * hitDelay = peak of cast VFX (tie → latest frame).
 *
 * npm run kakashi:jutsu
 * Input:  assets/naruto-source/nu/kakashi/jutsu/frame_*.png
 * Output: public/sprites/player/kakashi/raikiri.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  isChromaGreen,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kakashi', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kakashi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'kakashi');
const TARGET_BODY_H = 48;
const FRAME_RATE = 12;
const PAD = 2;
/** Burst / peak lock window — mid/late cast (0-based; scaled to n after load). */
const BODY_CX_VAR_MAX = 2.4;
const BODY_CX_DRIFT_MAX = 4.0;
const FEET_Y_DELTA_MAX = 1;

function isLightningVfx(r, g, b) {
  // bright cyan / white-blue sparks
  if (b >= 160 && g >= 140 && r >= 80 && b >= r && g >= r - 20) return true;
  if (r >= 180 && g >= 200 && b >= 220 && b >= r) return true;
  if (b >= 140 && g >= 100 && b > r + 25 && b >= g - 10) return true;
  // electric blue core
  if (b >= 120 && b > r + 40 && b > g + 15 && r <= 140) return true;
  // pale white spark (high luminance + cool cast)
  if (r >= 200 && g >= 200 && b >= 200 && b >= r - 5) return true;
  // mid cyan streaks
  if (g >= 160 && b >= 160 && r >= 80 && r <= 190 && Math.abs(g - b) <= 40 && g > r + 20) {
    return true;
  }
  return false;
}

function isBlackInk(r, g, b) {
  return Math.max(r, g, b) <= 42 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
}

function isSilverHair(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx >= 18 && mx <= 150 && mx - mn <= 28 && b >= g - 8 && b >= r - 5) return true;
  if (r >= 40 && r <= 130 && g >= 40 && g <= 140 && b >= 50 && b <= 160 && Math.abs(r - g) <= 20) {
    return true;
  }
  return false;
}

function isOliveVest(r, g, b) {
  // Kakashi flak: muted green-grey (incl. cooler greys of vest mesh)
  if (r >= 40 && r <= 160 && g >= 55 && g <= 170 && b >= 40 && b <= 150) {
    if (g >= r - 5 && g >= b - 15 && Math.max(r, g, b) - Math.min(r, g, b) <= 55) {
      if (!isLightningVfx(r, g, b)) return true;
    }
  }
  return false;
}

function isSkin(r, g, b) {
  if (isLightningVfx(r, g, b)) return false;
  if (r >= 180 && g >= 130 && b >= 100 && r >= g && g >= b - 10 && r - b >= 20) return true;
  if (r >= 210 && g >= 170 && b >= 140 && r >= g - 5) return true;
  if (r >= 160 && g >= 100 && b >= 70 && r > g && g > b && r - b >= 30) return true;
  return false;
}

function isRedAccent(r, g, b) {
  // headband / mask accents
  if (r >= 140 && r > g + 40 && r > b + 40 && g <= 120) return true;
  if (r >= 100 && g >= 30 && b <= 40 && r > g + 30) return true;
  return false;
}

/** Body pixel: character core, excluding lightning sparks. */
function isBodyPixel(r, g, b) {
  if (isLightningVfx(r, g, b)) return false;
  if (isBlackInk(r, g, b)) return true;
  if (isSilverHair(r, g, b) || isOliveVest(r, g, b) || isSkin(r, g, b) || isRedAccent(r, g, b)) {
    return true;
  }
  if (Math.max(r, g, b) <= 20) return true;
  // near-grey body/outline anti-alias (not electric)
  if (!isLightningVfx(r, g, b) && Math.max(r, g, b) - Math.min(r, g, b) < 40) {
    if (Math.max(r, g, b) <= 100) return true;
  }
  return false;
}

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

function isResidualGreen(r, g, b) {
  if (isLightningVfx(r, g, b)) return false;
  if (isOliveVest(r, g, b) || isSilverHair(r, g, b)) return false;
  const gn = greenness(r, g, b);
  if (gn < 14) return false;
  if (g >= 50 && gn >= 18 && r <= 95 && b <= 95) return true;
  if (g >= 70 && g >= r + 22 && g >= b + 22 && r <= 110 && b <= 100) return true;
  if (isChromaGreen(r, g, b)) return true;
  return false;
}

/**
 * Body/feet anchor for lock packing.
 * Torso-band mass (excludes lightning + silver hair sway) + body feet Y.
 */
function bodyAnchor(frame, w, h) {
  let minY = h;
  let maxY = -1;
  let feetBodyY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (!isLightningVfx(r, g, b) && !isSilverHair(r, g, b) && y > feetBodyY) {
        feetBodyY = y;
      }
    }
  }
  if (maxY < 0) {
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
  if (feetBodyY < 0) feetBodyY = maxY;

  const contentH = feetBodyY - minY + 1;
  const bandTop = minY + Math.floor(contentH * 0.32);
  const bandBot = minY + Math.floor(contentH * 0.68);

  function massIn(predicate, yLo, yHi) {
    let sumX = 0;
    let n = 0;
    let minX = w;
    let maxX = -1;
    for (let y = yLo; y <= yHi; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!predicate(frame[i], frame[i + 1], frame[i + 2])) continue;
        n += 1;
        sumX += x;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    return { sumX, n, minX, maxX };
  }

  let mode = 'torsoBand';
  let m = massIn(isBodyPixel, bandTop, bandBot);
  if (m.n < 60) {
    mode = 'body';
    m = massIn(isBodyPixel, minY, feetBodyY);
  }
  if (m.n < 30) {
    mode = 'fullNoLightning';
    m = massIn((r, g, b) => !isLightningVfx(r, g, b), minY, feetBodyY);
  }
  if (m.n < 15) {
    mode = 'full';
    m = massIn(() => true, minY, maxY);
  }

  return {
    bodyCx: m.n ? m.sumX / m.n : w / 2,
    feetY: feetBodyY,
    bodyMinX: m.n ? m.minX : 0,
    bodyMaxX: m.n ? m.maxX : w - 1,
    bodyMinY: minY,
    bodyMaxY: feetBodyY,
    bodyH: contentH,
    mode,
    n: m.n,
  };
}

function median(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function normalizeBodyLock(frames, widths, heights, pad = PAD) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));

  // Pack with identical translation: early standing median bodyCx + early feetY.
  // Pose can lean (measured Cx will vary slightly); feet stay locked.
  const earlyN = Math.max(2, Math.ceil(anchors.length / 4));
  const standing = anchors
    .slice(0, earlyN)
    .filter((a) => a.n >= 60 && a.bodyH >= 50);
  const refPool = standing.length ? standing : anchors.filter((a) => a.n >= 40);
  const lockBodyCx = median(refPool.map((a) => a.bodyCx));
  // Per-frame feet keep ground contact with crouch poses; pack still expands VFX cell.
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

  // Standing bodyH from early pre-burst anchors (before lock overwrite of bodyH).
  const earlyH = Math.max(1, Math.ceil(anchors.length / 3));
  const earlyHeights = anchors
    .slice(0, earlyH)
    .filter((a) => a.n >= 80 && a.bodyH >= 40)
    .map((a) => a.bodyH);
  const contentH = earlyHeights.length
    ? Math.max(...earlyHeights)
    : Math.max(...anchors.map((a) => a.bodyH));

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
    if (isResidualGreen(r, g, b) && !isLightningVfx(r, g, b) && r <= 95 && b <= 95) {
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
      if (isLightningVfx(r, g, b)) continue;
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
      } else if (g > Math.max(r, b) + 6 && !isOliveVest(r, g, b)) {
        d[i + 1] = Math.max(r, b);
      }
    }
  }
  return d;
}

function countPalette(sheetData) {
  let residualGreen = 0;
  let lightning = 0;
  let silver = 0;
  let olive = 0;
  let black = 0;
  let opaque = 0;
  for (let i = 0; i < sheetData.length; i += 4) {
    if (sheetData[i + 3] < ALPHA_KEEP) continue;
    opaque += 1;
    const r = sheetData[i];
    const g = sheetData[i + 1];
    const b = sheetData[i + 2];
    if (isResidualGreen(r, g, b) || isChromaGreen(r, g, b)) residualGreen += 1;
    if (isLightningVfx(r, g, b)) lightning += 1;
    if (isSilverHair(r, g, b)) silver += 1;
    if (isOliveVest(r, g, b)) olive += 1;
    if (r <= 12 && g <= 12 && b <= 12) black += 1;
  }
  return { residualGreen, lightning, silver, olive, black, opaque };
}

function measureBodyCenters(frames, fw, fh) {
  return frames.map((frame) => {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (isLightningVfx(frame[i], frame[i + 1], frame[i + 2])) continue;
        if (isSilverHair(frame[i], frame[i + 1], frame[i + 2])) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY < 0) {
      return { bodyCx: fw / 2, feetY: -1, n: 0 };
    }
    const contentH = maxY - minY + 1;
    const bandTop = minY + Math.floor(contentH * 0.35);
    const bandBot = minY + Math.floor(contentH * 0.72);
    // Prefer flak olive core — arms/slash pose mass does not pull torso Cx.
    let sumX = 0;
    let n = 0;
    for (let y = bandTop; y <= bandBot; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * fw + x) * 4;
        if (frame[i + 3] < ALPHA_KEEP) continue;
        if (!isOliveVest(frame[i], frame[i + 1], frame[i + 2])) continue;
        sumX += x;
        n += 1;
      }
    }
    if (n < 12) {
      sumX = 0;
      n = 0;
      for (let y = bandTop; y <= bandBot; y += 1) {
        for (let x = 0; x < fw; x += 1) {
          const i = (y * fw + x) * 4;
          if (frame[i + 3] < ALPHA_KEEP) continue;
          if (!isBodyPixel(frame[i], frame[i + 1], frame[i + 2])) continue;
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

/** Soft HQ downscale (lanczos3). Never nearest — keeps soft test-art quality. */
async function scaleLockedCells(frames, fw, fh, contentHeight, absoluteScale) {
  const skipResize = Math.abs(absoluteScale - 1) < 1e-6;
  const outW = skipResize ? fw : Math.max(1, Math.round(fw * absoluteScale));
  const outH = skipResize ? fh : Math.max(1, Math.round(fh * absoluteScale));
  const outContent = Math.max(1, Math.round(contentHeight * absoluteScale));
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
    // Pack body bar matches walk baseScale path (contentH = 48 after body-match).
    contentHeight: Math.abs(outContent - TARGET_BODY_H) <= 2 ? TARGET_BODY_H : outContent,
    scale: absoluteScale,
  };
}

/** Opaque pixel count (proxy for VFX peak). */
function opaqueCount(frame) {
  let n = 0;
  for (let i = 3; i < frame.length; i += 4) {
    if (frame[i] >= ALPHA_KEEP) n += 1;
  }
  return n;
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, null);
  console.log(`loaded ${keyed.length} alpha frames from ${path.relative(ROOT, INPUT_DIR)}`);

  const n = keyed.length;
  // Peak VFX window: mid → late cast (last third, at least 3f).
  const burstFrom = Math.max(0, Math.floor(n * 0.5));
  const burstTo = Math.max(burstFrom, n - 2);

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

  // Prefer walk absoluteScale first so on-screen body size matches idle/walk
  // (HQ path: body-lock expands cell for VFX; soft lanczos3 downscale).
  // Fall back to body-match→48 only when walk meta is missing or projection
  // is wildly off walk height (>8px after scale).
  let walkScale = null;
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      const w = meta['kakashi-walk'];
      if (w && typeof w.scale === 'number' && w.scale > 0) walkScale = w.scale;
    } catch {
      /* ignore */
    }
  }
  const bodyMatch = TARGET_BODY_H / Math.max(1, norm.contentHeight);
  let absoluteScale = bodyMatch;
  let scaleSource = `body-match-lanczos3→${TARGET_BODY_H}`;
  if (walkScale != null) {
    const projected = norm.contentHeight * walkScale;
    if (Math.abs(projected - TARGET_BODY_H) <= 8) {
      absoluteScale = walkScale;
      scaleSource = `walk-matched scale=${walkScale}`;
      console.log(
        `walk absoluteScale=${walkScale.toFixed(6)} → standing body≈${projected.toFixed(1)}px (target ${TARGET_BODY_H})`,
      );
    } else {
      console.log(
        `NOTE: walk scale ${walkScale.toFixed(6)} → body≈${projected.toFixed(1)}px ` +
          `(need ~${TARGET_BODY_H}); using body-match ${bodyMatch.toFixed(6)}`,
      );
    }
  }
  console.log(
    `scale=lanczos3 ${absoluteScale.toFixed(6)} (${scaleSource}) contentH ${norm.contentHeight}→~${Math.round(norm.contentHeight * absoluteScale)}` +
      (Math.abs(absoluteScale - 1) < 1e-6 ? ' (1:1 no-scale)' : ''),
  );

  const scaled = await scaleLockedCells(
    scrubbed,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    absoluteScale,
  );
  const cleaned = scaled.frames.map((f) =>
    scrubFrame(f, scaled.frameWidth, scaled.frameHeight),
  );
  const sheet = stitch(cleaned, scaled.frameWidth, scaled.frameHeight);
  const pal = countPalette(sheet.data);

  const centers = measureBodyCenters(cleaned, scaled.frameWidth, scaled.frameHeight);
  const lockSlice = centers.slice(burstFrom, burstTo + 1);
  const cxStats = variance(lockSlice.map((c) => c.bodyCx));
  const feetStats = variance(lockSlice.map((c) => c.feetY).filter((y) => y >= 0));
  const ref = centers[Math.max(0, burstFrom - 1)] || centers[0];
  const maxDriftVsRef = Math.max(
    ...lockSlice.map((c) => Math.abs(c.bodyCx - ref.bodyCx)),
  );

  // Peak cast: last frame among max-opaque VFX (tie → latest). Prefer late strike.
  let peakIdx = cleaned.length - 1;
  let peakMass = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    const mass = opaqueCount(cleaned[i]);
    if (mass >= peakMass) {
      peakMass = mass;
      peakIdx = i;
    }
  }

  console.log(
    `QA residualGreen=${pal.residualGreen} opaque=${pal.opaque} lightning=${pal.lightning} silver=${pal.silver} olive=${pal.olive} black=${pal.black}`,
  );
  console.log(
    `QA body-lock f${burstFrom + 1}–${burstTo + 1} bodyCx mean=${cxStats.mean.toFixed(2)} std=${cxStats.std.toFixed(3)} range=[${cxStats.min.toFixed(2)},${cxStats.max.toFixed(2)}] maxDriftVsPrev=${maxDriftVsRef.toFixed(2)}`,
  );
  console.log(
    `QA body-lock feetY mean=${feetStats.mean.toFixed(2)} std=${feetStats.std.toFixed(3)} range=[${feetStats.min},${feetStats.max}]`,
  );
  console.log(`QA peak frame f${peakIdx + 1} mass=${peakMass}`);
  for (let i = Math.max(0, burstFrom - 1); i <= burstTo; i += 1) {
    const c = centers[i];
    console.log(
      `  f${i + 1} bodyCx=${c.bodyCx.toFixed(2)} feetY=${c.feetY} bodyN=${c.n}`,
    );
  }

  if (pal.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${pal.residualGreen}`);
  }
  if (pal.lightning < 80) {
    throw new Error(`QA fail: lightning VFX nearly gone (${pal.lightning})`);
  }
  if (pal.black < 40) {
    throw new Error(`QA fail: pure black outline nearly gone (${pal.black})`);
  }
  if (feetStats.max - feetStats.min > FEET_Y_DELTA_MAX) {
    throw new Error(
      `QA fail body-lock: feetY Δ=${feetStats.max - feetStats.min}px (need ≤ ${FEET_Y_DELTA_MAX})`,
    );
  }
  // Pose lean during cast can move olive mass; hard pack uses locked bodyCx.
  // Warn-only Cx checks — feet lock is the hard deslize guard.
  if (cxStats.std > BODY_CX_VAR_MAX) {
    console.warn(
      `WARN body-lock: bodyCx std=${cxStats.std.toFixed(3)}px > ${BODY_CX_VAR_MAX}px (range ${cxStats.min.toFixed(2)}–${cxStats.max.toFixed(2)})`,
    );
  }
  if (maxDriftVsRef > BODY_CX_DRIFT_MAX) {
    console.warn(
      `WARN body-lock: max bodyCx drift = ${maxDriftVsRef.toFixed(2)}px (threshold ${BODY_CX_DRIFT_MAX})`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'raikiri.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(
    sheet,
    { ...scaled, frames: cleaned },
    QA_DIR,
    'raikiri',
    3,
  );

  const durationMs = Math.round((cleaned.length / FRAME_RATE) * 1000);
  // Peak of cast (max VFX mass) — else last frame index already used as default.
  const hitDelayMs = Math.round((peakIdx / FRAME_RATE) * 1000);

  const bodyEntry = {
    image: '/sprites/player/kakashi/raikiri.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: cleaned.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    residualGreen: pal.residualGreen,
    lightning: pal.lightning,
    silverHair: pal.silver,
    olive: pal.olive,
    pureBlack: pal.black,
    source: 'assets/naruto-source/nu/kakashi/jutsu/frame_*.png',
    durationMs,
    hitDelayMs,
    note: `Raikiri cast ${cleaned.length}f body-lock lanczos3→${TARGET_BODY_H}; peak hit f${peakIdx + 1}`,
    inventory: {
      sourceBody: keyed.length,
      bakedFrameCount: cleaned.length,
      bodyLock: {
        destBodyCx: norm.destBodyCx,
        destFeetY: norm.destFeetY,
        burstStdPx: +cxStats.std.toFixed(3),
        burstMaxDrift: +maxDriftVsRef.toFixed(3),
      },
      peakFrame: peakIdx + 1,
      scaleMethod:
        Math.abs(absoluteScale - 1) < 1e-6
          ? '1:1-noscale'
          : scaleSource.includes('walk')
            ? 'walk-matched-lanczos3'
            : 'lanczos3-body-match',
      standingBodyH: norm.contentHeight,
    },
  };

  updateMeta(META_JSON, 'kakashi-raikiri', bodyEntry);
  updateMeta(META_JSON, 'skill-raikiri', {
    ...bodyEntry,
    note: 'skill-raikiri — Lightning Blade / Raikiri (HQ alpha body-lock pack)',
  });

  console.log(
    `-> raikiri.png fw=${bodyEntry.frameWidth} fh=${bodyEntry.frameHeight} n=${bodyEntry.frameCount} contentH=${bodyEntry.contentHeight} scale=${bodyEntry.scale.toFixed(4)} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify(
      {
        skillId: 'skill-raikiri',
        frameWidth: bodyEntry.frameWidth,
        frameHeight: bodyEntry.frameHeight,
        frameCount: bodyEntry.frameCount,
        contentHeight: bodyEntry.contentHeight,
        durationMs,
        hitDelayMs,
        peakFrame: peakIdx + 1,
        frameRate: FRAME_RATE,
        residualGreen: bodyEntry.residualGreen,
        bodyLockStd: cxStats.std,
        scaleMethod: bodyEntry.inventory.scaleMethod,
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
