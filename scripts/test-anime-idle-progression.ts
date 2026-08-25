/**
 * Critérios de aceite do núcleo de progressão (prompt de balanceamento).
 * Run: npx --yes tsx scripts/test-anime-idle-progression.ts
 */
import { BALANCE } from '../src/anime-idle/balance';
import {
  createInitialState,
  d,
  difficultyMultiplier,
  possibleFragments,
  simulateElapsed,
  xpToNextLevel,
  type Character,
  type GameState,
} from '../src/anime-idle';

function assert(name: string, cond: boolean, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`ok  ${name}`);
}

function nearly(actual: number, expected: number, tol = 0.05): boolean {
  return Math.abs(actual - expected) / expected <= tol;
}

function isFiniteDecimal(value: { m: number; e: number }): boolean {
  return Number.isFinite(value.m) && Number.isFinite(value.e);
}

function soloC(): Character {
  return {
    id: 'solo',
    name: 'Solo',
    level: 1,
    xpCurrent: d(0),
    rarity: 'C',
    teamSlot: 0,
  };
}

function emptyState(characters: Character[], zoneId = 'calibracao'): GameState {
  const state = createInitialState(0);
  state.characters = characters;
  state.currentZoneId = zoneId;
  state.combatProgress = 0;
  state.fragments = 0;
  state.xpTotalHistoric = d(0);
  state.lastTickAt = 0;
  state.lastReturnAt = 0;
  return state;
}

function timeToReachLevel(target: number, zoneId = 'calibracao'): number {
  let lo = 0;
  let hi = 1e12;
  let best = hi;
  for (let i = 0; i < 56; i += 1) {
    const mid = (lo + hi) / 2;
    const reached = simulateElapsed(emptyState([soloC()], zoneId), mid).state.characters[0].level >= target;
    if (reached) {
      best = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

{
  const t2 = timeToReachLevel(2);
  assert('1. nível 1→2 em ~30s (Δ+10)', nearly(t2, 30, 0.02), `got ${t2.toFixed(3)}s`);
}

{
  const t50 = timeToReachLevel(50);
  const t100 = timeToReachLevel(100);
  const t150 = timeToReachLevel(150);
  assert('2. nível 50 ~1,1h', nearly(t50 / 3600, 1.1, 0.06), `got ${(t50 / 3600).toFixed(3)}h`);
  assert('2. nível 100 ~7,1h', nearly(t100 / 3600, 7.1, 0.06), `got ${(t100 / 3600).toFixed(3)}h`);
  assert('2. nível 150 ~40,6h', nearly(t150 / 3600, 40.6, 0.06), `got ${(t150 / 3600).toFixed(3)}h`);
}

{
  const tA = timeToReachLevel(2, 'plano');
  const tB = timeToReachLevel(2, 'plano-x100');
  assert('3. Δ=0 HP×100 não muda tempo 1→2', nearly(tA, tB, 0.001), `${tA} vs ${tB}`);
}

{
  const m10 = difficultyMultiplier(10);
  const m40 = difficultyMultiplier(40);
  const mNeg20 = difficultyMultiplier(-20);
  assert('4. Δ+10 ≈ 1,48x', nearly(m10, 1.04 ** 10, 1e-9), String(m10));
  assert('4. Δ+10 vs Δ0', nearly(m10, 1.48, 0.02), String(m10));
  assert('4. Δ+40 teto 2,5x', m40 === BALANCE.DELTA_CAP, String(m40));
  assert('4. Δ−20 ≈ 10%', nearly(mNeg20, 0.1, 0.08), String(mNeg20));
}

{
  const batch = simulateElapsed(emptyState([soloC()]), 8 * 3600);
  let stepwise = emptyState([soloC()]);
  for (let i = 0; i < 28_800; i += 1) {
    stepwise = simulateElapsed(stepwise, 1).state;
  }
  const a = batch.state.characters[0];
  const b = stepwise.characters[0];
  const xpDenom = a.xpCurrent.gte(b.xpCurrent) ? a.xpCurrent : b.xpCurrent;
  const xpRel = xpDenom.gt(0) ? a.xpCurrent.minus(b.xpCurrent).abs().div(xpDenom).toNumber() : 0;
  const histRel = batch.state.xpTotalHistoric.gt(0)
    ? batch.state.xpTotalHistoric.minus(stepwise.xpTotalHistoric).abs().div(batch.state.xpTotalHistoric).toNumber()
    : 0;
  assert('5. 8h batch level = 28800×1s', a.level === b.level, `${a.level} vs ${b.level}`);
  assert('5. 8h batch xp = 28800×1s', a.xpCurrent.eq(b.xpCurrent) || xpRel < 1e-8, `${a.xpCurrent} vs ${b.xpCurrent}`);
  assert(
    '5. 8h historic igual',
    batch.state.xpTotalHistoric.eq(stepwise.xpTotalHistoric) || histRel < 1e-8,
    `${batch.state.xpTotalHistoric} vs ${stepwise.xpTotalHistoric}`,
  );
}

{
  const team: Character[] = [
    { id: 'a', name: 'A', level: 1, xpCurrent: d(0), rarity: 'C', teamSlot: 0 },
    { id: 'b', name: 'B', level: 1, xpCurrent: d(0), rarity: 'C', teamSlot: 1 },
    { id: 'c', name: 'C', level: 1, xpCurrent: d(0), rarity: 'C', teamSlot: 2 },
  ];
  const after = simulateElapsed(emptyState(team, 'plano'), 5).state;
  const xp0 = after.characters[0].xpCurrent;
  const xp1 = after.characters[1].xpCurrent;
  const xp2 = after.characters[2].xpCurrent;
  const r1 = xp1.div(xp0).toNumber();
  const r2 = xp2.div(xp0).toNumber();
  assert('6. slot 1 = 30% do slot 0', nearly(r1, 0.3, 1e-6), String(r1));
  assert('6. slot 2 = 10% do slot 0', nearly(r2, 0.1, 1e-6), String(r2));
}

{
  const reached = simulateElapsed(emptyState([soloC()]), timeToReachLevel(150) + 1);
  assert('chegou no 150', reached.state.characters[0].level >= 150, `level=${reached.state.characters[0].level}`);
  const fragments = possibleFragments(reached.state.xpTotalHistoric);
  assert('7. fragmentos no 150 ~99', nearly(fragments, 99, 0.08), `got ${fragments}`);
}

{
  const need = xpToNextLevel(300);
  assert('8. nível 300 Decimal finito', isFiniteDecimal(need) && need.gt(0), String(need));
  const summed = need.plus(need).minus(need);
  const rel = summed.minus(need).abs().div(need).toNumber();
  assert('8. nível 300 sem estourar precisão', rel < 1e-10, `${summed} vs ${need}`);
  const high = simulateElapsed(emptyState([{ ...soloC(), level: 280, xpCurrent: d(0) }]), 3600);
  assert('8. simulação 280+ não explode', high.state.characters[0].level >= 280 && isFiniteDecimal(high.summary.xpTotal));
}

console.log('all anime-idle progression tests passed');
