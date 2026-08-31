/**
 * Item 37 — Guild backend (Postgres / Drizzle).
 * Paridade comportamental com LocalGuildProvider; persistência relacional.
 */

import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  GUILD_ACTIVITY_LIMIT,
  GUILD_CONTRIBUTION_PER_ONLINE_KILL,
  GUILD_DESCRIPTION_MAX,
  GUILD_MEMBER_LIMIT,
  GUILD_XP_PER_ONLINE_KILL,
} from '@/constants/guild';
import {
  canDemoteMember,
  canDissolveGuild,
  canKickMember,
  canLeaveGuild,
  canPromoteMember,
  canTransferLeadership,
  canGuildMemberPerform,
} from '@/lib/guild-permissions';
import {
  applyGuildXp,
  isValidGuildName,
  isValidGuildTag,
  normalizeGuildName,
  normalizeGuildTag,
} from '@/lib/guild-xp';
import type { SocialDb } from '@/server/db/client';
import {
  guildActivities,
  guildApplications,
  guildMembers,
  guildOnlineKillLimits,
  guilds,
  players,
  type GuildRow,
} from '@/server/db/schema';
import { SocialError } from '@/server/social/errors';
import { getServerDailyCycleId } from '@/server/social/server-time';
import type {
  CreateGuildInput,
  Guild,
  GuildActivity,
  GuildActivityType,
  GuildApplication,
  GuildJoinMode,
  GuildMember,
  GuildMemberRole,
  GuildPublicSummary,
  GuildSearchQuery,
  GuildSearchResult,
} from '@/types/guild';

type Tx = Parameters<Parameters<SocialDb['transaction']>[0]>[0];
type DbOrTx = SocialDb | Tx;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

function asRole(value: string): GuildMemberRole {
  if (value === 'leader' || value === 'officer' || value === 'member') return value;
  return 'member';
}

function asJoinMode(value: string): GuildJoinMode {
  return value === 'approval' ? 'approval' : 'open';
}

function tsMs(value: Date | string | number | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : Date.now();
  }
  return Date.now();
}

function toSummary(row: GuildRow): GuildPublicSummary {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    level: row.level,
    memberCount: row.memberCount,
    maxMembers: row.memberLimit,
    joinMode: asJoinMode(row.joinMode),
    description: row.description,
  };
}

function memberFromRow(row: typeof guildMembers.$inferSelect): GuildMember {
  return {
    playerId: row.playerId,
    nickname: row.nickname,
    role: asRole(row.role),
    contribution: row.contribution,
    joinedAt: tsMs(row.joinedAt),
    lastActiveAt: tsMs(row.lastActiveAt),
    playerLevel: Math.max(1, row.playerLevel),
  };
}

async function pushActivity(
  db: DbOrTx,
  guildId: string,
  entry: {
    type: GuildActivityType;
    actorId: string | null;
    targetId: string | null;
    message: string;
  },
): Promise<void> {
  const id = randomUUID();
  await db.insert(guildActivities).values({
    id,
    guildId,
    type: entry.type,
    actorId: entry.actorId,
    targetId: entry.targetId,
    message: entry.message,
  });

  // Cap histórico: remove mais antigos além do limite.
  await db.execute(sql`
    DELETE FROM guild_activities
    WHERE id IN (
      SELECT id FROM guild_activities
      WHERE guild_id = ${guildId}
      ORDER BY created_at DESC
      OFFSET ${GUILD_ACTIVITY_LIMIT}
    )
  `);
}

async function assertPlayerExists(db: DbOrTx, playerId: string): Promise<void> {
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!rows[0]) {
    throw new SocialError('NOT_FOUND', 'Jogador não encontrado.', 404);
  }
}

async function loadGuildRow(db: DbOrTx, guildId: string): Promise<GuildRow | null> {
  const rows = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
  return rows[0] ?? null;
}

async function lockGuildRow(tx: Tx, guildId: string): Promise<GuildRow> {
  const rows = await tx.select().from(guilds).where(eq(guilds.id, guildId)).for('update').limit(1);
  const row = rows[0];
  if (!row) throw new SocialError('NOT_FOUND', 'Guild não encontrada.', 404);
  return row;
}

