/**
 * Probe Black Clover MUGEN chars: SFF version, AIR actions, sprite groups.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Black Clover Mugen V8 (DirectX)',
  'Black Clover Mugen V8 (DirectX)',
  'chars',
);

const DIRS = [
  'Mereoleona',
  'Vanica',
  'Zenon',
  'Reve',
  'Yuno Spirit Dive',
  'Yuno_Royal_Knight',
  'Yuno (Spirit Dive) sword',
  'Gordon',
  'Rakugeki Yuno',
  'Black Asta',
  'Zora',
  'Zagred',
  'Yami Sukehiro',
  'William Vangeance',
  'Luck Voltia',
  'Langris Vaude',
  'Kaiser',
  'Julius Novachrono',
  'Gauche',
  'Fana',
  'E99_Noelle',
  'Dorothy',
  'Asta Demon',
  'Asta',
];

function parseAir(text) {
  const actions = new Map();
  let id = null;
  let frames = [];
  let ticks = 0;
  let hitTicks = null;
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
      ticks = 0;
      hitTicks = null;
      pendingHit = false;
      continue;
    }
    if (/^Clsn1/i.test(line)) pendingHit = true;
    const m = line.match(/^(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
    if (!m || id == null) continue;
    const group = Number(m[1]);
    const number = Number(m[2]);
    const time = Math.max(1, Number(m[5]));
    if (group < 0) {
      ticks += time;
      continue;
    }
    frames.push({ group, number, time, hit: pendingHit });
    if (pendingHit && hitTicks == null) hitTicks = ticks;
    ticks += time;
    if (pendingHit) pendingHit = false;
  }
  flush();
  return actions;
}

function collapse(frames) {
  const out = [];
  for (const f of frames) {
    const prev = out[out.length - 1];
    if (prev && prev.group === f.group && prev.number === f.number) {
      prev.time += f.time;
      continue;
    }
    out.push({ ...f });
  }
  return out;
}

function uniquePairs(frames) {
  return collapse(frames).map((f) => `${f.group},${f.number}`).join(' ');
}

function findFiles(dir) {
  const files = fs.readdirSync(dir);
  const sff = files.filter((f) => f.toLowerCase().endsWith('.sff'));
  const air = files.filter((f) => f.toLowerCase().endsWith('.air'));
  const def = files.filter((f) => f.toLowerCase().endsWith('.def'));
  return { sff, air, def };
}

function sffHeader(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.toString('ascii', 0, 12).replace(/\0/g, '');
  const ver = buf[15];
  let nSprites = 0;
  if (magic.startsWith('ElecbyteSpr') && ver === 2) {
    nSprites = buf.readUInt32LE(0x28);
  } else if (magic.startsWith('ElecbyteSpr')) {
    nSprites = buf.readUInt32LE(0x10);
  }
  return { magic, ver, nSprites, bytes: buf.length };
}

for (const name of DIRS) {
  const dir = path.join(BASE, name);
  console.log(`\n======== ${name} ========`);
  if (!fs.existsSync(dir)) {
    console.log('MISSING DIR');
    continue;
  }
  const { sff, air, def } = findFiles(dir);
  console.log('sff', sff.join(' | ') || '(none)');
  console.log('air', air.join(' | ') || '(none)');
  for (const d of def) {
    const text = fs.readFileSync(path.join(dir, d), 'utf8');
    const sprite = text.match(/sprite\s*=\s*(.+)/i);
    const anim = text.match(/anim\s*=\s*(.+)/i);
    console.log(`def ${d} sprite=${sprite ? sprite[1].trim() : '?'} anim=${anim ? anim[1].trim() : '?'}`);
  }
  for (const f of sff) {
    try {
      console.log('sffmeta', f, JSON.stringify(sffHeader(path.join(dir, f))));
    } catch (err) {
      console.log('sffmeta FAIL', f, err.message);
    }
  }
  const airFile = air[0] ? path.join(dir, air[0]) : null;
  if (!airFile) continue;
  let text;
  try {
    text = fs.readFileSync(airFile, 'utf8');
  } catch {
    text = fs.readFileSync(airFile, 'latin1');
  }
  const actions = parseAir(text);
  const ids = [...actions.keys()].sort((a, b) => a - b);
  const specials = ids.filter((id) => id >= 1000 && id < 4000);
  const basics = [0, 5, 20, 21, 200, 210, 220, 230, 240, 250, 400, 410, 5000, 5030, 5050, 5100, 5110, 5120, 5150, 5170, 5300];
  console.log('nActions', ids.length, 'specials', specials.slice(0, 20).join(','));
  for (const id of basics) {
    const a = actions.get(id);
    if (!a || a.frames.length === 0) continue;
    const c = collapse(a.frames);
    console.log(
      `  act ${id}: ${c.length}f hit=${a.hitTicks ?? '-'} ticks=${a.durationTicks} [${uniquePairs(c).slice(0, 120)}]`,
    );
  }
  for (const id of specials.slice(0, 8)) {
    const a = actions.get(id);
    const c = collapse(a.frames);
    const groups = [...new Set(c.map((f) => f.group))];
    console.log(
      `  spec ${id}: ${c.length}f hit=${a.hitTicks ?? '-'} ticks=${a.durationTicks} groups=${groups.join(',')}`,
    );
  }
}
