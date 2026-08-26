/** Moeda usada pela loja. */
export const SHOP_CURRENCY_ITEM_ID = 'item-copper-coin';

/** Cartão comum (id legado item-sealing-scroll — não alterar). */
export const SEALING_SCROLL_ITEM_ID = 'item-sealing-scroll';

/** Preço inicial do Cartão de Recrutamento comum. */
export const SEALING_SCROLL_PRICE = 25;

/**
 * Chance de sucesso do cartão comum (0–1).
 * Outros ranks usam SEALING_SCROLL_TIERS.
 */
export const SEAL_SUCCESS_CHANCE = 0.9;

/** Tamanho máximo da equipe ativa. */
export const TEAM_SLOT_COUNT = 3;

export type SealingScrollTierId =
  | 'item-sealing-scroll'
  | 'item-sealing-scroll-rare'
  | 'item-sealing-scroll-epic'
  | 'item-sealing-scroll-legendary';

export interface SealingScrollTier {
  itemId: SealingScrollTierId;
  /** Ordem de consumo: o de maior rank é preferido quando disponível. */
  rank: number;
  successChance: number;
  /**
   * Alias estável da chance do cartão (0–1).
   * Hoje = successChance; não rebalancear.
   */
  captureModifier: number;
  /** Multiplicador da chance base da quality (spec de captura). */
  multiplier: number;
  label: string;
  iconSrc: string;
}

/**
 * Tiers de Cartão de Recrutamento (Comum → Lendário).
 * Consumo: prioriza o de tier mais alto que o jogador tiver.
 */
export const SEALING_SCROLL_TIERS: readonly SealingScrollTier[] = [
  {
    itemId: 'item-sealing-scroll',
    rank: 1,
    successChance: SEAL_SUCCESS_CHANCE,
    captureModifier: 1,
    multiplier: 1,
    label: 'Comum',
    iconSrc: '/ui/items/recruitment-cards/common.png',
  },
  {
    itemId: 'item-sealing-scroll-rare',
    rank: 2,
    successChance: 0.94,
    captureModifier: 1.35,
    multiplier: 1.35,
    label: 'Raro',
    iconSrc: '/ui/items/recruitment-cards/rare.png',
  },
] as const;

/** Cartões épico/lendário saíram da loja; ainda valem no recrutamento se existirem no inventário. */
export const LEFTOVER_SEALING_SCROLL_TIERS: readonly SealingScrollTier[] = [
  {
    itemId: 'item-sealing-scroll-epic',
    rank: 3,
    successChance: 0.97,
    captureModifier: 1.8,
    multiplier: 1.8,
    label: 'Épico',
    iconSrc: '/ui/items/recruitment-cards/epic.png',
  },
  {
    itemId: 'item-sealing-scroll-legendary',
    rank: 4,
    successChance: 0.99,
    captureModifier: 2.4,
    multiplier: 2.4,
    label: 'Lendário',
    iconSrc: '/ui/items/recruitment-cards/legendary.png',
  },
];

export function listCaptureScrollTiers(): readonly SealingScrollTier[] {
  return [...SEALING_SCROLL_TIERS, ...LEFTOVER_SEALING_SCROLL_TIERS];
}

export function getSealingScrollTiersHighFirst(): readonly SealingScrollTier[] {
  return [...SEALING_SCROLL_TIERS].sort((a, b) => b.rank - a.rank);
}

export function getSealingScrollTierLowFirst(): readonly SealingScrollTier[] {
  return [...SEALING_SCROLL_TIERS].sort((a, b) => a.rank - b.rank);
}
