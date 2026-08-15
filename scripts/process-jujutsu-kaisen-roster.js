/**
 * Pack Jujutsu Kaisen MUGEN chars at native HQ.
 * npm run jjk:roster
 * Optional: node scripts/process-jujutsu-kaisen-roster.js gojo itadori
 */
const { packMugenCharacter } = require('./lib/mugen-hq-char');
const { JJK_ROSTER, resolveChar } = require('./lib/jjk-roster');

async function main() {
  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const rows = JJK_ROSTER.filter(
    (row) =>
      filter.length === 0 || filter.includes(row.id) || filter.includes(row.dir.toLowerCase()),
  );
  const ok = [];
  const fail = [];
  for (const row of rows) {
    const cfg = resolveChar(row);
    try {
      const wire = await packMugenCharacter(cfg);
      ok.push(wire.id);
    } catch (err) {
      console.error(`FAIL ${cfg.id}:`, err.message);
      fail.push({ id: cfg.id, error: err.message });
    }
  }
  console.log('\nOK', ok.length, ok.join(', '));
  if (fail.length) {
    console.log('FAIL', fail.length, JSON.stringify(fail, null, 2));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
