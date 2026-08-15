/**
 * Shared alpha-only sprite packing for clean transparent sources.
 *
 * NEVER black-key / exterior-black flood / hole-fill that deletes hair or
 * ankle connectors. Preserve source RGBA → alpha bbox → floor-align →
 * nearest scale contentH ≈ targetBodyH → horizontal strip.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { resolveHqTargetBodyH, snapNativeScale } = require('./strip-hq-scale');

const ALPHA_KEEP = 16;

/** True pure chroma green only (never olive fabric / hair greys). */
function isChromaGreen(r, g, b) {
  // Strict: saturated screen green — g dominant and low r/b
  if (g >= 90 && g >= r + 40 && g >= b + 40 && r <= 70 && b <= 70) return true;
  if (g >= 120 && g >= r + 50 && g >= b + 50 && r <= 90 && b <= 90) return true;
  return false;
}

/**
 * Pass-through: keep opaque RGB (including pure black hair/outlines).
 * Zero near-transparent + any true residual chroma green.
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
function normalize(frames, widths, heights, { pad = 2, contentFromN = 2 } = {}) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const fw = Math.max(...boxes.map((b) => b.width)) + pad * 2;
  const fh = Math.max(...boxes.map((b) => b.height)) + pad * 2;
  const n = Math.min(contentFromN, boxes.length);
  const contentH0 = Math.round(
    boxes.slice(0, n).reduce((s, b) => s + b.height, 0) / n,
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

/**
 * `targetOrOpts` accepts either a fixed body height (legacy) or
 * `{ hq: { mode, metaPath, idleKey } }` for HQ native pixels, where the ruler
 * anim resolves to scale 1 and the rest match its contentHeight.
 */
async function scaleFrames(frames, fw, fh, contentHeight, targetOrOpts = 48) {
  const hq = typeof targetOrOpts === 'object' && targetOrOpts ? targetOrOpts.hq : null;
  const bodyH = hq
    ? resolveHqTargetBodyH(contentHeight, hq)
    : typeof targetOrOpts === 'number'
      ? targetOrOpts
      : 48;
  const rawScale = bodyH / Math.max(1, contentHeight);
  const scale = hq ? snapNativeScale(rawScale, contentHeight) : rawScale;
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = hq ? bodyH : Math.max(1, Math.round(contentHeight * scale));
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
    contentHeight: outContent,
    scale,
  };
}

/** Average X of opaque pixels in the bottom `band` rows (feet stance). */
function footCenterX(data, w, h, band = 5) {
  let sum = 0;
  let n = 0;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return w / 2;
  const y0 = Math.max(0, maxY - band + 1);
  for (let y = y0; y <= maxY; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      sum += x;
      n += 1;
    }
  }
  return n > 0 ? sum / n : w / 2;
}

/**
 * Uniform body scale for walk / combo / etc.
 *
 * Per-frame `scale = target / frameH` warps body size when poses raise arms/hair
 * (taller bbox → smaller scale → character shrinks). Instead:
 *   1) one global scale for the whole sequence
 *   2) scale each bbox crop with that same scale
 *   3) floor-align + place into shared cell
 *
 * Horizontal place (`alignX`):
 *   - `'bbox'` (default) — center crop box (OK for compact body)
 *   - `'feet'` — lock feet mass X (idle with cloak/tail that would otherwise
 *     slide the torso left-right when centering the full silhouette)
 *
 * Scale selection (first match):
 *   - `absoluteScale` — fix a known scale (e.g. match walk pack density so crouch
 *     combos are not over-scaled when their shorter bbox is forced to targetBodyH)
 *   - `refContentH` — scale so this source height maps to targetBodyH
 *   - default — scale so max frame content height maps to targetBodyH
 *
 * When `absoluteScale` is set, by default projected body is capped so max source
 * height → targetBodyH (walk/idle/combo stay compact). For jutsus that mix body
 * poses with full-canvas VFX, pass `allowOversizedFrames: true` so the walk
 * density is kept and early body frames are not crushed by effect bboxes.
 *
 * contentHeight is reported as targetBodyH (shared pack body bar).
 */
