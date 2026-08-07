/**
 * Gaara single hotbar jutsu — Sand Prison / Burial sequence.
 *
 * Sources: multi-cell green-screen sheets (Cursor assets) extracted in attachment
 * order as continuous animation cells → alpha-only strip.
 *
 * Input:  assets/naruto-source/nu/gaara/jutsu/frame_*.png  (written by import)
 * Output: public/sprites/player/gaara/sand-prison.png
 *
 * npm run gaara:jutsu
 *
 * Body idle/walk/combo are NOT touched.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CURSOR_ASSETS = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor',
  'projects',
  'c-Users-marlo-Projects-idle-mmorpg',
  'assets',
);
const SOURCE_SHEETS = [
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-a3f9f914-5827-4f4d-b567-de4cf2964477.png',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-447f1514-38c4-434d-bfb5-febd91a83bcc.png',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-fd3f2f55-c3e9-4b09-a3e7-c56f7420bd75.png',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-9aba1109-17f0-4b6a-8d1f-805be8bec925.png',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-0a6e41db-3b13-43b8-9893-f0701899cd19.png',
  'c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-63f2329e-de7c-49ee-940d-33b683132d6f.png',
];

const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'gaara', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gaara');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'gaara');
const OUT_NAME = 'sand-prison.png';
const TARGET_BODY_H = 48;
const FRAME_RATE = 11;
const PAD = 2;
const ALPHA_KEEP = 16;

/** Bright + dark green screens and teal grid lines. */
function isBg(r, g, b) {
  if (g >= 100 && g >= r + 45 && g >= b + 45) return true;
  if (g >= 40 && g <= 100 && g >= r + 18 && g >= b + 12 && r <= 55 && b <= 55) return true;
  if (g >= 50 && g <= 120 && Math.abs(r - b) < 20 && g > Math.max(r, b) + 15 && r < 80) {
    return true;
  }
  if (g >= 20 && g <= 90 && r <= 40 && b <= 40 && g >= r + 8 && g >= b + 5) return true;
  // teal / cyan grid
  if (g >= 60 && b >= 40 && r <= 80 && g >= r + 12 && (g >= b - 10 || b >= g - 25)) {
    if (Math.min(r, b) <= 90 && g >= 55) return true;
  }
  return false;
}

function isChromaGreen(r, g, b) {
  if (g >= 90 && g >= r + 40 && g >= b + 40 && r <= 70 && b <= 70) return true;
  if (g >= 50 && g >= r + 28 && g >= b + 28 && r <= 90 && b <= 90) return true;
  if (g >= 28 && g - Math.max(r, b) >= 14 && r <= 100 && b <= 95) return true;
  return false;
}

function isRedHair(r, g, b) {
  return r >= 80 && r >= g + 20 && r >= b + 12 && r <= 220;
}

function isSandVfx(r, g, b) {
  // tan/beige sand particles & mound (not skin: skin is pinker / higher)
  if (r < 90 || g < 60 || b > 160) return false;
  if (r >= g - 5 && g >= b - 8 && Math.abs(r - g) < 70 && r >= b + 8) return true;
  if (r >= 140 && g >= 110 && b >= 60 && b <= 150 && r >= b + 15) return true;
  return false;
}

function isSkin(r, g, b) {
  return r > 150 && g > 95 && b > 70 && r > g && g >= b - 5 && r - b > 30 && r < 240;
}

function contentRuns(frac, thr, minLen = 12) {
  const runs = [];
  let s = -1;
  for (let i = 0; i <= frac.length; i += 1) {
    const ok = i < frac.length && frac[i] >= thr;
    if (ok && s < 0) s = i;
    if (!ok && s >= 0) {
      if (i - s >= minLen) runs.push([s, i]);
      s = -1;
    }
  }
  return runs;
}

function mergeRuns(runs, gap = 8) {
  if (!runs.length) return [];
  const m = [[...runs[0]]];
  for (let i = 1; i < runs.length; i += 1) {
    const last = m[m.length - 1];
    if (runs[i][0] - last[1] <= gap) last[1] = runs[i][1];
    else m.push([...runs[i]]);
  }
  return m;
}

function fingerprint(frame, w, h) {
  // downsampled signature for near-duplicate skip
  let sum = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor(w / 24));
  const stepY = Math.max(1, Math.floor(h / 24));
  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      sum = (sum * 33 + frame[i] + frame[i + 1] * 3 + frame[i + 2] * 7 + x * 11 + y * 13) >>> 0;
      n += 1;
    }
  }
  return `${w}x${h}:${n}:${sum}`;
}

