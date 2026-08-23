import { resolveSocialProviderMode } from '@/config/social-backend';
import {
  getBackendWorldBossProvider,
  UnavailableWorldBossProvider,
} from '@/lib/world-boss-backend-provider';
import { getLocalWorldBossProvider } from '@/lib/world-boss-local-provider';
import type { WorldBossProvider } from '@/types/world-boss';

export function getWorldBossProvider(): WorldBossProvider {
  const mode = resolveSocialProviderMode();
  if (mode === 'backend') return getBackendWorldBossProvider();
  if (mode === 'unavailable') return new UnavailableWorldBossProvider();
  return getLocalWorldBossProvider();
}

export function getWorldBossProviderId(): string {
  return getWorldBossProvider().id;
}
