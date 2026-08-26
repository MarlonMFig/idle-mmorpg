/**
 * Shikamaru Nara (NUN5 MUGEN G6_Shikamaru) → public/sprites/player/shikamaru
 * HQ nativo, sem pixelização forçada.
 *
 * Fontes: .../chars/G6_Shikamaru/Shikamaru.sff|.air
 *
 * Kunai Explosiva = Bakushiki Shojin 1200 (corpo) + FX 1260 (9007) + fogo 1270 (9026).
 *
 * Uso: node scripts/process-shikamaru-g6.js
 */
const fs = require('fs');
const path = require('path');
const { packMugenCharacter } = require('./lib/mugen-hq-char');
const { openAnySff } = require('./lib/sff-open');
const { parseAir, collapse } = require('./lib/mugen-air');
const {
  stitch,
  writePng,
  updateMeta,
  ALPHA_KEEP,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const NUN5 = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'Naruto Shippuden Ultimate Ninja 5 MUGEN',
  'chars',
  'G6_Shikamaru',
);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nun5', 'shikamaru');
/** 8fps — leitura clara do cast + explosão. */
const FRAME_RATE = 8;

function readAir(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
  else if (buf[0] === 0xfe && buf[1] === 0xff) {
    text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) text = buf.toString('latin1');
  }
  return parseAir(text);
}

function actionRefs(air, id, { dropLoopHold = false } = {}) {
  const act = air.get(id);
  if (!act) return [];
  let frames = collapse(act.frames);
  if (dropLoopHold && frames.length > 2) {
    const last = frames[frames.length - 1];
    if ((last.ticks || 0) >= 40) frames = frames.slice(0, -1);
  }
  return frames;
}

async function getSprite(sff, group, number) {
  const spr = await sff.get(group, number);
  if (!spr || !spr.rgba) throw new Error(`missing sprite ${group},${number}`);
  return spr;
}

