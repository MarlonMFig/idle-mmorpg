/**
 * Shikamaru jutsu 2 body — Explosive Kunai cast (14 frames), alpha-only.
 *
 * Body only — projectile/explosion is a separate FX strip
 * (process-shikamaru-jutsu2-vfx.js). Do NOT black-key or ExteriorBlack peel.
 *
 * npm run shikamaru:jutsu2
 * Input:  assets/naruto-source/nu/shikamaru/jutsu2/frame_001..014.png
 * Output: public/sprites/player/shikamaru/explosion-kunai.png
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
} = require('./lib/alpha-frame-pack');
const { hqLinearScale, hqAreaScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru', 'jutsu2');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shikamaru');
const HQ = { hq: { mode: 'match', metaPath: META_JSON, idleKey: 'shikamaru-idle' } };
const FRAME_RATE = 10;
const EXPECTED = 14;

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  // Early stand/prep frames set content height so crouch poses share feet scale.
  const norm = normalize(
    keyed.map((k) => k.frame),
    keyed.map((k) => k.width),
    keyed.map((k) => k.height),
    { contentFromN: 3, pad: 2 },
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
  const linear = hqLinearScale(scaled.contentHeight);
  const areaScale = hqAreaScale(scaled.contentHeight);
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);

  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: 12,
      minBlackPerFrame: 12,
      minOlivePerFrame: 15,
      minBluePerFrame: 3,
      minOpaquePerFrame: 80,
      areaScale,
    },
  );

  // Extra residual-green scan (defensive)
  let residualGreen = qa.residualGreen;
  for (let f = 0; f < scaled.frames.length; f += 1) {
    let olive = 0;
    for (let y = 0; y < scaled.frameHeight; y += 1) {
      for (let x = 0; x < scaled.frameWidth; x += 1) {
        const i = (y * sheet.width + f * scaled.frameWidth + x) * 4;
        if (sheet.data[i + 3] < ALPHA_KEEP) continue;
        if (isChromaGreen(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) {
          residualGreen += 1;
        }
        if (isOliveJacket(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) olive += 1;
        if (isBlueDetail(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])) {
          /* counted in qa */
        }
      }
    }
    if (olive < 12) {
      throw new Error(`Frame ${f} olive jacket nearly gone (${olive}px)`);
    }
  }

  console.log(
    `QA residualGreen=${residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} olive=${qa.olive} blue=${qa.blue} footSpread=${qa.footSpread}`,
  );
  console.log(
    `QA comps: ${qa.frameComps.map((c, i) => `f${i}=n${c.length}[${c.slice(0, 4).join(',')}]`).join(' ')}`,
  );

  if (residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${residualGreen}`);
  }
  if (qa.pureBlack < 100) {
    throw new Error(`QA fail: pure black hair nearly gone (${qa.pureBlack})`);
  }
  if (qa.olive < 200) {
    throw new Error(`QA fail: olive jacket nearly gone (${qa.olive})`);
  }
  if (qa.footSpread > Math.round(6 * linear)) {
    console.warn(`WARN footSpread=${qa.footSpread}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'explosion-kunai.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );
  await writeFrameCrops(sheet, scaled, QA_DIR, 'explosion-kunai', 3);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  // Throw / release ~ mid-late cast; FX starts slightly before hit.
  const hitDelayMs = Math.round(durationMs * 0.58);
  const entry = {
    image: '/sprites/player/shikamaru/explosion-kunai.png',
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    scale: scaled.scale,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    source: 'assets/naruto-source/nu/shikamaru/jutsu2/frame_001..014.png',
    residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    olive: qa.olive,
    note: `${scaled.frames.length}f body cast only — FX separate (explosion-kunai-fx); alpha-only`,
  };
  updateMeta(META_JSON, 'shikamaru-explosion-kunai', entry);
  updateMeta(META_JSON, 'skill-explosion-kunai', {
    ...entry,
    note: 'Jutsu 2 Shikamaru — Kunai Explosiva (body)',
  });

  console.log(
    `-> explosion-kunai.png ${sheet.width}x${sheet.height} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} scale=${entry.scale.toFixed(4)} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log(
    'Pack wire:',
    JSON.stringify({
      skillId: 'skill-explosion-kunai',
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
