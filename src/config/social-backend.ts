/**
 * Item 37 — seleção de provider social (Ranking / Guild / Guild Boss).
 *
 * Produção: backend obrigatório (sem mock silencioso).
 * DEV local: local-mock por padrão (sem Supabase).
 * DEV + NEXT_PUBLIC_USE_SUPABASE_LOCAL=1: backend para testar Supabase no localhost.
 */

import { isLocalGameplayRuntime } from '@/lib/auth/local-runtime';

export type SocialProviderMode = 'local' | 'backend' | 'unavailable';

function readPublicMode(): string {
  if (typeof process === 'undefined') return 'auto';
  return (
    process.env.NEXT_PUBLIC_SOCIAL_BACKEND ||
    process.env.SOCIAL_BACKEND ||
    'auto'
  ).toLowerCase();
}

export function hasSocialDatabaseConfigured(): boolean {
  if (typeof process === 'undefined') return false;
  if (process.env.NODE_ENV === 'production') {
    return Boolean(process.env.DATABASE_URL);
  }
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_DEV);
}

/**
 * Resolve modo efetivo.
 * - production + sem DB → unavailable (nunca mock)
 * - production + DB → backend
 * - development + auto → local
 * - development + backend → backend (PGlite se sem URL)
 */
export function resolveSocialProviderMode(): SocialProviderMode {
  const isProd = process.env.NODE_ENV === 'production';
  if (isLocalGameplayRuntime()) return 'local';

  const mode = readPublicMode();

  if (mode === 'unavailable') return 'unavailable';
  if (mode === 'local') {
    if (isProd) return 'unavailable';
    return 'local';
  }
  if (mode === 'backend') return 'backend';

  // auto
  if (isProd) {
    return hasSocialDatabaseConfigured() ? 'backend' : 'unavailable';
  }
  return 'local';
}

export function isSocialBackendActive(): boolean {
  return resolveSocialProviderMode() === 'backend';
}

export function isSocialUnavailable(): boolean {
  return resolveSocialProviderMode() === 'unavailable';
}

export function socialBackendStatusMessage(): string {
  if (isSocialUnavailable()) {
    return 'Sistema social indisponível (backend não configurado).';
  }
  return '';
}
