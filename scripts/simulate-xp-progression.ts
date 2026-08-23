import fs from 'node:fs';
import path from 'node:path';
import {
  ENEMY_RESPAWN_MS,
  huntEnemyStatsForLevel,
  LATERAL_SIDE_ENEMY_RESPAWN_MS,
} from '../src/constants/combat';
import {
  getEnemyHpMultiplier,
  getForceHuntLevel,
  getXpMultiplier,
  isDevMode,
} from '../src/config/devConfig';
import { enemyRespawnMsForMap, getWonsrRenderedMap } from '../src/data/wonsr-rendered-maps';
import {
  applyStageXpGain,
  getXpRequiredForLevel,
  getTotalXpToReachLevel,
} from '../src/lib/player-progression';
import {
  estimateTimeToLevel,
  inspectAccumulatedXp,
  simulateXpPerHourTable,
  TIME_TABLE_TARGET_LEVELS,
  XP_PER_HOUR_SCENARIOS,
} from '../src/lib/xp-simulator';
import type { HuntCatalog, HuntDefinition } from '../src/types/hunt';
import type { MapKey } from '../src/maps/map-registry';

const HUNTS_FILE = path.join(process.cwd(), 'public/data/wonsr/hunts.json');

function formatXp(value: number): string {
  if (!Number.isFinite(value)) return 'Infinity';
  const abs = Math.abs(value);
  if (abs >= 1e15) return value.toExponential(4);
  return Math.round(value).toLocaleString('pt-BR');
}

function copperRange(level: number): { min: number; max: number } {
  const safeLevel = Math.max(1, Math.floor(level) || 1);
  const coinMax = Math.max(2, Math.min(25, Math.ceil(safeLevel / 3)));
  return { min: 1, max: coinMax };
}

function primaryTarget(hunt: HuntDefinition) {
  return hunt.targets[0];
}

function catalogHunts(): HuntDefinition[] {
  const catalog = JSON.parse(fs.readFileSync(HUNTS_FILE, 'utf8')) as HuntCatalog;
  return catalog.hunts;
}

function respawnMsForHunt(hunt: HuntDefinition): number {
  const map = getWonsrRenderedMap(hunt.mapKey as MapKey);
  return enemyRespawnMsForMap(map);
}

function theoreticalKillsPerHour(respawnMs: number): number {
  if (respawnMs <= 0) return 0;
  return Math.round(3_600_000 / respawnMs);
}

interface HuntRow {
  name: string;
  id: string;
  requiredLevel: number;
  xpPerKill: number;
  hp: number;
  copperMin: number;
  copperMax: number;
  targetName: string;
  mapKey: string;
  respawnMs: number;
  respawnKillsPerHour: number | null;
  respawnXpPerHourAtHuntLevel: number | null;
}

function huntRows(hunts: HuntDefinition[]): HuntRow[] {
  return hunts.map((hunt) => {
    const target = primaryTarget(hunt);
    const level = target?.level ?? hunt.requiredLevel;
    const xp = target?.xp ?? 0;
    const hp = target?.hp ?? 0;
    const copper = copperRange(level);
    const respawnMs = respawnMsForHunt(hunt);
    const killsH = theoreticalKillsPerHour(respawnMs);
    const effectiveXp = applyStageXpGain(xp * getXpMultiplier(), hunt.requiredLevel);
    return {
      name: hunt.name,
      id: hunt.id,
      requiredLevel: hunt.requiredLevel,
      xpPerKill: xp,
      hp,
      copperMin: copper.min,
      copperMax: copper.max,
      targetName: target?.name ?? '—',
      mapKey: hunt.mapKey,
      respawnMs,
      respawnKillsPerHour: killsH,
      respawnXpPerHourAtHuntLevel: killsH * effectiveXp,
    };
  });
}