function bbox(rgba, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rgba[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function bottomContact(rgba, w, h) {
  const box = bbox(rgba, w, h);
  if (!box) throw new Error('empty sprite');
  let sum = 0;
  let n = 0;
  for (let y = Math.max(box.minY, box.maxY - 1); y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (rgba[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
      sum += x;
      n += 1;
    }
  }
  return { feetY: box.maxY, contactX: n ? sum / n : (box.minX + box.maxX) / 2, box };
}

/** Chroma screen green only (lime puro) — NÃO o colete verde do Shikamaru. */
function isChromaGreen(r, g, b) {
  return g >= 200 && r <= 45 && b <= 45 && g >= r + 100 && g >= b + 100;
}

function assertClean(frames, fw, fh, label, { lockFeet = true } = {}) {
  const xs = [];
  const ys = [];
  let green = 0;
  for (const fr of frames) {
    const c = bottomContact(fr, fw, fh);
    xs.push(Math.round(c.contactX));
    ys.push(c.feetY);
    for (let p = 0; p < fw * fh; p += 1) {
      const o = p * 4;
      if (fr[o + 3] < 16) continue;
      if (isChromaGreen(fr[o], fr[o + 1], fr[o + 2])) green += 1;
    }
  }
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  if (lockFeet && ySpread > 0) throw new Error(`${label} feetY not locked (Δ${ySpread})`);
  if (lockFeet && xSpread > 1) throw new Error(`${label} contactX not locked (Δ${xSpread})`);
  if (green > 0) throw new Error(`${label} green fringe ${green}px`);
  return { xSpread, ySpread };
}

function packNativeFeetLocked(sprites) {
  const metas = sprites.map((s) => bottomContact(s.rgba, s.width, s.height));
  let maxLeft = 0;
  let maxRight = 0;
  let maxAbove = 0;
  let maxBelow = 0;
  for (let i = 0; i < sprites.length; i += 1) {
    const m = metas[i];
    maxLeft = Math.max(maxLeft, m.contactX - m.box.minX);
    maxRight = Math.max(maxRight, m.box.maxX - m.contactX);
    maxAbove = Math.max(maxAbove, m.feetY - m.box.minY);
    maxBelow = Math.max(maxBelow, m.box.maxY - m.feetY);
  }
  const pad = 2;
  const fw = pad + Math.ceil(maxLeft) + Math.ceil(maxRight) + pad;
  const fh = pad + Math.ceil(maxAbove) + Math.ceil(maxBelow) + pad;
  const anchorX = pad + Math.ceil(maxLeft);
  const anchorY = pad + Math.ceil(maxAbove);
  const frames = sprites.map((s, i) => {
    const m = metas[i];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = Math.round(anchorX - m.contactX);
    const dy = Math.round(anchorY - m.feetY);
    for (let y = 0; y < s.height; y += 1) {
      const ty = dy + y;
      if (ty < 0 || ty >= fh) continue;
      for (let x = 0; x < s.width; x += 1) {
        const tx = dx + x;
        if (tx < 0 || tx >= fw) continue;
        const si = (y * s.width + x) * 4;
        if (s.rgba[si + 3] < ALPHA_KEEP) continue;
        const di = (ty * fw + tx) * 4;
        canvas[di] = s.rgba[si];
        canvas[di + 1] = s.rgba[si + 1];
        canvas[di + 2] = s.rgba[si + 2];
        canvas[di + 3] = s.rgba[si + 3];
      }
    }
    return canvas;
  });

  const qa = assertClean(frames, fw, fh, 'feet-locked');
  const stand = bbox(frames[0], fw, fh);
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: stand ? stand.height : fh,
    originX: Number((anchorX / fw).toFixed(4)),
    ...qa,
  };
}

function packFxCentered(sprites, { pad = 2 } = {}) {
  const boxes = sprites.map((s) => bbox(s.rgba, s.width, s.height));
  const fw = pad * 2 + Math.max(...boxes.map((b) => b.width));
  const fh = pad * 2 + Math.max(...boxes.map((b) => b.height));
  const frames = sprites.map((s, i) => {
    const b = boxes[i];
    const canvas = Buffer.alloc(fw * fh * 4);
    const dx = Math.round((fw - b.width) / 2) - b.minX;
    const dy = Math.round((fh - b.height) / 2) - b.minY;
    for (let y = 0; y < s.height; y += 1) {
      const ty = dy + y;
      if (ty < 0 || ty >= fh) continue;
      for (let x = 0; x < s.width; x += 1) {
        const tx = dx + x;
        if (tx < 0 || tx >= fw) continue;
        const si = (y * s.width + x) * 4;
        if (s.rgba[si + 3] < ALPHA_KEEP) continue;
        const di = (ty * fw + tx) * 4;
        canvas[di] = s.rgba[si];
        canvas[di + 1] = s.rgba[si + 1];
        canvas[di + 2] = s.rgba[si + 2];
        canvas[di + 3] = s.rgba[si + 3];
      }
    }
    return canvas;
  });
  assertClean(frames, fw, fh, 'fx', { lockFeet: false });
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight: Math.max(...boxes.map((b) => b.height)),
    originX: 0.5,
  };
}

async function loadRefs(sff, refs, { minOpaque = 20, maxDim = 280 } = {}) {
  const sprites = [];
  for (const ref of refs) {
    if (ref.group < 0) continue;
    let spr;
    try {
      spr = await getSprite(sff, ref.group, ref.number);
    } catch {
      continue;
    }
    if (spr.width > maxDim || spr.height > maxDim) continue;
    let opaque = 0;
    for (let i = 3; i < spr.rgba.length; i += 4) if (spr.rgba[i] >= ALPHA_KEEP) opaque += 1;
    if (opaque < minOpaque) continue;
    sprites.push({
      rgba: spr.rgba,
      width: spr.width,
      height: spr.height,
      key: `${ref.group},${ref.number}`,
      ticks: ref.ticks || 4,
    });
  }
  return sprites;
}

function expandByTicks(sprites, fps = FRAME_RATE, pace = 2) {
  const out = [];
  for (const s of sprites) {
    const ticks = Math.max(1, s.ticks || 4);
    const n = Math.max(1, Math.round((ticks * fps * pace) / 60));
    for (let i = 0; i < n; i += 1) out.push(s);
  }
  return out;
}

async function writeSkillSheet(fileBase, packed, metaExtra) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SRC, { recursive: true });
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  await writePng(path.join(OUT, `${fileBase}.png`), sheet.data, sheet.width, sheet.height);
  const durationMs =
    metaExtra.durationMs != null
      ? metaExtra.durationMs
      : Math.round((packed.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs =
    metaExtra.hitDelayMs != null
      ? metaExtra.hitDelayMs
      : Math.round(((packed.frames.length - 2) / FRAME_RATE) * 1000);
  const entry = {
    image: `/sprites/player/shikamaru/${fileBase}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    originX: packed.originX,
    frameRate: FRAME_RATE,
    durationMs,
    hitDelayMs,
    scale: 1,
    nativePixels: true,
    ...metaExtra,
    durationMs,
    hitDelayMs,
    frameRate: FRAME_RATE,
  };
  updateMeta(path.join(OUT, 'meta.json'), `shikamaru-${fileBase}`, entry);
  console.log(
    `${fileBase} ${entry.frameCount}f ${entry.frameWidth}x${entry.frameHeight} ${entry.durationMs}ms @${FRAME_RATE}fps`,
  );
  return entry;
}

/** Bakushiki Shojin → Kunai Explosiva (corpo + FX explosão). */
async function buildExplosionKunai(sff, air) {
  // Corpo: cast 1200 (pula hold longo do idle 6,1 se ticks>=40)
  const bodyRefs = actionRefs(air, 1200, { dropLoopHold: true }).filter(
    (r) => r.group < 9000 && r.group !== 6,
  );
  // Se ficou curto, inclui pose 6,1 uma vez no início.
  const startHold = actionRefs(air, 1200).filter((r) => r.group === 6).slice(0, 1);
  const rawBody = await loadRefs(sff, [...startHold, ...bodyRefs]);
  if (rawBody.length < 3) throw new Error(`explosion-kunai body: ${rawBody.length}`);
  // Holds manuais para cast legível
  const bodySprites = expandByTicks(
    rawBody.map((s, i) => ({
      ...s,
      ticks: i === 0 ? 12 : Math.max(s.ticks || 4, 6),
    })),
    FRAME_RATE,
    2,
  );
  const bodyPacked = packNativeFeetLocked(bodySprites);
  const hitAt = Math.min(
    bodyPacked.frames.length - 1,
    Math.max(3, Math.floor(bodyPacked.frames.length * 0.55)),
  );
  const bodyEntry = await writeSkillSheet('explosion-kunai', bodyPacked, {
    feetFixed: true,
    hitDelayMs: Math.round((hitAt / FRAME_RATE) * 1000),
    source: 'G6_Shikamaru Bakushiki Shojin 1200',
    note: 'Kunai Explosiva corpo HQ @8fps',
  });

  // FX: explosão 9007,144–152 + fogo 9026,*
  const fxRefs = [
    ...actionRefs(air, 1260).filter((r) => r.group === 9007 && r.number <= 152),
    ...actionRefs(air, 1270).filter((r) => r.group === 9026),
  ];
  const fxRaw = await loadRefs(sff, fxRefs, { maxDim: 200 });
  if (fxRaw.length < 4) throw new Error(`explosion-kunai fx: ${fxRaw.length}`);
  const fxSprites = expandByTicks(
    fxRaw.map((s) => ({ ...s, ticks: Math.max(s.ticks || 3, 4) })),
    FRAME_RATE,
    1.75,
  );
  const fxPacked = packFxCentered(fxSprites);
  const fxEntry = await writeSkillSheet('explosion-kunai-fx', fxPacked, {
    hitDelayMs: 0,
    source: 'G6_Shikamaru 1260/1270 (9007+9026)',
    note: 'Kunai Explosiva VFX explosão+fogo HQ',
  });
  return { body: bodyEntry, fx: fxEntry };
}

async function main() {
  if (!fs.existsSync(path.join(NUN5, 'Shikamaru.sff'))) {
    throw new Error(`G6_Shikamaru não encontrado: ${NUN5}`);
  }

  const wire = await packMugenCharacter({
    id: 'shikamaru',
    name: 'Shikamaru Nara (G6)',
    lookType: 1426,
    charDir: NUN5,
    sffRel: 'Shikamaru.sff',
    airRel: 'Shikamaru.air',
    srcRoot: 'assets/naruto-source/nun5',
    sameRipZoom: true,
    matchWalkHeight: false,
    idleActionId: 0,
    comboActionIds: [200, 210, 220],
    specialIds: [99999],
    hurtIds: [5000, 5010, 5030],
    deathIds: [5080, 5070, 5120],
  });

  const sff = openAnySff(path.join(NUN5, 'Shikamaru.sff'));
  const air = readAir(path.join(NUN5, 'Shikamaru.air'));
  const kunai = await buildExplosionKunai(sff, air);

  const contentHeight = wire.contentHeight || kunai.body.contentHeight;
  kunai.body.contentHeight = contentHeight;
  updateMeta(path.join(OUT, 'meta.json'), 'shikamaru-explosion-kunai', kunai.body);

  // Limpa restos de runs antigos / specials vazios
  for (const stale of ['special1', 'special2', 'special3', 'special4', 'attack', 'jutsu']) {
    const p = path.join(OUT, `${stale}.png`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const metaPath = path.join(OUT, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  for (const k of Object.keys(meta)) {
    if (/shikamaru-special|shikamaru-attack|shikamaru-jutsu$/.test(k)) delete meta[k];
  }
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  const wirePath = path.join(OUT, 'wire.json');
  const full = JSON.parse(fs.readFileSync(wirePath, 'utf8'));
  full.contentHeight = contentHeight;
  full.skills = [
    {
      skillId: 'skill-explosion-kunai',
      skillName: 'Kunai Explosiva',
      file: 'explosion-kunai',
      entry: kunai.body,
      fx: kunai.fx,
      index: 0,
    },
  ];
  fs.writeFileSync(wirePath, `${JSON.stringify(full, null, 2)}\n`);

  console.log('\nOK shikamaru G6 HQ');
  console.log(
    JSON.stringify(
      {
        contentHeight,
        idle: full.idle && {
          fw: full.idle.frameWidth,
          fh: full.idle.frameHeight,
          n: full.idle.frameCount,
          ox: full.idle.originX,
        },
        walk: full.walk && {
          fw: full.walk.frameWidth,
          fh: full.walk.frameHeight,
          n: full.walk.frameCount,
        },
        combo: (full.combo || []).map((c) => ({
          fw: c.frameWidth,
          fh: c.frameHeight,
          n: c.frameCount,
        })),
        kunai: {
          fw: kunai.body.frameWidth,
          fh: kunai.body.frameHeight,
          n: kunai.body.frameCount,
          durationMs: kunai.body.durationMs,
          hitDelayMs: kunai.body.hitDelayMs,
          originX: kunai.body.originX,
          fx: {
            fw: kunai.fx.frameWidth,
            fh: kunai.fx.frameHeight,
            n: kunai.fx.frameCount,
          },
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
