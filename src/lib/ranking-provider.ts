import { resolveSocialProviderMode } from '@/config/social-backend';
import {
  getBackendRankingProvider,
  UnavailableRankingProvider,
} from '@/lib/ranking-backend-provider';
import { getLocalRankingProvider } from '@/lib/ranking-local-provider';
import type { RankingProvider } from '@/types/ranking';

/**
 * Resolução do RankingProvider (Item 37).
 * PROD sem DB → unavailable (nunca mock).
 * DEV → local-mock por padrão.
 */
export function getRankingProvider(): RankingProvider {
  const mode = resolveSocialProviderMode();
  if (mode === 'backend') return getBackendRankingProvider();
  if (mode === 'unavailable') return new UnavailableRankingProvider();
  return getLocalRankingProvider();
}

export function getRankingProviderId(): string {
  return getRankingProvider().id;
}
