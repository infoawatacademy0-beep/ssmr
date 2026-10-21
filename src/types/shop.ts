export type ShopItemType = 'coin_pack' | 'avatar_frame' | 'vip_badge' | 'entrance_effect';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  description: string;
  price: number;         // in coins (or real currency for coin packs)
  realPrice?: string;    // e.g. "$0.99" for coin pack purchases
  coinAmount?: number;   // for coin packs: how many coins granted
  assetKey?: string;     // frame/badge asset identifier
  isLimited?: boolean;
  stock?: number;
}

export interface PurchaseRecord {
  id: string;
  buyerUid: string;
  itemId: string;
  itemName: string;
  itemType: ShopItemType;
  coinCost: number;
  timestamp: number;
}