async function getMember(
  db: DbOrTx,
  guildId: string,
  playerId: string,
): Promise<GuildMember | null> {
  const rows = await db
    .select()
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
    .limit(1);
  return rows[0] ? memberFromRow(rows[0]) : null;
}

async function listMembers(db: DbOrTx, guildId: string): Promise<GuildMember[]> {
  const rows = await db
    .select()
    .from(guildMembers)
    .where(eq(guildMembers.guildId, guildId))
    .orderBy(asc(guildMembers.joinedAt));
  return rows.map(memberFromRow);
}

async function listPendingApplications(db: DbOrTx, guildId: string): Promise<GuildApplication[]> {
  const rows = await db
    .select()
    .from(guildApplications)
    .where(and(eq(guildApplications.guildId, guildId), eq(guildApplications.status, 'pending')))
    .orderBy(asc(guildApplications.createdAt));
  return rows.map((a) => ({
    playerId: a.playerId,
    nickname: a.nickname,
    playerLevel: Math.max(1, a.playerLevel),
    requestedAt: tsMs(a.createdAt),
  }));
}

async function listActivities(db: DbOrTx, guildId: string): Promise<GuildActivity[]> {
  const rows = await db
    .select()
    .from(guildActivities)
    .where(eq(guildActivities.guildId, guildId))
    .orderBy(desc(guildActivities.createdAt))
    .limit(GUILD_ACTIVITY_LIMIT);
  return rows.map((a) => ({
    id: a.id,
    type: a.type as GuildActivityType,
    actorId: a.actorId,
    targetId: a.targetId,
    message: a.message,
    timestamp: tsMs(a.createdAt),
  }));
}

async function assembleGuild(db: DbOrTx, row: GuildRow): Promise<Guild> {
  const [members, applications, activity] = await Promise.all([
    listMembers(db, row.id),
    listPendingApplications(db, row.id),
    listActivities(db, row.id),
  ]);
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    level: row.level,
    xp: row.xp,
    leaderId: row.leaderId,
    members,
    maxMembers: row.memberLimit,
    joinMode: asJoinMode(row.joinMode),
    applications,
    activity,
    benefits: { extraMemberSlots: 0, guildBossUnlocked: false },
    createdAt: tsMs(row.createdAt),
  };
}

export async function findGuildIdByPlayer(db: SocialDb, playerId: string): Promise<string | null> {
  const rows = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.playerId, playerId))
    .limit(1);
  return rows[0]?.guildId ?? null;
}

export async function getGuild(db: SocialDb, guildId: string): Promise<Guild | null> {
  const row = await loadGuildRow(db, guildId);
  if (!row) return null;
  return assembleGuild(db, row);
}

