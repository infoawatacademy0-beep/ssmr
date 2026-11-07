import { ref, push, set, update, runTransaction, get } from 'firebase/database';
import { database } from '../config/firebase';
import { calculateVipLevelFromXp, type PurchaseRecord, type ShopItem, type ShopItemType, type User } from '../types';

export interface TopTopCoinPack {
  id: string;
  coins: number;
  vipReward: number;
  iqdPrice: string;
  discount?: string;
  levelBoost: number;
  stackSize: 'single' | 'double' | 'pile';
}

export const TOPTOP_COIN_PACKS: TopTopCoinPack[] = [
  {
    id: 'pack_16875',
    coins: 16875,
    vipReward: 99,
    iqdPrice: 'IQD 1,500',
    levelBoost: 1,
    stackSize: 'single',
  },
  {
    id: 'pack_88425',
    coins: 88425,
    vipReward: 499,
    iqdPrice: 'IQD 7,550',
    discount: '5%OFF',
    levelBoost: 3,
    stackSize: 'single',
  },
  {
    id: 'pack_184725',
    coins: 184725,
    vipReward: 999,
    iqdPrice: 'IQD 15,100',
    discount: '9%OFF',
    levelBoost: 5,
    stackSize: 'double',
  },
  {
    id: 'pack_377775',
    coins: 377775,
    vipReward: 1999,
    iqdPrice: 'IQD 30,200',
    discount: '11%OFF',
    levelBoost: 10,
    stackSize: 'pile',
  },
  {
    id: 'pack_964350',
    coins: 964350,
    vipReward: 4999,
    iqdPrice: 'IQD 75,500',
    discount: '13%OFF',
    levelBoost: 20,
    stackSize: 'pile',
  },
  {
    id: 'pack_2009025',
    coins: 2009025,
    vipReward: 9999,
    iqdPrice: 'IQD 151,000',
    discount: '17%OFF',
    levelBoost: 35,
    stackSize: 'pile',
  },
];

/**
 * Recharges a TopTop-style VIP Coin Pack:
 * - Adds coins to user's balance
 * - Awards VIP Exp (خەڵاتی VIP) and increases VIP Level (VIP 1 .. VIP 10)
 * - Increases user's Account Level (Lv.X) exclusively through VIP coin purchase
 */
export async function rechargeTopTopCoinPack(
  buyerUid: string,
  pack: TopTopCoinPack,
): Promise<{ newCoins: number; newVipLevel: number; newLevel: number }> {
  if (!buyerUid) throw new Error('User UID is required.');
  const userRef = ref(database, `users/${buyerUid}`);
  const snap = await get(userRef);
  const current = snap.exists() ? (snap.val() as User) : null;

  const newCoins = (current?.coins ?? 0) + pack.coins;
  const newVipXp = (current?.vipXp ?? 0) + pack.vipReward;
  const newVipLevel = calculateVipLevelFromXp(newVipXp, true, current?.vipLevel);
  const newXp = (current?.xp ?? 0) + pack.levelBoost * 500;
  const newLevel = Math.min(100, Math.max(current?.level ?? 1, (current?.level ?? 1) + pack.levelBoost));

  await update(userRef, {
    coins: newCoins,
    vipXp: newVipXp,
    vipLevel: newVipLevel,
    isVerified: true,
    xp: newXp,
    level: newLevel,
  });

  return { newCoins, newVipLevel, newLevel };
}

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
