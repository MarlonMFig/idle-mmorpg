import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import * as guilds from '@/server/social/guild-service';
import { SocialError } from '@/server/social/errors';
import type { CreateGuildInput, GuildJoinMode, GuildMemberRole } from '@/types/guild';

/** GET /api/social/guild — mine | search | by id */
export async function GET(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'guild-get', rateLimit: 120 }, async ({ db, playerId }) => {
    const url = new URL(req.url);
    const guildId = url.searchParams.get('guildId');
    const q = url.searchParams.get('q');
    const mine = url.searchParams.get('mine') === '1';

    if (mine && playerId) {
      const id = await guilds.findGuildIdByPlayer(db, playerId);
      const guild = id ? await guilds.getGuild(db, id) : null;
      return jsonOk({ guildId: id, guild });
    }

    if (guildId) {
      const guild = await guilds.getGuild(db, guildId);
      return jsonOk({ guild });
    }

    const result = await guilds.searchGuilds(db, {
      query: q ?? undefined,
      page: Number(url.searchParams.get('page') ?? 0) || 0,
      pageSize: Number(url.searchParams.get('pageSize') ?? 20) || 20,
    });
    return jsonOk(result);
  });
}

/** POST /api/social/guild — actions */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'guild-mutate', rateLimit: 40 }, async ({ db, playerId, nickname }) => {
    if (!playerId || !nickname) throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.action !== 'string') {
      throw new SocialError('VALIDATION', 'action obrigatória.');
    }

    const action = body.action;
    const playerLevel = typeof body.playerLevel === 'number' ? body.playerLevel : 1;

    switch (action) {
      case 'create': {
        const input: CreateGuildInput = {
          name: String(body.name ?? ''),
          tag: String(body.tag ?? ''),
          description: typeof body.description === 'string' ? body.description : '',
          joinMode: (body.joinMode as GuildJoinMode) || 'open',
        };
        const guild = await guilds.createGuild(db, input, { playerId, nickname, playerLevel });
        return jsonOk({ guild }, 201);
      }
      case 'join': {
        const guildId = String(body.guildId ?? '');
        const result = await guilds.joinGuild(db, guildId, { playerId, nickname, playerLevel });
        return jsonOk(result);
      }
      case 'leave': {
        const guildId = String(body.guildId ?? '');
        await guilds.leaveGuild(db, guildId, playerId);
        return jsonOk({ ok: true });
      }
      case 'dissolve': {
        const guildId = String(body.guildId ?? '');
        await guilds.dissolveGuild(db, guildId, playerId);
        return jsonOk({ ok: true });
      }
      case 'kick': {
        await guilds.kickMember(db, String(body.guildId ?? ''), playerId, String(body.targetId ?? ''));
        return jsonOk({ ok: true });
      }
      case 'transfer': {
        await guilds.transferLeadership(
          db,
          String(body.guildId ?? ''),
          playerId,
          String(body.newLeaderId ?? ''),
        );
        return jsonOk({ ok: true });
      }
      case 'role': {
        await guilds.updateMemberRole(
          db,
          String(body.guildId ?? ''),
          playerId,
          String(body.targetId ?? ''),
          body.role as GuildMemberRole,
        );
        return jsonOk({ ok: true });
      }
      case 'edit': {
        await guilds.editGuild(db, String(body.guildId ?? ''), playerId, {
          name: typeof body.name === 'string' ? body.name : undefined,
          description: typeof body.description === 'string' ? body.description : undefined,
          joinMode: body.joinMode as GuildJoinMode | undefined,
        });
        return jsonOk({ ok: true });
      }
      case 'approve': {
        await guilds.approveApplication(
          db,
          String(body.guildId ?? ''),
          playerId,
          String(body.applicantId ?? ''),
        );
        return jsonOk({ ok: true });
      }
      case 'reject': {
        await guilds.rejectApplication(
          db,
          String(body.guildId ?? ''),
          playerId,
          String(body.applicantId ?? ''),
        );
        return jsonOk({ ok: true });
      }
      case 'applications': {
        const apps = await guilds.getApplications(db, String(body.guildId ?? ''));
        return jsonOk({ applications: apps });
      }
      case 'grantOnlineKill': {
        const source = body.source as 'online' | 'offline' | 'dev' | undefined;
        const result = await guilds.grantOnlineKillProgress(
          db,
          String(body.guildId ?? ''),
          playerId,
          { source },
        );
        return jsonOk(result);
      }
      default:
        throw new SocialError('VALIDATION', `action desconhecida: ${action}`);
    }
  });
}
