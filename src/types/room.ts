import type { RoomCinemaState } from './cinema';

/**
 * Chat message within an active voice room.
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderIsVerified?: boolean;
  text: string;
  timestamp: number;
}

export type SeatRole = 'host' | 'coHost' | 'moderator' | 'vip' | 'speaker';

export type VoiceEffectMode = 'normal' | 'child' | 'venom';

/**
 * Seat in the 8-seat audio grid.
 */
export type SeatTier = 'standard' | 'iron' | 'vip' | 'platinum';

export interface Seat {
  seatNo: number; // 1 to 16
  userId: string | null;
  username: string | null;
  avatar: string | null;
  isVerified?: boolean;
  isMuted: boolean;
  isLocked: boolean;
  role?: SeatRole;
  isMicBlocked?: boolean;
  voiceEffect?: VoiceEffectMode;
  isVip?: boolean;
  isPlatinum?: boolean;
  isIron?: boolean;
  seatTier?: SeatTier;
  vipAssignedName?: string | null;
  vipAssignedUserId?: string | null;
}

export type RoomCategory = 'Gaming' | 'Voice Chat' | 'Music' | 'Chill';

export interface RoomEntranceEvent {
  id: string;
  uid: string;
  username: string;
  level: number;
  avatar?: string;
  isVerified?: boolean;
  timestamp: number;
}

export interface RoomGiftEvent {
  id: string;
  senderUid: string;
  senderUsername: string;
  recipientUid: string;
  recipientUsername: string;
  gift: any;
  timestamp: number;
}

/**
 * Real-time Voice Chat Room entity.
 */
export interface Room {
  id: string;
  roomName: string;
  category?: RoomCategory;
  isPrivate?: boolean;
  password?: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  participantCount?: number;
  activeChat: ChatMessage[];
  seats: Seat[];
  seatCount?: number;
  coHosts?: Record<string, boolean>;
  moderators?: Record<string, boolean>;
  memberRanks?: Record<string, SeatRole>;
  blockedMics?: Record<string, boolean>;
  latestEntrance?: RoomEntranceEvent | null;
  cinema?: RoomCinemaState | null;
  createdAt: number;
}

/**
 * Helper to build an initial set of empty seats (1 to count, default 8).
 */
export function buildInitialSeats(count = 8): Seat[] {
  const safeCount = Math.max(1, Math.min(16, count));
  return Array.from({ length: safeCount }, (_, index) => ({
    seatNo: index + 1,
    userId: null,
    username: null,
    avatar: null,
    isMuted: false,
    isLocked: false,
    role: 'speaker',
    isMicBlocked: false,
  }));
}
