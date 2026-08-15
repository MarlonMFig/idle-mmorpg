/**
 * Shikamaru combo — 15 alpha frames → combo1/2/3 (5+5+5) + full attack strip.
 *
 * Frame_005 source has a solid greyscale UI nameplate over the legs (site watermark).
 * Scrub plate greys only (never pure-black hair) and heal from neighbors.
 *
 * npm run shikamaru:combo
 * Input:  assets/naruto-source/nu/shikamaru/combo/frame_001..015.png
 * Output: public/sprites/player/shikamaru/{combo1,combo2,combo3,attack}.png
 */
const fs = require('fs');
const path = require('path');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  normalize,
  scaleFrames,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
  bbox,
} = require('./lib/alpha-frame-pack');
const { hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru', 'combo');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shikamaru');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'shikamaru-idle' } };
const FRAME_RATE = 12;
const EXPECTED = 15;

/** Three equal beats of 5 frames each (prep/hit1 | hit2 | finisher). */
const SLICES = [
  { name: 'combo1', from: 0, to: 5, note: 'prep + first strike' },
  { name: 'combo2', from: 5, to: 10, note: 'second strike' },
  { name: 'combo3', from: 10, to: 15, note: 'finisher / recovery' },
];

/** Solid greyscale UI plate ~#1f1f1f — NOT pure-black hair (≤12). */
function isPlateDark(r, g, b) {
  if (r <= 14 && g <= 14 && b <= 14) return false; // hair / outline
  return (
    Math.abs(r - 31) <= 14 &&
    Math.abs(g - 31) <= 14 &&
    Math.abs(b - 31) <= 14 &&
    Math.max(r, g, b) - Math.min(r, g, b) <= 8
  );
}

/** Light plate rim / lettering flat greys. */
function isPlateLight(r, g, b) {
  const avg = (r + g + b) / 3;
  if (avg < 175 || avg > 245) return false;
  if (Math.max(r, g, b) - Math.min(r, g, b) > 18) return false;
  return true;
}

function isPlatePixel(r, g, b) {
  return isPlateDark(r, g, b) || isPlateLight(r, g, b);
}

/**
 * Detect solid greyscale nameplate band (watermark) and scrub it.
 * Heal cleared body pixels from neighboring frames that share canvas size.
 * Never treats pure #000 hair as plate.
 */