export async function createGuild(
  db: SocialDb,
  input: CreateGuildInput,
  founder: { playerId: string; nickname: string; playerLevel: number },
): Promise<Guild> {
  await assertPlayerExists(db, founder.playerId);

  if (await findGuildIdByPlayer(db, founder.playerId)) {
    throw new SocialError('CONFLICT', 'Você já está em uma Guild.', 409);
  }

  const name = normalizeGuildName(input.name);
  const tag = normalizeGuildTag(input.tag);
  if (!isValidGuildName(name)) throw new SocialError('VALIDATION', 'Nome inválido.');
  if (!isValidGuildTag(tag)) throw new SocialError('VALIDATION', 'Tag inválida.');

  const nameNormalized = name.toLowerCase();
  const joinMode: GuildJoinMode = input.joinMode === 'approval' ? 'approval' : 'open';
  const description = (input.description ?? '').trim().slice(0, GUILD_DESCRIPTION_MAX);
  const id = randomUUID();
  const nick = founder.nickname.trim() || 'Jogador';
  const playerLevel = Math.max(1, Math.floor(founder.playerLevel));
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(guilds).values({
        id,
        name,
        nameNormalized,
        tag,
        description,
        level: 1,
        xp: 0,
        leaderId: founder.playerId,
        joinMode,
        memberLimit: GUILD_MEMBER_LIMIT,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(guildMembers).values({
        guildId: id,
        playerId: founder.playerId,
        role: 'leader',
        nickname: nick,
        contribution: 0,
        playerLevel,
        joinedAt: now,
        lastActiveAt: now,
      });
      await pushActivity(tx, id, {
        type: 'guildCreated',
        actorId: founder.playerId,
        targetId: null,
        message: `${nick} criou a Guild [${tag}] ${name}.`,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SocialError('CONFLICT', 'Nome ou tag já em uso.', 409);
    }
    throw err;
  }

  console.info('[guild]', 'createGuild', { guildId: id, leaderId: founder.playerId, tag });
  const guild = await getGuild(db, id);
  if (!guild) throw new SocialError('INTERNAL', 'Falha ao criar Guild.', 500);
  return guild;
}

export async function searchGuilds(
  db: SocialDb,
  query: GuildSearchQuery,
): Promise<GuildSearchResult> {
  const q = (query.query ?? '').trim();
  const page = Math.max(0, query.page ?? 0);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const offset = page * pageSize;

  const where =
    q.length > 0 ? or(ilike(guilds.name, `%${q}%`), ilike(guilds.tag, `%${q}%`)) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(guilds).where(where);
  const total = Number(totalRow?.value ?? 0);

  const rows = await db
    .select()
    .from(guilds)
    .where(where)
    .orderBy(desc(guilds.level), asc(guilds.name))
    .limit(pageSize)
    .offset(offset);

  return {
    guilds: rows.map(toSummary),
    total,
    page,
    pageSize,
  };
}

async function insertMemberUnderLock(
  tx: Tx,
  guild: GuildRow,
  player: { playerId: string; nickname: string; playerLevel: number },
): Promise<void> {
  if (guild.memberCount >= guild.memberLimit) {
    throw new SocialError('GUILD_FULL', 'Guild cheia.', 409);
  }
  const existing = await tx
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.playerId, player.playerId))
    .limit(1);
  if (existing[0]) {
    throw new SocialError('CONFLICT', 'Você já está em uma Guild.', 409);
  }

  const now = new Date();
  try {
    await tx.insert(guildMembers).values({
      guildId: guild.id,
      playerId: player.playerId,
      role: 'member',
      nickname: player.nickname,
      contribution: 0,
      playerLevel: Math.max(1, Math.floor(player.playerLevel)),
      joinedAt: now,
      lastActiveAt: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new SocialError('CONFLICT', 'Você já está em uma Guild.', 409);
    }
    throw err;
  }

  await tx
    .update(guilds)
    .set({ memberCount: guild.memberCount + 1, updatedAt: now })
    .where(eq(guilds.id, guild.id));
}

export async function joinGuild(
  db: SocialDb,
  guildId: string,
  player: { playerId: string; nickname: string; playerLevel: number },
): Promise<{ ok: true; pending: boolean }> {
  await assertPlayerExists(db, player.playerId);
  const nick = player.nickname.trim() || 'Jogador';

  if (await findGuildIdByPlayer(db, player.playerId)) {
    throw new SocialError('CONFLICT', 'Você já está em uma Guild.', 409);
  }

  const result = await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);

    if (asJoinMode(guild.joinMode) === 'approval') {
      const existingApp = await tx
        .select()
        .from(guildApplications)
        .where(
          and(
            eq(guildApplications.guildId, guildId),
            eq(guildApplications.playerId, player.playerId),
            eq(guildApplications.status, 'pending'),
          ),
        )
        .limit(1);
      if (existingApp[0]) return { pending: true as const };

      await tx
        .insert(guildApplications)
        .values({
          guildId,
          playerId: player.playerId,
          nickname: nick,
          playerLevel: Math.max(1, Math.floor(player.playerLevel)),
          status: 'pending',
        })
        .onConflictDoUpdate({
          target: [guildApplications.guildId, guildApplications.playerId],
          set: {
            nickname: nick,
            playerLevel: Math.max(1, Math.floor(player.playerLevel)),
            status: 'pending',
            createdAt: new Date(),
          },
        });

      await pushActivity(tx, guildId, {
        type: 'applicationSubmitted',
        actorId: player.playerId,
        targetId: null,
        message: `${nick} solicitou entrada.`,
      });
      return { pending: true as const };
    }

    await insertMemberUnderLock(tx, guild, {
      playerId: player.playerId,
      nickname: nick,
      playerLevel: player.playerLevel,
    });
    await pushActivity(tx, guildId, {
      type: 'memberJoined',
      actorId: player.playerId,
      targetId: null,
      message: `${nick} entrou na Guild.`,
    });
    return { pending: false as const };
  });

  console.info('[guild]', 'joinGuild', {
    guildId,
    playerId: player.playerId,
    pending: result.pending,
  });
  return { ok: true as const, ...result };
}

