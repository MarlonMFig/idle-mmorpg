import {
  SEALING_SCROLL_ITEM_ID,
  SEALING_SCROLL_PRICE,
  SHOP_CURRENCY_ITEM_ID,
} from '@/constants/sealing';

export interface ShopOffer {
  id: string;
  itemId: string;
  name: string;
  description: string;
  price: number;
  currencyItemId: string;
}

export const SHOP_OFFERS: readonly ShopOffer[] = [
  {
    id: 'offer-sealing-scroll',
    itemId: SEALING_SCROLL_ITEM_ID,
    name: 'Pergaminho de Selamento (Comum)',
    description:
      'Consome 1 pergaminho ao matar personagem. Chance de sealar ~90%. Existem tiers Raro, Épico e Lendário.',
    price: SEALING_SCROLL_PRICE,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-rare',
    itemId: 'item-sealing-scroll-rare',
    name: 'Pergaminho de Selamento (Raro)',
    description: 'Chance de selamento ~94%. Priorizado sobre o Comum.',
    price: SEALING_SCROLL_PRICE * 3,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-epic',
    itemId: 'item-sealing-scroll-epic',
    name: 'Pergaminho de Selamento (Épico)',
    description: 'Chance de selamento ~97%. Priorizado sobre Raro.',
    price: SEALING_SCROLL_PRICE * 8,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
  {
    id: 'offer-sealing-scroll-legendary',
    itemId: 'item-sealing-scroll-legendary',
    name: 'Pergaminho de Selamento (Lendário)',
    description: 'Chance de selamento ~99%. Máxima prioridade de consumo.',
    price: SEALING_SCROLL_PRICE * 20,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
];

export function getShopOffer(offerId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.id === offerId);
}
