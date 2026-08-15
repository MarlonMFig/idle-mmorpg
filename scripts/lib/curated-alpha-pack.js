/**
 * Shared alpha-only pack builder for curated side sprites (frame_*.png).
 * Used by Kabuto / Tsunade / etc.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
  bbox,
} = require('./alpha-frame-pack');
const { preferNativeScale } = require('./strip-hq-scale');

const TARGET_BODY_H = 48;
const PAD = 2;

function scrub(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(d[i], d[i + 1], d[i + 2])) {
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

function countGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(data[i], data[i + 1], data[i + 2])) n += 1;
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

function removeTinyIslands(frame, w, h, maxSize = 2) {
  const N = w * h;
  const seen = new Uint8Array(N);
  for (let start = 0; start < N; start += 1) {
    if (seen[start] || frame[start * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (cells.length <= maxSize) {
      for (const idx of cells) {
        const i = idx * 4;
        frame[i] = 0;
        frame[i + 1] = 0;
        frame[i + 2] = 0;
        frame[i + 3] = 0;
      }
    }
  }
}

async function packSequence(
  label,
  inputDir,
  expected,
  {
    absoluteScale = null,
    allowOversizedFrames = false,
    alignX = 'bbox',
    /** When set, scale so these first frames map body height → targetBodyH. */
    bodyMatchN = null,
    refContentH = null,
    pad = PAD,
    /** When set, only pack the first N frames from the input dir. */
    frameLimit = null,
    /** Body ruler (default TARGET_BODY_H). Native packs pass idle contentHeight. */
    targetBodyH = TARGET_BODY_H,
    /** Keep source canvas ground line (kills walk hop from bbox crop). */
    fullFrame = false,
  } = {},
) {
  const keyed = await loadAlphaFrames(inputDir, expected);
  const slice = frameLimit != null ? keyed.slice(0, frameLimit) : keyed;
  if (frameLimit != null && slice.length < frameLimit) {
    throw new Error(`${label}: frameLimit ${frameLimit} but only ${slice.length} frames`);
  }
  const frames = slice.map((k) => scrub(k.frame));
  const widths = slice.map((k) => k.width);
  const heights = slice.map((k) => k.height);

  let resolvedRef = refContentH;
  if (absoluteScale == null && bodyMatchN != null && bodyMatchN > 0) {
    // Standing/cast poses live early; VFX later must not crush body scale.
    const n = Math.min(bodyMatchN, frames.length);
    let sumH = 0;
    for (let i = 0; i < n; i += 1) {
      const b = bbox(frames[i], widths[i], heights[i]);
      sumH += b.height;
    }
    resolvedRef = Math.max(1, Math.round(sumH / n));
  }

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH,
    pad,
    absoluteScale,
    refContentH: resolvedRef,
    allowOversizedFrames,
    alignX,
    fullFrame,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    removeTinyIslands(packed.frames[i], packed.frameWidth, packed.frameHeight, 2);
    const op = countOpaque(packed.frames[i]);
    if (op < 50) throw new Error(`${label} f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  const pureBlack = countBlack(sheet.data);
  if (residualGreen > 0) throw new Error(`${label}: residualGreen=${residualGreen}`);

  console.log(
    `OK ${label} n=${packed.frames.length} fw=${packed.frameWidth} fh=${packed.frameHeight} scale=${packed.scale.toFixed(4)}${
      resolvedRef ? ` refH=${resolvedRef}` : ''
    } black=${pureBlack}`,
  );

  return {
    sheet,
    frames: packed.frames,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    contentHeight: targetBodyH,
    scale: packed.scale,
    residualGreen,
    pureBlack,
    frameCount: packed.frames.length,
    originX: packed.originX,
    anchorX: packed.anchorX,
  };
}

async function writeSheet(outDir, qaDir, outName, packed, qaPrefix) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(qaDir, { recursive: true });
  await writePng(path.join(outDir, outName), packed.sheet.data, packed.sheet.width, packed.sheet.height);
  await writeFrameCrops(
    packed.sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    qaDir,
    qaPrefix,
    3,
  );
}

/**
 * @param {{
 *   id: string,
 *   srcDir: string,
 *   outDir: string,
 *   previewPath: string,
 *   metaJson: string,
 *   qaDir: string,
 *   expected: { idle: number, walk: number, combo: number, damage: number, jutsu: number },
 *   comboSplits: number[], // lengths summing to combo count
 *   hurtFrameCount?: number, // default 2 (rest of damage = death)
 *   walkAlignX?: 'bbox' | 'feet', // default bbox; use feet to kill stance slide
 *   scaleRef?: 'walk' | 'idle', // idle = flight packs (walk bbox height is thin axis)
 *   nativePixels?: boolean, // absoluteScale=1 — max quality; contentHeight from idle body
 *   sameRipZoom?: boolean, // rip already shares the idle zoom: never body-match
 *                          // (hunched runs/crouched attacks are shorter by pose,
 *                          //  not by zoom, and upscaling them inflates the body)
 *   jutsu: {
 *     file: string,
 *     metaKey: string,
 *     skillMetaKey: string,
 *     frameRate: number,
 *     hitFrame1based: number,
 *     absoluteScaleFromWalk?: boolean,
 *     bodyMatchN?: number,
 *     alignX?: 'bbox' | 'feet',
 *     pad?: number,
 *     bodyFrameCount?: number,
 *   },
 * }} cfg
 */
function measurePackedBodyHeight(frames, fw, fh) {
  let maxH = 0;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= 0) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return Math.max(1, maxH);
}

async function processCuratedAlphaPack(cfg) {
  const {
    id,
    srcDir,
    outDir,
    previewPath,
    metaJson,
    qaDir,
    expected,
    comboSplits,
    hurtFrameCount = 2,
    walkAlignX = 'bbox',
    scaleRef = 'walk',
    // Default ON — max visual quality (idle scale=1; world size via contentHeight).
    nativePixels = true,
    sameRipZoom = false,
    jutsu: jutsuCfg,
  } = cfg;

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });

  const refIsIdle = scaleRef === 'idle';
  const nativeOpts = nativePixels
    ? { absoluteScale: 1, allowOversizedFrames: true }
    : null;

  // Body reference first when idle drives density (flight packs).
  let idle;
  let walk;
  let bodyScale;

  if (nativeOpts) {
    console.log(`${id}: nativePixels=true (idle scale=1; other anims match idle body)`);
    idle = await packSequence(`${id}-idle`, path.join(srcDir, 'idle'), expected.idle, {
      ...nativeOpts,
      alignX: 'feet',
    });
    bodyScale = 1;
    const idleBodyH = measurePackedBodyHeight(
      idle.frames,
      idle.frameWidth,
      idle.frameHeight,
    );
    // Walk rips are often a different zoom than idle — upsample like combo.
    const walkKeyed = await loadAlphaFrames(path.join(srcDir, 'walk'), expected.walk);
    let walkMaxH = 0;
    for (const k of walkKeyed) {
      const b = bbox(scrub(k.frame), k.width, k.height);
      walkMaxH = Math.max(walkMaxH, b.height);
    }
    const walkScale = sameRipZoom
      ? 1
      : preferNativeScale(walkMaxH > 0 ? idleBodyH / walkMaxH : 1);
    console.log(
      `${id}: walk scale=${walkScale.toFixed(4)} (walkMaxH=${walkMaxH} → idleBodyH=${idleBodyH})`,
    );
    walk = await packSequence(`${id}-walk`, path.join(srcDir, 'walk'), expected.walk, {
      absoluteScale: walkScale,
      allowOversizedFrames: true,
      targetBodyH: idleBodyH,
      alignX: walkAlignX,
      fullFrame: cfg.walkFullFrame === true,
    });
  } else if (refIsIdle) {
    idle = await packSequence(`${id}-idle`, path.join(srcDir, 'idle'), expected.idle, {
      alignX: 'feet',
    });
    bodyScale = idle.scale;
    walk = await packSequence(`${id}-walk`, path.join(srcDir, 'walk'), expected.walk, {
      absoluteScale: bodyScale,
      alignX: walkAlignX,
    });
  } else {
    walk = await packSequence(`${id}-walk`, path.join(srcDir, 'walk'), expected.walk, {
      alignX: walkAlignX,
    });
    bodyScale = walk.scale;
    idle = await packSequence(`${id}-idle`, path.join(srcDir, 'idle'), expected.idle, {
      absoluteScale: bodyScale,
      // Cloak/tail width changes must not slide torso — lock stance feet X.
      alignX: 'feet',
    });
  }

  const contentHeight = nativePixels
    ? measurePackedBodyHeight(idle.frames, idle.frameWidth, idle.frameHeight)
    : TARGET_BODY_H;
  if (nativePixels) {
    console.log(`${id}: contentHeight=${contentHeight} (idle body ruler)`);
  }

  await writeSheet(outDir, qaDir, 'walk.png', walk, 'walk');
  updateMeta(metaJson, `${id}-walk`, {
    image: `/sprites/player/${id}/walk.png`,
    frameWidth: walk.frameWidth,
    frameHeight: walk.frameHeight,
    frameCount: walk.frameCount,
    contentHeight,
    scale: walk.scale,
    originX: walk.originX,
    residualGreen: 0,
    pureBlack: walk.pureBlack,
  });

  await writeSheet(outDir, qaDir, 'idle.png', idle, 'idle');
  await sharp(idle.frames[0], {
    raw: { width: idle.frameWidth, height: idle.frameHeight, channels: 4 },
  })
    .png()
    .toFile(previewPath);
  updateMeta(metaJson, `${id}-idle`, {
    image: `/sprites/player/${id}/idle.png`,
    frameWidth: idle.frameWidth,
    frameHeight: idle.frameHeight,
    frameCount: idle.frameCount,
    contentHeight,
    scale: idle.scale,
    originX: idle.originX,
  });

  // Combo: native sources are often drawn shorter/crouched than idle.
  // Match max body height → contentHeight so attacks don't look shrunk.
  let comboOpts;
  if (nativeOpts) {
    const comboKeyed = await loadAlphaFrames(path.join(srcDir, 'combo'), expected.combo);
    let comboRefH = 0;
    if (cfg.comboBodyMatchN != null && cfg.comboBodyMatchN > 0) {
      // Stance poses (early frames) — ignore jump/sword-up bboxes that would
      // shrink the standing body to fit the tallest VFX frame.
      const n = Math.min(cfg.comboBodyMatchN, comboKeyed.length);
      let sumH = 0;
      for (let i = 0; i < n; i += 1) {
        const k = comboKeyed[i];
        sumH += bbox(scrub(k.frame), k.width, k.height).height;
      }
      comboRefH = Math.max(1, Math.round(sumH / n));
    } else {
      for (const k of comboKeyed) {
        const b = bbox(scrub(k.frame), k.width, k.height);
        comboRefH = Math.max(comboRefH, b.height);
      }
    }
    const comboScale = sameRipZoom
      ? 1
      : preferNativeScale(comboRefH > 0 ? contentHeight / comboRefH : 1);
    console.log(
      `${id}: combo scale=${comboScale.toFixed(4)} (comboRefH=${comboRefH} → contentHeight=${contentHeight})`,
    );
    comboOpts = {
      absoluteScale: comboScale,
      allowOversizedFrames: true,
      targetBodyH: contentHeight,
      alignX: cfg.comboAlignX ?? 'feet',
      fullFrame: cfg.comboFullFrame === true,
    };
  } else if (refIsIdle) {
    comboOpts = { absoluteScale: bodyScale, allowOversizedFrames: true };
  } else {
    comboOpts = { bodyMatchN: 3, allowOversizedFrames: true };
  }
  const combo = await packSequence(
    `${id}-combo`,
    path.join(srcDir, 'combo'),
    expected.combo,
    comboOpts,
  );
  const sum = comboSplits.reduce((a, b) => a + b, 0);
  if (sum !== combo.frameCount) {
    throw new Error(`${id} combo splits ${sum} != ${combo.frameCount}`);
  }
  let cursor = 0;
  const comboParts = [];
  for (let s = 0; s < comboSplits.length; s += 1) {
    const n = comboSplits[s];
    const frames = combo.frames.slice(cursor, cursor + n);
    const sheet = stitch(frames, combo.frameWidth, combo.frameHeight);
    const name = `combo${s + 1}.png`;
    await writePng(path.join(outDir, name), sheet.data, sheet.width, sheet.height);
    await writeFrameCrops(
      sheet,
      { frames, frameWidth: combo.frameWidth, frameHeight: combo.frameHeight },
      qaDir,
      `combo${s + 1}`,
      3,
    );
    comboParts.push({
      frameWidth: combo.frameWidth,
      frameHeight: combo.frameHeight,
      frameCount: n,
      contentHeight,
    });
    updateMeta(metaJson, `${id}-combo${s + 1}`, {
      image: `/sprites/player/${id}/${name}`,
      ...comboParts[s],
      scale: combo.scale,
      originX: combo.originX,
      range: [cursor, cursor + n],
    });
    console.log(`-> ${name} n=${n}`);
    cursor += n;
  }
  await writeSheet(outDir, qaDir, 'attack.png', combo, 'attack');

  // Damage: match standing-hurt body height to idle (allow upscale when the
  // rip is a smaller zoom; only downscale when hurt is bulkier than idle).
  const hurtN = Math.min(Math.max(1, hurtFrameCount), expected.damage - 1);
  let damageOpts;
  if (nativeOpts) {
    const dmgKeyed = await loadAlphaFrames(path.join(srcDir, 'damage'), expected.damage);
    let standingBodyH = 0;
    for (let i = 0; i < hurtN; i += 1) {
      const k = dmgKeyed[i];
      const b = bbox(scrub(k.frame), k.width, k.height);
      standingBodyH = Math.max(standingBodyH, b.height);
    }
    const damageScale = sameRipZoom
      ? 1
      : preferNativeScale(standingBodyH > 0 ? contentHeight / standingBodyH : 1);
    console.log(
      `${id}: damage scale=${damageScale.toFixed(4)} (hurtBodyH=${standingBodyH} → contentHeight=${contentHeight})`,
    );
    damageOpts = {
      absoluteScale: damageScale,
      allowOversizedFrames: true,
      targetBodyH: contentHeight,
      alignX: 'feet',
    };
  } else {
    damageOpts = { absoluteScale: bodyScale, allowOversizedFrames: true };
  }
  const damage = await packSequence(
    `${id}-damage`,
    path.join(srcDir, 'damage'),
    expected.damage,
    damageOpts,
  );
  // First N frames = hurt; remaining = death (default N=2).
  const hurtFrames = damage.frames.slice(0, hurtN);
  const deathFrames = damage.frames.slice(hurtN);
  if (deathFrames.length < 1) {
    throw new Error(`${id}-damage: need at least 1 death frame after hurt (${damage.frameCount} total)`);
  }
  const hurtSheet = stitch(hurtFrames, damage.frameWidth, damage.frameHeight);
  const deathSheet = stitch(deathFrames, damage.frameWidth, damage.frameHeight);
  await writePng(path.join(outDir, 'hurt.png'), hurtSheet.data, hurtSheet.width, hurtSheet.height);
  await writePng(path.join(outDir, 'death.png'), deathSheet.data, deathSheet.width, deathSheet.height);
  await writeFrameCrops(
    hurtSheet,
    { frames: hurtFrames, frameWidth: damage.frameWidth, frameHeight: damage.frameHeight },
    qaDir,
    'hurt',
    3,
  );
  await writeFrameCrops(
    deathSheet,
    { frames: deathFrames, frameWidth: damage.frameWidth, frameHeight: damage.frameHeight },
    qaDir,
    'death',
    3,
  );
  const hurt = {
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: hurtFrames.length,
    contentHeight,
    frameRate: 10,
    scale: damage.scale,
  };
  const death = {
    frameWidth: damage.frameWidth,
    frameHeight: damage.frameHeight,
    frameCount: deathFrames.length,
    contentHeight,
    frameRate: 8,
    scale: damage.scale,
  };
  updateMeta(metaJson, `${id}-hurt`, {
    image: `/sprites/player/${id}/hurt.png`,
    ...hurt,
  });
  updateMeta(metaJson, `${id}-death`, {
    image: `/sprites/player/${id}/death.png`,
    ...death,
  });
  console.log(`-> hurt.png n=${hurt.frameCount} death.png n=${death.frameCount}`);

  let jutsuEntry = null;
  if (expected.jutsu && jutsuCfg) {
    // Idle-ref flight packs: body-match early cast poses (sources often shorter
    // than idle) + feet lock so beams don't slide the caster.
    // Walk-ref: optional walk lock or bodyMatch.
    // nativePixels: match early cast body → idle contentHeight (same idea as combo).
    let jutsuPackOpts;
    if (nativeOpts) {
      jutsuPackOpts = {
        allowOversizedFrames: true,
        targetBodyH: contentHeight,
        alignX: jutsuCfg.alignX ?? 'feet',
        ...(jutsuCfg.pad != null ? { pad: jutsuCfg.pad } : {}),
        ...(jutsuCfg.absoluteScale != null
          ? { absoluteScale: jutsuCfg.absoluteScale }
          : sameRipZoom
            ? { absoluteScale: 1 }
            : { bodyMatchN: jutsuCfg.bodyMatchN != null ? jutsuCfg.bodyMatchN : 4 }),
        ...(jutsuCfg.fullFrame ? { fullFrame: true } : {}),
      };
    } else if (refIsIdle) {
      jutsuPackOpts = {
        allowOversizedFrames: true,
        bodyMatchN: jutsuCfg.bodyMatchN != null ? jutsuCfg.bodyMatchN : 6,
        alignX: jutsuCfg.alignX ?? 'feet',
        ...(jutsuCfg.pad != null ? { pad: jutsuCfg.pad } : {}),
      };
    } else {
      jutsuPackOpts = {
        allowOversizedFrames: true,
        alignX: jutsuCfg.alignX ?? 'bbox',
        ...(jutsuCfg.pad != null ? { pad: jutsuCfg.pad } : {}),
        ...(jutsuCfg.absoluteScaleFromWalk
          ? { absoluteScale: walk.scale }
          : { bodyMatchN: jutsuCfg.bodyMatchN != null ? jutsuCfg.bodyMatchN : 4 }),
      };
    }
    const jutsu = await packSequence(`${id}-jutsu`, path.join(srcDir, 'jutsu'), expected.jutsu, {
      ...jutsuPackOpts,
      ...(jutsuCfg.bodyFrameCount != null ? { frameLimit: jutsuCfg.bodyFrameCount } : {}),
    });
    await writeSheet(outDir, qaDir, jutsuCfg.file, jutsu, jutsuCfg.metaKey.replace(`${id}-`, ''));
    const fr = jutsuCfg.frameRate;
    const hitIdx = Math.max(0, Math.min(jutsu.frameCount - 1, jutsuCfg.hitFrame1based - 1));
    jutsuEntry = {
      image: `/sprites/player/${id}/${jutsuCfg.file}`,
      frameWidth: jutsu.frameWidth,
      frameHeight: jutsu.frameHeight,
      frameCount: jutsu.frameCount,
      contentHeight,
      scale: jutsu.scale,
      frameRate: fr,
      durationMs: Math.round((jutsu.frameCount / fr) * 1000),
      hitDelayMs: Math.round((hitIdx / fr) * 1000),
      residualGreen: 0,
      pureBlack: jutsu.pureBlack,
      originX: jutsu.originX,
    };
    updateMeta(metaJson, jutsuCfg.metaKey, jutsuEntry);
    updateMeta(metaJson, jutsuCfg.skillMetaKey, jutsuEntry);
    console.log(
      `-> ${jutsuCfg.file} n=${jutsu.frameCount} hit=${jutsuEntry.hitDelayMs}ms dur=${jutsuEntry.durationMs}ms originX=${(jutsu.originX ?? 0.5).toFixed(3)}`,
    );
  } else {
    console.log('-> jutsu skipped (none in pack)');
  }

  const wire = {
    walk: {
      frameWidth: walk.frameWidth,
      frameHeight: walk.frameHeight,
      frameCount: walk.frameCount,
      contentHeight,
      scale: walk.scale,
    },
    idle: {
      frameWidth: idle.frameWidth,
      frameHeight: idle.frameHeight,
      frameCount: idle.frameCount,
      contentHeight,
      scale: idle.scale,
    },
    combo: comboParts,
    hurt,
    death,
    jutsu: jutsuEntry
      ? {
          frameWidth: jutsuEntry.frameWidth,
          frameHeight: jutsuEntry.frameHeight,
          frameCount: jutsuEntry.frameCount,
          durationMs: jutsuEntry.durationMs,
          hitDelayMs: jutsuEntry.hitDelayMs,
          frameRate: jutsuEntry.frameRate,
          file: jutsuCfg.file,
          originX: jutsuEntry.originX,
          contentHeight,
        }
      : null,
    scaleRef,
    bodyScale,
    contentHeight,
    nativePixels,
  };
  console.log('PACK_WIRE', JSON.stringify(wire, null, 2));
  return wire;
}

module.exports = { processCuratedAlphaPack, TARGET_BODY_H };