function detectJumps(rows: HuntRow[]): string[] {
  const findings: string[] = [];
  const byLevel = [...rows].sort(
    (a, b) => a.requiredLevel - b.requiredLevel || a.name.localeCompare(b.name),
  );

  for (let i = 1; i < byLevel.length; i += 1) {
    const prev = byLevel[i - 1];
    const next = byLevel[i];
    if (next.requiredLevel === prev.requiredLevel) {
      if (next.xpPerKill !== prev.xpPerKill || next.hp !== prev.hp) {
        findings.push(
          `MESMO NÍVEL ${next.requiredLevel}: "${next.name}" XP ${next.xpPerKill}/HP ${next.hp} vs "${prev.name}" XP ${prev.xpPerKill}/HP ${prev.hp}`,
        );
      }
      continue;
    }

    const levelJump = next.requiredLevel / Math.max(1, prev.requiredLevel);
    const xpRatio = next.xpPerKill / Math.max(1, prev.xpPerKill);
    const hpRatio = next.hp / Math.max(1, prev.hp);

    if (levelJump >= 2 && xpRatio < 1.15) {
      findings.push(
        `XP QUASE IGUAL com level bem maior: "${prev.name}" Lv${prev.requiredLevel} XP ${prev.xpPerKill} → "${next.name}" Lv${next.requiredLevel} XP ${next.xpPerKill}`,
      );
    }
    if (xpRatio >= 4 && levelJump < 2) {
      findings.push(
        `XP EXCESSIVA vs salto de level: "${prev.name}" XP ${prev.xpPerKill} → "${next.name}" XP ${next.xpPerKill} (${xpRatio.toFixed(1)}×) com level ${prev.requiredLevel}→${next.requiredLevel}`,
      );
    }
    if (hpRatio >= 2.5 && xpRatio < 1.4) {
      findings.push(
        `HP SOBE SEM XP PROPORCIONAL: "${prev.name}" HP ${prev.hp} XP ${prev.xpPerKill} → "${next.name}" HP ${next.hp} XP ${next.xpPerKill}`,
      );
    }
  }

  const xpPerLevel = byLevel
    .filter((row) => row.requiredLevel > 1)
    .map((row) => row.xpPerKill / row.requiredLevel);
  if (xpPerLevel.length) {
    const median = [...xpPerLevel].sort((a, b) => a - b)[Math.floor(xpPerLevel.length / 2)];
    for (const row of byLevel) {
      if (row.requiredLevel <= 1) continue;
      const ratio = row.xpPerKill / row.requiredLevel;
      if (ratio > median * 2.5) {
        findings.push(
          `RECOMPENSA ALTA p/ o level: "${row.name}" Lv${row.requiredLevel} XP ${row.xpPerKill} (${ratio.toFixed(2)} XP/lv vs mediana ${median.toFixed(2)})`,
        );
      }
      if (ratio < median * 0.4) {
        findings.push(
          `RECOMPENSA BAIXA p/ o level: "${row.name}" Lv${row.requiredLevel} XP ${row.xpPerKill} (${ratio.toFixed(2)} XP/lv vs mediana ${median.toFixed(2)})`,
        );
      }
    }
  }

  const byDistinctLevel: HuntRow[] = [];
  for (const row of byLevel) {
    const last = byDistinctLevel[byDistinctLevel.length - 1];
    if (!last || last.requiredLevel !== row.requiredLevel) byDistinctLevel.push(row);
  }
  for (let i = 1; i < byDistinctLevel.length; i += 1) {
    const prev = byDistinctLevel[i - 1];
    const next = byDistinctLevel[i];
    const prevEff = prev.respawnXpPerHourAtHuntLevel ?? 0;
    const nextEff = next.respawnXpPerHourAtHuntLevel ?? 0;
    if (prevEff > 0 && nextEff > 0 && nextEff < prevEff * 0.85) {
      findings.push(
        `XP/h EFETIVA CAI ao subir de faixa: Lv${prev.requiredLevel} teto ${Math.round(prevEff).toLocaleString('pt-BR')} → Lv${next.requiredLevel} teto ${Math.round(nextEff).toLocaleString('pt-BR')} (stage WONSR + XP linear).`,
      );
    }
  }

  return [...new Set(findings)];
}

function printSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const accum = inspectAccumulatedXp();
printSection('XP acumulada (funções oficiais)');
console.log('level\txpToNext\txpAccumulated');
for (const row of accum) {
  console.log(`${row.level}\t${formatXp(row.xpToNext)}\t${formatXp(row.xpAccumulated)}`);
}

