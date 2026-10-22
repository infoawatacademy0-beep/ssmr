import { ref, runTransaction, set, onValue, get, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { GiftItem, GiftReceived, User, RoomGiftEvent, PkTeam } from '../types';
import { sendRoomMessage } from './roomService';
import { addPkBattlePoints } from './pkBattleService';

/* ─────────────────────────────────────────────────────────────
   Gift Service — Economy & Real-Time Gifting
   Includes Text-to-Speech (TTS) Hype Announcements for Luxury Gifts
   TikTok-style live broadcast overlay synchronization.
   ───────────────────────────────────────────────────────────── */

export async function sendGift(
  roomId: string,
  sender: { uid: string; username: string },
  recipient: { uid: string; username: string },
  gift: GiftItem,
): Promise<void> {
  if (sender.uid === recipient.uid) {
    throw new Error('You cannot send a gift to yourself.');
  }

  // 1. Deduct coins from sender atomically
  const senderRef = ref(database, `users/${sender.uid}`);
  await runTransaction(senderRef, (senderData: User | null) => {
    if (!senderData) throw new Error('Sender not found.');
    const currentCoins = senderData.coins ?? 0;
    if (currentCoins < gift.cost) {
      throw new Error(`Insufficient coins! You need ${gift.cost} coins for this gift.`);
    }

    senderData.coins = currentCoins - gift.cost;
    // Award sender +25 XP for social generosity
    senderData.xp = (senderData.xp ?? 0) + 25;
    return senderData;
  });

  // 2. Add gift & tip to recipient
  const recipientRef = ref(database, `users/${recipient.uid}`);
  await runTransaction(recipientRef, (recipientData: User | null) => {
    if (!recipientData) return recipientData;

    const newGift: GiftReceived = {
      id: `gift_${Date.now()}`,
      fromUid: sender.uid,
      fromUsername: sender.username,
      giftName: gift.name,
      giftIcon: gift.iconKey,
      coinValue: gift.cost,
      receivedAt: Date.now(),
    };

    const currentGifts = Array.isArray(recipientData.giftsReceived)
      ? recipientData.giftsReceived
      : [];

    recipientData.giftsReceived = [...currentGifts, newGift];
    // Recipient receives 50% coin cash-out tip + 50 XP
    recipientData.coins = (recipientData.coins ?? 0) + Math.floor(gift.cost * 0.5);
    const newXp = (recipientData.xp ?? 0) + 50;
    recipientData.xp = newXp;
    recipientData.level = Math.max(recipientData.level ?? 1, Math.floor(newXp / 500) + 1);

    return recipientData;
  });

  // 3. Track total gift coins received by the recipient during this room session
  const seatCoinsRef = ref(database, `rooms/${roomId}/seatGiftCoins/${recipient.uid}`);
  await runTransaction(seatCoinsRef, (current) => (current || 0) + gift.cost);

  // 4. If a 4v4 PK battle is active, award points to the recipient's team
  // Seats 1, 2, 5, 6 are Team Red; Seats 3, 4, 7, 8 are Team Blue
  try {
    const seatsSnapshot = await get(ref(database, `rooms/${roomId}/seats`));
    if (seatsSnapshot.exists()) {
      const seats = seatsSnapshot.val();
      const seatList = Array.isArray(seats) ? seats : Object.values(seats);
      const recipientSeat = seatList.find((s: any) => s?.userId === recipient.uid);
      if (recipientSeat && typeof recipientSeat.seatNo === 'number') {
        const isRed = [1, 2, 5, 6].includes(recipientSeat.seatNo);
        const team: PkTeam = isRed ? 'red' : 'blue';
        await addPkBattlePoints(roomId, team, gift.cost);
      }
    }
  } catch (err) {
    console.error('Error crediting PK battle points for gift:', err);
  }

  // 5. Broadcast live TikTok-style room gift event
  const latestGiftRef = ref(database, `rooms/${roomId}/latestGift`);
  await set(latestGiftRef, {
    id: `gift_${Date.now()}_${sender.uid.slice(0, 5)}`,
    senderUid: sender.uid,
    senderUsername: sender.username,
    recipientUid: recipient.uid,
    recipientUsername: recipient.username,
    gift,
    timestamp: Date.now(),
  });

  // 4. Announce in room chat
  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Gift] ${sender.username} presented ${gift.name} (${gift.cost} Coins) to ${recipient.username}.`,
  );
}

/**
 * Subscribes to real-time room gift events for TikTok-style animated popups.
 */
export function subscribeToRoomGift(
  roomId: string,
  onGift: (event: RoomGiftEvent | null) => void,
): Unsubscribe {
  const latestGiftRef = ref(database, `rooms/${roomId}/latestGift`);
  return onValue(latestGiftRef, (snapshot) => {
    if (snapshot.exists()) {
      onGift(snapshot.val() as RoomGiftEvent);
    } else {
      onGift(null);
    }
  });
}

/**
 * Subscribes to real-time gift coins earned by each user in this room session.
 */
export function subscribeToSeatGiftCoins(
  roomId: string,
  onUpdate: (coinsMap: Record<string, number>) => void,
): Unsubscribe {
  const seatCoinsRef = ref(database, `rooms/${roomId}/seatGiftCoins`);
  return onValue(seatCoinsRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as Record<string, number>);
    } else {
      onUpdate({});
    }
  });
}
