import { resolveSocialProviderMode } from '@/config/social-backend';
import {
  getBackendGuildBossProvider,
  UnavailableGuildBossProvider,
} from '@/lib/guild-boss-backend-provider';
import { getLocalGuildBossProvider } from '@/lib/guild-boss-local-provider';
import type { GuildBossProvider } from '@/types/guild-boss';

export function getGuildBossProvider(): GuildBossProvider {
  const mode = resolveSocialProviderMode();
  if (mode === 'backend') return getBackendGuildBossProvider();
  if (mode === 'unavailable') return new UnavailableGuildBossProvider();
  return getLocalGuildBossProvider();
}

export function getGuildBossProviderId(): string {
  return getGuildBossProvider().id;
}
