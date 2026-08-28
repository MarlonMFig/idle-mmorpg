/**
 * Process one selected character walk pack.
 *
 * This intentionally accepts only one character id per invocation so a walk
 * replacement cannot rewrite another character's pack or assets.
 * Walk frames use a shared foot ruler plus a nearest vertical body lock so
 * crouched source frames do not make the character visibly bounce.
 *
 * Usage:
 *   node scripts/process-selected-walk.js kisame
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  qaSheet,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');

const SPECS = {
  kisame: {
    sourceId: 'kisame',
    packBlock: 'KISAME_WALK',
    bodyHeight: 110,
    minBlack: 40,
    note: 'walk replacement from sprite walk kisame.zip',
  },
  itachi: {
    sourceId: 'itachi',
    packBlock: 'UCHIHA_ITACHI_WALK',
    bodyHeight: 136,
    minBlack: 60,
    note: 'walk replacement from sprite walk itachi.zip',
  },
  'rock-lee': {
    sourceId: 'rock-lee',
    packBlock: 'ROCK_LEE_WALK',
    bodyHeight: 127,
    minBlack: 40,
    // The supplied 52×51 frames are already registered to one floor ruler.
    // Preserve those pixels instead of applying vertical correction.
    lockBodyY: false,
    note: 'walk replacement from supplied six PNG frames',
  },
  gaara: {
    sourceId: 'gaara',
    packBlock: 'GAARA_WALK',
    bodyHeight: 120,
    minBlack: 15,
    note: 'walk replacement from sprite walk gaara classic.zip',
    aliasRun: true,
  },
  jiraiya: {
    sourceId: 'jiraiya',
    packBlock: 'JIRAIYA_WALK',
    bodyHeight: 225,
    minBlack: 40,
    maxMinorComponent: 32,
    note: 'walk replacement from sprite walk jiraya.zip',
  },
  kabuto: {
    sourceId: 'kabuto',
    packBlock: 'KABUTO_WALK',
    bodyHeight: 124,
    minBlack: 40,
    note: 'walk replacement from sprite walk kabuto.zip',
  },
};

function patchPackTs(spec, entry) {
  const packPath = path.join(ROOT, 'src', 'data', 'character-packs.ts');
  let source = fs.readFileSync(packPath, 'utf8');
  const blockRe = new RegExp(
    `const ${spec.packBlock}: SpriteSheetDef = \\{[\\s\\S]*?\\r?\\n\\};`,
  );
  const block = `const ${spec.packBlock}: SpriteSheetDef = {
  key: '${entry.key}',
  url: '${entry.image}',
  // node scripts/process-selected-walk.js ${spec.sourceId}
  frameWidth: ${entry.frameWidth},
  frameHeight: ${entry.frameHeight},
  frameCount: ${entry.frameCount},
  contentHeight: ${entry.contentHeight},
  originX: ${entry.originX.toFixed(6)},
};`;
  if (!blockRe.test(source)) {
    throw new Error(`${spec.packBlock} block not found in character-packs.ts`);
  }
  source = source.replace(blockRe, block);
  fs.writeFileSync(packPath, source);
}

function opaqueBounds(frame, width, height) {
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frame[(y * width + x) * 4 + 3] < 16) continue;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return maxY < 0 ? { minY: 0, maxY: height - 1 } : { minY, maxY };
}

/**
 * Keep the planted foot and the visual torso on a shared ruler.
 *
 * A shared canvas alone is not enough for these sources: several frames have
 * the foot on the same row but a crouched/extended torso with a different
 * height. That reads as a vertical bounce in-game. This applies a nearest
 * vertical-only correction around the foot; X pixels and the source palette
 * remain untouched.
 */
async function lockWalkBodyY(frames, width, height, pad = 2) {
  const anchors = frames.map((frame) => {
    const box = opaqueBounds(frame, width, height);
    const bandTop = box.minY + Math.floor((box.maxY - box.minY + 1) * 0.28);
    const bandBottom = box.minY + Math.floor((box.maxY - box.minY + 1) * 0.72);
    let sumY = 0;
    let n = 0;
    for (let y = bandTop; y <= bandBottom; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (frame[(y * width + x) * 4 + 3] < 16) continue;
        sumY += y;
        n += 1;
      }
    }
    return {
      minY: box.minY,
      footY: box.maxY,
      bodyY: n > 0 ? sumY / n : (box.minY + box.maxY) / 2,
    };
  });

  const sortedBodyY = anchors.map((anchor) => anchor.bodyY).sort((a, b) => a - b);
  const targetBodyY = sortedBodyY[Math.floor(sortedBodyY.length / 2)] ?? height / 2;
  const targetFootY = Math.max(...anchors.map((anchor) => anchor.footY));
  const transforms = anchors.map((anchor) => {
    const sourceSpan = Math.max(1, anchor.footY - anchor.bodyY);
    const targetSpan = Math.max(1, targetFootY - targetBodyY);
    return {
      ...anchor,
      scaleY: Math.max(0.8, Math.min(1.25, targetSpan / sourceSpan)),
    };
  });
  const maxExtent = Math.max(
    ...transforms.map((transform) => (transform.footY - transform.minY) * transform.scaleY),
  );
  const outHeight = Math.max(1, Math.ceil(maxExtent) + pad * 2);

  const out = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const transform = transforms[frameIndex];
    const sourceHeight = transform.footY - transform.minY + 1;
    const scaledHeight = Math.max(1, Math.round(sourceHeight * transform.scaleY));
    const crop = Buffer.alloc(width * sourceHeight * 4);
    for (let y = 0; y < sourceHeight; y += 1) {
      frame.copy(
        crop,
        y * width * 4,
        (transform.minY + y) * width * 4,
        (transform.minY + y + 1) * width * 4,
      );
    }
    const resized = await sharp(crop, {
      raw: { width, height: sourceHeight, channels: 4 },
    })
      .resize(width, scaledHeight, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const canvas = Buffer.alloc(width * outHeight * 4);
    const destY = outHeight - pad - scaledHeight;
    for (let y = 0; y < scaledHeight; y += 1) {
      resized.copy(canvas, (destY + y) * width * 4, y * width * 4, (y + 1) * width * 4);
    }
    out.push(canvas);
  }

  return {
    frames: out,
    frameWidth: width,
    frameHeight: outHeight,
    scalesY: transforms.map((transform) => transform.scaleY),
  };
}

