import {
  assertPlayerProgressionIntegrity,
  inspectXpCurve,
  MAX_PLAYER_LEVEL,
  XP_CURVE_REFERENCE_LEVELS,
} from '../src/lib/player-progression';

function formatXp(value: number): string {
  if (!Number.isFinite(value)) return 'Infinity';
  return String(value);
}

const rows = inspectXpCurve(XP_CURVE_REFERENCE_LEVELS);
console.log(`MAX_PLAYER_LEVEL = ${MAX_PLAYER_LEVEL}`);
console.log('level\txpRequired\tbandMultiplier\tband');
for (const row of rows) {
  console.log(
    `${row.level}\t${formatXp(row.xpRequired)}\t${row.multiplier}\t${row.minLevel}-${row.maxLevel}`,
  );
}

const errors = assertPlayerProgressionIntegrity();
if (errors.length > 0) {
  console.error('\nIntegrity check FAILED:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('\nIntegrity check OK (small gain, single level-up, multi level-up, max level, XP bar).');