function scrubNameplate(frame, w, h, neighbors = []) {
  const rowPlate = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (isPlateDark(frame[i], frame[i + 1], frame[i + 2])) rowPlate[y] += 1;
    }
  }
  // Continuous row-run with dense plate darks
  let best = null;
  let runS = -1;
  for (let y = 0; y <= h; y += 1) {
    const hit = y < h && rowPlate[y] >= 20;
    if (hit && runS < 0) runS = y;
    if (!hit && runS >= 0) {
      const runE = y;
      let mass = 0;
      for (let yy = runS; yy < runE; yy += 1) mass += rowPlate[yy];
      if (runE - runS >= 8 && mass >= 200) {
        if (!best || mass > best.mass) best = { t: runS, b: runE, mass };
      }
      runS = -1;
    }
  }
  if (!best) return { cleared: 0, healed: 0 };

  let minX = w;
  let maxX = -1;
  for (let y = best.t; y < best.b; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (!isPlatePixel(frame[i], frame[i + 1], frame[i + 2])) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < minX) return { cleared: 0, healed: 0 };

  const T = Math.max(0, best.t - 2);
  const B = Math.min(h - 1, best.b + 2);
  const L = Math.max(0, minX - 1);
  const R = Math.min(w - 1, maxX + 1);

  let cleared = 0;
  const clearedMask = new Uint8Array(w * h);
  for (let y = T; y <= B; y += 1) {
    for (let x = L; x <= R; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      // Never drop pure-black hair / body outline
      if (r <= 14 && g <= 14 && b <= 14) continue;
      if (!isPlatePixel(r, g, b)) continue;
      frame[i] = 0;
      frame[i + 1] = 0;
      frame[i + 2] = 0;
      frame[i + 3] = 0;
      clearedMask[y * w + x] = 1;
      cleared += 1;
    }
  }

  // Second pass: leftover plate darks in band
  for (let y = T; y <= B; y += 1) {
    for (let x = L; x <= R; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      if (frame[i] <= 14 && frame[i + 1] <= 14 && frame[i + 2] <= 14) continue;
      if (!isPlateDark(frame[i], frame[i + 1], frame[i + 2])) continue;
      frame[i] = 0;
      frame[i + 1] = 0;
      frame[i + 2] = 0;
      frame[i + 3] = 0;
      clearedMask[y * w + x] = 1;
      cleared += 1;
    }
  }

  // Heal from neighbors (same canvas size preferred)
  let healed = 0;
  for (const nb of neighbors) {
    if (!nb || nb.width !== w || nb.height !== h) continue;
    for (let y = T; y <= B; y += 1) {
      for (let x = L; x <= R; x += 1) {
        if (!clearedMask[y * w + x]) continue;
        const i = (y * w + x) * 4;
        if (frame[i + 3] >= ALPHA_KEEP) continue;
        if (nb.frame[i + 3] < ALPHA_KEEP) continue;
        const nr = nb.frame[i];
        const ng = nb.frame[i + 1];
        const nbv = nb.frame[i + 2];
        // Don't copy more plate garbage from neighbor
        if (isPlatePixel(nr, ng, nbv) && !(nr <= 14 && ng <= 14 && nbv <= 14)) continue;
        frame[i] = nr;
        frame[i + 1] = ng;
        frame[i + 2] = nbv;
        frame[i + 3] = 255;
        healed += 1;
      }
    }
  }

  console.log(
    `  scrub nameplate bbox ${L},${T}-${R},${B} cleared=${cleared} healed=${healed} mass=${best.mass}`,
  );
  return { cleared, healed, L, T, R, B };
}

