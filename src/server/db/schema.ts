/**
 * Item 37 — Schema social (Ranking / Guild / Guild Boss).
 * Postgres via Drizzle. Sem save completo do jogo.
 */

import {
  boolean,
  index,
  integer,
  bigint,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const players = pgTable(
  'players',
  {
    id: text('id').primaryKey(),
    nickname: text('nickname').notNull(),
    /** Legado de Guest Account; contas autenticadas usam linkedAuthSubject. */
    tokenHash: text('token_hash'),
    /** Identidade gerenciada pelo provedor de autenticação. */
    linkedAuthProvider: text('linked_auth_provider'),
    linkedAuthSubject: text('linked_auth_subject'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('players_linked_auth_uidx').on(t.linkedAuthProvider, t.linkedAuthSubject)],
);

export const playerSaves = pgTable(
  'player_saves',
  {
    playerId: text('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('player_saves_updated_idx').on(t.updatedAt)],
);

/** Eventos econômicos entregues pelo servidor — idempotência e auditoria. */
export const serverEconomyEvents = pgTable(
  'server_economy_events',
  {
    eventId: text('event_id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    rewardsJson: jsonb('rewards_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('server_economy_events_player_idx').on(t.playerId, t.createdAt),
    index('server_economy_events_source_idx').on(t.source, t.createdAt),
  ],
);

export const apiRateLimits = pgTable('api_rate_limits', {
  key: text('key').primaryKey(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
  requestCount: integer('request_count').notNull().default(0),
});

/** Snapshot social para Ranking — rank NÃO é persistido. */
export const rankingSnapshots = pgTable(
  'ranking_snapshots',
  {
    playerId: text('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    playerLevel: integer('player_level').notNull().default(1),
    levelXp: integer('level_xp').notNull().default(0),
    totalXp: bigint('total_xp', { mode: 'number' }).notNull().default(0),
    accountPower: integer('account_power').notNull().default(0),
    accountPowerProvisional: boolean('account_power_provisional').notNull().default(true),
    totalMastery: integer('total_mastery').notNull().default(0),
    uniqueCharacters: integer('unique_characters').notNull().default(0),
    collectionRarityScore: integer('collection_rarity_score').notNull().default(0),
    onlineKills: integer('online_kills').notNull().default(0),
    lineageId: text('lineage_id'),
    lineageRank: integer('lineage_rank').notNull().default(0),
    specializationId: text('specialization_id'),
    specializationLevel: integer('specialization_level').notNull().default(0),
    lineageOnlineKills: integer('lineage_online_kills').notNull().default(0),
    equippedTitleId: text('equipped_title_id'),
    bossBest: jsonb('boss_best')
      .$type<Record<string, { bestTimeMs: number | null; bestDamage: number; victory: boolean }>>()
      .notNull()
      .default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ranking_level_idx').on(t.playerLevel),
    index('ranking_power_idx').on(t.accountPower),
    index('ranking_mastery_idx').on(t.totalMastery),
    index('ranking_collection_idx').on(t.uniqueCharacters),
    index('ranking_kills_idx').on(t.onlineKills),
    index('ranking_lineage_idx').on(t.lineageId, t.lineageRank),
  ],
);

export const guilds = pgTable(
  'guilds',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    tag: text('tag').notNull(),
    description: text('description').notNull().default(''),
    level: integer('level').notNull().default(1),
    xp: integer('xp').notNull().default(0),
    leaderId: text('leader_id')
      .notNull()
      .references(() => players.id),
    joinMode: text('join_mode').notNull().default('open'),
    memberLimit: integer('member_limit').notNull().default(30),
    memberCount: integer('member_count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('guilds_name_uidx').on(t.nameNormalized),
    uniqueIndex('guilds_tag_uidx').on(t.tag),
    index('guilds_level_idx').on(t.level),
  ],
);

export const guildMembers = pgTable(
  'guild_members',
  {
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    nickname: text('nickname').notNull(),
    contribution: integer('contribution').notNull().default(0),
    playerLevel: integer('player_level').notNull().default(1),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.playerId] }),
    /** Um player = uma guild. */
    uniqueIndex('guild_members_player_uidx').on(t.playerId),
    index('guild_members_guild_idx').on(t.guildId),
  ],
);

export const guildOnlineKillLimits = pgTable(
  'guild_online_kill_limits',
  {
    playerId: text('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    cycleId: text('cycle_id').notNull(),
    grantedCount: integer('granted_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guild_online_kill_limits_cycle_idx').on(t.cycleId)],
);

export const guildApplications = pgTable(
  'guild_applications',
  {
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    playerLevel: integer('player_level').notNull().default(1),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.playerId] }),
    index('guild_applications_status_idx').on(t.guildId, t.status),
  ],
);

export const guildActivities = pgTable(
  'guild_activities',
  {
    id: text('id').primaryKey(),
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorId: text('actor_id'),
    targetId: text('target_id'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guild_activities_guild_idx').on(t.guildId, t.createdAt)],
);

export const guildBossCycles = pgTable(
  'guild_boss_cycles',
  {
    id: text('id').primaryKey(),
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    bossId: text('boss_id').notNull(),
    definitionId: text('definition_id').notNull(),
    cycleId: text('cycle_id').notNull(),
    maxHp: integer('max_hp').notNull(),
    currentHp: integer('current_hp').notNull(),
    status: text('status').notNull().default('AVAILABLE'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    defeatedAt: timestamp('defeated_at', { withTimezone: true }),
    totalDamage: integer('total_damage').notNull().default(0),
    reachedMilestones: jsonb('reached_milestones').$type<string[]>().notNull().default([]),
    guildXpGranted: boolean('guild_xp_granted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('guild_boss_cycle_uidx').on(t.guildId, t.bossId, t.cycleId),
    index('guild_boss_guild_idx').on(t.guildId),
  ],
);

export const guildBossParticipants = pgTable(
  'guild_boss_participants',
  {
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => guildBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    attemptsUsed: integer('attempts_used').notNull().default(0),
    attemptsResetCycleId: text('attempts_reset_cycle_id'),
    totalDamage: integer('total_damage').notNull().default(0),
    bestAttemptDamage: integer('best_attempt_damage').notNull().default(0),
    participated: boolean('participated').notNull().default(false),
    eligibleParticipation: boolean('eligible_participation').notNull().default(false),
    eligibleDefeat: boolean('eligible_defeat').notNull().default(false),
    claimedIds: jsonb('claimed_ids').$type<string[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.cycleRowId, t.playerId] })],
);

export const guildBossAttempts = pgTable(
  'guild_boss_attempts',
  {
    id: text('id').primaryKey(),
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => guildBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    submittedDamage: integer('submitted_damage'),
    acceptedDamage: integer('accepted_damage'),
    endReason: text('end_reason'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('guild_boss_attempts_cycle_idx').on(t.cycleRowId),
    index('guild_boss_attempts_player_idx').on(t.playerId, t.status),
  ],
);

export const guildBossPendingClaims = pgTable(
  'guild_boss_pending_claims',
  {
    claimId: text('claim_id').primaryKey(),
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => guildBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    milestoneId: text('milestone_id'),
    rewardsJson: jsonb('rewards_json').notNull(),
    claimed: boolean('claimed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guild_boss_claims_player_idx').on(t.cycleRowId, t.playerId)],
);

export type PlayerRow = typeof players.$inferSelect;
export type RankingSnapshotRow = typeof rankingSnapshots.$inferSelect;
export type GuildRow = typeof guilds.$inferSelect;

/** Item 44 — World Boss global (server-authoritative HP). */
export const worldBossCycles = pgTable(
  'world_boss_cycles',
  {
    id: text('id').primaryKey(),
    bossId: text('boss_id').notNull(),
    definitionId: text('definition_id').notNull(),
    cycleId: text('cycle_id').notNull(),
    maxHp: bigint('max_hp', { mode: 'number' }).notNull(),
    currentHp: bigint('current_hp', { mode: 'number' }).notNull(),
    status: text('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    defeatedAt: timestamp('defeated_at', { withTimezone: true }),
    totalDamage: bigint('total_damage', { mode: 'number' }).notNull().default(0),
    participantCount: integer('participant_count').notNull().default(0),
    reachedMilestones: jsonb('reached_milestones').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('world_boss_cycle_uidx').on(t.bossId, t.cycleId),
    index('world_boss_status_idx').on(t.status),
  ],
);

export const worldBossParticipants = pgTable(
  'world_boss_participants',
  {
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => worldBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    attemptsUsed: integer('attempts_used').notNull().default(0),
    attemptsResetCycleId: text('attempts_reset_cycle_id'),
    totalDamage: bigint('total_damage', { mode: 'number' }).notNull().default(0),
    bestAttemptDamage: bigint('best_attempt_damage', { mode: 'number' }).notNull().default(0),
    participated: boolean('participated').notNull().default(false),
    eligibleParticipation: boolean('eligible_participation').notNull().default(false),
    eligibleDefeat: boolean('eligible_defeat').notNull().default(false),
    claimedIds: jsonb('claimed_ids').$type<string[]>().notNull().default([]),
    scoreUpdatedAt: bigint('score_updated_at', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.cycleRowId, t.playerId] }),
    index('world_boss_rank_idx').on(
      t.cycleRowId,
      t.totalDamage,
      t.bestAttemptDamage,
      t.scoreUpdatedAt,
    ),
  ],
);

export const worldBossAttempts = pgTable(
  'world_boss_attempts',
  {
    id: text('id').primaryKey(),
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => worldBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    submittedDamage: bigint('submitted_damage', { mode: 'number' }),
    acceptedDamage: bigint('accepted_damage', { mode: 'number' }),
    endReason: text('end_reason'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('world_boss_attempts_cycle_idx').on(t.cycleRowId),
    index('world_boss_attempts_player_idx').on(t.playerId, t.status),
  ],
);

export const worldBossPendingClaims = pgTable(
  'world_boss_pending_claims',
  {
    claimId: text('claim_id').primaryKey(),
    cycleRowId: text('cycle_row_id')
      .notNull()
      .references(() => worldBossCycles.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    milestoneId: text('milestone_id'),
    rewardsJson: jsonb('rewards_json').notNull(),
    claimed: boolean('claimed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('world_boss_claims_player_idx').on(t.cycleRowId, t.playerId)],
);

/** Item 45 — Guild Shop (limites por playerId+offerId+cycleId; sem Guild Coin). */
export const guildShopPurchases = pgTable(
  'guild_shop_purchases',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    offerId: text('offer_id').notNull(),
    /** '' for resetType none */
    cycleId: text('cycle_id').notNull(),
    bought: integer('bought').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.offerId, t.cycleId] })],
);

export const guildShopTransactions = pgTable(
  'guild_shop_transactions',
  {
    transactionId: text('transaction_id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    offerId: text('offer_id').notNull(),
    cycleId: text('cycle_id').notNull(),
    price: integer('price').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guild_shop_tx_player_idx').on(t.playerId, t.createdAt)],
);