export async function leaveGuild(db: SocialDb, guildId: string, playerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    const member = await getMember(tx, guildId, playerId);
    if (!member) throw new SocialError('NOT_MEMBER', 'Você não é membro.', 403);

    const leave = canLeaveGuild(member, guild.memberCount);
    if (!leave.ok)
      throw new SocialError('PERMISSION_DENIED', leave.reason ?? 'Sem permissão.', 403);

    await tx
      .delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)));
    await tx
      .delete(guildApplications)
      .where(and(eq(guildApplications.guildId, guildId), eq(guildApplications.playerId, playerId)));
    await tx
      .update(guilds)
      .set({
        memberCount: Math.max(0, guild.memberCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));
    await pushActivity(tx, guildId, {
      type: 'memberLeft',
      actorId: playerId,
      targetId: null,
      message: `${member.nickname} saiu da Guild.`,
    });
  });

  console.info('[guild]', 'leaveGuild', { guildId, playerId });
}

export async function dissolveGuild(
  db: SocialDb,
  guildId: string,
  playerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, playerId);
    if (!canDissolveGuild(actor)) {
      throw new SocialError('PERMISSION_DENIED', 'Apenas o Líder pode dissolver.', 403);
    }
    // Cascades: members, applications, activities, boss cycles.
    await tx.delete(guilds).where(eq(guilds.id, guild.id));
  });

  console.info('[guild]', 'dissolveGuild', { guildId, playerId });
}

export async function transferLeadership(
  db: SocialDb,
  guildId: string,
  actorId: string,
  newLeaderId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    const target = await getMember(tx, guildId, newLeaderId);
    if (!canTransferLeadership(actor, target)) {
      throw new SocialError('PERMISSION_DENIED', 'Transferência inválida.', 403);
    }

    const now = new Date();
    // Garante exatamente um líder: demote todos, promote target, demote actor → officer.
    await tx
      .update(guildMembers)
      .set({ role: 'member' })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.role, 'leader')));
    await tx
      .update(guildMembers)
      .set({ role: 'leader', lastActiveAt: now })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, newLeaderId)));
    await tx
      .update(guildMembers)
      .set({ role: 'officer', lastActiveAt: now })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, actorId)));
    await tx
      .update(guilds)
      .set({ leaderId: newLeaderId, updatedAt: now })
      .where(eq(guilds.id, guildId));

    await pushActivity(tx, guildId, {
      type: 'leadershipTransferred',
      actorId,
      targetId: newLeaderId,
      message: `${actor!.nickname} transferiu a liderança para ${target!.nickname}.`,
    });
  });

  console.info('[guild]', 'transferLeadership', { guildId, actorId, newLeaderId });
}

export async function kickMember(
  db: SocialDb,
  guildId: string,
  actorId: string,
  targetId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    const target = await getMember(tx, guildId, targetId);
    if (!canKickMember(actor, target)) {
      throw new SocialError('PERMISSION_DENIED', 'Sem permissão para expulsar.', 403);
    }

    await tx
      .delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, targetId)));
    await tx
      .update(guilds)
      .set({
        memberCount: Math.max(0, guild.memberCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));
    await pushActivity(tx, guildId, {
      type: 'memberKicked',
      actorId,
      targetId,
      message: `${actor!.nickname} expulsou ${target!.nickname}.`,
    });
  });

  console.info('[guild]', 'kickMember', { guildId, actorId, targetId });
}