function similarity(a, b, wa, ha, wb, hb) {
  if (!a || !b) return 0;
  if (Math.abs(wa - wb) > 12 || Math.abs(ha - hb) > 12) return 0;
  const w = Math.min(wa, wb);
  const h = Math.min(ha, hb);
  let match = 0;
  let tot = 0;
  const step = 3;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const ia = (y * wa + x) * 4;
      const ib = (y * wb + x) * 4;
      const aa = a[ia + 3] >= ALPHA_KEEP;
      const ab = b[ib + 3] >= ALPHA_KEEP;
      if (!aa && !ab) continue;
      tot += 1;
      if (aa && ab) {
        if (
          Math.abs(a[ia] - b[ib]) < 28 &&
          Math.abs(a[ia + 1] - b[ib + 1]) < 28 &&
          Math.abs(a[ia + 2] - b[ib + 2]) < 28
        ) {
          match += 1;
        }
      }
    }
  }
  return tot ? match / tot : 0;
}

/** Extract char+sand cells from one multi-frame green sheet via green grid gulfs. */
async function extractSheetCells(sheetPath) {
  const { data, info } = await sharp(sheetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const p = i * 4;
    if (!isBg(data[p], data[p + 1], data[p + 2])) mask[i] = 1;
  }

  const colFrac = new Array(w).fill(0);
  for (let x = 0; x < w; x += 1) {
    let c = 0;
    for (let y = 0; y < h; y += 1) if (mask[y * w + x]) c += 1;
    colFrac[x] = c / h;
  }
  const rowFrac = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    let c = 0;
    for (let x = 0; x < w; x += 1) if (mask[y * w + x]) c += 1;
    rowFrac[y] = c / w;
  }

  // Major green gulfs: near-empty columns/rows that span the full axis → grid lines
  function gulfCenters(frac, thr, minGap = 8) {
    const gulfs = [];
    let s = -1;
    for (let i = 0; i <= frac.length; i += 1) {
      const empty = i >= frac.length || frac[i] < thr;
      if (empty && s < 0) s = i;
      if (!empty && s >= 0) {
        if (i - s >= minGap) gulfs.push(Math.floor((s + i - 1) / 2));
        s = -1;
      }
    }
    return gulfs;
  }

  // Content spans between gulfs (ignore edge padding gulfs)
  function spansBetweenGulfs(size, gulfs) {
    const cuts = [0, ...gulfs, size];
    const spans = [];
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a < 40) continue;
      spans.push([a, b]);
    }
    return spans;
  }

  // Column content thr low so thin character still counts; gulf thr very low
  const vGulfs = gulfCenters(colFrac, 0.012, 10).filter((x) => x > 30 && x < w - 30);
  const hGulfs = gulfCenters(rowFrac, 0.012, 8).filter((y) => y > 20 && y < h - 20);

  let colSpans = spansBetweenGulfs(w, vGulfs);
  let rowSpans = spansBetweenGulfs(h, hGulfs);

  // Fallback: density content-runs with pairing when gulf detection is weak
  if (colSpans.length < 2) {
    const cols = mergeRuns(contentRuns(colFrac, 0.03, 14), 18);
    if (cols.length === 4) {
      colSpans = [
        [cols[0][0], cols[1][1]],
        [cols[2][0], cols[3][1]],
      ];
    } else if (cols.length >= 2) {
      colSpans = [];
      for (let i = 0; i + 1 < cols.length; i += 2) {
        colSpans.push([cols[i][0], cols[i + 1][1]]);
      }
    }
  } else if (colSpans.length === 4) {
    // character + sand split by green → re-pair
    colSpans = [
      [colSpans[0][0], colSpans[1][1]],
      [colSpans[2][0], colSpans[3][1]],
    ];
  }

  // Horizontal: for 4 spans alternating sand/body, pair; else keep major rows
  if (rowSpans.length >= 4) {
    const paired = [];
    for (let i = 0; i + 1 < rowSpans.length; i += 2) {
      paired.push([rowSpans[i][0], rowSpans[i + 1][1]]);
    }
    // Accept pair if height looks like full cell (>=180)
    if (paired.every((r) => r[1] - r[0] >= 160)) {
      rowSpans = paired;
    } else {
      rowSpans = mergeRuns(
        rowSpans.map((r) => [r[0], r[1]]),
        55,
      ).filter((r) => r[1] - r[0] >= 140);
    }
  } else if (rowSpans.length === 0) {
    rowSpans = mergeRuns(contentRuns(rowFrac, 0.02, 12), 14).filter(
      (r) => r[1] - r[0] >= 80,
    );
  }

  // Trim rowSpans that are only labels (< 100px height after content)
  // but keep when sand-above+body merge already tall

  const cells = [];
  for (const [rt0, rb0] of rowSpans) {
    for (const [cl0, cr0] of colSpans) {
      // expand cell slightly then bbox opaque content
      const cl = Math.max(0, cl0);
      const cr = Math.min(w, cr0);
      const rt = Math.max(0, rt0);
      const rb = Math.min(h, rb0);
      const cw = cr - cl;
      const ch = rb - rt;
      if (cw < 40 || ch < 40) continue;

      let minX = cw;
      let maxX = -1;
      let minY = ch;
      let maxY = -1;
      const cell = Buffer.alloc(cw * ch * 4);
      let hair = 0;
      let sand = 0;
      let opaque = 0;
      let black = 0;
      for (let y = 0; y < ch; y += 1) {
        for (let x = 0; x < cw; x += 1) {
          const sx = cl + x;
          const sy = rt + y;
          if (!mask[sy * w + sx]) continue;
          const si = (sy * w + sx) * 4;
          const di = (y * cw + x) * 4;
          const r = data[si];
          const g = data[si + 1];
          const b = data[si + 2];
          if (isChromaGreen(r, g, b)) continue;
          cell[di] = r;
          cell[di + 1] = g;
          cell[di + 2] = b;
          cell[di + 3] = 255;
          opaque += 1;
          if (isRedHair(r, g, b)) hair += 1;
          if (isSandVfx(r, g, b)) sand += 1;
          if (r <= 12 && g <= 12 && b <= 12) black += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0 || opaque < 200) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (bh < 80 || bw < 50) continue;
      if (sand < 80) continue;
      if (black < 40 || hair < 30) continue;

      const frame = Buffer.alloc(bw * bh * 4);
      for (let y = 0; y < bh; y += 1) {
        for (let x = 0; x < bw; x += 1) {
          const si = ((minY + y) * cw + (minX + x)) * 4;
          const di = (y * bw + x) * 4;
          frame[di] = cell[si];
          frame[di + 1] = cell[si + 1];
          frame[di + 2] = cell[si + 2];
          frame[di + 3] = cell[si + 3];
        }
      }
      cells.push({ frame, width: bw, height: bh, hair, sand, opaque, black });
    }
  }
  return cells;
}

