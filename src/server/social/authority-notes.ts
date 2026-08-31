/**
 * Limitação documentada (Item 37+) — autoridade parcial de economia.
 *
 * Shared state autoritativo no servidor:
 * - Ranking snapshots reconstruídos do save em nuvem da sessão Neon Auth
 * - Guild membership / roles / XP / contribution
 * - Guild Boss HP / attempts / acceptedDamage / claim entitlement
 * - World Boss HP / attempts / acceptedDamage / claim entitlement (global)
 * - Guild Shop purchase limits + atomic copper/item mutation
 *
 * Ainda client-side:
 * - Rewards de bosses são entitlements no servidor e o cliente aplica o
 *   inventário local; a conversão para uma carteira de recompensas server-side
 *   continua sendo uma etapa futura.
 *
 * O save de gameplay ainda é uma entrada confiável apenas para a conta do
 * jogador; progressão anti-cheat completa exigirá um ledger de eventos.
 */
export const SOCIAL_BACKEND_AUTHORITY_NOTES = {
  serverAuthoritative: [
    'guild membership',
    'guild boss shared hp',
    'world boss shared hp',
    'attempt lifecycle',
    'reward claim entitlement',
    'guild shop purchase entitlement',
    'ranking board query',
  ],
  clientAuthoritativeStill: ['inventory grants', 'copper balance', 'full player save'],
} as const;