export async function updateMemberRole(
  db: SocialDb,
  guildId: string,
  actorId: string,
  targetId: string,
  role: GuildMemberRole,
): Promise<void> {
  if (role === 'leader') {
    throw new SocialError('VALIDATION', 'Use transferência de liderança.');
  }

  await db.transaction(async (tx) => {
    await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    const target = await getMember(tx, guildId, targetId);
    if (!actor || !target) {
      throw new SocialError('NOT_FOUND', 'Membro não encontrado.', 404);
    }

    if (role === 'officer') {
      if (!canPromoteMember(actor, target, 'officer')) {
        throw new SocialError('PERMISSION_DENIED', 'Sem permissão para promover.', 403);
      }
    } else if (role === 'member') {
      if (!canDemoteMember(actor, target)) {
        throw new SocialError('PERMISSION_DENIED', 'Sem permissão para rebaixar.', 403);
      }
    } else {
      throw new SocialError('VALIDATION', 'Cargo inválido.');
    }

    await tx
      .update(guildMembers)
      .set({ role, lastActiveAt: new Date() })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, targetId)));

    await pushActivity(tx, guildId, {
      type: role === 'officer' ? 'memberPromoted' : 'memberDemoted',
      actorId,
      targetId,
      message:
        role === 'officer'
          ? `${actor.nickname} promoveu ${target.nickname} a Oficial.`
          : `${actor.nickname} rebaixou ${target.nickname} a Membro.`,
    });
  });

  console.info('[guild]', 'updateMemberRole', { guildId, actorId, targetId, role });
}

export async function editGuild(
  db: SocialDb,
  guildId: string,
  actorId: string,
  patch: Partial<Pick<Guild, 'name' | 'description' | 'joinMode'>>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    if (!canGuildMemberPerform(actor, 'editGuild')) {
      throw new SocialError('PERMISSION_DENIED', 'Sem permissão para editar.', 403);
    }

    let name = guild.name;
    let nameNormalized = guild.nameNormalized;
    if (typeof patch.name === 'string') {
      name = normalizeGuildName(patch.name);
      if (!isValidGuildName(name)) throw new SocialError('VALIDATION', 'Nome inválido.');
      nameNormalized = name.toLowerCase();
    }

    const description =
      typeof patch.description === 'string'
        ? patch.description.trim().slice(0, GUILD_DESCRIPTION_MAX)
        : guild.description;
    const joinMode =
      patch.joinMode === 'approval' || patch.joinMode === 'open'
        ? patch.joinMode
        : asJoinMode(guild.joinMode);

    try {
      await tx
        .update(guilds)
        .set({
          name,
          nameNormalized,
          description,
          joinMode,
          updatedAt: new Date(),
        })
        .where(eq(guilds.id, guildId));
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new SocialError('CONFLICT', 'Nome já em uso.', 409);
      }
      throw err;
    }

    await pushActivity(tx, guildId, {
      type: 'guildEdited',
      actorId,
      targetId: null,
      message: `${actor!.nickname} atualizou a Guild.`,
    });
  });

  console.info('[guild]', 'editGuild', { guildId, actorId });
}

export async function getApplications(
  db: SocialDb,
  guildId: string,
  actorId: string,
): Promise<GuildApplication[]> {
  const row = await loadGuildRow(db, guildId);
  if (!row) throw new SocialError('NOT_FOUND', 'Guild não encontrada.', 404);
  const actor = await getMember(db, guildId, actorId);
  if (!canGuildMemberPerform(actor, 'approveMember')) {
    throw new SocialError(
      'PERMISSION_DENIED',
      'Apenas Líder ou Oficial pode ver solicitações.',
      403,
    );
  }
  return listPendingApplications(db, guildId);
}

