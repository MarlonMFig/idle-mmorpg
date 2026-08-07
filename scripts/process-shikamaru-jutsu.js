/**
 * Shikamaru jutsu — Kage Mane (21 frames), alpha-only pack.
 *
 * Wide canvas frames include shadow tendril VFX to the right of the body.
 * Content height uses body-only height from early stand frames (not full
 * shadow-extension bbox width). Multi-component shadow is intentional.
 *
 * npm run shikamaru:jutsu
 * Input:  assets/naruto-source/nu/shikamaru/jutsu/frame_001..021.png
 * Output: public/sprites/player/shikamaru/kage-mane.png
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
  isOliveJacket,
  isBlueDetail,
  isChromaGreen,
  bbox,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shikamaru');
const TARGET_BODY_H = 48;
const FRAME_RATE = 10;
const EXPECTED = 21;

/**
 * Body content height: ignore sparse far-right pure-black shadow tendrils
 * for vertical scale (use leftmost dense body mass).
 * For normalization floor-align we still use full alpha bbox so VFX packs in.
 */
function bodyOnlyHeight(frame, w, h, box) {
  // Density per column — body sits left of long shadow extensions
  const dens = new Array(w).fill(0);
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      dens[x] += 1;
    }
  }
  // Find leftmost column band with solid body (peak density cluster)
  const thr = Math.max(4, Math.floor((box.height) * 0.12));
  let bodyR = box.minX;
  let seen = false;
  for (let x = box.minX; x <= box.maxX; x += 1) {
    if (dens[x] >= thr) {
      bodyR = x;
      seen = true;
    } else if (seen && dens[x] < thr * 0.35) {
      // gap after body → stop before sparse shadow chain
      // only break if gap is sustained and x past half-body start
      let gap = 0;
      for (let xx = x; xx <= Math.min(box.maxX, x + 8); xx += 1) {
        if (dens[xx] < thr * 0.35) gap += 1;
      }
      if (gap >= 4 && bodyR - box.minX > 20) break;
    }
  }
  if (!seen) return box.height;

  let minY = h;
  let maxY = -1;
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= bodyR + 2; x += 1) {
      if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return box.height;
  return Math.max(1, maxY - minY + 1);
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  // Full alpha bbox normalize so shadow VFX is included in the cell
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: 2, pad: 2 },
  );

  // Override contentHeight to body-only median of first 6 frames (stand/prep)
  const bodyHeights = [];
  for (let i = 0; i < Math.min(6, keyed.length); i += 1) {
    const k = keyed[i];
    const box = bbox(k.frame, k.width, k.height);
    const bh = bodyOnlyHeight(k.frame, k.width, k.height, box);
    bodyHeights.push(bh);
    console.log(`  bodyH f${i + 1} box=${box.width}x${box.height} bodyH=${bh}`);
  }
  bodyHeights.sort((a, b) => a - b);
  const midBody = bodyHeights[Math.floor(bodyHeights.length / 2)] || norm.contentHeight;
  console.log(
    `normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH(body)=${midBody} (fullBboxH=${norm.contentHeight})`,
  );

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    midBody,
    TARGET_BODY_H,
  );
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  // Shadow VFX is intentional multi-component — disable single-comp fail
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: false,
      minBlackPerFrame: 8,
      minOlivePerFrame: 5,
      minBluePerFrame: 0,
      minOpaquePerFrame: 40,
    },
  );

  // Extra: olive+blue should appear on most body frames (not pure FX frames)
  let bodyFramesWithOlive = 0;
  for (let f = 0; f < scaled.frames.length; f += 1) {
    let olive = 0;
    let blue = 0;
    let green = 0;
    for (let y = 0; y < scaled.frameHeight; y += 1) {
      for (let x = 0; x < scaled.frameWidth; x += 1) {
        const i = (y * sheet.width + f * scaled.frameWidth + x) * 4;
        if (sheet.data[i + 3] < ALPHA_KEEP) continue;
        if (isChromaGreen(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) green += 1;
        if (isOliveJacket(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) olive += 1;
        if (isBlueDetail(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) blue += 1;
      }
    }
    if (green > 0) throw new Error(`Frame ${f} residual chroma green=${green}`);
    if (olive >= 8) bodyFramesWithOlive += 1;
    if (f < 3 && olive < 5) {
      throw new Error(`Frame ${f} early body missing olive jacket (${olive}px)`);
    }
  }

  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} olive=${qa.olive} blue=${qa.blue} bodyOliveFrames=${bodyFramesWithOlive} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=n${c.length}[${c.slice(0, 4).join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${qa.residualGreen}`);
  }
  if (qa.pureBlack < 80) {
    throw new Error(`QA fail: pure black hair nearly gone (${qa.pureBlack})`);
  }
  if (bodyFramesWithOlive < 10) {
    throw new Error(`QA fail: too few frames with olive body (${bodyFramesWithOlive})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'kage-mane.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, scaled, QA_DIR, 'kage-mane', 2);

  // Remove obsolete FX strip if present (new clean source is self-contained)
  const retiredFx = path.join(OUT_DIR, 'kage-mane-fx.png');
  if (fs.existsSync(retiredFx)) {
    fs.unlinkSync(retiredFx);
    console.log('removed retired kage-mane-fx.png (embedded in sequence)');
  }

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(durationMs * 0.55);
  const entry = {
    image: '/sprites/player/shikamaru/kage-mane.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    source: 'assets/naruto-source/nu/shikamaru/jutsu/frame_001..021.png',
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    olive: qa.olive,
    note: `${scaled.frames.length}f Kage Mane (stance→shadow extension); alpha-only, no chromakey`,
  };
  updateMeta(META_JSON, 'shikamaru-kage-mane', entry);
  updateMeta(META_JSON, 'skill-kage-mane', {
    ...entry,
    note: 'Jutsu 1 Shikamaru — Kage Mane no Jutsu',
  });

  // Drop old fx meta
  if (fs.existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
      if (meta['shikamaru-kage-mane-fx']) {
        delete meta['shikamaru-kage-mane-fx'];
        fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
        console.log('removed meta shikamaru-kage-mane-fx');
      }
    } catch {
      /* ignore */
    }
  }

  console.log(
    `-> kage-mane.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      skillId: 'skill-kage-mane',
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
