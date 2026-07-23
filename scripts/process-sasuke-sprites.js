/**
 * Crop Sasuke Uchiha labeled sheet into Phaser-ready strips.
 * Manual region crops + safe dark-blue/navy chroma key (preserves hair/pants).
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "naruto-source", "sasuke-sheet.png");
const OUT = path.join(ROOT, "public", "sprites", "player", "sasuke");
const SKILLS = path.join(ROOT, "public", "sprites", "skills");

// Sampled from flat sheet background (corner + panel)
const CHROMAS = [
  [33, 36, 57],
  [30, 35, 54],
  [56, 61, 81],
  [55, 60, 80],
  [40, 45, 65],
  [29, 34, 53],
  [63, 65, 80],
];
const TOL = 26; // safer: 22-28 range (was 52 — ate hair/pants)

function dist2(r, g, b, c) {
  const dr = r - c[0],
    dg = g - c[1],
    db = b - c[2];
  return dr * dr + dg * dg + db * db;
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Key out navy/teal panel bg only.
 * Keep near-black hair/pants: lum < 40 and blue not clearly dominant over red.
 */
function isChroma(r, g, b) {
  const lum = luminance(r, g, b);

  // Preserve character blacks / dark hair / pants
  if (lum < 40 && !(b > r + 8 && b > g)) {
    return false;
  }

  const maxD = TOL * TOL;
  let nearBg = false;
  for (const c of CHROMAS) {
    if (dist2(r, g, b, c) <= maxD) {
      nearBg = true;
      break;
    }
  }
  if (!nearBg) return false;

  // Only remove bg-like pixels that are blue-dominant (navy panel)
  // or very flat dark-blue (still blue-biased)
  if (b > r + 8 && b > g) return true;

  return false;
}

function extractRect(data, sw, sh, rect) {
  const { left, top, width, height } = rect;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = left + x;
      const sy = top + y;
      const di = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) {
        out[di + 3] = 0;
        continue;
      }
      const si = (sy * sw + sx) * 4;
      const r = data[si],
        g = data[si + 1],
        b = data[si + 2];
      if (isChroma(r, g, b)) {
        out[di + 3] = 0;
      } else {
        out[di] = r;
        out[di + 1] = g;
        out[di + 2] = b;
        out[di + 3] = 255;
      }
    }
  }
  return out;
}

/** Content bbox inside a chroma-keyed buffer */
function contentBounds(buf, w, h, pad = 1) {
  let minx = w,
    miny = h,
    maxx = -1,
    maxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return { left: 0, top: 0, width: w, height: h };
  return {
    left: Math.max(0, minx - pad),
    top: Math.max(0, miny - pad),
    width: Math.min(w, maxx + pad + 1) - Math.max(0, minx - pad),
    height: Math.min(h, maxy + pad + 1) - Math.max(0, miny - pad),
  };
}

function cropBuf(buf, w, h, box) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const si = ((box.top + y) * w + (box.left + x)) * 4;
      const di = (y * box.width + x) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