export async function approveApplication(
  db: SocialDb,
  guildId: string,
  actorId: string,
  applicantId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    if (!canGuildMemberPerform(actor, 'approveMember')) {
      throw new SocialError('PERMISSION_DENIED', 'Sem permissão.', 403);
    }

    const apps = await tx
      .select()
      .from(guildApplications)
      .where(
        and(
          eq(guildApplications.guildId, guildId),
          eq(guildApplications.playerId, applicantId),
          eq(guildApplications.status, 'pending'),
        ),
      )
      .limit(1);
    const app = apps[0];
    if (!app) throw new SocialError('NOT_FOUND', 'Solicitação não encontrada.', 404);

    const elsewhere = await tx
      .select({ guildId: guildMembers.guildId })
      .from(guildMembers)
      .where(eq(guildMembers.playerId, applicantId))
      .limit(1);
    if (elsewhere[0]) {
      await tx
        .update(guildApplications)
        .set({ status: 'rejected' })
        .where(
          and(eq(guildApplications.guildId, guildId), eq(guildApplications.playerId, applicantId)),
        );
      throw new SocialError('CONFLICT', 'Jogador já está em outra Guild.', 409);
    }

    await insertMemberUnderLock(tx, guild, {
      playerId: app.playerId,
      nickname: app.nickname,
      playerLevel: app.playerLevel,
    });

    await tx
      .update(guildApplications)
      .set({ status: 'approved' })
      .where(
        and(eq(guildApplications.guildId, guildId), eq(guildApplications.playerId, applicantId)),
      );

    await pushActivity(tx, guildId, {
      type: 'applicationApproved',
      actorId,
      targetId: applicantId,
      message: `${actor!.nickname} aprovou ${app.nickname}.`,
    });
  });

  console.info('[guild]', 'approveApplication', { guildId, actorId, applicantId });
}

export async function rejectApplication(
  db: SocialDb,
  guildId: string,
  actorId: string,
  applicantId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockGuildRow(tx, guildId);
    const actor = await getMember(tx, guildId, actorId);
    if (!canGuildMemberPerform(actor, 'approveMember')) {
      throw new SocialError('PERMISSION_DENIED', 'Sem permissão.', 403);
    }

    const apps = await tx
      .select()
      .from(guildApplications)
      .where(
        and(
          eq(guildApplications.guildId, guildId),
          eq(guildApplications.playerId, applicantId),
          eq(guildApplications.status, 'pending'),
        ),
      )
      .limit(1);
    if (!apps[0]) throw new SocialError('NOT_FOUND', 'Solicitação não encontrada.', 404);

    await tx
      .update(guildApplications)
      .set({ status: 'rejected' })
      .where(
        and(eq(guildApplications.guildId, guildId), eq(guildApplications.playerId, applicantId)),
      );

    await pushActivity(tx, guildId, {
      type: 'applicationRejected',
      actorId,
      targetId: applicantId,
      message: `${actor!.nickname} rejeitou uma solicitação.`,
    });
  });

  console.info('[guild]', 'rejectApplication', { guildId, actorId, applicantId });
}

/** Aplica XP de Guild a partir de level/xp persistidos. */
async function applyXpToGuildRow(
  tx: Tx,
  guildId: string,
  level: number,
  xp: number,
  amount: number,
): Promise<{ level: number; xp: number; levelsGained: number }> {
  const applied = applyGuildXp(
    {
      id: guildId,
      name: '',
      tag: '',
      description: '',
      level,
      xp,
      leaderId: '',
      members: [],
      maxMembers: GUILD_MEMBER_LIMIT,
      joinMode: 'open',
      applications: [],
      activity: [],
      benefits: { extraMemberSlots: 0, guildBossUnlocked: false },
      createdAt: 0,
    },
    amount,
  );

  await tx
    .update(guilds)
    .set({
      level: applied.guild.level,
      xp: applied.guild.xp,
      updatedAt: new Date(),
    })
    .where(eq(guilds.id, guildId));

  if (applied.levelsGained > 0) {
    await pushActivity(tx, guildId, {
      type: 'guildLevelUp',
      actorId: null,
      targetId: null,
      message: `Guild alcançou o Level ${applied.guild.level}.`,
    });
  }

  return {
    level: applied.guild.level,
    xp: applied.guild.xp,
    levelsGained: applied.levelsGained,
  };
}

