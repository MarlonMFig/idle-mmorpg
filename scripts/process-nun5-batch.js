/**
 * Pack NUN5 batch chars at native HQ.
 * node scripts/process-nun5-batch.js
 * Optional filter: node scripts/process-nun5-batch.js hinata-kid kakashi-g6
 */
const { packMugenCharacter } = require('./lib/mugen-hq-char');
const { NUN5_BATCH_ROSTER, resolveNun5Char } = require('./lib/nun5-batch-roster');

async function main() {
  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const rows = NUN5_BATCH_ROSTER.filter(
    (row) =>
      filter.length === 0 ||
      filter.includes(row.id) ||
      filter.includes(row.dir.toLowerCase()) ||
      filter.includes(row.dir.toLowerCase().replace(/\s+/g, '-')),
  );
  const ok = [];
  const fail = [];
  for (const row of rows) {
    const cfg = resolveNun5Char(row);
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
