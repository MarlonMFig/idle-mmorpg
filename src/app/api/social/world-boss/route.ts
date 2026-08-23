import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import { SocialError } from '@/server/social/errors';
import * as worldBoss from '@/server/social/world-boss-service';
import type { WorldBossAttemptEndReason } from '@/types/world-boss';

const MAX_SUBMITTED_DAMAGE = 1_000_000_000_000;

/** GET /api/social/world-boss */
export async function GET(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'world-boss-get', rateLimit: 120 }, async ({ db }) => {
    const state = await worldBoss.getState(db);
    return jsonOk({ state });
  });
}

/** POST /api/social/world-boss — ensure / start / submit / claim / ranking (+ DEV) */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'world-boss-mutate', rateLimit: 40 },
    async ({ db, playerId, nickname }) => {
      if (!playerId || !nickname) {
        throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
      }

      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.action !== 'string') {
        throw new SocialError('VALIDATION', 'action obrigatória.');
      }

      const isDev = isDevWriteAllowed();

      switch (body.action) {
        case 'ensure': {
          const state = await worldBoss.ensureCycle(db);
          return jsonOk({ state });
        }
        case 'start': {
          const playerLevel =
            typeof body.playerLevel === 'number' && Number.isFinite(body.playerLevel)
              ? body.playerLevel
              : 1;
          const result = await worldBoss.startAttempt(db, {
            playerId,
            nickname,
            playerLevel,
          });
          return jsonOk(result);
        }
        case 'submit': {
          const damage = Number(body.damage);
          if (!Number.isFinite(damage) || damage < 0) {
            throw new SocialError('VALIDATION', 'damage inválido.');
          }
          if (damage > MAX_SUBMITTED_DAMAGE) {
            throw new SocialError('VALIDATION', 'damage acima do limite técnico.');
          }
          const result = await worldBoss.submitAttempt(db, {
            attemptId: String(body.attemptId ?? ''),
            playerId,
            damage,
            endReason: (body.endReason as WorldBossAttemptEndReason) || 'timeout',
          });
          console.info('[social.world-boss] submit', {
            playerId,
            attemptId: body.attemptId,
            ok: result.ok,
            accepted: result.validDamage,
          });
          return jsonOk(result);
        }
        case 'claim': {
          const result = await worldBoss.claimReward(db, {
            playerId,
            claimId: String(body.claimId ?? ''),
          });
          return jsonOk(result);
        }
        case 'ranking': {
          const ranking = await worldBoss.getRanking(db, playerId);
          return jsonOk({ ranking });
        }
        case 'setHp': {
          if (!isDev) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          const hp = Number(body.hp);
          if (!Number.isFinite(hp)) throw new SocialError('VALIDATION', 'hp inválido.');
          await worldBoss.setSharedHp(db, hp);
          const state = await worldBoss.getState(db);
          return jsonOk({ state });
        }
        case 'forceDefeat': {
          if (!isDev) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          await worldBoss.forceDefeat(db, {
            grantEntitlements: Boolean(body.grantEntitlements),
          });
          const state = await worldBoss.getState(db);
          return jsonOk({ state });
        }
        case 'resetCycle': {
          if (!isDev) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          await worldBoss.resetCycle(db);
          const state = await worldBoss.getState(db);
          return jsonOk({ state });
        }
        case 'resetAttempts': {
          if (!isDev) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          const targetId =
            typeof body.targetPlayerId === 'string' && body.targetPlayerId
              ? body.targetPlayerId
              : playerId;
          await worldBoss.resetPlayerAttempts(db, targetId);
          const state = await worldBoss.getState(db);
          return jsonOk({ state });
        }
        case 'mockDamage': {
          if (!isDev) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          const damage = Number(body.damage);
          if (!Number.isFinite(damage) || damage < 0) {
            throw new SocialError('VALIDATION', 'damage inválido.');
          }
          if (damage > MAX_SUBMITTED_DAMAGE) {
            throw new SocialError('VALIDATION', 'damage acima do limite técnico.');
          }
          const actorId =
            typeof body.actorId === 'string' && body.actorId ? body.actorId : 'mock-other';
          const actorNickname =
            typeof body.actorNickname === 'string' && body.actorNickname
              ? body.actorNickname
              : actorId;
          const result = await worldBoss.applyExternalDamage(
            db,
            damage,
            actorId,
            actorNickname,
          );
          return jsonOk(result);
        }
        default:
          throw new SocialError('VALIDATION', `action desconhecida: ${body.action}`);
      }
    },
  );
}
