import { jsonOk, withSocialApi } from '@/server/social/api-helpers';
import {
  isCloudSavePayload,
  MAX_SAVE_BYTES,
  getPlayerSave,
  upsertPlayerSave,
} from '@/server/social/save-service';
import { SocialError } from '@/server/social/errors';

export async function GET(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'save-get', rateLimit: 30 },
    async ({ db, playerId }) => {
      if (!playerId) throw new SocialError('UNAUTHORIZED', 'Autenticação necessária.', 401);
      const save = await getPlayerSave(db, playerId);
      return jsonOk({
        save: save
          ? {
              payload: save.payload,
              updatedAt: save.updatedAt.toISOString(),
            }
          : null,
      });
    },
  );
}

export async function PUT(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'save-put', rateLimit: 60, rateWindowMs: 60_000 },
    async ({ db, playerId }) => {
      if (!playerId) throw new SocialError('UNAUTHORIZED', 'Autenticação necessária.', 401);
      const contentLength = Number(req.headers.get('content-length') ?? 0);
      if (contentLength > MAX_SAVE_BYTES) {
        throw new SocialError('VALIDATION', 'Save excede o limite permitido.', 413);
      }
      const body = await req.json().catch(() => null);
      const payload = body && typeof body === 'object' ? body.payload : null;
      if (!isCloudSavePayload(payload)) {
        throw new SocialError('VALIDATION', 'Payload de save inválido.', 400);
      }
      if (JSON.stringify(payload).length > MAX_SAVE_BYTES) {
        throw new SocialError('VALIDATION', 'Save excede o limite permitido.', 413);
      }
      const result = await upsertPlayerSave(db, playerId, payload);
      return jsonOk({
        saved: true,
        updatedAt: result.updatedAt.toISOString(),
        payload: result.payload,
      });
    },
  );
}