/** Body height: use left ~35% of early frames (Gaara body, not sand mound). */
function bodyContentHeight(frame, w, h) {
  const xMax = Math.max(24, Math.floor(w * 0.38));
  let minY = h;
  let maxY = -1;
  let bodyPx = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      // skip pure distant sand when sampling left (still sand can be skin-ish)
      if (isSandVfx(r, g, b) && !isSkin(r, g, b) && !isRedHair(r, g, b)) {
        // allow if close to known body column — sand gourd is on back (tan)
        if (x > xMax * 0.55) continue;
      }
      bodyPx += 1;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY < 0 || bodyPx < 40) {
    // fallback: full bbox height
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxY < 0) return h;
  return Math.max(1, maxY - minY + 1);
}

/** Find Gaara feet anchor: lowest opaque pixel in left body column. */
function bodyAnchor(frame, w, h) {
  const xMax = Math.max(28, Math.floor(w * 0.4));
  let minX = xMax;
  let maxX = -1;
  let maxY = -1;
  let minY = h;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < xMax; x += 1) {
      const i = (y * w + x) * 4;
      if (frame[i + 3] < ALPHA_KEEP) continue;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      if (isSandVfx(r, g, b) && !isRedHair(r, g, b) && !isSkin(r, g, b) && x > 20) {
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
    }
  }
  if (maxX < 0) {
    // whole-frame bbox
    minX = w;
    maxX = -1;
    minY = h;
    maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    footX: minX,
    footY: maxY,
    bodyTop: minY,
    bodyH: Math.max(1, maxY - minY + 1),
  };
}

/**
 * Normalize: floor-align body feet + left-align body so sand VFX can grow
 * without shifting Gaara.
 */
