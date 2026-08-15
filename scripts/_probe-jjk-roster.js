const fs = require('fs');
const path = require('path');
const { parseAir, collapse } = require('./lib/mugen-air');
const { JJK_ROSTER, resolveChar } = require('./lib/jjk-roster');
const { openAnySff } = require('./lib/sff-open');

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
  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const rows = JJK_ROSTER.filter(
    (row) =>
      filter.length === 0 || filter.includes(row.id) || filter.includes(row.dir.toLowerCase()),
  );
  for (const row of rows) {
    const cfg = resolveChar(row);
    const sffPath = path.join(cfg.charDir, cfg.sffRel);
    const airPath = path.join(cfg.charDir, cfg.airRel);
    console.log(`\n===== ${cfg.name} (${cfg.id}) =====`);
    console.log('sff', sffPath, fs.existsSync(sffPath), fs.statSync(sffPath).size);
    console.log('air', airPath, fs.existsSync(airPath));
    const sff = openAnySff(sffPath);
    console.log('sff version', sff.version);
    const air = readAir(airPath);
    const ids = [0, 5, 20, 21, 200, 210, 220, 230, 240, 250, 300, 400, 410, 5000, 5001, 5030, 5050, 5080, 5110, 5170, 1000, 1100, 1111, 1200, 1300, 1301, 1400, 1500, 1600, 1680, 2000, 3000];
    for (const id of ids) {
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
      if (id < 1000 || id > 3999) continue;
      const frames = collapse(act.frames);
      if (frames.length < 2) continue;
      specials.push({
        id,
        name: act.name,
        n: frames.length,
        body: frames.filter((f) => f.group < 600).length,
        fx: frames.filter((f) => f.group >= 600).length,
      });
    }
    specials.sort((a, b) => a.id - b.id);
    console.log('  specials (first 24):');
    for (const s of specials.slice(0, 24)) {
      console.log(`    ${s.id} ${JSON.stringify(s.name)} n=${s.n} body=${s.body} fx=${s.fx}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
