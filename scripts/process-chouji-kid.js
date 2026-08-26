/**
 * Chouji Kid (NUN5 MUGEN) → public/sprites/player/chouji (HQ nativo, sem pixelização).
 *
 * Fontes:
 *   .../chars/Choji_Kid/ChojiAkimichi.sff|.air
 *
 * Skills (melhores VFX do pack):
 *   0 Nikudan Sensha     = Baika 3100+3105+3110+3120
 *   1 Chō Harite         = Hands Demoler 2200 (+ FX 1150,*)
 *   2 Baika Jishin       = Earthquake 1400 (+ FX 1200,* de 1455)
 *   3 Bubun Baika        = Defense Point 2500 + inflate 1100,*
 *
 * Uso: node scripts/process-chouji-kid.js
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
  'Choji_Kid',
);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'chouji');
const SRC = path.join(ROOT, 'assets', 'naruto-source', 'nun5', 'chouji');
const FRAME_RATE = 12;

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
      if (fr[o + 1] > fr[o] + 35 && fr[o + 1] > fr[o + 2] + 35 && fr[o + 1] > 90) green += 1;
    }
  }
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  if (lockFeet && ySpread > 0) throw new Error(`${label} feetY not locked (Δ${ySpread})`);
  if (lockFeet && xSpread > 1) throw new Error(`${label} contactX not locked (Δ${xSpread})`);
  if (green > 0) throw new Error(`${label} green fringe ${green}px`);
  return { xSpread, ySpread };
}

/** Pack frames on shared canvas, feet/contact locked, native pixels (scale=1). */
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
  const contentHeight = stand ? stand.height : fh;
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight,
    originX: Number((anchorX / fw).toFixed(4)),
    ...qa,
  };
}

/** Pack oversized VFX centered on canvas (no feet lock). */
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
  const contentHeight = Math.max(...boxes.map((b) => b.height));
  return {
    frames,
    frameWidth: fw,
    frameHeight: fh,
    contentHeight,
    originX: 0.5,
  };
}

async function loadRefs(sff, refs, { minOpaque = 20 } = {}) {
  const sprites = [];
  for (const ref of refs) {
    if (ref.group < 0) continue;
    const spr = await getSprite(sff, ref.group, ref.number);
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

/** Expand short clips with hold frames so duration feels playable (~12fps). */
function withHolds(sprites, minFrames) {
  if (sprites.length >= minFrames) return sprites;
  const out = [...sprites];
  const last = sprites[sprites.length - 1];
  while (out.length < minFrames) out.push({ ...last });
  return out;
}

async function writeSkillSheet(fileBase, packed, metaExtra) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SRC, { recursive: true });
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  await writePng(path.join(OUT, `${fileBase}.png`), sheet.data, sheet.width, sheet.height);
  const durationMs = Math.round((packed.frames.length / FRAME_RATE) * 1000);
  const hitDelayMs =
    metaExtra.hitDelayMs != null
      ? metaExtra.hitDelayMs
      : Math.round(((packed.frames.length - 2) / FRAME_RATE) * 1000);
  const entry = {
    image: `/sprites/player/chouji/${fileBase}.png`,
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
  };
  updateMeta(path.join(OUT, 'meta.json'), `chouji-${fileBase}`, entry);
  console.log(
    `${fileBase} ${entry.frameCount}f ${entry.frameWidth}x${entry.frameHeight} contentH=${entry.contentHeight}`,
  );
  return entry;
}

async function buildNikudan(sff, air) {
  const refs = [
    ...actionRefs(air, 3100),
    ...actionRefs(air, 3105, { dropLoopHold: true }),
    ...actionRefs(air, 3110),
    ...actionRefs(air, 3120),
  ];
  if (refs.length < 8) throw new Error(`nikudan refs curtos: ${refs.length}`);
  const sprites = await loadRefs(sff, refs);
  if (sprites.length < 8) throw new Error(`nikudan sprites: ${sprites.length}`);

  const packed = packNativeFeetLocked(sprites);
  const dashStartMs = Math.round((14 / FRAME_RATE) * 1000);
  const hitDelayMs = Math.round(((packed.frames.length - 3) / FRAME_RATE) * 1000);
  return writeSkillSheet('nikudan-sensha', packed, {
    dashStartMs,
    hitDelayMs,
    feetFixed: true,
    source: 'Choji_Kid Baika 3100+3105+3110+3120',
    note: 'Nikudan Sensha HQ nativo; contato com o chão fixo',
  });
}

/** Chō Harite — windup curto + VFX mãos gigantes (group 1150). */
async function buildChouHarite(sff, air) {
  // Só pose base (group 2); 201/1150 ficam no FX para não duplicar a mão.
  const bodyRefs = actionRefs(air, 2200).filter((r) => r.group < 100);
  let body = await loadRefs(sff, bodyRefs);
  body = withHolds(body, 6);
  const packed = packNativeFeetLocked(body);
  const bodyEntry = await writeSkillSheet('chou-harite', packed, {
    feetFixed: true,
    hitDelayMs: Math.round((4 / FRAME_RATE) * 1000),
    source: 'Choji_Kid Hands Demoler 2200 (pose)',
    note: 'Chō Harite corpo (HQ); FX mãos gigantes à parte',
  });

  const fxRefs = [];
  for (let n = 0; n <= 5; n += 1) fxRefs.push({ group: 1150, number: n, ticks: 4 });
  const fxSprites = await loadRefs(sff, fxRefs);
  if (fxSprites.length < 4) throw new Error(`chou-harite fx: ${fxSprites.length}`);
  const fxPacked = packFxCentered(fxSprites);
  const fxEntry = await writeSkillSheet('chou-harite-fx', fxPacked, {
    hitDelayMs: 0,
    source: 'Choji_Kid group 1150',
    note: 'Chō Harite VFX mãos/pernas gigantes',
  });
  return { body: bodyEntry, fx: fxEntry };
}

