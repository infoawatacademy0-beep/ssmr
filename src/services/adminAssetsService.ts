import { ref, update, get } from 'firebase/database';
import { database } from '../config/firebase';
import type { User, VoiceEffectMode } from '../types';

/**
 * Permanently bans a user account.
 * Flags the account as banned indefinitely and terminates presence state.
 */
export async function permanentBanUser(
  targetUid: string,
  reason = 'Permanent ban issued by Administration for policy violations.',
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, {
    isBanned: true,
    banReason: reason,
    bannedAt: Date.now(),
    banUntil: null, // null denotes lifetime ban
    isOnline: false,
    status: 'offline',
  });
}

/**
 * Applies a timed temporary ban to a user account.
 * Writes a timestamp to `/users/{targetUid}/banUntil`.
 */
export async function tempBanUser(
  targetUid: string,
  durationInHours: number,
  reason = 'Temporary suspension issued by Administration.',
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');
  if (durationInHours <= 0) throw new Error('Ban duration must be greater than 0.');

  const banUntil = Date.now() + durationInHours * 3600000;
  const userRef = ref(database, `users/${targetUid}`);

  await update(userRef, {
    isBanned: true,
    banReason: reason,
    bannedAt: Date.now(),
    banUntil,
    isOnline: false,
    status: 'offline',
  });
}

/**
 * Lifts any temporary or permanent ban for a user.
 */
export async function unbanUserAccount(targetUid: string): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, {
    isBanned: false,
    banReason: null,
    bannedAt: null,
    banUntil: null,
  });
}

/**
 * Grants or revokes the official Verified Badge (Blue Tick) on a user's profile.
 */
export async function toggleVerificationBadge(
  targetUid: string,
  isVerified: boolean,
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, {
    isVerified,
  });
}

/**
 * Assigns premium graphic cosmetics: Custom Profile Cover and Room Background.
 */
export async function assignPremiumCosmetics(
  targetUid: string,
  profileCoverUrl?: string | null,
  roomBackgroundUrl?: string | null,
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  const updates: Record<string, any> = {};
  if (profileCoverUrl !== undefined) {
    updates.profileCover = profileCoverUrl && profileCoverUrl.trim() !== '' ? profileCoverUrl.trim() : null;
  }
  if (roomBackgroundUrl !== undefined) {
    updates.roomBackground = roomBackgroundUrl && roomBackgroundUrl.trim() !== '' ? roomBackgroundUrl.trim() : null;
  }

  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, updates);
}

/**
 * Modifies a user's coin balance from the admin console.
 */
export async function modifyUserCoins(
  targetUid: string,
  newBalance: number,
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');
  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, {
    coins: Math.max(0, Math.floor(newBalance)),
  });
}

/**
 * Allows an Administrator to silently force-change any user's microphone voice
 * ('normal' | 'child' | 'venom') without requiring the user to have VIP or permission.
 * Updates both `/users/{targetUid}/forcedVoiceEffect` and any active room seat they occupy.
 */
export async function setAdminForcedVoice(
  targetUid: string,
  voiceEffect: VoiceEffectMode,
): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  const userRef = ref(database, `users/${targetUid}`);
  await update(userRef, {
    forcedVoiceEffect: voiceEffect,
  });

  // Also immediately update any active seat in any room where this user is currently sitting
  try {
    const roomsSnap = await get(ref(database, 'rooms'));
    if (roomsSnap.exists()) {
      const roomsData = roomsSnap.val() as Record<string, any>;
      const updates: Record<string, any> = {};
      for (const [roomId, roomObj] of Object.entries(roomsData)) {
        if (!roomObj || !roomObj.seats) continue;
        const seats = Array.isArray(roomObj.seats)
          ? roomObj.seats
          : Object.values(roomObj.seats);
        seats.forEach((seat: any, idx: number) => {
          if (seat && seat.userId === targetUid) {
            updates[`rooms/${roomId}/seats/${idx}/voiceEffect`] = voiceEffect;
          }
        });
      }
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    }
  } catch (err) {
    console.warn('Could not sync forced voice to active room seats:', err);
  }
}

/**
 * Evaluates whether a user's account is currently blocked by ban.
 * Automatically handles expired temporary suspensions.
 */
export function checkUserBanStatus(user: User | null | undefined): {
  isBlocked: boolean;
  isPermanent: boolean;
  remainingHours?: number;
  reason: string;
} {
  if (!user || !user.isBanned) {
    return { isBlocked: false, isPermanent: false, reason: '' };
  }

  const defaultReason = user.banReason || 'Your account has been suspended by Administration.';

  // If there's an active temporary expiration timestamp
  if (user.banUntil) {
    const now = Date.now();
    if (now < user.banUntil) {
      const remainingMs = user.banUntil - now;
      const remainingHours = Math.ceil(remainingMs / 3600000);
      return {
        isBlocked: true,
        isPermanent: false,
        remainingHours,
        reason: `${defaultReason} (Suspension expires in approx. ${remainingHours} hours)`,
      };
    } else {
      // Temporary ban has lapsed
      return { isBlocked: false, isPermanent: false, reason: '' };
    }
  }

  // Lifetime / permanent ban
  return {
    isBlocked: true,
    isPermanent: true,
    reason: `${defaultReason} (Permanent ban)`,
  };
}
