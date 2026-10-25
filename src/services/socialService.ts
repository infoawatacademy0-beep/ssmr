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
import type { User } from '../types';

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

/**
 * Subscribes to mutual friends count (users who follow each other).
 */
export function subscribeToFriendsCount(
  uid: string,
  callback: (count: number) => void,
): Unsubscribe {
  if (!uid) {
    callback(0);
    return () => {};
  }
  const userRef = ref(database, `users/${uid}`);
  return onValue(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(0);
      return;
    }
    const val = snapshot.val();
    const following = val.following ? Object.keys(val.following) : [];
    const followers = val.followers ? Object.keys(val.followers) : [];
    const mutualFriends = following.filter((fUid) => followers.includes(fUid));
    callback(mutualFriends.length);
  });
}

/**
 * Accepts a follower by following them back mutually and sending a confirmation alert.
 */
export async function acceptFollow(
  currentUser: { uid: string; username: string; avatar?: string | null },
  followerUid: string,
): Promise<void> {
  if (!currentUser.uid || !followerUid || currentUser.uid === followerUid) return;

  await followUser(currentUser.uid, followerUid);

  try {
    await sendNotification({
      recipientUid: followerUid,
      senderUid: currentUser.uid,
      senderName: currentUser.username,
      senderAvatar: currentUser.avatar || null,
      type: 'follow',
      title: 'هاوڕێیەتی پەسەندکرا 🤝',
      body: `${currentUser.username} فۆڵۆوەکەی تۆی وەرگرت و بوون بە هاوڕێ!`,
    });
  } catch {
    // Non-critical notification error
  }
}

/**
 * Helper to hydrate an array of user UIDs into rich User objects.
 */
async function hydrateUserList(uids: string[]): Promise<User[]> {
  if (!uids.length) return [];
  const promises = uids.map(async (uid) => {
    try {
      const snap = await get(ref(database, `users/${uid}`));
      if (!snap.exists()) return null;
      const data = snap.val();
      return {
        ...data,
        uid,
        username: data.username || 'ئەندام',
        avatar: data.avatar || data.profileImage || '',
        profileImage: data.profileImage || data.avatar || '',
        bio: data.bio || '',
        level: data.level || 1,
        coins: data.coins || 0,
        xp: data.xp || 0,
        isOnline: Boolean(data.isOnline || data.status === 'online'),
        isVerified: Boolean(data.isVerified),
        vipFrame: data.vipFrame || null,
      } as User;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((u): u is User => Boolean(u));
}

/**
 * Subscribes to the live list of followers for a user.
 */
export function subscribeToFollowersList(
  targetUid: string,
  callback: (users: User[]) => void,
): Unsubscribe {
  if (!targetUid) {
    callback([]);
    return () => {};
  }

  const followersRef = ref(database, `users/${targetUid}/followers`);
  return onValue(followersRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const uids = Object.keys(snapshot.val());
    const users = await hydrateUserList(uids);
    callback(users);
  });
}

/**
 * Subscribes to the live list of users being followed by a user.
 */
export function subscribeToFollowingList(
  userUid: string,
  callback: (users: User[]) => void,
): Unsubscribe {
  if (!userUid) {
    callback([]);
    return () => {};
  }

  const followingRef = ref(database, `users/${userUid}/following`);
  return onValue(followingRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const uids = Object.keys(snapshot.val());
    const users = await hydrateUserList(uids);
    callback(users);
  });
}

/**
 * Subscribes to mutual friends (users who both follow each other).
 */
export function subscribeToFriendsList(
  uid: string,
  callback: (users: User[]) => void,
): Unsubscribe {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const userRef = ref(database, `users/${uid}`);
  return onValue(userRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const following = data.following ? Object.keys(data.following) : [];
    const followers = data.followers ? Object.keys(data.followers) : [];
    const mutualUids = following.filter((fUid) => followers.includes(fUid));

    const users = await hydrateUserList(mutualUids);
    callback(users);
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