async function packUniformGlobalScale(
  frames,
  widths,
  heights,
  {
    targetBodyH = 48,
    pad = 2,
    absoluteScale = null,
    refContentH = null,
    allowOversizedFrames = false,
    alignX = 'bbox',
    /**
     * Scale the whole source canvas (no bbox crop). Keeps the artist's ground
     * line so walk/run cycles don't hop when hair/sword/trailing-foot pixels
     * sit below the planted foot in some frames.
     */
    fullFrame = false,
    /** Keep Namekian / costume greens (skip screen-green punch-out after resize). */
    preserveCostumeGreen = false,
    /**
     * Keep the source alpha ramp instead of binarizing at 128. Pixel-art bodies
     * want hard alpha; HD VFX (additive glows, slash trails) lose all their
     * feathering and turn into flat blobs without this.
     */
    softAlpha = false,
    /**
     * HQ native pixels (opt-in). `{ mode:'idle'|'match', metaPath, idleKey }`
     * replaces the fixed `targetBodyH` ruler with the character's own body:
     * the ruler anim resolves to scale 1, everything else matches its
     * contentHeight. Omit to keep legacy fixed-target behaviour.
     */
    hq = null,
  } = {},
) {
  const boxes = frames.map((frame, i) => {
    if (fullFrame) {
      return {
        minX: 0,
        minY: 0,
        maxX: widths[i] - 1,
        maxY: heights[i] - 1,
        width: widths[i],
        height: heights[i],
      };
    }
    return bbox(frame, widths[i], heights[i]);
  });
  const srcHeights = boxes.map((b) => b.height);
  const srcWidths = boxes.map((b) => b.width);
  const maxContentH = Math.max(...srcHeights);
  const bodyH = hq ? resolveHqTargetBodyH(maxContentH, hq) : targetBodyH;
  let scale;
  if (absoluteScale != null && absoluteScale > 0) {
    scale = absoluteScale;
    // Walk density can overshoot on taller poses (idle hair / raised arms).
    // Cap so no frame body exceeds bodyH — skip for body+VFX jutsus.
    if (!allowOversizedFrames) {
      const projected = maxContentH * scale;
      if (projected > bodyH) {
        scale = bodyH / Math.max(1, maxContentH);
      }
    }
  } else if (refContentH != null && refContentH > 0) {
    scale = bodyH / refContentH;
  } else {
    scale = bodyH / Math.max(1, maxContentH);
  }
  if (hq) scale = snapNativeScale(scale, maxContentH);

  const crops = [];
  for (let i = 0; i < frames.length; i += 1) {
    const box = boxes[i];
    const srcW = widths[i];
    const crop = Buffer.alloc(box.width * box.height * 4);
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const si = ((box.minY + y) * srcW + (box.minX + x)) * 4;
        const di = (y * box.width + x) * 4;
        crop[di] = frames[i][si];
        crop[di + 1] = frames[i][si + 1];
        crop[di + 2] = frames[i][si + 2];
        crop[di + 3] = frames[i][si + 3];
      }
    }
    const outW = Math.max(1, Math.round(box.width * scale));
    const outH = Math.max(1, Math.round(box.height * scale));
    const { data } = await sharp(crop, {
      raw: { width: box.width, height: box.height, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let p = 0; p < data.length; p += 4) {
      const cut = softAlpha ? ALPHA_KEEP : 128;
      if (data[p + 3] < cut) {
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
      } else {
        if (!softAlpha) data[p + 3] = 255;
        if (!preserveCostumeGreen && isChromaGreen(data[p], data[p + 1], data[p + 2])) {
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
          data[p + 3] = 0;
        }
      }
    }
    const feetX = footCenterX(data, outW, outH);
    crops.push({ data, width: outW, height: outH, feetX });
  }

  let fw;
  let destFeetX = null;
  if (alignX === 'feet') {
    const maxLeft = Math.max(...crops.map((c) => Math.ceil(c.feetX)));
    const maxRight = Math.max(...crops.map((c) => Math.ceil(c.width - c.feetX)));
    fw = maxLeft + maxRight + pad * 2;
    destFeetX = pad + maxLeft;
  } else {
    fw = Math.max(...crops.map((c) => c.width)) + pad * 2;
  }
  const fh = Math.max(...crops.map((c) => c.height)) + pad * 2;
  const packed = crops.map((crop) => {
    const canvas = Buffer.alloc(fw * fh * 4);
    let destX;
    if (alignX === 'feet' && destFeetX != null) {
      destX = Math.round(destFeetX - crop.feetX);
    } else {
      destX = Math.floor((fw - crop.width) / 2);
    }
    const destY = fh - crop.height - pad;
    for (let y = 0; y < crop.height; y += 1) {
      for (let x = 0; x < crop.width; x += 1) {
        const si = (y * crop.width + x) * 4;
        const di = ((destY + y) * fw + destX + x) * 4;
        if (di < 0 || di + 3 >= canvas.length) continue;
        canvas[di] = crop.data[si];
        canvas[di + 1] = crop.data[si + 1];
        canvas[di + 2] = crop.data[si + 2];
        canvas[di + 3] = crop.data[si + 3];
      }
    }
    return canvas;
  });

  const scaledHeights = crops.map((c) => c.height);
  const scaledWidths = crops.map((c) => c.width);
  const anchorX = destFeetX != null ? destFeetX : fw / 2;

  return {
    frames: packed,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: bodyH,
    /** Resolved body ruler (equals targetBodyH unless `hq` is set). */
    targetBodyH: bodyH,
    scale,
    boxes,
    srcHeights,
    srcWidths,
    scaledHeights,
    scaledWidths,
    maxContentH,
    alignX,
    /** Pixel X of stance feet (or frame center) — use as originX = anchorX / fw. */
    anchorX,
    originX: anchorX / Math.max(1, fw),
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

function listFramePngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => {
      if (!f.toLowerCase().endsWith('.png')) return false;
      return /^frame_\d+/i.test(f) || /^sprite-\d+-\d+/i.test(f) || /^sprite-\d+\.png$/i.test(f);
    })
    .sort((a, b) => {
      const order = (name) => {
        const frame = name.match(/frame_(\d+)/i);
        if (frame) return +frame[1];
        const pair = name.match(/sprite-(\d+)-(\d+)/i);
        if (pair) return +pair[1] * 1000 + +pair[2];
        const single = name.match(/sprite-(\d+)/i);
        if (single) return +single[1];
        return 0;
      };
      return order(a) - order(b) || a.localeCompare(b);
    });
}

