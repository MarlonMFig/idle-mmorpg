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
  } = {},
) {
  const keyed = await loadAlphaFrames(inputDir, expected);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

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
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    absoluteScale,
    refContentH: resolvedRef,
    allowOversizedFrames,
    alignX,
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
    contentHeight: TARGET_BODY_H,
    scale: packed.scale,
    residualGreen,
    pureBlack,
    frameCount: packed.frames.length,
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
 *   jutsu: { file: string, metaKey: string, skillMetaKey: string, frameRate: number, hitFrame1based: number },
 * }} cfg
 */
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
    jutsu: jutsuCfg,
  } = cfg;

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(qaDir, { recursive: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });

  const walk = await packSequence(`${id}-walk`, path.join(srcDir, 'walk'), expected.walk);
  await writeSheet(outDir, qaDir, 'walk.png', walk, 'walk');
  updateMeta(metaJson, `${id}-walk`, {
    image: `/sprites/player/${id}/walk.png`,
    frameWidth: walk.frameWidth,
    frameHeight: walk.frameHeight,
    frameCount: walk.frameCount,
    contentHeight: 48,
    scale: walk.scale,
    residualGreen: 0,
    pureBlack: walk.pureBlack,
  });

  const idle = await packSequence(`${id}-idle`, path.join(srcDir, 'idle'), expected.idle, {
    absoluteScale: walk.scale,
    // Cloak/tail width changes must not slide torso — lock stance feet X.
    alignX: 'feet',
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
    contentHeight: 48,
    scale: idle.scale,
  });

  // Body-match early standing poses → TARGET_BODY_H. Using walk.scale crushes
  // combo/jutsu sources whose native canvas is shorter than walk
  // (Shino walk ~148px content vs combo/jutsu ~86–90px → ~0.6× mid-attack).
  const combo = await packSequence(`${id}-combo`, path.join(srcDir, 'combo'), expected.combo, {
    bodyMatchN: 3,
    allowOversizedFrames: true,
  });
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
      contentHeight: 48,
    });
    updateMeta(metaJson, `${id}-combo${s + 1}`, {
      image: `/sprites/player/${id}/${name}`,
      ...comboParts[s],
      scale: combo.scale,
      range: [cursor, cursor + n],
    });
    console.log(`-> ${name} n=${n}`);
    cursor += n;
  }
  await writeSheet(outDir, qaDir, 'attack.png', combo, 'attack');

  const damage = await packSequence(`${id}-damage`, path.join(srcDir, 'damage'), expected.damage, {
    absoluteScale: walk.scale,
  });
  // First 2 frames = hurt; remaining = death (supports 5 → n=3 or 6 → n=4, etc.).
  const hurtN = Math.min(2, damage.frameCount);
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
    // Body size must match walk on-screen (~TARGET_BODY_H). Using walk.scale
    // crushes jutsus whose green-strip crops are shorter than walk zips
    // (Deidara: walk ~121px vs jutsu pose ~82px → ~2/3 size mid-cast).
    const jutsu = await packSequence(`${id}-jutsu`, path.join(srcDir, 'jutsu'), expected.jutsu, {
      bodyMatchN: 4,
      allowOversizedFrames: true,
    });
    await writeSheet(outDir, qaDir, jutsuCfg.file, jutsu, jutsuCfg.metaKey.replace(`${id}-`, ''));
    const fr = jutsuCfg.frameRate;
    const hitIdx = Math.max(0, Math.min(jutsu.frameCount - 1, jutsuCfg.hitFrame1based - 1));
    jutsuEntry = {
      image: `/sprites/player/${id}/${jutsuCfg.file}`,
      frameWidth: jutsu.frameWidth,
      frameHeight: jutsu.frameHeight,
      frameCount: jutsu.frameCount,
      contentHeight: 48,
      scale: jutsu.scale,
      frameRate: fr,
      durationMs: Math.round((jutsu.frameCount / fr) * 1000),
      hitDelayMs: Math.round((hitIdx / fr) * 1000),
      residualGreen: 0,
      pureBlack: jutsu.pureBlack,
    };
    updateMeta(metaJson, jutsuCfg.metaKey, jutsuEntry);
    updateMeta(metaJson, jutsuCfg.skillMetaKey, jutsuEntry);
    console.log(
      `-> ${jutsuCfg.file} n=${jutsu.frameCount} hit=${jutsuEntry.hitDelayMs}ms dur=${jutsuEntry.durationMs}ms`,
    );
  } else {
    console.log('-> jutsu skipped (none in pack)');
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
    jutsu: jutsuEntry
      ? {
          frameWidth: jutsuEntry.frameWidth,
          frameHeight: jutsuEntry.frameHeight,
          frameCount: jutsuEntry.frameCount,
          durationMs: jutsuEntry.durationMs,
          hitDelayMs: jutsuEntry.hitDelayMs,
          frameRate: jutsuEntry.frameRate,
          file: jutsuCfg.file,
        }
      : null,
  };
  console.log('PACK_WIRE', JSON.stringify(wire, null, 2));
  return wire;
}

module.exports = { processCuratedAlphaPack, TARGET_BODY_H };
