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
  visitCount?: number;
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
  _isVip?: boolean,
  _vipFrame?: VipFrameStyle | string | null,
): string {
  // Per user request: VIP status should NOT force a colored animated ring around the avatar;
  // only the clean VIP Level badge (e.g. VIP 1, VIP 5) is displayed.
  return '';
}

export const VIP_LEVEL_THRESHOLDS: { level: number; minXp: number; nameKu: string; nameEn: string }[] = [
  { level: 1, minXp: 99, nameKu: 'ڤایپ ١', nameEn: 'VIP 1' },
  { level: 2, minXp: 500, nameKu: 'ڤایپ ٢', nameEn: 'VIP 2' },
  { level: 3, minXp: 1500, nameKu: 'ڤایپ ٣', nameEn: 'VIP 3' },
  { level: 4, minXp: 5000, nameKu: 'ڤایپ ٤', nameEn: 'VIP 4' },
  { level: 5, minXp: 10000, nameKu: 'ڤایپ ٥', nameEn: 'VIP 5' },
  { level: 6, minXp: 55000, nameKu: 'ڤایپ ٦', nameEn: 'VIP 6' },
  { level: 7, minXp: 150000, nameKu: 'ڤایپ ٧', nameEn: 'VIP 7' },
  { level: 8, minXp: 350000, nameKu: 'ڤایپ ٨', nameEn: 'VIP 8' },
  { level: 9, minXp: 750000, nameKu: 'ڤایپ ٩', nameEn: 'VIP 9' },
  { level: 10, minXp: 1500000, nameKu: 'ڤایپ ١٠', nameEn: 'VIP 10' },
];

export function calculateVipLevelFromXp(vipXp: number = 0, isVerified?: boolean, explicitVipLevel?: number): number {
  let computed = 0;
  for (const tier of VIP_LEVEL_THRESHOLDS) {
    if (vipXp >= tier.minXp) {
      computed = tier.level;
    }
  }
  if (explicitVipLevel && explicitVipLevel > computed) {
    computed = explicitVipLevel;
  }
  if (isVerified && computed < 1) {
    computed = 1;
  }
  return Math.min(10, Math.max(0, computed));
}

export function getUserVipLevel(user?: Partial<User> | null): number {
  if (!user) return 0;
  return calculateVipLevelFromXp(user.vipXp ?? 0, user.isVerified, user.vipLevel);
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
  vipLevel?: number;
  vipXp?: number;
  badges: Badge[];
  giftsReceived: GiftReceived[];
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
  isAnonymous?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  banUntil?: number | null;
  isVerified?: boolean;
  vipFrame?: VipFrameStyle | null;
  avatarFrame?: string | null;
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
  deviceInfo?: UserDeviceInfo | null;
}

/** Device and mobile hardware telemetry detected on user connection. */
export interface UserDeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceModel: string;
  brand: string;
  os: string;
  browser: string;
  screen?: string;
  isMobile: boolean;
  detectedAt?: number;
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