function countOpaque(frame) {
  let n = 0;
  for (let i = 3; i < frame.length; i += 4) if (frame[i] >= ALPHA_KEEP) n += 1;
  return n;
}

/** Connected-component sizes within one frame of a sheet. */
function componentSizes(sheetData, sheetW, fh, fw, frameIndex) {
  const n = fw * fh;
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
    if (seen[start] || sheetData[i0 + 3] < ALPHA_KEEP) continue;
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
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
        const ni = ny * fw + nx;
        const ii = (ny * sheetW + frameIndex * fw + nx) * 4;
        if (seen[ni] || sheetData[ii + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    comps.push(size);
  }
  comps.sort((a, b) => b - a);
  return comps;
}

/**
 * Shikamaru palette QA helpers.
 * olive jacket: soft green-brown (NOT pure chroma)
 * pure black: hair + outline
 * blue: sandals / thigh wrap
 */
function isOliveJacket(r, g, b) {
  // ~72,104,56 and greyer olive mesh
  if (r >= 45 && r <= 145 && g >= 55 && g <= 155 && b >= 20 && b <= 110) {
    if (g >= r - 20 && g >= b + 5 && g - Math.max(r, b) < 40) return true;
  }
  return false;
}

function isBlueDetail(r, g, b) {
  // bright blue sandals / holster
  if (b >= 120 && b > r + 30 && b > g + 20 && r <= 120) return true;
  if (b >= 80 && b > r + 20 && b > g + 10 && r <= 90 && g <= 100) return true;
  return false;
}

/**
 * `areaScale` rescales the pixel-area budgets, which were all tuned against the
 * legacy 48px body. Native-pixel packs keep the same silhouette but many more
 * pixels, so area grows with the square of the body ratio — pass
 * `hqAreaScale(contentHeight)` instead of re-tuning every threshold by hand.
 */
function qaSheet(sheetData, sheetW, fh, fw, n, opts = {}) {
  const {
    requireSingleComponent = true,
    maxMinorComponent = 0,
    minBlackPerFrame = 8,
    minOlivePerFrame = 10,
    minBluePerFrame = 3,
    minOpaquePerFrame = 60,
    areaScale = 1,
  } = opts;
  const minorBudget = Math.round(maxMinorComponent * areaScale);

  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let olive = 0;
  let blue = 0;
  const footY = [];
  const frameComps = [];

  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let frameBlack = 0;
    let frameOlive = 0;
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
          pureBlack += 1;
          frameBlack += 1;
        }
        if (isOliveJacket(r, g, b)) {
          olive += 1;
          frameOlive += 1;
        }
        if (isBlueDetail(r, g, b)) {
          blue += 1;
          frameBlue += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }

    const comps = componentSizes(sheetData, sheetW, fh, fw, f);
    frameComps.push(comps);
    footY.push(maxFoot);

    if (pix < minOpaquePerFrame) {
      throw new Error(`Frame ${f} too empty (${pix}px)`);
    }
    if (frameBlack < minBlackPerFrame) {
      throw new Error(`Frame ${f} pure black hair/outline too low (${frameBlack}px)`);
    }
    if (frameOlive < minOlivePerFrame) {
      throw new Error(`Frame ${f} olive jacket nearly gone (${frameOlive}px)`);
    }
    if (frameBlue < minBluePerFrame) {
      throw new Error(`Frame ${f} blue sandals/wrap missing (${frameBlue}px)`);
    }
    if (requireSingleComponent && comps.length > 1) {
      const minor = comps.slice(1).reduce((s, c) => s + c, 0);
      if (minor > minorBudget) {
        throw new Error(
          `Frame ${f} disconnected body nComps=${comps.length} top=${comps[0]} minor=${minor} sizes=${comps.join(',')}`,
        );
      }
    }
  }

  const feet = footY.filter((y) => y >= 0);
  return {
    residualGreen,
    residualExteriorBlack: 0,
    opaque,
    pureBlack,
    olive,
    blue,
    footSpread: feet.length ? Math.max(...feet) - Math.min(...feet) : 0,
    footY,
    frameComps,
  };
}

