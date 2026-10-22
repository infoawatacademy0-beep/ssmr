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

export type VipFrameStyle =
  | 'fire'
  | 'pink'
  | 'crimson'
  | 'cyan'
  | 'purple'
  | 'emerald'
  | 'gold'
  | 'rainbow';

export interface VipFrameOption {
  id: VipFrameStyle;
  name: string;
  badge: string;
  cssClass: string;
  previewGradient: string;
}

export const VIP_FRAME_CATALOG: VipFrameOption[] = [
  {
    id: 'fire',
    name: 'ئاگری ڕاستەقینە · Real Inferno Fire',
    badge: '🔥 Fire',
    cssClass: 'vip-fire-avatar',
    previewGradient: 'linear-gradient(135deg, #fde047, #f97316, #dc2626)',
  },
  {
    id: 'pink',
    name: 'پەمەیی شاژن · Pink Sakura Flame',
    badge: '🌸 Pink Queen',
    cssClass: 'vip-fire-avatar vip-frame-pink',
    previewGradient: 'linear-gradient(135deg, #fbcfe8, #ec4899, #be185d)',
  },
  {
    id: 'crimson',
    name: 'بورکانی سوور · Hellfire Crimson',
    badge: '🩸 Crimson',
    cssClass: 'vip-fire-avatar vip-frame-crimson',
    previewGradient: 'linear-gradient(135deg, #fca5a5, #ef4444, #7f1d1d)',
  },
  {
    id: 'cyan',
    name: 'بروسکەی کارەبایی · Cyber Ice Lightning',
    badge: '⚡ Cyber Ice',
    cssClass: 'vip-fire-avatar vip-frame-cyan',
    previewGradient: 'linear-gradient(135deg, #a5f3fc, #06b6d4, #1d4ed8)',
  },
  {
    id: 'purple',
    name: 'مۆری شاهانە · Royal Galaxy Violet',
    badge: '👑 Royal Purple',
    cssClass: 'vip-fire-avatar vip-frame-purple',
    previewGradient: 'linear-gradient(135deg, #e9d5ff, #a855f7, #581c87)',
  },
  {
    id: 'emerald',
    name: 'ئاگری ئەژدیها · Dragon Emerald Fire',
    badge: '🐉 Dragon Green',
    cssClass: 'vip-fire-avatar vip-frame-emerald',
    previewGradient: 'linear-gradient(135deg, #a7f3d0, #10b981, #065f46)',
  },
  {
    id: 'gold',
    name: 'زێڕی عەیار ٢٤ · Pure 24K Diamond Gold',
    badge: '✨ 24K Gold',
    cssClass: 'vip-fire-avatar vip-frame-gold',
    previewGradient: 'linear-gradient(135deg, #fef9c3, #facc15, #b45309)',
  },
  {
    id: 'rainbow',
    name: 'ئیمپراتۆری حەوت ڕەنگ · Mythic Chroma RGB',
    badge: '🌈 Rainbow RGB',
    cssClass: 'vip-fire-avatar vip-frame-rainbow',
    previewGradient: 'linear-gradient(135deg, #f43f5e, #f59e0b, #10b981, #06b6d4, #a855f7)',
  },
];

export function getVipAvatarClass(
  isVip?: boolean,
  vipFrame?: VipFrameStyle | string | null,
): string {
  if (!isVip && !vipFrame) return '';
  switch (vipFrame) {
    case 'pink':
      return 'vip-fire-avatar vip-frame-pink';
    case 'crimson':
      return 'vip-fire-avatar vip-frame-crimson';
    case 'cyan':
      return 'vip-fire-avatar vip-frame-cyan';
    case 'purple':
      return 'vip-fire-avatar vip-frame-purple';
    case 'emerald':
      return 'vip-fire-avatar vip-frame-emerald';
    case 'gold':
      return 'vip-fire-avatar vip-frame-gold';
    case 'rainbow':
      return 'vip-fire-avatar vip-frame-rainbow';
    default:
      return 'vip-fire-avatar';
  }
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
  vipFrame?: VipFrameStyle | null;
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
