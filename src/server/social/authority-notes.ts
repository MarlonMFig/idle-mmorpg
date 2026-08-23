/**
 * Limitação documentada (Item 37+) — autoridade parcial de economia.
 *
 * Shared state autoritativo no servidor:
 * - Ranking snapshots (validado por sessão Guest)
 * - Guild membership / roles / XP / contribution
 * - Guild Boss HP / attempts / acceptedDamage / claim entitlement
 * - World Boss HP / attempts / acceptedDamage / claim entitlement (global)
 * - Guild Shop purchase limits + authorize entitlement (playerId+offerId+cycleId;
 *   membership + guild level revalidated; NO inventory/copper grant on server)
 *
 * Ainda client-side (não é economia server completa neste item):
 * - Inventory / Copper / Anime Coins grant físico
 * - RewardService aplica itens no inventário local após claim entitlement
 *   (World Boss: entitlement no server; grant via source `worldBoss` / economy `worldBossReward`)
 * - Guild Shop: após authorize, client spendCurrency(source `guildShopPurchase`) + inventoryStore.addItem
 *
 * Risco residual: cliente pode mentir métricas de ranking (level/power) no submit;
 * validação atual = schema + ownership do playerId autenticado (não anti-cheat completo).
 * Hunt continua local se API social falhar.
 * Guild Shop: se client não gastar após authorize, limite já foi consumido (aceitável neste item).
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