function padTo(buf, w, h, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  const xOff = Math.floor((tw - w) / 2);
  const yOff = Math.floor((th - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = ((yOff + y) * tw + (xOff + x)) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

function stitchH(frames, fw, fh) {
  const n = frames.length;
  const out = Buffer.alloc(fw * n * fh * 4);
  for (let f = 0; f < n; f++) {
    for (let y = 0; y < fh; y++) {
      frames[f].copy(
        out,
        (y * fw * n + f * fw) * 4,
        y * fw * 4,
        (y + 1) * fw * 4
      );
    }
  }
  return { data: out, width: fw * n, height: fh };
}

async function saveRaw(buf, w, h, filePath) {
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(filePath);
}

async function framesFromRects(data, sw, sh, rects, tight = true) {
  const keyed = rects.map((r) => {
    const buf = extractRect(data, sw, sh, r);
    if (!tight) return { buf, w: r.width, h: r.height, src: r };
    const box = contentBounds(buf, r.width, r.height, 2);
    return {
      buf: cropBuf(buf, r.width, r.height, box),
      w: box.width,
      h: box.height,
      src: r,
      tight: box,
    };
  });
  const fw = Math.max(...keyed.map((k) => k.w));
  const fh = Math.max(...keyed.map((k) => k.h));
  const frames = keyed.map((k) => padTo(k.buf, k.w, k.h, fw, fh));
  return { frames, fw, fh, keyed };
}

async function writeStrip(name, frames, fw, fh, meta) {
  const sheet = stitchH(frames, fw, fh);
  const outPath = path.join(OUT, name);
  await saveRaw(sheet.data, sheet.width, sheet.height, outPath);
  const entry = {
    frameWidth: fw,
    frameHeight: fh,
    frameCount: frames.length,
    image: name,
    chroma: {
      samples: CHROMAS.map(([r, g, b]) => ({ r, g, b })),
      tolerance: TOL,
      preserveDarkNonBlue: true,
    },
    outputSize: { width: sheet.width, height: sheet.height },
    ...meta,
  };
  console.log(
    name,
    sheet.width + "x" + sheet.height,
    "fw=" + fw,
    "fh=" + fh,
    "count=" + frames.length
  );
  return entry;
}

async function writeSingle(name, data, sw, sh, rect, dir = OUT) {
  const buf = extractRect(data, sw, sh, rect);
  const box = contentBounds(buf, rect.width, rect.height, 2);
  const cropped = cropBuf(buf, rect.width, rect.height, box);
  const outPath = path.join(dir, name);
  await saveRaw(cropped, box.width, box.height, outPath);
  console.log(name, box.width + "x" + box.height, "from", JSON.stringify(rect));
  return { width: box.width, height: box.height, image: name, sourceRect: rect };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SKILLS, { recursive: true });

  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sw = info.width,
    sh = info.height;
  console.log("FULL_SIZE", sw, sh);
  console.log("CHROMA TOL", TOL, "preserveDarkNonBlue=true");

  const meta = {
    source: "assets/naruto-source/sasuke-sheet.png",
    sourceSize: { width: sw, height: sh },
  };

  // --- Standing Punch (left column): 4 vertical frames ---
  const punchRects = [
    { left: 48, top: 108, width: 58, height: 42 },
    { left: 48, top: 210, width: 58, height: 44 },
    { left: 48, top: 312, width: 58, height: 44 },
    { left: 48, top: 430, width: 58, height: 50 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(data, sw, sh, punchRects);
    meta["sasuke-idle-walk"] = await writeStrip(
      "sasuke-idle-walk.png",
      frames,
      fw,
      fh,
      { sourceRects: punchRects, note: "Standing Punch column (4 frames)" }
    );
    meta["sasuke-punch"] = await writeStrip(
      "sasuke-punch.png",
      frames,
      fw,
      fh,
      { sourceRects: punchRects, note: "Same as idle-walk / Standing Punch" }
    );
    await saveRaw(frames[0], fw, fh, path.join(OUT, "sasuke-idle-frame0.png"));
    console.log("sasuke-idle-frame0.png", fw + "x" + fh, "count=1");
    meta["sasuke-idle-frame0"] = {
      frameWidth: fw,
      frameHeight: fh,
      frameCount: 1,
      image: "sasuke-idle-frame0.png",
    };
  }

  // --- Kick (adjacent column): 4 frames ---
  const kickRects = [
    { left: 152, top: 108, width: 70, height: 42 },
    { left: 152, top: 210, width: 70, height: 42 },
    { left: 152, top: 312, width: 70, height: 42 },
    { left: 152, top: 430, width: 70, height: 48 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(data, sw, sh, kickRects);
    meta["sasuke-kick"] = await writeStrip("sasuke-kick.png", frames, fw, fh, {
      sourceRects: kickRects,
    });
  }

  // --- Chidori: charge(2) + large(1) + impacts(2) ---
  const chidoriRects = [
    { left: 265, top: 110, width: 70, height: 55 },
    { left: 338, top: 110, width: 65, height: 55 },
    { left: 268, top: 198, width: 145, height: 125 },
    { left: 268, top: 338, width: 145, height: 90 },
    { left: 268, top: 420, width: 145, height: 105 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(
      data,
      sw,
      sh,
      chidoriRects
    );
    meta["sasuke-chidori"] = await writeStrip(
      "sasuke-chidori.png",
      frames,
      fw,
      fh,
      {
        sourceRects: chidoriRects,
        sequence: ["charge", "charge", "large", "impact", "impact"],
      }
    );
  }

  // --- Fireball cast: 3 seals + 2 blow ---
  const fireballCastRects = [
    { left: 435, top: 112, width: 48, height: 58 },
    { left: 493, top: 112, width: 55, height: 58 },
    { left: 560, top: 112, width: 58, height: 58 },
    { left: 448, top: 268, width: 58, height: 55 },
    { left: 442, top: 375, width: 60, height: 55 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(
      data,
      sw,
      sh,
      fireballCastRects
    );
    meta["sasuke-fireball-cast"] = await writeStrip(
      "sasuke-fireball-cast.png",
      frames,
      fw,
      fh,
      {
        sourceRects: fireballCastRects,
        sequence: ["seal", "seal", "seal", "blow", "blow"],
      }
    );
  }

  // --- Fireball FX: 2 orbs ---
  const fxRects = [
    { left: 492, top: 218, width: 135, height: 128 },
    { left: 495, top: 348, width: 132, height: 105 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(data, sw, sh, fxRects);
    meta["sasuke-fireball-fx"] = await writeStrip(
      "sasuke-fireball-fx.png",
      frames,
      fw,
      fh,
      { sourceRects: fxRects }
    );
    meta["fireball-fx-1"] = await writeSingle(
      "fireball-fx-1.png",
      data,
      sw,
      sh,
      fxRects[0]
    );
    meta["fireball-fx-2"] = await writeSingle(
      "fireball-fx-2.png",
      data,
      sw,
      sh,
      fxRects[1]
    );
  }

  // --- Kirin cast ---
  const kirinCastRects = [
    { left: 650, top: 100, width: 70, height: 75 },
    { left: 728, top: 108, width: 58, height: 68 },
    { left: 808, top: 100, width: 70, height: 75 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(
      data,
      sw,
      sh,
      kirinCastRects
    );
    meta["sasuke-kirin-cast"] = await writeStrip(
      "sasuke-kirin-cast.png",
      frames,
      fw,
      fh,
      { sourceRects: kirinCastRects }
    );
  }

  meta["sasuke-kirin-dragon"] = await writeSingle(
    "sasuke-kirin-dragon.png",
    data,
    sw,
    sh,
    { left: 630, top: 190, width: 270, height: 170 }
  );
  meta["sasuke-kirin-impact"] = await writeSingle(
    "sasuke-kirin-impact.png",
    data,
    sw,
    sh,
    { left: 710, top: 348, width: 160, height: 90 }
  );

  // --- Amaterasu cast ---
  const amaCastRects = [
    { left: 920, top: 98, width: 75, height: 80 },
    { left: 468, top: 478, width: 42, height: 55 },
    { left: 532, top: 478, width: 48, height: 55 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(
      data,
      sw,
      sh,
      amaCastRects
    );
    meta["sasuke-amaterasu-cast"] = await writeStrip(
      "sasuke-amaterasu-cast.png",
      frames,
      fw,
      fh,
      { sourceRects: amaCastRects }
    );
  }

  const amaFxRects = [
    { left: 650, top: 478, width: 48, height: 58 },
    { left: 700, top: 478, width: 58, height: 60 },
    { left: 755, top: 478, width: 60, height: 60 },
  ];
  {
    const { frames, fw, fh } = await framesFromRects(data, sw, sh, amaFxRects);
    meta["sasuke-amaterasu-fx"] = await writeStrip(
      "sasuke-amaterasu-fx.png",
      frames,
      fw,
      fh,
      { sourceRects: amaFxRects }
    );
  }

  meta["skill-chidori"] = await writeSingle(
    "sasuke-chidori.png",
    data,
    sw,
    sh,
    { left: 820, top: 472, width: 65, height: 65 },
    SKILLS
  );
  meta["skill-fireball"] = await writeSingle(
    "sasuke-fireball.png",
    data,
    sw,
    sh,
    { left: 875, top: 472, width: 65, height: 65 },
    SKILLS
  );
  meta["skill-amaterasu"] = await writeSingle(
    "sasuke-amaterasu.png",
    data,
    sw,
    sh,
    { left: 760, top: 475, width: 58, height: 60 },
    SKILLS
  );

  const metaPath = path.join(OUT, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log("\nWrote", metaPath);
  console.log("\n=== Frame metrics ===");
  for (const [k, v] of Object.entries(meta)) {
    if (v && v.frameWidth != null) {
      console.log(
        k + ":",
        "fw=" + v.frameWidth,
        "fh=" + v.frameHeight,
        "count=" + v.frameCount,
        "out=" +
          (v.outputSize
            ? v.outputSize.width + "x" + v.outputSize.height
            : "")
      );
    } else if (v && v.width != null) {
      console.log(k + ":", v.width + "x" + v.height);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
