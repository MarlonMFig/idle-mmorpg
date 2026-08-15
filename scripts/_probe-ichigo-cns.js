const fs = require('fs');
const path = require('path');
const { parseAir, collapse } = require('./lib/mugen-air');

const dir = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'JUMP FORCE',
  'Jump Force Mugen V14',
  'chars',
  'Ichigo',
);

function readAir(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
  else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) text = buf.toString('latin1');
  }
  return parseAir(text);
}

const air = readAir(path.join(dir, 'Ichigo.air'));

const cnsFiles = ['Ichigo.cns', 'Especiales.cns', 'Supers.cns'];
let all = '';
for (const f of cnsFiles) all += '\n' + fs.readFileSync(path.join(dir, f), 'latin1');

function stateBlock(id) {
  const re = new RegExp(`\\[\\s*Statedef\\s+${id}\\s*\\]`, 'i');
  const m = all.search(re);
  if (m < 0) return null;
  const rest = all.slice(m + 12);
  const nxt = rest.search(/\[\s*Statedef/i);
  return all.slice(m, m + 12 + (nxt < 0 ? 6000 : nxt));
}

function describe(id) {
  const act = air.get(id);
  if (!act) return `${id}: no AIR action`;
  const frames = collapse(act.frames);
  const groups = [...new Set(frames.map((f) => f.group))];
  return `${id}: "${act.name}" n=${frames.length} groups=${groups.join(',')}`;
}

const helperIds = [1450, 1250, 1350, 1560, 1580, 1582, 405, 415, 3050, 3070, 3081, 737, 738, 739, 800, 1552, 1551];
console.log('--- helper self anims ---');
for (const id of helperIds) {
  const b = stateBlock(id);
  const selfAnim = b ? (b.match(/^\s*anim\s*=\s*(-?\d+)/im) || [])[1] : null;
  const explods = b
    ? [...b.matchAll(/type\s*=\s*Explod([\s\S]{0,500}?)(?=\n\s*\[|$)/gi)].flatMap((m) => {
        const a = m[1].match(/\banim\s*=\s*(?:S)?(\d+)/i);
        return a ? [a[1]] : [];
      })
    : [];
  console.log(
    `state ${id}: selfAnim=${selfAnim ?? '-'} explods=[${[...new Set(explods)].join(',')}]  air-> ${describe(selfAnim ?? id)}`,
  );
}
