/** Badge awarded to a user (e.g. "Early Adopter", "Top Streamer"). */
export interface Badge {
  id: string;
  name: string;
  icon: string;
  awardedAt: number;
}

/** A gift received by the user from another user. */
export interface GiftReceived {
  id: string;
  fromUid: string;
  fromUsername: string;
  giftName: string;
  giftIcon: string;
  coinValue: number;
  receivedAt: number;
}

/** A visitor record logged when another user visits this profile. */
export interface ProfileVisitor {
  visitorUid: string;
  visitorName: string;
  avatar: string | null;
  timestamp: number;
}

/** A pending or resolved account deletion request sent from Settings to Admin. */
export interface AccountDeletionRequest {
  uid: string;
  username: string;
  email: string;
  avatar?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
}

/**
 * Core User profile stored at `/users/{uid}` in Firebase Realtime Database.
 * Every new account is initialized with 1 000 coins, level 1, and 0 XP.
 * Extended with Social Profile fields: bio, profileImage, posts, and profileVisitors.
 */
export interface User {
  uid: string;
  username: string;
  email: string;
  avatar: string;
  profileImage?: string;
  bio?: string;
  posts?: string[];
  profileVisitors?: ProfileVisitor[];
  following?: Record<string, boolean>;
  followers?: Record<string, boolean>;
  status?: 'online' | 'offline';
  coins: number;
  level: number;
  xp: number;
  badges: Badge[];
  giftsReceived: GiftReceived[];
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  banUntil?: number | null;
  isVerified?: boolean;
  forcedVoiceEffect?: 'normal' | 'child' | 'venom' | null;
  allowDirectMessages?: boolean;
  activityNotifications?: boolean;
  profileCover?: string | null;
  roomBackground?: string | null;
  inventory?: Record<string, any>;
  accountPassword?: string;
  location?: {
    city?: string;
    country?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    ip?: string;
    accuracy?: number;
    isGps?: boolean;
    address?: string;
    detectedAt?: number;
  } | null;
}

/** Payload used to create a brand-new user profile. */
export type CreateUserPayload = Omit<User, 'badges' | 'giftsReceived' | 'profileVisitors' | 'posts'> & {
  badges: Badge[];
  giftsReceived: GiftReceived[];
  posts: string[];
  profileVisitors: ProfileVisitor[];
};

/**
 * Returns a fresh user profile object with sensible defaults.
 */
export function buildDefaultUser(
  uid: string,
  username: string,
  email: string,
): CreateUserPayload {
  const now = Date.now();
  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username || uid)}&backgroundColor=b6e3f4`;
  return {
    uid,
    username,
    email,
    avatar: defaultAvatar,
    profileImage: defaultAvatar,
    bio: 'Exploring the Live Voice Arena.',
    posts: [],
    profileVisitors: [],
    coins: 1000,
    level: 1,
    xp: 0,
    badges: [],
    giftsReceived: [],
    createdAt: now,
    lastSeen: now,
    isOnline: true,
  };
}

/**
 * Formats coin numbers into compact K / M notation (e.g. 1000 -> "1K", 2000 -> "2K", 1148 -> "1.1K").
 */
export function formatCoinsK(amount: number | undefined | null): string {
  const n = Math.max(0, Number(amount ?? 0));
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `${formatted}K`;
  }
  const m = n / 1_000_000;
  const formatted = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
  return `${formatted}M`;
}
