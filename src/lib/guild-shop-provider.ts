import { resolveSocialProviderMode } from '@/config/social-backend';
import {
  getBackendGuildShopProvider,
  UnavailableGuildShopProvider,
} from '@/lib/guild-shop-backend-provider';
import { getLocalGuildShopProvider } from '@/lib/guild-shop-local-provider';
import type { GuildShopProvider } from '@/types/guild-shop';

export function getGuildShopProvider(): GuildShopProvider {
  const mode = resolveSocialProviderMode();
  if (mode === 'backend') return getBackendGuildShopProvider();
  if (mode === 'unavailable') return new UnavailableGuildShopProvider();
  return getLocalGuildShopProvider();
}

export function getGuildShopProviderId(): string {
  return getGuildShopProvider().id;
}