async function main() {
  const id = process.argv[2];
  const spec = SPECS[id];
  if (!spec) {
    throw new Error(`unsupported character "${id}"; choose one of ${Object.keys(SPECS).join(', ')}`);
  }

  const sourceDir = path.join(ROOT, 'assets', 'naruto-source', 'nu', spec.sourceId, 'walk');
  const outDir = path.join(ROOT, 'public', 'sprites', 'player', spec.sourceId);
  const metaPath = path.join(outDir, 'meta.json');
  const qaDir = path.join(ROOT, 'assets-src', '_qa', spec.sourceId);
  const keyed = await loadAlphaFrames(sourceDir);
  if (keyed.length < 5 || keyed.length > 8) {
    throw new Error(`unexpected frame count for ${id}: ${keyed.length}`);
  }

  const packed = await packUniformGlobalScale(
    keyed.map((frame) => frame.frame),
    keyed.map((frame) => frame.width),
    keyed.map((frame) => frame.height),
    {
      targetBodyH: spec.bodyHeight,
      pad: 2,
      // Keep the source canvas/body fixed. Foot-center alignment makes the
      // whole character move sideways when the active leg changes.
      alignX: 'bbox',
      // Preserve the original canvas ground line. Cropping each bbox makes
      // frames with raised legs/hair land at different visual heights.
      fullFrame: true,
    },
  );
  const locked = spec.lockBodyY === false
    ? {
        frames: packed.frames,
        frameWidth: packed.frameWidth,
        frameHeight: packed.frameHeight,
        scalesY: [1],
      }
    : await lockWalkBodyY(
        packed.frames,
        packed.frameWidth,
        packed.frameHeight,
        2,
      );
  const sheet = stitch(locked.frames, locked.frameWidth, locked.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    locked.frameHeight,
    locked.frameWidth,
    locked.frames.length,
    {
      requireSingleComponent: true,
      maxMinorComponent: spec.maxMinorComponent || 8,
      minBlackPerFrame: spec.minBlack,
      minOlivePerFrame: 0,
      minBluePerFrame: 0,
      minOpaquePerFrame: 80,
    },
  );

  console.log(
    `${id}: frames=${packed.frames.length} sourceMaxH=${packed.maxContentH} ` +
      `scale=${packed.scale.toFixed(6)} output=${sheet.width}x${sheet.height} ` +
      `fw=${locked.frameWidth} fh=${locked.frameHeight} ` +
      `verticalScales=${locked.scalesY.map((scale) => scale.toFixed(3)).join(',')}`,
  );
  console.log(
    `${id}: QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} ` +
      `pureBlack=${qa.pureBlack} footSpread=${qa.footSpread}`,
  );
  console.log(
    `${id}: components=${qa.frameComps.map((components, index) => `f${index}=[${components.join(',')}]`).join(' ')}`,
  );

  if (qa.residualGreen !== 0) throw new Error(`${id}: residual chroma-green pixels remain`);
  if (qa.footSpread > 2) throw new Error(`${id}: foot line variance ${qa.footSpread}px`);

  fs.mkdirSync(outDir, { recursive: true });
  await writePng(path.join(outDir, 'walk.png'), sheet.data, sheet.width, sheet.height);
  if (spec.aliasRun) {
    await writePng(path.join(outDir, 'run.png'), sheet.data, sheet.width, sheet.height);
  }
  await writeFrameCrops(
    sheet,
    {
      frames: locked.frames,
      frameWidth: locked.frameWidth,
      frameHeight: locked.frameHeight,
    },
    qaDir,
    'walk',
    3,
  );

  const entry = {
    key: `${spec.sourceId}-walk`,
    image: `/sprites/player/${spec.sourceId}/walk.png`,
    frameWidth: locked.frameWidth,
    frameHeight: locked.frameHeight,
    frameCount: locked.frames.length,
    contentHeight: spec.bodyHeight,
    scale: packed.scale,
    originX: packed.originX,
    frameRate: 10,
    source: `assets/naruto-source/nu/${spec.sourceId}/walk (${spec.note})`,
    residualGreen: qa.residualGreen,
    residualExteriorBlack: 0,
    pureBlack: qa.pureBlack,
    footSpread: qa.footSpread,
    packMode: spec.lockBodyY === false ? 'feet+fullFrame' : 'feet+bodyLockY',
    note: spec.lockBodyY === false
      ? 'alpha-only, nearest-neighbor scale, preserved supplied frame canvas and planted feet'
      : 'alpha-only, nearest-neighbor scale, planted feet and locked torso height',
  };
  updateMeta(metaPath, entry.key, entry);
  if (spec.aliasRun) {
    updateMeta(metaPath, `${spec.sourceId}-run`, {
      ...entry,
      key: `${spec.sourceId}-run`,
      image: `/sprites/player/${spec.sourceId}/run.png`,
    });
  }
  patchPackTs(spec, entry);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
