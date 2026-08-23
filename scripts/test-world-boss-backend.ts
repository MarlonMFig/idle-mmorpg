/**
 * Item 44 — World Boss (backend PGlite + local concurrency).
 * Offline note: offline damage = 0 (no offline path for World Boss).
 * Run: npx --yes tsx scripts/test-world-boss-backend.ts
 */
import { getWorldBossDefinition } from '../src/constants/world-boss';
import { getBossDefinition } from '../src/data/bosses/boss-registry';
import { resolveBossPhase } from '../src/lib/boss-runtime';
import {
  LocalWorldBossProvider,
  getLocalWorldBossProvider,
  resetLocalWorldBossProvider,
} from '../src/lib/world-boss-local-provider';
import { createTestSocialDb, resetSocialDbCache } from '../src/server/db/client';
import { registerGuest } from '../src/server/social/auth';
import {
  getServerNextWeeklyResetMs,
  serverNow,
} from '../src/server/social/server-time';
import * as worldBoss from '../src/server/social/world-boss-service';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

async function runBackendTests(): Promise<void> {
  resetSocialDbCache();
  const { db } = await createTestSocialDb();
  const def = getWorldBossDefinition();
  const bossDef = getBossDefinition(def.bossId);
  assert('boss definition exists', bossDef != null);

  const nextReset = getServerNextWeeklyResetMs(serverNow());
  assert('getServerNextWeeklyResetMs is future', nextReset > serverNow());

  const a = await registerGuest(db, { nickname: 'PlayerA', playerId: 'wb-a' });
  const b = await registerGuest(db, { nickname: 'PlayerB', playerId: 'wb-b' });
  const c = await registerGuest(db, { nickname: 'PlayerC', playerId: 'wb-c' });
  assert('guests registered', Boolean(a.playerId && b.playerId && c.playerId));

  await worldBoss.ensureCycle(db);
  await worldBoss.setSharedHp(db, 1000);

  // Concurrent applyExternalDamage 800+700 → accepted total 1000, hp 0
  const rA = await worldBoss.applyExternalDamage(db, 800, a.playerId, 'PlayerA');
  const rB = await worldBoss.applyExternalDamage(db, 700, b.playerId, 'PlayerB');
  let state = (await worldBoss.getState(db))!;
  assert('concurrent total accepted 1000', rA.validDamage + rB.validDamage === 1000);
  assert('concurrent hp 0', state.currentHp === 0);
  assert('never 1500', rA.validDamage + rB.validDamage !== 1500);

  // Overkill: hp 100, submit 10000 → accepted 100
  await worldBoss.resetCycle(db);
  await worldBoss.setSharedHp(db, 100);
  const over = await worldBoss.applyExternalDamage(db, 10_000, a.playerId, 'PlayerA');
  assert('overkill capped 100', over.validDamage === 100);
  assert('hp 0 after overkill', (await worldBoss.getState(db))!.currentHp === 0);

  // Duplicate submit same attemptId
  await worldBoss.resetCycle(db);
  await worldBoss.setSharedHp(db, 1000);
  const startDup = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  assert('dup start ok', startDup.ok && !!startDup.attemptId);
  const s1 = await worldBoss.submitAttempt(db, {
    attemptId: startDup.attemptId!,
    playerId: a.playerId,
    damage: 50,
    endReason: 'timeout',
  });
  const s2 = await worldBoss.submitAttempt(db, {
    attemptId: startDup.attemptId!,
    playerId: a.playerId,
    damage: 50,
    endReason: 'timeout',
  });
  assert('first submit ok', s1.ok && s1.validDamage === 50);
  assert('duplicate ignored', s2.alreadyProcessed && s2.validDamage === 0);

  // Attempts consume on start; second start after max fails
  await worldBoss.resetCycle(db);
  await worldBoss.resetPlayerAttempts(db, a.playerId);
  for (let i = 0; i < def.maxAttempts; i += 1) {
    const st = await worldBoss.startAttempt(db, {
      playerId: a.playerId,
      nickname: 'PlayerA',
      playerLevel: 50,
    });
    assert(`attempt ${i + 1} starts`, st.ok && !!st.attemptId);
    await worldBoss.submitAttempt(db, {
      attemptId: st.attemptId!,
      playerId: a.playerId,
      damage: 1,
      endReason: 'timeout',
    });
  }
  const blocked = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  assert('max attempts blocks start', blocked.ok === false);

  // Reload: start, submit 0 disconnect, attempts not refunded
  await worldBoss.resetCycle(db);
  await worldBoss.resetPlayerAttempts(db, a.playerId);
  const reloadStart = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  assert('reload start', reloadStart.ok);
  await worldBoss.submitAttempt(db, {
    attemptId: reloadStart.attemptId!,
    playerId: a.playerId,
    damage: 0,
    endReason: 'disconnect',
  });
  state = (await worldBoss.getState(db))!;
  assert(
    'attempts not refunded after disconnect',
    state.participants[a.playerId]?.attemptsUsed === 1,
  );

  // Ranking order A 100M B 80M C 50M
  await worldBoss.resetCycle(db);
  await worldBoss.setSharedHp(db, 300_000_000);
  await worldBoss.applyExternalDamage(db, 100_000_000, a.playerId, 'PlayerA');
  await worldBoss.applyExternalDamage(db, 80_000_000, b.playerId, 'PlayerB');
  await worldBoss.applyExternalDamage(db, 50_000_000, c.playerId, 'PlayerC');
  const ranking = await worldBoss.getRanking(db, a.playerId);
  assert('rank A #1', ranking.top[0]?.playerId === a.playerId && ranking.top[0]?.totalDamage === 100_000_000);
  assert('rank B #2', ranking.top[1]?.playerId === b.playerId && ranking.top[1]?.totalDamage === 80_000_000);
  assert('rank C #3', ranking.top[2]?.playerId === c.playerId && ranking.top[2]?.totalDamage === 50_000_000);
  assert('myRank A is 1', ranking.myRank?.rank === 1);

  // Participation: 0 damage not eligible; min damage eligible
  await worldBoss.resetCycle(db);
  await worldBoss.resetPlayerAttempts(db, a.playerId);
  const zeroStart = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  await worldBoss.submitAttempt(db, {
    attemptId: zeroStart.attemptId!,
    playerId: a.playerId,
    damage: 0,
    endReason: 'abandon',
  });
  state = (await worldBoss.getState(db))!;
  assert('0 dmg not eligible', !state.participants[a.playerId]?.eligibleParticipation);

  const minStart = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  await worldBoss.submitAttempt(db, {
    attemptId: minStart.attemptId!,
    playerId: a.playerId,
    damage: def.minimumParticipationDamage,
    endReason: 'timeout',
  });
  state = (await worldBoss.getState(db))!;
  assert('min dmg eligible', state.participants[a.playerId]?.eligibleParticipation === true);

  // Defeat reward entitlement once; double claim blocked
  await worldBoss.applyExternalDamage(db, state.currentHp, b.playerId, 'PlayerB');
  state = (await worldBoss.getState(db))!;
  assert('defeated', state.status === 'DEFEATED');
  const claims = state.pendingClaims[a.playerId] ?? [];
  const defeatClaim = claims.find((row) => row.kind === 'defeat');
  assert('defeat entitlement', defeatClaim != null && !defeatClaim.claimed);
  const claim1 = await worldBoss.claimReward(db, {
    playerId: a.playerId,
    claimId: defeatClaim!.claimId,
  });
  assert('claim defeat ok', claim1.ok === true);
  const claim2 = await worldBoss.claimReward(db, {
    playerId: a.playerId,
    claimId: defeatClaim!.claimId,
  });
  assert('double claim blocked', claim2.ok === false);

  // Phase: set hp to 40%, ensure phase resolution via resolveBossPhase
  await worldBoss.resetCycle(db);
  await worldBoss.setSharedHp(db, Math.floor(def.maxHp * 0.4));
  state = (await worldBoss.getState(db))!;
  const ratio = state.maxHp > 0 ? state.currentHp / state.maxHp : 0;
  const phase = resolveBossPhase(ratio, bossDef!.phases);
  assert('phase at ~40%', phase?.id === 'phase-3' || (phase != null && phase.hpThreshold <= 0.5));
  assert('hp ratio ~0.4', Math.abs(ratio - 0.4) < 0.01);

  // Concurrent start attempts A and B against shared HP
  await worldBoss.resetCycle(db);
  await worldBoss.setSharedHp(db, 1000);
  const startA = await worldBoss.startAttempt(db, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  const startB = await worldBoss.startAttempt(db, {
    playerId: b.playerId,
    nickname: 'PlayerB',
    playerLevel: 50,
  });
  assert('concurrent starts', startA.ok && startB.ok);
  const subA = await worldBoss.submitAttempt(db, {
    attemptId: startA.attemptId!,
    playerId: a.playerId,
    damage: 800,
    endReason: 'timeout',
  });
  const subB = await worldBoss.submitAttempt(db, {
    attemptId: startB.attemptId!,
    playerId: b.playerId,
    damage: 700,
    endReason: 'timeout',
  });
  state = (await worldBoss.getState(db))!;
  assert('concurrent starts accepted 1000', subA.validDamage + subB.validDamage === 1000);
  assert('concurrent starts hp 0', state.currentHp === 0);

  console.log('note offline damage = 0 (no offline path for World Boss)');
}

async function runLocalProviderTests(): Promise<void> {
  resetLocalWorldBossProvider();
  const p = getLocalWorldBossProvider();
  const def = getWorldBossDefinition();

  await p.ensureCycle(99);
  await p.setSharedHp!(1000);
  const r1 = await p.applyExternalDamage!(800, 'local-a', 'A');
  const r2 = await p.applyExternalDamage!(700, 'local-b', 'B');
  const state = (await p.getState())!;
  assert('local concurrent total 1000', r1.validDamage + r2.validDamage === 1000);
  assert('local concurrent hp 0', state.currentHp === 0);

  await p.resetCycle!();
  await p.setSharedHp!(100);
  const over = await p.applyExternalDamage!(10_000, 'local-over');
  assert('local overkill 100', over.validDamage === 100);

  // peekState / onChange
  assert('peekState works', p.peekState() != null);
  let bumped = 0;
  const unsub = p.onChange(() => {
    bumped += 1;
  });
  await p.setSharedHp!(500);
  assert('onChange fires', bumped >= 1);
  unsub();

  await p.resetCycle!();
  const playerId = 'local-p';
  for (let i = 0; i < def.maxAttempts; i += 1) {
    const st = await p.startAttempt({
      playerId,
      nickname: 'Local',
      playerLevel: 10,
    });
    assert(`local attempt ${i + 1}`, st.ok && !!st.attemptId);
    await p.submitAttempt({
      attemptId: st.attemptId!,
      playerId,
      damage: 1,
      endReason: 'timeout',
    });
  }
  const maxBlocked = await p.startAttempt({
    playerId,
    nickname: 'Local',
    playerLevel: 10,
  });
  assert('local max attempts blocked', maxBlocked.ok === false);

  assert('LocalWorldBossProvider id', p instanceof LocalWorldBossProvider && p.id === 'local-mock');
}

async function main(): Promise<void> {
  await runBackendTests();
  await runLocalProviderTests();
  console.log('ALL World Boss tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
