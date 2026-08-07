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
    name: 'Pergaminho de Selamento',
    description:
      'Ao matar um personagem ainda não selado, consome 1 pergaminho e tem 10% de chance de capturá-lo.',
    price: SEALING_SCROLL_PRICE,
    currencyItemId: SHOP_CURRENCY_ITEM_ID,
  },
];

export function getShopOffer(offerId: string): ShopOffer | undefined {
  return SHOP_OFFERS.find((offer) => offer.id === offerId);
}