function normalizeAnchored(frames, widths, heights) {
  const anchors = frames.map((f, i) => bodyAnchor(f, widths[i], heights[i]));
  // estimated cell size: max reach to the right of feet + above feet
  let maxRight = 0;
  let maxUp = 0;
  let maxDown = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const a = anchors[i];
    const w = widths[i];
    const h = heights[i];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frames[i][(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        maxRight = Math.max(maxRight, x - a.footX);
        maxUp = Math.max(maxUp, a.footY - y);
        maxDown = Math.max(maxDown, y - a.footY);
      }
    }
  }
  // also room left of feet (gourd back)
  let maxLeft = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const a = anchors[i];
    const w = widths[i];
    const h = heights[i];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (frames[i][(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        maxLeft = Math.max(maxLeft, a.footX - x);
      }
    }
  }

  const fw = maxLeft + maxRight + 1 + PAD * 2;
  const fh = maxUp + maxDown + 1 + PAD * 2;
  const destFootX = PAD + maxLeft;
  const destFootY = PAD + maxUp;

  const bodyHs = anchors
    .map((a) => a.bodyH)
    .filter((bh) => bh >= 30 && bh <= 200)
    .sort((a, b) => a - b);
  const contentH =
    bodyHs[Math.floor(bodyHs.length / 2)] ||
    anchors[0].bodyH ||
    TARGET_BODY_H;

  const out = frames.map((frame, index) => {
    const a = anchors[index];
    const srcW = widths[index];
    const srcH = heights[index];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = destFootX - a.footX;
    const dy = destFootY - a.footY;
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

  return { frames: out, frameWidth: fw, frameHeight: fh, contentHeight: contentH };
}

async function scaleFrames(frames, fw, fh, contentHeight) {
  const scale = Math.min(1, TARGET_BODY_H / Math.max(1, contentHeight));
  const outW = Math.max(1, Math.round(fw * scale));
  const outH = Math.max(1, Math.round(fh * scale));
  const outContent = Math.max(1, Math.round(contentHeight * scale));
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
        continue;
      }
      data[i + 3] = 255;
      if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
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

function qaSheet(sheetData, sheetW, fh, fw, n) {
  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let red = 0;
  let sand = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let hair = 0;
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
        if (r <= 12 && g <= 12 && b <= 12) pureBlack += 1;
        if (isRedHair(r, g, b)) {
          red += 1;
          hair += 1;
        }
        if (isSandVfx(r, g, b)) sand += 1;
        if (y > maxFoot) maxFoot = y;
      }
    }
    if (pix < 40) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (hair < 20) {
      throw new Error(`Frame ${f} missing Gaara hair (${hair} red px) — body flaw`);
    }
    footY.push(maxFoot);
  }
  const feet = footY.filter((y) => y >= 0);
  return {
    residualGreen,
    opaque,
    pureBlack,
    red,
    sand,
    footSpread: feet.length ? Math.max(...feet) - Math.min(...feet) : 0,
  };
}