async function writeMagentaPreview(sheet, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
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
    .toFile(outPath);
}

async function writeFrameCrops(sheet, scaled, qaDir, prefix, scale = 4) {
  fs.mkdirSync(qaDir, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(qaDir, `${prefix}-full.png`));

  await writeMagentaPreview(sheet, path.join(qaDir, `${prefix}-magenta-bg.png`));

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
      .resize(scaled.frameWidth * scale, scaled.frameHeight * scale, {
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toFile(path.join(qaDir, `${prefix}-frame-${fi}-x${scale}.png`));
  }
}

async function loadAlphaFrames(inputDir, expected = null, { chromaKey = true } = {}) {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Missing input dir: ${inputDir}`);
  }
  const files = listFramePngs(inputDir);
  if (expected != null && files.length !== expected) {
    throw new Error(`Expected ${expected} frames in ${inputDir}, got ${files.length}`);
  }
  if (!files.length) throw new Error(`No frame_*.png in ${inputDir}`);

  const keyed = [];
  for (const file of files) {
    const full = path.join(inputDir, file);
    const { data, info } = await sharp(full)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const corners = [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ].map(([x, y]) => data[(y * info.width + x) * 4 + 3]);
    const alphaCorners = corners.every((a) => a < ALPHA_KEEP);

    // chromaKey:false — Namekian / costume greens must survive (Piccolo).
    let frame;
    if (chromaKey) {
      frame = preserveFrame(data);
    } else {
      frame = Buffer.from(data);
      for (let i = 0; i < frame.length; i += 4) {
        if (frame[i + 3] < ALPHA_KEEP) {
          frame[i] = 0;
          frame[i + 1] = 0;
          frame[i + 2] = 0;
          frame[i + 3] = 0;
        } else {
          frame[i + 3] = 255;
        }
      }
    }
    const box = bbox(frame, info.width, info.height);
    const opaque = countOpaque(frame);
    if (opaque < 80 || box.width < 4 || box.height < 8) {
      // Some sequences include 1-frame flashes that key out completely.
      // Reuse previous pose so timing/frameCount stay stable.
      if (keyed.length > 0) {
        const prev = keyed[keyed.length - 1];
        console.warn(
          `WARN ${file} empty after preserve (opaque=${opaque}) — clone previous ${prev.file}`,
        );
        keyed.push({
          file,
          frame: Buffer.from(prev.frame),
          width: prev.width,
          height: prev.height,
          box: prev.box,
          opaque: prev.opaque,
          clonedFrom: prev.file,
        });
        continue;
      }
      throw new Error(
        `${file} empty after preserve (opaque=${opaque} box=${box.width}x${box.height})`,
      );
    }
    console.log(
      `KEEP ${file} ${info.width}x${info.height} → content ${box.width}x${box.height} opaque=${opaque} alphaCorners=${alphaCorners}`,
    );
    keyed.push({
      file,
      frame,
      width: info.width,
      height: info.height,
      box,
      opaque,
    });
  }
  return keyed;
}

function updateMeta(metaJsonPath, key, entry) {
  let meta = {};
  if (fs.existsSync(metaJsonPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta[key] = entry;
  fs.writeFileSync(metaJsonPath, `${JSON.stringify(meta, null, 2)}\n`);
}

async function writePng(file, data, width, height) {
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(file);
}

module.exports = {
  ALPHA_KEEP,
  isChromaGreen,
  preserveFrame,
  bbox,
  normalize,
  scaleFrames,
  packUniformGlobalScale,
  stitch,
  listFramePngs,
  countOpaque,
  componentSizes,
  isOliveJacket,
  isBlueDetail,
  qaSheet,
  writeMagentaPreview,
  writeFrameCrops,
  loadAlphaFrames,
  updateMeta,
  writePng,
};
