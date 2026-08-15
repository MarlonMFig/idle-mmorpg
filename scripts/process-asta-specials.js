/**
 * Asta — 4 especiais do AIR/SFF (Black Slash, Black Strong, Bull Thrust, Black Combo).
 * npm run asta:specials
 */
const fs = require('fs');
const path = require('path');
const { openSff, getSprite } = require('./lib/sff-v2');
const {
  packUniformGlobalScale,
  stitch,
  writePng,
  updateMeta,
} = require('./lib/alpha-frame-pack');
const { assertAstaSheet, writeAstaQa } = require('./lib/asta-qa');

const ROOT = path.resolve(__dirname, '..');
const CHAR_DIR = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Black Clover Mugen V8 (DirectX)',
  'Black Clover Mugen V8 (DirectX)',
  'chars',
  'Asta Time Skip',
);
const SFF = path.join(CHAR_DIR, 'Asta.sff');
const AIR = path.join(CHAR_DIR, 'Asta.air');
const ID = 'asta';
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', ID);
const SRC_DIR = path.join(ROOT, 'assets', 'black-clover-source', 'nu', ID);
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', ID);
const META = path.join(OUT_DIR, 'meta.json');
const TICK_MS = 1000 / 60;

const SPECIALS = [
  {
    id: 'black-slash',
    actions: [1000, 1001],
    bodyGroups: [0, 200, 302, 304],
    fxActions: [1060],
    file: 'black-slash',
    skillId: 'skill-black-slash',
  },
  {
    id: 'black-strong',
    actions: [1100],
    bodyGroups: [0, 200, 301],
    fxActions: [1150],
    file: 'black-strong',
    skillId: 'skill-black-strong',
  },
  {
    id: 'bull-thrust',
    actions: [1200, 1201, 1202],
    bodyGroups: [0, 200, 308],
    fxActions: [7053],
    file: 'bull-thrust',
    skillId: 'skill-bull-thrust',
  },
  {
    id: 'black-combo',
    actions: [1300],
    bodyGroups: [0, 200, 302],
    fxActions: [7213],
    file: 'black-combo',
    skillId: 'skill-black-combo',
  },
];

function parseAir(text) {
  const actions = new Map();
  let id = null;
  let frames = [];
  let hitTicks = null;
  let ticks = 0;
  let pendingHit = false;

  const flush = () => {
    if (id == null) return;
    actions.set(id, { frames, hitTicks, durationTicks: ticks });
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const begin = line.match(/^\[Begin Action (\d+)\]/i);
    if (begin) {
      flush();
      id = Number(begin[1]);
      frames = [];
      hitTicks = null;
      ticks = 0;
      pendingHit = false;
      continue;
    }
    if (/^Clsn1/i.test(line)) pendingHit = true;
    const m = line.match(
      /^(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/,
    );
    if (!m || id == null) continue;
    const group = Number(m[1]);
    const number = Number(m[2]);
    const time = Math.max(1, Number(m[5]));
    if (group < 0) {
      ticks += time;
      continue;
    }
    const hit = pendingHit;
    frames.push({ group, number, time, hit });
    if (pendingHit && hitTicks == null) hitTicks = ticks;
    ticks += time;
    if (pendingHit) pendingHit = false;
  }
  flush();
  return actions;
}

function collapse(frames) {
  const out = [];
  for (const frame of frames) {
    const prev = out[out.length - 1];
    if (prev && prev.group === frame.group && prev.number === frame.number) {
      prev.time += frame.time;
      continue;
    }
    out.push({ ...frame });
  }
  return out;
}

function pick(frames, groups) {
  const allow = new Set(groups);
  return collapse(frames.filter((frame) => allow.has(frame.group)));
}

function actionFrames(air, actionIds) {
  const merged = [];
  for (const actionId of actionIds) {
    const action = air.get(actionId);
    if (!action) {
      console.warn(`AIR action ${actionId} missing`);
      continue;
    }
    merged.push(...action.frames);
  }
  return collapse(merged);
}

function measureBodyH(frames, fw, fh) {
  let maxH = 1;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < 16) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= minY) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return maxH;
}

async function packRefs(sff, refs, idleBodyH, { fx = false } = {}) {
  const extracted = [];
  for (const ref of refs) {
    try {
      extracted.push(getSprite(sff, ref.group, ref.number));
    } catch (err) {
      console.warn(`skip ${ref.group},${ref.number}: ${err.message}`);
    }
  }
  if (extracted.length === 0) throw new Error('no sprites');
  if (fx) {
    return packUniformGlobalScale(
      extracted.map((s) => s.rgba),
      extracted.map((s) => s.width),
      extracted.map((s) => s.height),
      { absoluteScale: 1, allowOversizedFrames: true, alignX: 'bbox' },
    );
  }
  return packUniformGlobalScale(
    extracted.map((s) => s.rgba),
    extracted.map((s) => s.width),
    extracted.map((s) => s.height),
    { absoluteScale: 1, allowOversizedFrames: true, alignX: 'feet', targetBodyH: idleBodyH },
  );
}

