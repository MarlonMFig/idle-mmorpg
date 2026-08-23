/**
 * Item 37 — Backend social (PGlite isolado).
 * Run: npx --yes tsx scripts/test-social-backend.ts
 */
import { createTestSocialDb, resetSocialDbCache } from '../src/server/db/client';
import { registerGuest, hashPlayerToken } from '../src/server/social/auth';
import {
  upsertRankingSnapshot,
  getRankingBoard,
  validateRankingProfile,
} from '../src/server/social/ranking-service';
import * as guilds from '../src/server/social/guild-service';
import * as boss from '../src/server/social/guild-boss-service';
import { resolveSocialProviderMode } from '../src/config/social-backend';
import type { RankingPlayerProfile } from '../src/types/ranking';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function profile(
  partial: Partial<RankingPlayerProfile> & Pick<RankingPlayerProfile, 'playerId' | 'nickname'>,
): RankingPlayerProfile {
  return {
    playerLevel: 1,
    levelXp: 0,
    totalXp: 0,
    accountPower: 0,
    accountPowerProvisional: true,
    totalMastery: 0,
    uniqueCharacters: 0,
    collectionRarityScore: 0,
    onlineKills: 0,
    lineageId: null,
    lineageRank: 0,
    specializationId: null,
    specializationLevel: 0,
    lineageOnlineKills: 0,
    equippedTitleId: null,
    bossBest: {},
    ...partial,
  };
}

async function main(): Promise<void> {
  resetSocialDbCache();
  const { db } = await createTestSocialDb();

  // Provider selection: default DEV = local
  process.env.NODE_ENV = 'development';
  delete process.env.SOCIAL_BACKEND;
  delete process.env.NEXT_PUBLIC_SOCIAL_BACKEND;
  assert('DEV auto → local', resolveSocialProviderMode() === 'local');
  process.env.SOCIAL_BACKEND = 'backend';
  assert('DEV backend flag', resolveSocialProviderMode() === 'backend');
  process.env.NODE_ENV = 'production';
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_DEV;
  delete process.env.SOCIAL_BACKEND;
  assert('PROD sem DB → unavailable', resolveSocialProviderMode() === 'unavailable');
  process.env.NODE_ENV = 'development';
  process.env.SOCIAL_BACKEND = 'backend';

  const a = await registerGuest(db, { nickname: 'PlayerA', playerId: 'p-test-a' });
  const b = await registerGuest(db, { nickname: 'PlayerB', playerId: 'p-test-b' });
  assert('guest A', a.playerId === 'p-test-a');
  assert('token hashed', hashPlayerToken(a.token).length === 64);

  await upsertRankingSnapshot(
    db,
    validateRankingProfile(
      profile({
        playerId: a.playerId,
        nickname: 'PlayerA',
        playerLevel: 50,
        totalXp: 50000,
        accountPower: 9000,
      }),
      a.playerId,
    ),
  );
  await upsertRankingSnapshot(
    db,
    validateRankingProfile(
      profile({
        playerId: b.playerId,
        nickname: 'PlayerB',
        playerLevel: 40,
        totalXp: 40000,
        accountPower: 7000,
      }),
      b.playerId,
    ),
  );
  const board = await getRankingBoard(db, { categoryId: 'level', page: 0, pageSize: 100 }, a.playerId);
  assert('ranking A above B', board.entries[0]?.playerId === a.playerId);
  assert('myRank 1', board.myRank === 1);

  let spoofBlocked = false;
  try {
    validateRankingProfile(profile({ playerId: 'p-hacker', nickname: 'X', playerLevel: 99 }), a.playerId);
  } catch {
    spoofBlocked = true;
  }
  assert('spoof blocked', spoofBlocked);

  const guild = await guilds.createGuild(
    db,
    { name: 'Leaf Shinobi', tag: 'LEAF', joinMode: 'open' },
    { playerId: a.playerId, nickname: 'PlayerA', playerLevel: 50 },
  );
  const join = await guilds.joinGuild(db, guild.id, {
    playerId: b.playerId,
    nickname: 'PlayerB',
    playerLevel: 40,
  });
  assert('B joined open', join.ok === true && join.pending === false);

  let kickBlocked = false;
  try {
    await guilds.kickMember(db, guild.id, b.playerId, a.playerId);
  } catch {
    kickBlocked = true;
  }
  assert('member kick blocked', kickBlocked);

  await guilds.transferLeadership(db, guild.id, a.playerId, b.playerId);
  const g3 = await guilds.getGuild(db, guild.id);
  assert('one leader', g3?.members.filter((m) => m.role === 'leader').length === 1);
  assert('B leader', g3?.leaderId === b.playerId);

  const xp = await guilds.grantOnlineKillProgress(db, guild.id, a.playerId, { source: 'online' });
  assert('online xp', xp.guildXp > 0);
  const xpDev = await guilds.grantOnlineKillProgress(db, guild.id, a.playerId, { source: 'dev' });
  assert('dev xp ignored', xpDev.guildXp === 0);

  // Boss concurrency: reduce HP to 1000 then 800+700
  await boss.ensureCycle(db, guild.id, 99);
  let state = await boss.getBossState(db, guild.id);
  assert('boss state', state != null);
  const drain = state!.currentHp - 1000;
  if (drain > 0) {
    await boss.applyExternalDamage(db, guild.id, drain, 'p-drain');
  }
  state = await boss.getBossState(db, guild.id);
  assert('hp 1000', state!.currentHp === 1000);

  const startA = await boss.startAttempt(db, {
    guildId: guild.id,
    playerId: a.playerId,
    nickname: 'PlayerA',
  });
  const startB = await boss.startAttempt(db, {
    guildId: guild.id,
    playerId: b.playerId,
    nickname: 'PlayerB',
  });
  assert('start A/B', Boolean(startA.attemptId && startB.attemptId));

  const reload = await boss.startAttempt(db, {
    guildId: guild.id,
    playerId: a.playerId,
    nickname: 'PlayerA',
  });
  assert('reload blocked', reload.ok === false);

  const [rA, rB] = await Promise.all([
    boss.submitAttempt(db, {
      guildId: guild.id,
      attemptId: startA.attemptId!,
      playerId: a.playerId,
      damage: 800,
      endReason: 'timeout',
    }),
    boss.submitAttempt(db, {
      guildId: guild.id,
      attemptId: startB.attemptId!,
      playerId: b.playerId,
      damage: 700,
      endReason: 'timeout',
    }),
  ]);
  assert('submits ok', rA.ok && rB.ok);
  assert('accepted sum 1000', rA.validDamage + rB.validDamage === 1000);
  const after = await boss.getBossState(db, guild.id);
  assert('hp 0', after!.currentHp === 0);
  assert('never negative', after!.currentHp >= 0);

  const dup = await boss.submitAttempt(db, {
    guildId: guild.id,
    attemptId: startA.attemptId!,
    playerId: a.playerId,
    damage: 99999,
    endReason: 'timeout',
  });
  assert('duplicate idempotent', dup.alreadyProcessed && dup.validDamage === 0);

  // Overkill clamp on fresh: use applyExternal with huge damage when hp already 0 → 0
  const over = await boss.applyExternalDamage(db, guild.id, 10000, 'p-over');
  assert('overkill on dead = 0', over.validDamage === 0);

  console.log('social backend tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
