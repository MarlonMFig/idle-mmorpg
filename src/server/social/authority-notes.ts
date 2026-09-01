/**
 * Limitação documentada (Item 37+) — autoridade parcial de economia.
 *
 * Shared state autoritativo no servidor:
 * - Ranking snapshots reconstruídos do save em nuvem da sessão autenticada
 * - Guild membership / roles / XP / contribution
 * - Guild Boss HP / attempts / acceptedDamage / claim entitlement
 * - World Boss HP / attempts / acceptedDamage / claim entitlement (global)
 * - Guild Shop purchase limits + atomic copper/item mutation
 * - Boss reward delivery through an append-only server economy ledger
 *
 * O cliente continua responsável pela simulação local e pelos metadados de
 * gameplay. O endpoint de save preserva no servidor XP, inventário, moedas e
 * ids de recompensa; alterações econômicas válidas entram pelo ledger.
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
  clientAuthoritativeStill: ['local combat simulation', 'non-economic save metadata'],
} as const;
