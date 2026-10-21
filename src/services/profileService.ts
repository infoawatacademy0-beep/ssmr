import {
  ref,
  get,
  update,
  runTransaction,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { ProfileVisitor, User } from '../types';

/**
 * Normalizes raw visitors data from Firebase into a sorted ProfileVisitor array.
 */
export function normalizeVisitors(rawVisitors: unknown): ProfileVisitor[] {
  if (!rawVisitors) return [];

  let list: unknown[] = [];
  if (Array.isArray(rawVisitors)) {
    list = rawVisitors;
  } else if (typeof rawVisitors === 'object') {
    list = Object.values(rawVisitors as Record<string, unknown>);
  }

  return list
    .filter((v): v is ProfileVisitor => Boolean(v && typeof v === 'object' && 'visitorUid' in v))
    .map((v) => ({
      visitorUid: String(v.visitorUid),
      visitorName: String(v.visitorName || 'Visitor'),
      avatar: v.avatar ? String(v.avatar) : null,
      timestamp: Number(v.timestamp) || Date.now(),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Logs a profile view when User A checks User B's profile.
 * Prevents consecutive duplicate logging within a 5-minute cooldown.
 */
export async function viewUserProfile(
  targetUid: string,
  visitorUser: { uid: string; username: string; avatar?: string | null },
): Promise<void> {
  // Prevent logging visits to one's own profile
  if (!targetUid || !visitorUser.uid || targetUid === visitorUser.uid) {
    return;
  }

  const visitorsRef = ref(database, `users/${targetUid}/profileVisitors`);

  await runTransaction(visitorsRef, (currentData) => {
    const visitors = normalizeVisitors(currentData);
    const now = Date.now();

    // Check if the most recent visitor is already this user within the last 5 minutes
    const latestFromThisUser = visitors.find((v) => v.visitorUid === visitorUser.uid);
    if (latestFromThisUser && now - latestFromThisUser.timestamp < 5 * 60 * 1000) {
      // Cooldown active: update timestamp of existing entry without inflating list
      latestFromThisUser.timestamp = now;
      latestFromThisUser.visitorName = visitorUser.username;
      latestFromThisUser.avatar = visitorUser.avatar || null;
      return visitors.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Add new visitor at the top
    const newVisitor: ProfileVisitor = {
      visitorUid: visitorUser.uid,
      visitorName: visitorUser.username,
      avatar: visitorUser.avatar || null,
      timestamp: now,
    };

    const updated = [newVisitor, ...visitors.filter((v) => v.visitorUid !== visitorUser.uid)];

    // Keep top 30 most recent visitors
    return updated.slice(0, 30);
  });
}

/**
 * Updates editable social profile fields (bio, profileImage, avatar) for a user.
 */
export async function updateUserSocialProfile(
  uid: string,
  data: { bio?: string; profileImage?: string; avatar?: string; username?: string },
): Promise<void> {
  if (!uid) throw new Error('User ID is required to update profile.');

  const userRef = ref(database, `users/${uid}`);
  const updates: Record<string, any> = {};

  if (typeof data.bio === 'string') {
    updates.bio = data.bio.trim().slice(0, 200);
  }

  if (data.profileImage !== undefined) {
    updates.profileImage = data.profileImage;
    updates.avatar = data.profileImage; // Keep avatar in sync
  } else if (data.avatar !== undefined) {
    updates.avatar = data.avatar;
    updates.profileImage = data.avatar;
  }

  if (data.username && data.username.trim()) {
    updates.username = data.username.trim();
  }

  updates.lastSeen = Date.now();

  await update(userRef, updates);
}

/**
 * Fetches a user's full social profile from Firebase Realtime Database.
 */
export async function getUserSocialProfile(uid: string): Promise<User | null> {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) return null;

  const raw = snapshot.val();
  return {
    ...raw,
    uid,
    bio: raw.bio || 'Exploring the Live Voice Arena.',
    profileImage: raw.profileImage || raw.avatar || '',
    avatar: raw.avatar || raw.profileImage || '',
    posts: Array.isArray(raw.posts) ? raw.posts : raw.posts ? Object.values(raw.posts) : [],
    profileVisitors: normalizeVisitors(raw.profileVisitors),
  } as User;
}

/**
 * Real-time listener for a user's profile visitors list.
 */
export function subscribeToUserVisitors(
  uid: string,
  onUpdate: (visitors: ProfileVisitor[]) => void,
): Unsubscribe {
  const visitorsRef = ref(database, `users/${uid}/profileVisitors`);
  return onValue(visitorsRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
    } else {
      onUpdate(normalizeVisitors(snapshot.val()));
    }
  });
}