export async function addGuildXp(
  db: SocialDb,
  guildId: string,
  amount: number,
): Promise<Guild | null> {
  const floored = Math.max(0, Math.floor(amount));
  if (!(floored > 0)) {
    return getGuild(db, guildId);
  }

  await db.transaction(async (tx) => {
    const guild = await lockGuildRow(tx, guildId);
    await applyXpToGuildRow(tx, guildId, guild.level, guild.xp, floored);
  });

  console.info('[guild]', 'addGuildXp', { guildId, amount: floored });
  return getGuild(db, guildId);
}

export async function addMemberContribution(
  db: SocialDb,
  guildId: string,
  playerId: string,
  amount: number,
): Promise<void> {
  const add = Math.floor(amount);
  if (!(add > 0)) return;

  const updated = await db
    .update(guildMembers)
    .set({
      contribution: sql`${guildMembers.contribution} + ${add}`,
      lastActiveAt: new Date(),
    })
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
    .returning();

  if (updated[0]) {
    console.info('[guild]', 'addMemberContribution', { guildId, playerId, amount: add });
  }
}

export async function grantOnlineKillProgress(
  db: SocialDb,
  guildId: string,
  playerId: string,
  opts?: { source?: 'online' | 'offline' | 'dev' },
): Promise<{ guildXp: number; contribution: number }> {
  const source = opts?.source ?? 'online';
  if (source === 'offline' || source === 'dev') {
    return { guildXp: 0, contribution: 0 };
  }

  const guildXp = GUILD_XP_PER_ONLINE_KILL;
  const contribution = GUILD_CONTRIBUTION_PER_ONLINE_KILL;
  const dailyCycleId = getServerDailyCycleId();
  const maxDailyGrants = 1_000;
  let granted = false;

  try {
    await db.transaction(async (tx) => {
      const guild = await lockGuildRow(tx, guildId);
      const memberRows = await tx
        .select()
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
        .limit(1);
      if (!memberRows[0]) {
        throw new SocialError('NOT_MEMBER', 'Você não é membro.', 403);
      }

      const limitRows = await tx
        .select()
        .from(guildOnlineKillLimits)
        .where(eq(guildOnlineKillLimits.playerId, playerId))
        .for('update')
        .limit(1);
      const limit = limitRows[0];
      if (limit?.cycleId === dailyCycleId && limit.grantedCount >= maxDailyGrants) return;

      if (!limit) {
        await tx.insert(guildOnlineKillLimits).values({
          playerId,
          cycleId: dailyCycleId,
          grantedCount: 1,
          updatedAt: new Date(),
        });
      } else {
        await tx
          .update(guildOnlineKillLimits)
          .set({
            cycleId: dailyCycleId,
            grantedCount: limit.cycleId === dailyCycleId ? limit.grantedCount + 1 : 1,
            updatedAt: new Date(),
          })
          .where(eq(guildOnlineKillLimits.playerId, playerId));
      }

      await tx
        .update(guildMembers)
        .set({
          contribution: memberRows[0].contribution + contribution,
          lastActiveAt: new Date(),
        })
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)));

      await applyXpToGuildRow(tx, guildId, guild.level, guild.xp, guildXp);
      granted = true;
    });
  } catch (err) {
    if (err instanceof SocialError && (err.code === 'NOT_FOUND' || err.code === 'NOT_MEMBER')) {
      return { guildXp: 0, contribution: 0 };
    }
    throw err;
  }

  if (!granted) return { guildXp: 0, contribution: 0 };
  console.info('[guild]', 'grantOnlineKillProgress', { guildId, playerId, guildXp, contribution });
  return { guildXp, contribution };
}
