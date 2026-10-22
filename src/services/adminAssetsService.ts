import { ref, update, get, set, remove, onValue, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { User, VoiceEffectMode, AccountDeletionRequest } from '../types';

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

/* ─────────────────────────────────────────────────────────────
   Account Deletion Request & Admin Approval Workflow
   ───────────────────────────────────────────────────────────── */

/**
 * Submits a user's request to permanently delete their account to the Admin Panel.
 */
export async function requestAccountDeletion(
  user: User,
  reason = 'User requested permanent account deletion from Settings.',
): Promise<void> {
  if (!user?.uid) throw new Error('User UID is required.');

  const reqRef = ref(database, `accountDeletionRequests/${user.uid}`);
  const payload: AccountDeletionRequest = {
    uid: user.uid,
    username: user.username || 'User',
    email: user.email || '',
    avatar: user.avatar || user.profileImage || '',
    reason: reason.trim(),
    status: 'pending',
    requestedAt: Date.now(),
  };

  await set(reqRef, payload);
}

/**
 * Cancels a pending account deletion request.
 */
export async function cancelAccountDeletionRequest(uid: string): Promise<void> {
  if (!uid) return;
  await remove(ref(database, `accountDeletionRequests/${uid}`));
}

/**
 * Subscribes to a single user's account deletion request status.
 */
export function subscribeToUserDeletionRequest(
  uid: string,
  onUpdate: (req: AccountDeletionRequest | null) => void,
): Unsubscribe {
  const reqRef = ref(database, `accountDeletionRequests/${uid}`);
  return onValue(reqRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as AccountDeletionRequest);
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Subscribes to all pending account deletion requests for the Admin Panel.
 */
export function subscribeToAllDeletionRequests(
  onUpdate: (requests: AccountDeletionRequest[]) => void,
): Unsubscribe {
  const allRef = ref(database, 'accountDeletionRequests');
  return onValue(allRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const raw = snapshot.val() as Record<string, AccountDeletionRequest>;
    const list = Object.values(raw)
      .filter((item) => item && item.uid && item.status === 'pending')
      .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
    onUpdate(list);
  });
}

/**
 * Admin Action: Permanently deletes a user's account (either directly by Admin without user notice,
 * or when approving a deletion request). Immediately terminates active sessions and vacates room seats.
 */
export async function approveAccountDeletion(targetUid: string): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');

  // 1. Mark in /deletedAccounts/{targetUid} so active sessions are immediately terminated & blocked
  await set(ref(database, `deletedAccounts/${targetUid}`), {
    uid: targetUid,
    deletedAt: Date.now(),
    approvedByAdmin: true,
  });

  // 2. Vacate any seat in any active room where this user is sitting
  try {
    const roomsSnap = await get(ref(database, 'rooms'));
    if (roomsSnap.exists()) {
      const roomsData = roomsSnap.val() as Record<string, any>;
      const updates: Record<string, any> = {};
      for (const [roomId, roomObj] of Object.entries(roomsData)) {
        if (!roomObj) continue;
        if (roomObj.seats) {
          const seats = Array.isArray(roomObj.seats)
            ? roomObj.seats
            : Object.values(roomObj.seats);
          seats.forEach((seat: any, idx: number) => {
            if (seat && seat.userId === targetUid) {
              updates[`rooms/${roomId}/seats/${idx}`] = {
                seatNo: seat.seatNo ?? idx + 1,
                userId: null,
                username: null,
                avatar: null,
                level: null,
                isMuted: false,
                isLocked: Boolean(seat.isLocked),
                voiceEffect: 'normal',
              };
            }
          });
        }
        updates[`rooms/${roomId}/audience/${targetUid}`] = null;
      }
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    }
  } catch (err) {
    console.warn('Could not clean room seats on account deletion:', err);
  }

  // 3. Remove user profile, stories, presence, notifications, and any deletion request
  await remove(ref(database, `users/${targetUid}`));
  await remove(ref(database, `stories/${targetUid}`));
  await remove(ref(database, `notifications/${targetUid}`));
  await remove(ref(database, `accountDeletionRequests/${targetUid}`));
}

/**
 * Admin Action: Rejects/dismisses an account deletion request without deleting the account.
 */
export async function rejectAccountDeletion(targetUid: string): Promise<void> {
  if (!targetUid) throw new Error('Target UID is required.');
  await remove(ref(database, `accountDeletionRequests/${targetUid}`));
}
