import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import * as boss from '@/server/social/guild-boss-service';
import { SocialError } from '@/server/social/errors';
import type { GuildBossAttemptEndReason } from '@/types/guild-boss';

/** GET /api/social/guild-boss?guildId= */
export async function GET(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'guild-boss-get', rateLimit: 120 }, async ({ db }) => {
    const guildId = new URL(req.url).searchParams.get('guildId');
    if (!guildId) throw new SocialError('VALIDATION', 'guildId obrigatório.');
    const state = await boss.getBossState(db, guildId);
    return jsonOk({ state });
  });
}

/** POST /api/social/guild-boss — start / submit / claim / ensure */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'guild-boss-mutate', rateLimit: 40 },
    async ({ db, playerId, nickname }) => {
      if (!playerId || !nickname) throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.action !== 'string') {
        throw new SocialError('VALIDATION', 'action obrigatória.');
      }
      const guildId = String(body.guildId ?? '');
      if (!guildId) throw new SocialError('VALIDATION', 'guildId obrigatório.');

      switch (body.action) {
        case 'ensure': {
          const guildLevel = typeof body.guildLevel === 'number' ? body.guildLevel : 1;
          const state = await boss.ensureCycle(db, guildId, guildLevel);
          return jsonOk({ state });
        }
        case 'start': {
          const result = await boss.startAttempt(db, {
            guildId,
            playerId,
            nickname,
          });
          return jsonOk(result);
        }
        case 'submit': {
          const damage = Number(body.damage);
          if (!Number.isFinite(damage) || damage < 0) {
            throw new SocialError('VALIDATION', 'damage inválido.');
          }
          // Limite técnico seguro (anti-overflow)
          if (damage > 1_000_000_000) {
            throw new SocialError('VALIDATION', 'damage acima do limite técnico.');
          }
          const result = await boss.submitAttempt(db, {
            guildId,
            attemptId: String(body.attemptId ?? ''),
            playerId,
            damage,
            endReason: (body.endReason as GuildBossAttemptEndReason) || 'timeout',
          });
          console.info('[social.guild-boss] submit', {
            playerId,
            guildId,
            attemptId: body.attemptId,
            ok: result.ok,
            accepted: result.validDamage,
          });
          return jsonOk(result);
        }
        case 'claim': {
          const result = await boss.claimReward(db, {
            guildId,
            playerId,
            claimId: String(body.claimId ?? ''),
          });
          return jsonOk(result);
        }
        case 'participants': {
          const list = await boss.getParticipants(db, guildId);
          return jsonOk({ participants: list });
        }
        default:
          throw new SocialError('VALIDATION', `action desconhecida: ${body.action}`);
      }
    },
  );
}