async function writeSheet(name, packed, contentHeight, extra = {}) {
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  assertAstaSheet(
    sheet.data,
    sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    name,
    { lockFeet: !name.endsWith('-fx') },
  );
  await writePng(path.join(OUT_DIR, `${name}.png`), sheet.data, sheet.width, sheet.height);
  await writePng(path.join(QA_DIR, `${name}.png`), sheet.data, sheet.width, sheet.height);
  await writeAstaQa(sheet, QA_DIR, name);
  const entry = {
    image: `/sprites/player/${ID}/${name}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
    ...extra,
  };
  updateMeta(META, `${ID}-${name}`, entry);
  console.log(
    `${name}: ${packed.frames.length}f ${packed.frameWidth}x${packed.frameHeight} ` +
      `contentH=${contentHeight} ${extra.durationMs ?? ''}ms hit=${extra.hitDelayMs ?? '-'}`,
  );
  return entry;
}

function timing(refs) {
  const durationTicks = refs.reduce((sum, f) => sum + f.time, 0);
  const hit = refs.find((f) => f.hit);
  let hitTicks = 0;
  if (hit) {
    for (const f of refs) {
      if (f === hit) break;
      hitTicks += f.time;
    }
  } else {
    hitTicks = Math.round(durationTicks * 0.7);
  }
  return {
    durationMs: Math.round(durationTicks * TICK_MS),
    hitDelayMs: Math.round(hitTicks * TICK_MS),
    frameRate: Math.max(8, Math.round(60 / Math.max(1, durationTicks / Math.max(1, refs.length)))),
  };
}

async function main() {
  if (!fs.existsSync(SFF) || !fs.existsSync(AIR)) {
    throw new Error(`Asta MUGEN files missing in ${CHAR_DIR}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });

  const sff = openSff(SFF);
  const air = parseAir(fs.readFileSync(AIR, 'utf8'));
  const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
  const idleBodyH = meta['asta-idle']?.contentHeight || 50;

  const report = {};
  for (const spec of SPECIALS) {
    const merged = [];
    let hitTicks = null;
    let ticks = 0;
    for (const actionId of spec.actions) {
      const action = air.get(actionId);
      if (!action) {
        console.warn(`AIR action ${actionId} missing`);
        continue;
      }
      if (hitTicks == null && action.hitTicks != null) hitTicks = ticks + action.hitTicks;
      merged.push(...action.frames);
      ticks += action.durationTicks;
    }
    const body = pick(merged, spec.bodyGroups);
    if (body.length === 0) throw new Error(`${spec.id}: no body frames`);
    const fx = spec.fxActions?.length ? actionFrames(air, spec.fxActions) : [];

    const dir = path.join(SRC_DIR, spec.file);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < body.length; i += 1) {
      try {
        const sprite = getSprite(sff, body[i].group, body[i].number);
        await writePng(
          path.join(dir, `frame_${String(i + 1).padStart(3, '0')}.png`),
          sprite.rgba,
          sprite.width,
          sprite.height,
        );
      } catch {
        /* skip */
      }
    }

    const packed = await packRefs(sff, body, idleBodyH);
    const times = timing(body);
    if (hitTicks != null) times.hitDelayMs = Math.round(hitTicks * TICK_MS);
    const entry = await writeSheet(spec.file, packed, idleBodyH, times);
    report[spec.skillId] = { ...entry, skillId: spec.skillId, file: spec.file };

    if (fx.length >= 3) {
      const fxDir = path.join(SRC_DIR, `${spec.file}-fx`);
      fs.mkdirSync(fxDir, { recursive: true });
      for (let i = 0; i < fx.length; i += 1) {
        try {
          const sprite = getSprite(sff, fx[i].group, fx[i].number);
          await writePng(
            path.join(fxDir, `frame_${String(i + 1).padStart(3, '0')}.png`),
            sprite.rgba,
            sprite.width,
            sprite.height,
          );
        } catch (err) {
          console.warn(`fx skip ${fx[i].group},${fx[i].number}: ${err.message}`);
        }
      }
      const fxPacked = await packRefs(sff, fx, idleBodyH, { fx: true });
      const fxBodyH = measureBodyH(
        fxPacked.frames,
        fxPacked.frameWidth,
        fxPacked.frameHeight,
      );
      const fxTimes = timing(fx);
      const fxEntry = await writeSheet(`${spec.file}-fx`, fxPacked, fxBodyH, {
        frameRate: fxTimes.frameRate,
        durationMs: fxTimes.durationMs,
      });
      report[spec.skillId].fx = fxEntry;
    } else if (spec.fxActions?.length) {
      console.warn(`${spec.id}: expected FX from ${spec.fxActions.join(',')} got ${fx.length}`);
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
