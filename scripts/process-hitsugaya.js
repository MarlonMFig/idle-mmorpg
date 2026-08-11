/**
 * Toshiro Hitsugaya — full lateral pack (Flame Bringer-style sprites).
 *
 * CRITICAL: his green chest sash (≈#316B31 / #52945A) matches the shared
 * isChromaGreen() screen-key and would be deleted by preserveFrame / scrub.
 * This pack only clears near-transparent pixels; pure screen green is not used
 * on these sources (already alpha).
 *
 * Especial: Daiguren Hyōrinmaru (7f ice dragon slash) — shared-source crop so
 * body/feet stay fixed while the ice expands.
 *
 * npm run hitsugaya:all
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
  bbox,
  listFramePngs,
} = require('./lib/alpha-frame-pack');

async function packUniformSafe(
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
  } = {},
) {
  const boxes = frames.map((frame, i) => bbox(frame, widths[i], heights[i]));
  const srcHeights = boxes.map((b) => b.height);
  const maxContentH = Math.max(...srcHeights);
  let scale;
  if (absoluteScale != null && absoluteScale > 0) {
    scale = absoluteScale;
    if (!allowOversizedFrames) {
      const projected = maxContentH * scale;
      if (projected > targetBodyH) scale = targetBodyH / Math.max(1, maxContentH);
    }
  } else if (refContentH != null && refContentH > 0) {
    scale = targetBodyH / refContentH;
  } else {
    scale = targetBodyH / Math.max(1, maxContentH);
  }

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
      if (data[p + 3] < 128) {
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
      } else {
        data[p + 3] = 255;
        // Only pure screen green — never wipe Hitsugaya sash.
        if (isTrueScreenGreen(data[p], data[p + 1], data[p + 2])) {
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
          data[p + 3] = 0;
        }
      }
    }
    const feetX = footCenterXSafe(data, outW, outH);
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

  return {
    frames: packed,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: targetBodyH,
    scale,
    frameCount: packed.length,
  };
}

function footCenterXSafe(data, w, h, band = 5) {
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

const ROOT = path.resolve(__dirname, '..');
const ID = 'hitsugaya';
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const PREVIEW = path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`);
const META = path.join(OUT, 'meta.json');
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const TARGET_BODY_H = 48;
const PAD = 2;
const FRAME_RATE = 12;

/** Hitsugaya sash / teal ice accents — NEVER treat as chroma. */
function isCostumeGreen(r, g, b) {
  // Sash greens / muted jade
  if (g >= 90 && g <= 180 && r >= 30 && r <= 100 && b >= 30 && b <= 110) {
    if (Math.abs(r - b) <= 40) return true;
  }
  // Ice cyan/blue-green highlights on especial
  if (b >= 120 && g >= 140 && r <= 180 && b >= r - 10) return true;
  return false;
}

function isTrueScreenGreen(r, g, b) {
  if (isCostumeGreen(r, g, b)) return false;
  // Only pure chroma screen (saturated, low R+B)
  if (g >= 200 && r <= 40 && b <= 40 && g >= r + 120 && g >= b + 120) return true;
  if (g >= 180 && r <= 25 && b <= 25) return true;
  return false;
}

/**
 * Preserve black outfit + green sash + white haori + ice VFX.
 * Drop near-transparent + pure screen green only.
 */
function scrubSafe(data) {
  const d = Buffer.from(data);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isTrueScreenGreen(d[i], d[i + 1], d[i + 2])) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  return d;
}

function countSashGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isCostumeGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

function countScreenGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isTrueScreenGreen(data[i], data[i + 1], data[i + 2])) n += 1;
    // leftover generic chroma that slipped past costume filter
    else if (
      isChromaGreen(data[i], data[i + 1], data[i + 2]) &&
      !isCostumeGreen(data[i], data[i + 1], data[i + 2])
    ) {
      n += 1;
    }
  }
  return n;
}

function countBlack(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12) n += 1;
  }
  return n;
}

