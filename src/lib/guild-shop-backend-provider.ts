import { socialFetch, SocialApiError } from '@/lib/social-api-client';
import type {
  GuildShopAuthorizeResult,
  GuildShopCatalogEntry,
  GuildShopProvider,
} from '@/types/guild-shop';

export class BackendGuildShopProvider implements GuildShopProvider {
  readonly id = 'backend';

  async listCatalog(input: {
    playerId: string;
    copperBalance: number;
  }): Promise<{
    ok: boolean;
    reason?: string;
    guildId?: string | null;
    guildLevel?: number;
    entries: GuildShopCatalogEntry[];
  }> {
    try {
      const q = new URLSearchParams({
        copperBalance: String(Math.max(0, Math.floor(input.copperBalance))),
      });
      return await socialFetch(`/api/social/guild-shop?${q.toString()}`);
    } catch (e) {
      if (e instanceof SocialApiError) {
        return { ok: false, reason: e.message, guildId: null, guildLevel: 0, entries: [] };
      }
      throw e;
    }
  }

  async authorizePurchase(input: {
    playerId: string;
    nickname: string;
    offerId: string;
    transactionId: string;
  }): Promise<GuildShopAuthorizeResult> {
    try {
      return await socialFetch('/api/social/guild-shop', {
        method: 'POST',
        nickname: input.nickname,
        body: JSON.stringify({
          action: 'authorize',
          offerId: input.offerId,
          transactionId: input.transactionId,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, reason: e.message };
      throw e;
    }
  }

  async getPurchaseCount(input: {
    playerId: string;
    offerId: string;
  }): Promise<{ bought: number; cycleId: string; limit: number | null }> {
    try {
      return await socialFetch('/api/social/guild-shop', {
        method: 'POST',
        body: JSON.stringify({ action: 'count', offerId: input.offerId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { bought: 0, cycleId: '', limit: null };
      throw e;
    }
  }

  async resetPurchaseLimit(playerId: string, offerId?: string): Promise<void> {
    await socialFetch('/api/social/guild-shop', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset', offerId: offerId ?? null, playerId }),
    });
  }
}

export class UnavailableGuildShopProvider implements GuildShopProvider {
  readonly id = 'unavailable';

  private fail(): never {
    throw new SocialApiError('UNAVAILABLE', 'Guild Shop indisponível (backend não configurado).', 503);
  }

  async listCatalog(): Promise<{
    ok: boolean;
    reason?: string;
    guildId?: string | null;
    guildLevel?: number;
    entries: GuildShopCatalogEntry[];
  }> {
    return {
      ok: false,
      reason: 'Guild Shop indisponível (backend não configurado).',
      guildId: null,
      guildLevel: 0,
      entries: [],
    };
  }

  async authorizePurchase(): Promise<GuildShopAuthorizeResult> {
    return { ok: false, reason: 'Guild Shop indisponível.' };
  }

  async getPurchaseCount(): Promise<{ bought: number; cycleId: string; limit: number | null }> {
    return { bought: 0, cycleId: '', limit: null };
  }
}

let singleton: BackendGuildShopProvider | null = null;

export function getBackendGuildShopProvider(): BackendGuildShopProvider {
  if (!singleton) singleton = new BackendGuildShopProvider();
  return singleton;
}