function recomputeBox(entry) {
  const box = bbox(entry.frame, entry.width, entry.height);
  entry.box = box;
  let opaque = 0;
  for (let i = 3; i < entry.frame.length; i += 4) {
    if (entry.frame[i] >= ALPHA_KEEP) opaque += 1;
  }
  entry.opaque = opaque;
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  // Scrub UI nameplate on frame_005 (index 4) — heal from f4/f6
  for (let i = 0; i < keyed.length; i += 1) {
    const neighbors = [keyed[i - 1], keyed[i + 1], keyed[i - 2], keyed[i + 2]].filter(Boolean);
    const res = scrubNameplate(keyed[i].frame, keyed[i].width, keyed[i].height, neighbors);
    if (res.cleared > 0) {
      recomputeBox(keyed[i]);
      console.log(
        `  post-scrub ${keyed[i].file}: content ${keyed[i].box.width}x${keyed[i].box.height} opaque=${keyed[i].opaque}`,
      );
    }
  }

  // Standing height from early prep frames (ignore deep lunge bbox later)
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: 3 },
  );
  console.log(
    `normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight}`,
  );

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
    HQ,
  );
  const areaScale = hqAreaScale(scaled.contentHeight);

  // Combo may briefly have floating VFX pixels — allow tiny speckles only
  const fullSheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const fullQa = qaSheet(
    fullSheet.data,
    fullSheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 6,
      minBlackPerFrame: 10,
      minOlivePerFrame: 12,
      minBluePerFrame: 2,
      minOpaquePerFrame: 70,
      areaScale,
    },
  );

  console.log(
    `QA full residualGreen=${fullQa.residualGreen} opaque=${fullQa.opaque} pureBlack=${fullQa.pureBlack} olive=${fullQa.olive} blue=${fullQa.blue} footSpread=${fullQa.footSpread}`,
  );
  console.log(
    `QA comps: ${fullQa.frameComps.map((c, i) => `f${i}=[${c.join(',')}]`).join(' ')}`,
  );

  if (fullQa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${fullQa.residualGreen}`);
  }
  if (fullQa.pureBlack < 150) {
    throw new Error(`QA fail: pure black nearly gone (${fullQa.pureBlack})`);
  }
  if (fullQa.olive < 100) {
    throw new Error(`QA fail: olive jacket nearly gone (${fullQa.olive})`);
  }

  // Residual UI plate greys (solid ~#1f excl. hair) must be zero after scrub
  let residualPlate = 0;
  for (let i = 0; i < fullSheet.data.length; i += 4) {
    if (fullSheet.data[i + 3] < ALPHA_KEEP) continue;
    const r = fullSheet.data[i];
    const g = fullSheet.data[i + 1];
    const b = fullSheet.data[i + 2];
    if (r <= 14 && g <= 14 && b <= 14) continue;
    if (
      Math.abs(r - 31) <= 10 &&
      Math.abs(g - 31) <= 10 &&
      Math.abs(b - 31) <= 10 &&
      Math.max(r, g, b) - Math.min(r, g, b) <= 6
    ) {
      residualPlate += 1;
    }
  }
  console.log(`QA residualPlateGrey=${residualPlate}`);
  if (residualPlate > 8) {
    throw new Error(`QA fail: residual nameplate greys = ${residualPlate}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'attack.png'),
    fullSheet.data,
    fullSheet.width,
    fullSheet.height,
  );
  await writeFrameCrops(fullSheet, scaled, QA_DIR, 'combo', 3);

  const wire = {};
  for (const slice of SLICES) {
    const frames = scaled.frames.slice(slice.from, slice.to);
    const sheet = stitch(frames, scaled.frameWidth, scaled.frameHeight);
    const qa = qaSheet(
      sheet.data,
      sheet.width,
      scaled.frameHeight,
      scaled.frameWidth,
      frames.length,
      {
        requireSingleComponent: true,
        maxMinorComponent: 6,
        minBlackPerFrame: 10,
        minOlivePerFrame: 12,
        minBluePerFrame: 2,
        minOpaquePerFrame: 70,
        areaScale,
      },
    );
    if (qa.residualGreen > 0) {
      throw new Error(`${slice.name} residual green = ${qa.residualGreen}`);
    }
    await writePng(
      path.join(OUT_DIR, `${slice.name}.png`),
      sheet.data,
      sheet.width,
      sheet.height,
    );
    const entry = {
      image: `/sprites/player/shikamaru/${slice.name}.png`,
      frameWidth: scaled.frameWidth,
      frameHeight: scaled.frameHeight,
      frameCount: frames.length,
      contentHeight: scaled.contentHeight,
      scale: scaled.scale,
      frameRate: FRAME_RATE,
      source: 'assets/naruto-source/nu/shikamaru/combo/frame_001..015.png',
      range: [slice.from, slice.to],
      residualGreen: qa.residualGreen,
      note: `${slice.note} (${frames.length}f); alpha-only pack`,
    };
    updateMeta(META_JSON, `shikamaru-${slice.name}`, entry);
    wire[slice.name] = {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
    };
    console.log(
      `-> ${slice.name}.png ${sheet.width}x${sheet.height} n=${entry.frameCount} residualGreen=${qa.residualGreen}`,
    );
  }

  updateMeta(META_JSON, 'shikamaru-attack', {
    image: '/sprites/player/shikamaru/attack.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    source: 'assets/naruto-source/nu/shikamaru/combo/frame_001..015.png',
    residualGreen: fullQa.residualGreen,
    note: `full combo strip (${scaled.frames.length}f); 5+5+5 splits; alpha-only`,
  });

  console.log(
    `-> attack.png ${fullSheet.width}x${fullSheet.height} fw=${scaled.frameWidth} fh=${scaled.frameHeight} n=${scaled.frames.length} contentH=${scaled.contentHeight} scale=${scaled.scale.toFixed(4)}`,
  );
  console.log('Pack wire:', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