printSection(`Tempo Lv1→marco (cenários XP/h)`);
const header = ['XP/h', ...TIME_TABLE_TARGET_LEVELS.map((lv) => `Lv ${lv}`)].join('\t');
console.log(header);
const table = simulateXpPerHourTable();
for (const row of table) {
  const cells = TIME_TABLE_TARGET_LEVELS.map((lv) => row.etas[lv]);
  console.log([row.xpPerHour.toLocaleString('pt-BR'), ...cells].join('\t'));
}

const hunts = catalogHunts();
const rows = huntRows(hunts);
printSection(`Hunts do catálogo (${rows.length}) — valores em hunts.json, sem forceHuntLevel`);
console.log(
  'name\tminLv\txpKill\thp\tcobre\tinimigo\tmap\trespawnMs\tkills/h teto respawn\tXP/h teto no lv da hunt*',
);
for (const row of rows) {
  console.log(
    [
      row.name,
      row.requiredLevel,
      row.xpPerKill,
      row.hp,
      `${row.copperMin}–${row.copperMax}`,
      row.targetName,
      row.mapKey,
      row.respawnMs,
      row.respawnKillsPerHour ?? '—',
      row.respawnXpPerHourAtHuntLevel != null ? formatXp(row.respawnXpPerHourAtHuntLevel) : '—',
    ].join('\t'),
  );
}
console.log(
  '* XP/h teto = kills/h de respawn × applyStageXpGain(xpCatálogo × getXpMultiplier(), lv da hunt). NÃO é DPS real.',
);

printSection('Flags de teste ativas no runtime');
console.log(`DEV enabled = ${String(isDevMode())}`);
console.log(`forceHuntLevel = ${String(getForceHuntLevel())}`);
console.log(`enemyHpMultiplier = ${getEnemyHpMultiplier()}`);
console.log(`xpMultiplier = ${getXpMultiplier()}`);
console.log(`ENEMY_RESPAWN_MS = ${ENEMY_RESPAWN_MS}`);
console.log(`LATERAL_SIDE_ENEMY_RESPAWN_MS = ${LATERAL_SIDE_ENEMY_RESPAWN_MS}`);
const forcedLevel = getForceHuntLevel();
if (forcedLevel != null) {
  const forced = huntEnemyStatsForLevel(forcedLevel);
  const hpMul = getEnemyHpMultiplier();
  console.log(
    `Com FORCE ativo, todo alvo vira Lv ${forced.level}, XP ${forced.xp}, HP ${Math.round(forced.hp * hpMul)} (hp × ${hpMul}).`,
  );
}

printSection('Saltos consecutivos (catálogo)');
const jumps = detectJumps(rows);
if (jumps.length === 0) {
  console.log('Nenhum salto irregular entre hunts consecutivas na regra linear do gerador.');
} else {
  for (const jump of jumps) console.log(`- ${jump}`);
}

printSection('Sanidade do simulador');
const to2 = getTotalXpToReachLevel(2);
const need1 = getXpRequiredForLevel(1);
if (to2 !== need1) {
  console.error(`FAIL acumulado Lv2: ${to2} vs xpToNext Lv1 ${need1}`);
  process.exit(1);
}
const eta10 = estimateTimeToLevel(1, 0, 10, 1_000);
const remain10 = getTotalXpToReachLevel(10);
const expectedHours = remain10 / 1000;
if (Math.abs(eta10.hours - expectedHours) > 1e-9) {
  console.error('FAIL estimateTimeToLevel');
  process.exit(1);
}
console.log(
  `OK  Lv2 acumulado=${formatXp(to2)}  |  Lv1→10 @ 1.000 XP/h = ${eta10.label} (${formatXp(remain10)} XP)`,
);

console.log('\nJSON_SUMMARY_BEGIN');
console.log(
  JSON.stringify(
    {
      accum,
      timeTable: table,
      hunts: rows,
      jumps,
      flags: {
        DEV_ENABLED: isDevMode(),
        forceHuntLevel: getForceHuntLevel(),
        enemyHpMultiplier: getEnemyHpMultiplier(),
        xpMultiplier: getXpMultiplier(),
      },
    },
    null,
    2,
  ),
);
console.log('JSON_SUMMARY_END');
