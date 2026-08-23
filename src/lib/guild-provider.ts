import { resolveSocialProviderMode } from '@/config/social-backend';
import {
  getBackendGuildProvider,
  UnavailableGuildProvider,
} from '@/lib/guild-backend-provider';
import { getLocalGuildProvider } from '@/lib/guild-local-provider';
import type { GuildProvider } from '@/types/guild';

export function getGuildProvider(): GuildProvider {
  const mode = resolveSocialProviderMode();
  if (mode === 'backend') return getBackendGuildProvider();
  if (mode === 'unavailable') return new UnavailableGuildProvider();
  return getLocalGuildProvider();
}

export function getGuildProviderId(): string {
  return getGuildProvider().id;
}
