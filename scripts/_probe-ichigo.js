const fs = require('fs');
const path = require('path');
const { parseAir, collapse } = require('./lib/mugen-air');
const { openAnySff } = require('./lib/sff-open');

const DIR =
  process.argv[2] ||
  path.join(
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
  else if (buf[0] === 0xfe && buf[1] === 0xff) {
    text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) text = buf.toString('latin1');
  }
  return parseAir(text);
}

async function main() {
  const sffPath = path.join(DIR, 'Ichigo.sff');
  const airPath = path.join(DIR, 'Ichigo.air');
  console.log('sff', fs.existsSync(sffPath), fs.statSync(sffPath).size);
  const sff = openAnySff(sffPath);
  console.log('sff version', sff.version, 'sprites', sff.sprites?.length ?? '?');
  const air = readAir(airPath);
  console.log('actions', air.size);

  const named = [0, 5, 11, 12, 20, 21, 40, 100, 200, 210, 220, 230, 240, 250, 300, 400, 410, 5000, 5001, 5010, 5020, 5030, 5050, 5070, 5080, 5100, 5110, 5120, 5150, 5170];
  for (const id of named) {
    const act = air.get(id);
    if (!act) continue;
    const frames = collapse(act.frames);
    const groups = [...new Set(frames.map((f) => f.group))].slice(0, 8);
    console.log(
      `  act ${id} "${act.name}" n=${frames.length} ticks=${act.durationTicks} groups=${groups.join(',')}`,
    );
  }

  const specials = [];
  for (const [id, act] of air) {
    if (id < 500 || id > 9999) continue;
    const frames = collapse(act.frames);
    if (frames.length < 2) continue;
    specials.push({
      id,
      name: act.name,
      n: frames.length,
      body: frames.filter((f) => f.group < 600).length,
      fx: frames.filter((f) => f.group >= 600).length,
      groups: [...new Set(frames.map((f) => f.group))].slice(0, 6),
    });
  }
  specials.sort((a, b) => a.id - b.id);
  console.log('\n  candidate specials:', specials.length);
  for (const s of specials) {
    console.log(
      `    ${s.id} ${JSON.stringify(s.name)} n=${s.n} body=${s.body} fx=${s.fx} groups=${s.groups.join(',')}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
