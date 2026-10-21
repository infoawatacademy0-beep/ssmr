import { ref, push, set, update, runTransaction, get } from 'firebase/database';
import { database } from '../config/firebase';
import type { PurchaseRecord, ShopItem, ShopItemType } from '../types';

// Static shop catalog — no database needed for catalog definition
export const SHOP_CATALOG: ShopItem[] = [
  {
    id: 'coins_500',
    type: 'coin_pack',
    name: '500 Gold Coins',
    description: 'A starter pack of premium arena gold coins.',
    price: 0,
    realPrice: '$0.99',
    coinAmount: 500,
  },
  {
    id: 'coins_2000',
    type: 'coin_pack',
    name: '2,000 Gold Coins',
    description: 'Power up your gifting and gaming with a larger coin reserve.',
    price: 0,
    realPrice: '$2.99',
    coinAmount: 2000,
    isLimited: false,
  },
  {
    id: 'coins_10000',
    type: 'coin_pack',
    name: '10,000 Elite Coins',
    description: 'The ultimate coin arsenal for top-tier spenders.',
    price: 0,
    realPrice: '$9.99',
    coinAmount: 10000,
  },
  {
    id: 'frame_golden',
    type: 'avatar_frame',
    name: 'Golden Crown Frame',
    description: 'A shimmering gold animated border for your avatar.',
    price: 2000,
    assetKey: 'frame_golden',
  },
  {
    id: 'frame_diamond',
    type: 'avatar_frame',
    name: 'Diamond Aura Frame',
    description: 'Premium crystal diamond rotating frame effect.',
    price: 5000,
    assetKey: 'frame_diamond',
  },
  {
    id: 'badge_vip',
    type: 'vip_badge',
    name: 'VIP Status Badge',
    description: 'Display an exclusive VIP badge on your profile and in rooms.',
    price: 3000,
    assetKey: 'badge_vip',
  },
  {
    id: 'badge_legend',
    type: 'vip_badge',
    name: 'Legend Status Badge',
    description: 'Reserved for top-tier arena legends. Rare cosmetic badge.',
    price: 8000,
    assetKey: 'badge_legend',
    isLimited: true,
    stock: 100,
  },
  {
    id: 'entrance_royal',
    type: 'entrance_effect',
    name: 'Royal Entrance Effect',
    description: 'Trigger a luxury cinematic entrance animation when joining rooms.',
    price: 4000,
    assetKey: 'entrance_royal',
  },
];

/**
 * Purchases a coin-cost shop item by deducting coins from buyer and recording the purchase.
 */
export async function purchaseShopItem(
  buyerUid: string,
  item: ShopItem,
): Promise<void> {
  if (item.type === 'coin_pack') {
    throw new Error('Coin packs require real currency payment processing.');
  }

  // Atomic coin deduction via Firebase Transaction
  const coinsRef = ref(database, `users/${buyerUid}/coins`);
  const result = await runTransaction(coinsRef, (currentCoins: number | null) => {
    const coins = currentCoins ?? 0;
    if (coins < item.price) {
      return undefined; // Abort transaction — insufficient coins
    }
    return coins - item.price;
  });

  if (!result.committed) {
    throw new Error('Insufficient coin balance to complete this purchase.');
  }

  // Write purchase record
  const purchasesRef = ref(database, `users/${buyerUid}/purchases`);
  const newRef = push(purchasesRef);
  const purchaseId = newRef.key!;

  const record: PurchaseRecord = {
    id: purchaseId,
    buyerUid,
    itemId: item.id,
    itemName: item.name,
    itemType: item.type,
    coinCost: item.price,
    timestamp: Date.now(),
  };

  await set(newRef, record);

  // Grant the item to the user's inventory
  const inventoryRef = ref(database, `users/${buyerUid}/inventory/${item.id}`);
  await set(inventoryRef, {
    itemId: item.id,
    itemType: item.type,
    assetKey: item.assetKey || null,
    purchasedAt: Date.now(),
  });
}

/**
 * Checks if a user owns a specific shop item.
 */
export async function userOwnsItem(buyerUid: string, itemId: string): Promise<boolean> {
  const inventoryRef = ref(database, `users/${buyerUid}/inventory/${itemId}`);
  const snapshot = await get(inventoryRef);
  return snapshot.exists();
}