function updateMeta(key, entry) {
  let meta = {};
  if (fs.existsSync(META_JSON)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    } catch {
      meta = {};
    }
  }
  meta[key] = entry;
  // drop retired skill keys
  delete meta['gaara-sand-slash'];
  delete meta['skill-sand-slash'];
  delete meta['gaara-sand-coffin'];
  delete meta['skill-sand-coffin'];
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`);
}

async function importSources() {
  fs.mkdirSync(INPUT_DIR, { recursive: true });
  // clear previous frames
  for (const f of fs.readdirSync(INPUT_DIR)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(INPUT_DIR, f));
  }

  const all = [];
  for (let si = 0; si < SOURCE_SHEETS.length; si += 1) {
    const full = path.join(CURSOR_ASSETS, SOURCE_SHEETS[si]);
    if (!fs.existsSync(full)) {
      throw new Error(`Missing source sheet ${si + 1}: ${full}`);
    }
    const cells = await extractSheetCells(full);
    console.log(`source ${si + 1}: ${cells.length} cells from ${path.basename(full)}`);
    for (const c of cells) {
      // skip near-duplicates of previous frame
      const prev = all[all.length - 1];
      if (prev) {
        const sim = similarity(
          prev.frame,
          c.frame,
          prev.width,
          prev.height,
          c.width,
          c.height,
        );
        if (sim >= 0.92) {
          console.log(`  skip near-dup of prev (sim=${sim.toFixed(3)})`);
          continue;
        }
      }
      all.push(c);
    }
  }

  if (all.length < 4) throw new Error(`Too few frames extracted: ${all.length}`);

  // write frame_001..N
  for (let i = 0; i < all.length; i += 1) {
    const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
    await sharp(all[i].frame, {
      raw: { width: all[i].width, height: all[i].height, channels: 4 },
    })
      .png()
      .toFile(path.join(INPUT_DIR, name));
  }
  console.log(`imported ${all.length} frames → ${INPUT_DIR}`);
  return all;
}

async function loadFrames() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => /^frame_\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = +(a.match(/frame_(\d+)/i) || [])[1] || 0;
      const nb = +(b.match(/frame_(\d+)/i) || [])[1] || 0;
      return na - nb;
    });
  const frames = [];
  for (const file of files) {
    const { data, info } = await sharp(path.join(INPUT_DIR, file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // scrub any residual chroma green
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < ALPHA_KEEP) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }
      if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }
      data[i + 3] = 255;
    }
    frames.push({ file, data, width: info.width, height: info.height });
  }
  return frames;
}

async function writeQa(sheet, scaled) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(QA_DIR, 'sand-prison-full.png'));

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
    .toFile(path.join(QA_DIR, 'sand-prison-magenta.png'));

  const samples = [
    0,
    Math.floor(scaled.frames.length * 0.25),
    Math.floor(scaled.frames.length * 0.5),
    Math.floor(scaled.frames.length * 0.75),
    scaled.frames.length - 1,
  ];
  for (const fi of [...new Set(samples)]) {
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
      raw: {
        width: scaled.frameWidth,
        height: scaled.frameHeight,
        channels: 4,
      },
    })
      .resize(scaled.frameWidth * 3, scaled.frameHeight * 3, {
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toFile(path.join(QA_DIR, `sand-prison-f${fi}-x3.png`));
  }
}

async function main() {
  await importSources();
  const loaded = await loadFrames();
  console.log(`loaded ${loaded.length} source frames`);

  const norm = normalizeAnchored(
    loaded.map((f) => f.data),
    loaded.map((f) => f.width),
    loaded.map((f) => f.height),
  );
  console.log(
    `normalize fw=${norm.frameWidth} fh=${norm.frameHeight} contentH=${norm.contentHeight}`,
  );

  const scaled = await scaleFrames(
    norm.frames,
    norm.frameWidth,
    norm.frameHeight,
    norm.contentHeight,
  );
  const sheet = stitch(scaled.frames, scaled.frameWidth, scaled.frameHeight);
  const qa = qaSheet(
    sheet.data,
    sheet.width,
    scaled.frameHeight,
    scaled.frameWidth,
    scaled.frames.length,
  );
  console.log(
    `QA residualGreen=${qa.residualGreen} opaque=${qa.opaque} pureBlack=${qa.pureBlack} red=${qa.red} sand=${qa.sand} footSpread=${qa.footSpread}`,
  );

  if (qa.residualGreen > 0) {
    throw new Error(`residualGreen=${qa.residualGreen} — not clean`);
  }
  if (qa.footSpread > 6) {
    throw new Error(`footSpread=${qa.footSpread} too high (body jitter)`);
  }
  if (qa.red < 20) throw new Error(`red hair nearly gone (${qa.red})`);
  if (qa.sand < 200) throw new Error(`sand VFX too thin (${qa.sand})`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(sheet.data, {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  })
    .png()
    .toFile(path.join(OUT_DIR, OUT_NAME));

  await writeQa(sheet, scaled);

  const durationMs = Math.round((scaled.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(durationMs * 0.72);
  const entry = {
    image: `/sprites/player/gaara/${OUT_NAME}`,
    frameWidth: scaled.frameWidth,
    frameHeight: scaled.frameHeight,
    frameCount: scaled.frames.length,
    contentHeight: scaled.contentHeight,
    source: 'assets/naruto-source/nu/gaara/jutsu/frame_001..N.png',
    frameRate: FRAME_RATE,
    scale: scaled.scale,
    durationMs,
    hitDelayMs,
    note: 'Gaara sole jutsu — Sabaku Kyū / sand prison rising → seal → shatter',
  };
  updateMeta('gaara-sand-prison', entry);
  updateMeta('skill-sand-prison', entry);

  // retire old sprite files from pack usage (keep on disk optional — remove for cleanliness)
  for (const old of ['sand-slash.png', 'sand-coffin.png']) {
    const p = path.join(OUT_DIR, old);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`removed retired ${old}`);
    }
  }

  console.log(
    `-> ${OUT_NAME} n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} contentH=${entry.contentHeight} durationMs=${durationMs} hitDelayMs=${hitDelayMs}`,
  );
  console.log(`meta written; residualGreen=0 OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
