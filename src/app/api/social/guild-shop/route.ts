import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import { SocialError } from '@/server/social/errors';
import * as guildShop from '@/server/social/guild-shop-service';

/** GET /api/social/guild-shop?copperBalance= */
export async function GET(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'guild-shop-get', rateLimit: 120 }, async ({
    db,
    playerId,
  }) => {
    if (!playerId) throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
    const copperRaw = new URL(req.url).searchParams.get('copperBalance');
    const copperBalance = Math.max(0, Math.floor(Number(copperRaw) || 0));
    const result = await guildShop.listCatalog(db, playerId, copperBalance);
    return jsonOk(result);
  });
}

/** POST /api/social/guild-shop — authorize / count / DEV reset */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'guild-shop-mutate', rateLimit: 40 },
    async ({ db, playerId }) => {
      if (!playerId) throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.action !== 'string') {
        throw new SocialError('VALIDATION', 'action obrigatória.');
      }

      switch (body.action) {
        case 'authorize': {
          const offerId = String(body.offerId ?? '');
          const transactionId = String(body.transactionId ?? '');
          const result = await guildShop.authorizePurchase(db, {
            playerId,
            offerId,
            transactionId,
          });
          console.info('[social.guild-shop] authorize', {
            playerId,
            offerId,
            ok: result.ok,
            alreadyProcessed: result.alreadyProcessed,
          });
          return jsonOk(result);
        }
        case 'count': {
          const offerId = String(body.offerId ?? '');
          const result = await guildShop.getPurchaseCount(db, playerId, offerId);
          return jsonOk(result);
        }
        case 'list': {
          const copperBalance = Math.max(0, Math.floor(Number(body.copperBalance) || 0));
          const result = await guildShop.listCatalog(db, playerId, copperBalance);
          return jsonOk(result);
        }
        case 'reset': {
          if (!isDevWriteAllowed()) throw new SocialError('FORBIDDEN', 'DEV only.', 403);
          const targetId =
            typeof body.playerId === 'string' && body.playerId.trim()
              ? body.playerId.trim()
              : playerId;
          const offerId =
            typeof body.offerId === 'string' && body.offerId.trim()
              ? body.offerId.trim()
              : undefined;
          await guildShop.resetPurchaseLimit(db, targetId, offerId);
          return jsonOk({ reset: true });
        }
        default:
          throw new SocialError('VALIDATION', `action desconhecida: ${body.action}`);
      }
    },
  );
}