async function loadSafeFrames(inputDir, expected) {
  const files = listFramePngs(inputDir);
  if (expected != null && files.length !== expected) {
    throw new Error(`Expected ${expected} frames in ${inputDir}, got ${files.length}`);
  }
  if (!files.length) throw new Error(`No frames in ${inputDir}`);

  const keyed = [];
  for (const file of files) {
    const full = path.join(inputDir, file);
    const { data, info } = await sharp(full).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frame = scrubSafe(data);
    const box = bbox(frame, info.width, info.height);
    const opaque = countOpaque(frame);
    if (opaque < 80) {
      throw new Error(`${file} too empty after scrub (op=${opaque})`);
    }
    console.log(
      `KEEP ${file} ${info.width}x${info.height} → content ${box.width}x${box.height} opaque=${opaque} sash=${countSashGreen(frame)}`,
    );
    keyed.push({ file, frame, width: info.width, height: info.height });
  }
  return keyed;
}

async function writeSheet(outName, packed, qaPrefix) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(path.join(OUT, outName), packed.sheet.data, packed.sheet.width, packed.sheet.height);
  await writeFrameCrops(
    packed.sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    qaPrefix,
    3,
  );
}

function assertQuality(label, frame, fw, fh, { minSash = 20, minOp = 80 } = {}) {
  const op = countOpaque(frame);
  const sash = countSashGreen(frame);
  const residual = countScreenGreen(frame);
  if (op < minOp) throw new Error(`${label}: too empty op=${op}`);
  if (sash < minSash) {
    throw new Error(`${label}: sash green wiped (sash=${sash}) — packing destroyed costume`);
  }
  if (residual > 0) throw new Error(`${label}: residual screen green=${residual}`);
  // no full-frame solid green leftovers
  let greenish = 0;
  for (let i = 0; i < frame.length; i += 4) {
    if (frame[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(frame[i], frame[i + 1], frame[i + 2]) && !isCostumeGreen(frame[i], frame[i + 1], frame[i + 2])) {
      greenish += 1;
    }
  }
  if (greenish > 0) throw new Error(`${label}: non-costume chroma green ${greenish}`);
  void fw;
  void fh;
  return { op, sash };
}

/**
 * Especial: shared source crop (same rect every frame) so ice expands without
 * sliding the body left like center-bbox packing would.
 */
async function packEspecialSharedCrop(keyed, absoluteScale) {
  const frames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  for (let i = 0; i < frames.length; i += 1) {
    const b = bbox(frames[i], widths[i], heights[i]);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }
  const union = {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  // Match walk body density so he doesn't shrink mid-special.
  const scale = absoluteScale > 0 ? absoluteScale : TARGET_BODY_H / Math.max(1, bbox(frames[0], widths[0], heights[0]).height);
  const cropW = Math.max(1, Math.round(union.width * scale));
  const cropH = Math.max(1, Math.round(union.height * scale));
  const fw = cropW + PAD * 2;
  const fh = cropH + PAD * 2;
  console.log(
    `especial shared crop ${union.width}x${union.height} scale=${scale.toFixed(4)} cell=${fw}x${fh}`,
  );

  const packed = [];
  for (let i = 0; i < frames.length; i += 1) {
    const crop = Buffer.alloc(union.width * union.height * 4);
    for (let y = 0; y < union.height; y += 1) {
      for (let x = 0; x < union.width; x += 1) {
        const sx = union.minX + x;
        const sy = union.minY + y;
        const si = (sy * widths[i] + sx) * 4;
        const di = (y * union.width + x) * 4;
        crop[di] = frames[i][si];
        crop[di + 1] = frames[i][si + 1];
        crop[di + 2] = frames[i][si + 2];
        crop[di + 3] = frames[i][si + 3];
      }
    }
    const { data: resized } = await sharp(crop, {
      raw: { width: union.width, height: union.height, channels: 4 },
    })
      .resize(cropW, cropH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let p = 0; p < resized.length; p += 4) {
      if (resized[p + 3] < 128) {
        resized[p] = 0;
        resized[p + 1] = 0;
        resized[p + 2] = 0;
        resized[p + 3] = 0;
      } else {
        resized[p + 3] = 255;
      }
    }

    const canvas = Buffer.alloc(fw * fh * 4);
    const destX = PAD;
    const destY = fh - cropH - PAD;
    for (let y = 0; y < cropH; y += 1) {
      for (let x = 0; x < cropW; x += 1) {
        const si = (y * cropW + x) * 4;
        if (resized[si + 3] < ALPHA_KEEP) continue;
        const di = ((destY + y) * fw + destX + x) * 4;
        resized.copy(canvas, di, si, si + 4);
      }
    }
    assertQuality(`especial f${i + 1}`, canvas, fw, fh, { minSash: 8, minOp: 50 });
    packed.push(canvas);
  }

  const sheet = stitch(packed, fw, fh);
  return {
    frames: packed,
    frameWidth: fw,
    frameHeight: fh,
    sheet,
    scale,
    frameCount: packed.length,
    contentHeight: TARGET_BODY_H,
    pureBlack: countBlack(sheet.data),
  };
}

async function packSequenceLabel(label, dir, expected, packOpts) {
  const keyed = await loadSafeFrames(dir, expected);
  const frames = keyed.map((k) => k.frame);
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packUniformSafe(frames, widths, heights, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    ...packOpts,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    // Death floors often hide the green sash (pose/occlusion in source) — allow 0.
    const allowZeroSash = label.includes('damage');
    assertQuality(`${label} f${i + 1}`, packed.frames[i], packed.frameWidth, packed.frameHeight, {
      minSash: allowZeroSash ? 0 : 12,
      minOp: 60,
    });
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  console.log(
    `OK ${label} n=${packed.frames.length} fw=${packed.frameWidth} fh=${packed.frameHeight} scale=${packed.scale.toFixed(4)} sash0=${countSashGreen(packed.frames[0])}`,
  );
  return {
    ...packed,
    sheet,
    pureBlack: countBlack(sheet.data),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });

  // --- walk ---
  const walk = await packSequenceLabel('hitsugaya-walk', path.join(SRC, 'walk'), 6, {
    alignX: 'feet',
  });
  await writeSheet('walk.png', walk, 'walk');
  updateMeta(META, `${ID}-walk`, {
    image: `/sprites/player/${ID}/walk.png`,
    frameWidth: walk.frameWidth,
    frameHeight: walk.frameHeight,
    frameCount: walk.frameCount,
    contentHeight: 48,
    scale: walk.scale,
    residualGreen: 0,
    pureBlack: walk.pureBlack,
  });

  // --- idle (feet lock: haori + arcs) ---
  // Idle export is ~18% taller in source than walk (152 vs 129). Do NOT reuse
  // walk.absoluteScale — that made idle body ~57px while contentHeight stayed 48
  // (scale from walk), so he read oversized on screen. Fit full bbox → 48 like walk.
  const idle = await packSequenceLabel('hitsugaya-idle', path.join(SRC, 'idle'), 6, {
    alignX: 'feet',
  });
  await writeSheet('idle.png', idle, 'idle');
  await sharp(idle.frames[0], {
    raw: { width: idle.frameWidth, height: idle.frameHeight, channels: 4 },
  })
    .png()
    .toFile(PREVIEW);
  updateMeta(META, `${ID}-idle`, {
    image: `/sprites/player/${ID}/idle.png`,
    frameWidth: idle.frameWidth,
    frameHeight: idle.frameHeight,
    frameCount: idle.frameCount,
    contentHeight: 48,
    scale: idle.scale,
  });

  // --- combo 14 → 5+5+4 ---
  const combo = await packSequenceLabel('hitsugaya-combo', path.join(SRC, 'combo'), 14, {
    absoluteScale: walk.scale,
    allowOversizedFrames: true,
    alignX: 'feet',
  });
  const splits = [5, 5, 4];
  if (splits.reduce((a, b) => a + b, 0) !== combo.frameCount) {
    throw new Error(`combo split sum mismatch`);
  }
  let cursor = 0;
  const comboParts = [];
  for (let s = 0; s < splits.length; s += 1) {
    const n = splits[s];
    const frames = combo.frames.slice(cursor, cursor + n);
    const sheet = stitch(frames, combo.frameWidth, combo.frameHeight);
    const name = `combo${s + 1}.png`;
    await writePng(path.join(OUT, name), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(
      sheet,
      { frames, frameWidth: combo.frameWidth, frameHeight: combo.frameHeight },
      QA,
      `combo${s + 1}`,
      3,
    );
    comboParts.push({
      frameWidth: combo.frameWidth,
      frameHeight: combo.frameHeight,
      frameCount: n,
      contentHeight: 48,
    });
    updateMeta(META, `${ID}-combo${s + 1}`, {
      image: `/sprites/player/${ID}/${name}`,
      ...comboParts[s],
      scale: combo.scale,
      range: [cursor, cursor + n],
    });
    console.log(`-> ${name} n=${n}`);
    cursor += n;
  }
  await writeSheet('attack.png', combo, 'attack');

  // --- damage 4 → hurt 2 + death 2 ---
  const damage = await packSequenceLabel('hitsugaya-damage', path.join(SRC, 'damage'), 4, {
    absoluteScale: walk.scale,
    allowOversizedFrames: true,
    alignX: 'feet',
  });
  const hurtFrames = damage.frames.slice(0, 2);
  const deathFrames = damage.frames.slice(2);
  const hurtSheet = stitch(hurtFrames, damage.frameWidth, damage.frameHeight);
  const deathSheet = stitch(deathFrames, damage.frameWidth, damage.frameHeight);
  await writePng(path.join(OUT, 'hurt.png'), hurtSheet.data, hurtSheet.width, hurtSheet.height);
  await writePng(path.join(OUT, 'death.png'), deathSheet.data, deathSheet.width, deathSheet.height);
  const hurt = {
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: 2,
    contentHeight: 48,
    frameRate: 10,
    scale: damage.scale,
  };
  const death = {
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: deathFrames.length,
    contentHeight: 48,
    frameRate: 8,
    scale: damage.scale,
  };
  updateMeta(META, `${ID}-hurt`, { image: `/sprites/player/${ID}/hurt.png`, ...hurt });
  updateMeta(META, `${ID}-death`, { image: `/sprites/player/${ID}/death.png`, ...death });
  console.log(`-> hurt.png n=2 death.png n=${death.frameCount}`);

  // --- especial Daiguren Hyōrinmaru ---
  const jutsuKeyed = await loadSafeFrames(path.join(SRC, 'jutsu'), 7);
  const especial = await packEspecialSharedCrop(jutsuKeyed, walk.scale);
  await writeSheet('daiguren-hyorinmaru.png', especial, 'daiguren-hyorinmaru');
  const hitFrame1based = 5; // ice peak mid-cast
  const fr = FRAME_RATE;
  const hitIdx = Math.max(0, Math.min(especial.frameCount - 1, hitFrame1based - 1));
  const jutsuEntry = {
    image: `/sprites/player/${ID}/daiguren-hyorinmaru.png`,
    frameWidth: especial.frameWidth,
    frameHeight: especial.frameHeight,
    frameCount: especial.frameCount,
    contentHeight: 48,
    scale: especial.scale,
    frameRate: fr,
    durationMs: Math.round((especial.frameCount / fr) * 1000),
    hitDelayMs: Math.round((hitIdx / fr) * 1000),
    residualGreen: 0,
    pureBlack: especial.pureBlack,
    source: 'hitsugaya/jutsu especial shared-crop body-lock; sash preserved',
  };
  updateMeta(META, `${ID}-daiguren-hyorinmaru`, jutsuEntry);
  updateMeta(META, 'skill-daiguren-hyorinmaru', jutsuEntry);
  console.log(
    `-> daiguren-hyorinmaru.png n=${especial.frameCount} hit=${jutsuEntry.hitDelayMs}ms dur=${jutsuEntry.durationMs}ms`,
  );

  // Final sheet-level sash QA (death poses may hide the sash in source art).
  for (const name of [
    'walk.png',
    'idle.png',
    'combo1.png',
    'combo2.png',
    'combo3.png',
    'hurt.png',
    'daiguren-hyorinmaru.png',
  ]) {
    const p = path.join(OUT, name);
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const sash = countSashGreen(data);
    if (sash < 8) throw new Error(`FINAL QA ${name}: sash gone (sash=${sash})`);
    console.log(`FINAL QA ${name} ${info.width}x${info.height} sash=${sash}`);
  }

  const wire = {
    walk: {
      frameWidth: walk.frameWidth,
      frameHeight: walk.frameHeight,
      frameCount: walk.frameCount,
      contentHeight: 48,
      scale: walk.scale,
    },
    idle: {
      frameWidth: idle.frameWidth,
      frameHeight: idle.frameHeight,
      frameCount: idle.frameCount,
      contentHeight: 48,
    },
    combo: comboParts,
    hurt,
    death,
    jutsu: {
      frameWidth: jutsuEntry.frameWidth,
      frameHeight: jutsuEntry.frameHeight,
      frameCount: jutsuEntry.frameCount,
      durationMs: jutsuEntry.durationMs,
      hitDelayMs: jutsuEntry.hitDelayMs,
      frameRate: fr,
      file: 'daiguren-hyorinmaru.png',
    },
  };
  console.log('PACK_WIRE', JSON.stringify(wire, null, 2));
  return wire;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