/**
 * Baika Jishin — Earthquake 1400 + hit 1455.
 * Group 1200 é o corpo inflado em bounce (não rachadura) → sheet único.
 */
async function buildBaikaJishin(sff, air) {
  const refs = [...actionRefs(air, 1400), ...actionRefs(air, 1455)];
  const body = await loadRefs(sff, refs);
  if (body.length < 12) throw new Error(`baika-jishin body: ${body.length}`);
  const packed = packNativeFeetLocked(body);
  // Hit quando a forma inflada / bounce começa (~fim do 1400).
  const hitDelayMs = Math.round((10 / FRAME_RATE) * 1000);
  const bodyEntry = await writeSkillSheet('baika-jishin', packed, {
    feetFixed: true,
    hitDelayMs,
    source: 'Choji_Kid Earthquake 1400+1455',
    note: 'Baika Jishin HQ (selo → expansão → bounce inflado)',
  });
  return { body: bodyEntry, fx: null };
}

/** Bubun Baika — Defense Point + bola inflada (group 1100). */
async function buildBubunBaika(sff, air) {
  const refs = [
    ...actionRefs(air, 2500),
    // Inflate spin (melhor VFX do Defense Point)
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ group: 1100, number: n, ticks: 4 })),
  ];
  const sprites = await loadRefs(sff, refs);
  if (sprites.length < 10) throw new Error(`bubun-baika sprites: ${sprites.length}`);
  const packed = packNativeFeetLocked(sprites);
  const hitDelayMs = Math.round((7 / FRAME_RATE) * 1000);
  const entry = await writeSkillSheet('bubun-baika', packed, {
    feetFixed: true,
    hitDelayMs,
    source: 'Choji_Kid Defense Point 2500 + inflate 1100',
    note: 'Bubun Baika no Jutsu HQ (selo → bola inflada)',
  });
  return { body: entry, fx: null };
}

async function main() {
  if (!fs.existsSync(path.join(NUN5, 'ChojiAkimichi.sff'))) {
    throw new Error(`Choji_Kid não encontrado: ${NUN5}`);
  }

  // Base locomotion/combo only — skills custom abaixo.
  const wire = await packMugenCharacter({
    id: 'chouji',
    name: 'Chouji Akimichi (Kid)',
    lookType: 9004,
    charDir: NUN5,
    sffRel: 'ChojiAkimichi.sff',
    airRel: 'ChojiAkimichi.air',
    srcRoot: 'assets/naruto-source/nun5',
    sameRipZoom: true,
    matchWalkHeight: true,
    comboActionIds: [200, 210, 300],
    specialIds: [99999],
    hurtIds: [5000, 5010, 5030],
    deathIds: [5080, 5110, 5150],
  });

  const sff = openAnySff(path.join(NUN5, 'ChojiAkimichi.sff'));
  const air = readAir(path.join(NUN5, 'ChojiAkimichi.air'));

  const nikudan = await buildNikudan(sff, air);
  const harite = await buildChouHarite(sff, air);
  const jishin = await buildBaikaJishin(sff, air);
  const bubun = await buildBubunBaika(sff, air);

  const contentHeight = wire.contentHeight || nikudan.contentHeight;
  for (const e of [nikudan, harite.body, jishin.body, bubun.body]) {
    e.contentHeight = contentHeight;
    updateMeta(path.join(OUT, 'meta.json'), `chouji-${e.image.split('/').pop().replace('.png', '')}`, e);
  }

  // Remove leftover auto specials / FX obsoleto de runs anteriores.
  for (const stale of [
    'special1',
    'special2',
    'special3',
    'special4',
    'attack',
    'baika-jishin-fx',
  ]) {
    const p = path.join(OUT, `${stale}.png`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const metaPath = path.join(OUT, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  for (const k of Object.keys(meta)) {
    if (/chouji-special|chouji-attack|chouji-baika-jishin-fx/.test(k)) delete meta[k];
  }
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  const wirePath = path.join(OUT, 'wire.json');
  const full = JSON.parse(fs.readFileSync(wirePath, 'utf8'));
  full.contentHeight = contentHeight;
  full.skills = [
    {
      skillId: 'skill-nikudan-sensha',
      skillName: 'Nikudan Sensha',
      file: 'nikudan-sensha',
      entry: nikudan,
      fx: null,
      index: 0,
    },
    {
      skillId: 'skill-chou-harite',
      skillName: 'Chō Harite',
      file: 'chou-harite',
      entry: harite.body,
      fx: harite.fx,
      index: 1,
    },
    {
      skillId: 'skill-baika-jishin',
      skillName: 'Baika Jishin',
      file: 'baika-jishin',
      entry: jishin.body,
      fx: jishin.fx,
      index: 2,
    },
    {
      skillId: 'skill-bubun-baika',
      skillName: 'Bubun Baika no Jutsu',
      file: 'bubun-baika',
      entry: bubun.body,
      fx: null,
      index: 3,
    },
  ];
  fs.writeFileSync(wirePath, `${JSON.stringify(full, null, 2)}\n`);

  console.log('\nOK chouji Kid HQ — 4 skills');
  console.log(
    JSON.stringify(
      full.skills.map((s) => ({
        id: s.skillId,
        fw: s.entry.frameWidth,
        fh: s.entry.frameHeight,
        n: s.entry.frameCount,
        durationMs: s.entry.durationMs,
        hitDelayMs: s.entry.hitDelayMs,
        fx: s.fx
          ? { fw: s.fx.frameWidth, fh: s.fx.frameHeight, n: s.fx.frameCount }
          : null,
      })),
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
