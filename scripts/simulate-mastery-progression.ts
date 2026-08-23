import { MASTERY_KILLS_PER_HOUR_SCENARIOS, MASTERY_REPORT_LEVELS } from '../src/constants/character-mastery';
import {
  getMasteryXpPerKill,
  getMasteryXpRequired,
  getTotalMasteryXpToReach,
  hoursToMasteryLevel,
} from '../src/lib/character-mastery';

function formatHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} d`;
}

const sampleHunt = 50;
const xpPerKill = getMasteryXpPerKill(sampleHunt);

console.log(`Maestria — Hunt Lv${sampleHunt} = ${xpPerKill} XP/kill (somente ONLINE)`);
console.log('Custo por nível (amostra):');
for (const level of [0, 1, 9, 10, 24, 25, 49, 50, 74, 75, 99]) {
  console.log(`  ${level} → ${level + 1}: ${getMasteryXpRequired(level)} XP`);
}

console.log('\nXP acumulada (0 → alvo):');
for (const level of MASTERY_REPORT_LEVELS) {
  const xp = getTotalMasteryXpToReach(level);
  const kills = Math.ceil(xp / xpPerKill);
  console.log(`  Lv ${level}: ${xp.toLocaleString('pt-BR')} XP · ${kills.toLocaleString('pt-BR')} kills @ Hunt ${sampleHunt}`);
}

console.log('\nTempo estimado (de 0, Hunt Lv50):');
console.log(['kills/h', ...MASTERY_REPORT_LEVELS.map((lv) => `Lv${lv}`)].join('\t'));
for (const kph of MASTERY_KILLS_PER_HOUR_SCENARIOS) {
  const cells = MASTERY_REPORT_LEVELS.map((lv) =>
    formatHours(hoursToMasteryLevel({ targetLevel: lv, killsPerHour: kph, huntLevel: sampleHunt })),
  );
  console.log([String(kph), ...cells].join('\t'));
}
