import {
  ref,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import { sendNotification } from './notificationService';

/* ─────────────────────────────────────────────────────────────
   Mutual Follow Network & Real-Time Presence Engine
   ───────────────────────────────────────────────────────────── */

/**
 * Follow a user bidirectionally updating both nodes atomically:
 * `/users/{userUid}/following/{targetUid} = true`
 * `/users/{targetUid}/followers/{userUid} = true`
 */
export async function followUser(userUid: string, targetUid: string): Promise<void> {
  if (!userUid || !targetUid || userUid === targetUid) return;

  const updates: Record<string, any> = {
    [`users/${userUid}/following/${targetUid}`]: true,
    [`users/${targetUid}/followers/${userUid}`]: true,
  };

  await update(ref(database), updates);

  // Send follower activity notification (respects target's Activity Notifications setting)
  try {
    const senderSnap = await get(ref(database, `users/${userUid}`));
    const senderData = senderSnap.exists() ? senderSnap.val() : null;
    const senderName = senderData?.username || 'ئەندامێک';
    const senderAvatar = senderData?.avatar || senderData?.profileImage || null;

    await sendNotification({
      recipientUid: targetUid,
      senderUid: userUid,
      senderName,
      senderAvatar,
      type: 'follow',
      title: 'فۆڵۆوکارێکی نوێ 👥',
      body: `${senderName} فۆڵۆوی هەژمارەکەتی کرد!`,
    });
  } catch {
    // Ignore non-critical notification error
  }
}

/**
 * Unfollow a user bidirectionally removing both links.
 */
export async function unfollowUser(userUid: string, targetUid: string): Promise<void> {
  if (!userUid || !targetUid) return;

  const updates: Record<string, any> = {
    [`users/${userUid}/following/${targetUid}`]: null,
    [`users/${targetUid}/followers/${userUid}`]: null,
  };

  await update(ref(database), updates);
}

/**
 * Checks whether userUid is following targetUid once.
 */
export async function checkIsFollowing(userUid: string, targetUid: string): Promise<boolean> {
  if (!userUid || !targetUid) return false;
  const followRef = ref(database, `users/${userUid}/following/${targetUid}`);
  const snapshot = await get(followRef);
  return snapshot.exists() && Boolean(snapshot.val());
}

/**
 * Subscribes to the live follow state between two users.
 */
export function subscribeToFollowState(
  userUid: string,
  targetUid: string,
  callback: (isFollowing: boolean) => void,
): Unsubscribe {
  if (!userUid || !targetUid) {
    callback(false);
    return () => {};
  }

  const followRef = ref(database, `users/${userUid}/following/${targetUid}`);
  return onValue(followRef, (snapshot) => {
    callback(snapshot.exists() && Boolean(snapshot.val()));
  });
}

/**
 * Subscribes to the follower count of a user.
 */
export function subscribeToFollowersCount(
  targetUid: string,
  callback: (count: number) => void,
): Unsubscribe {
  const followersRef = ref(database, `users/${targetUid}/followers`);
  return onValue(followersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(0);
    } else {
      callback(Object.keys(snapshot.val()).length);
    }
  });
}

/**
 * Subscribes to the following count of a user.
 */
export function subscribeToFollowingCount(
  userUid: string,
  callback: (count: number) => void,
): Unsubscribe {
  const followingRef = ref(database, `users/${userUid}/following`);
  return onValue(followingRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(0);
    } else {
      callback(Object.keys(snapshot.val()).length);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Real-Time User Presence Engine (.info/connected + onDisconnect)
   ───────────────────────────────────────────────────────────── */

/**
 * Initializes automatic online/offline presence tracking for an authenticated user.
 * Sets `/users/{uid}/status` = 'online', `isOnline` = true, and configures `onDisconnect()` hooks.
 */
export function initUserPresence(uid: string): () => void {
  if (!uid) return () => {};

  const connectedRef = ref(database, '.info/connected');
  const userStatusRef = ref(database, `users/${uid}/status`);
  const userIsOnlineRef = ref(database, `users/${uid}/isOnline`);
  const userLastSeenRef = ref(database, `users/${uid}/lastSeen`);

  const unsubConnected = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === true) {
      // 1. Establish onDisconnect handlers
      const disconnectStatus = onDisconnect(userStatusRef);
      const disconnectIsOnline = onDisconnect(userIsOnlineRef);
      const disconnectLastSeen = onDisconnect(userLastSeenRef);

      await disconnectStatus.set('offline');
      await disconnectIsOnline.set(false);
      await disconnectLastSeen.set(serverTimestamp());

      // 2. Mark user currently active
      await set(userStatusRef, 'online');
      await set(userIsOnlineRef, true);
      await set(userLastSeenRef, Date.now());
    }
  });

  return () => {
    unsubConnected();
    // On explicit cleanup, mark offline
    set(userStatusRef, 'offline').catch(() => {});
    set(userIsOnlineRef, false).catch(() => {});
    set(userLastSeenRef, Date.now()).catch(() => {});
  };
}

/**
 * Subscribes to another user's live presence status (online/offline + lastSeen).
 */
export function subscribeToUserPresence(
  uid: string,
  callback: (presence: { isOnline: boolean; lastSeen: number; statusText: string }) => void,
): Unsubscribe {
  const userRef = ref(database, `users/${uid}`);

  return onValue(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback({ isOnline: false, lastSeen: Date.now(), statusText: 'Offline' });
      return;
    }

    const data = snapshot.val();
    const isOnline = Boolean(data.isOnline || data.status === 'online');
    const lastSeen = Number(data.lastSeen) || Date.now();

    let statusText = 'Online';
    if (!isOnline) {
      const diffMinutes = Math.floor((Date.now() - lastSeen) / 60000);
      if (diffMinutes < 1) statusText = 'Seen just now';
      else if (diffMinutes < 60) statusText = `Seen ${diffMinutes}m ago`;
      else {
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) statusText = `Seen ${diffHours}h ago`;
        else statusText = 'Offline';
      }
    }

    callback({ isOnline, lastSeen, statusText });
  });
}
