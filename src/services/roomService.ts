import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  runTransaction,
  query,
  limitToFirst,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { Room, Seat, ChatMessage, RoomCategory, RoomEntranceEvent, VoiceEffectMode } from '../types';
import { buildInitialSeats } from '../types';

/* ─────────────────────────────────────────────────────────────
   Firebase Real-Time Voice Room Service
   Handles atomic seat reservations, real-time messaging,
   live synchronization, and user room entrance broadcasting.
   ───────────────────────────────────────────────────────────── */

export interface HostUserInfo {
  uid: string;
  username: string;
  avatar?: string;
}

export interface UserSeatInfo {
  uid: string;
  username: string;
  avatar?: string;
  isVerified?: boolean;
  isMuted?: boolean;
  voiceEffect?: VoiceEffectMode;
  isAdmin?: boolean;
}

export interface CreateRoomOptions {
  roomName: string;
  hostUser: HostUserInfo;
  category?: RoomCategory;
  isPrivate?: boolean;
  password?: string;
}

/**
 * Normalizes seats data from Firebase Realtime Database into
 * a strict 8-element Seat array.
 */
function normalizeSeats(rawSeats: unknown): Seat[] {
  if (!rawSeats) return buildInitialSeats(8);

  let seatList: unknown[] = [];
  if (Array.isArray(rawSeats)) {
    seatList = rawSeats;
  } else if (typeof rawSeats === 'object') {
    seatList = Object.values(rawSeats as Record<string, unknown>);
  }

  const length = Math.max(seatList.length, 1);
  const initialSeats = buildInitialSeats(length);

  return initialSeats.map((defaultSeat, index) => {
    const rawSeat = seatList[index] as Partial<Seat> | undefined;
    if (!rawSeat) return defaultSeat;

    const isPlatinum = Boolean(rawSeat.isPlatinum || rawSeat.seatTier === 'platinum');
    const isIron = Boolean(rawSeat.isIron || rawSeat.seatTier === 'iron');
    const isVip = Boolean(rawSeat.seatTier === 'vip' || (rawSeat.isVip && !isPlatinum && !isIron));
    const seatTier: SeatTier = isPlatinum ? 'platinum' : isIron ? 'iron' : isVip ? 'vip' : 'standard';

    return {
      seatNo: index + 1,
      userId: rawSeat.userId ?? null,
      username: rawSeat.username ?? null,
      avatar: rawSeat.avatar ?? null,
      isVerified: Boolean(rawSeat.isVerified),
      isMuted: Boolean(rawSeat.isMuted),
      isLocked: Boolean(rawSeat.isLocked),
      voiceEffect: (rawSeat.voiceEffect as VoiceEffectMode) || 'normal',
      isVip,
      isPlatinum,
      isIron,
      seatTier,
      vipAssignedName: rawSeat.vipAssignedName || null,
      vipAssignedUserId: rawSeat.vipAssignedUserId || null,
    };
  });
}

/**
 * Normalizes activeChat from Firebase RTDB (object map or array) into ChatMessage[].
 */
function normalizeChat(rawChat: unknown): ChatMessage[] {
  if (!rawChat) return [];

  if (Array.isArray(rawChat)) {
    return rawChat.filter(Boolean) as ChatMessage[];
  }

  if (typeof rawChat === 'object') {
    return Object.entries(rawChat as Record<string, Partial<ChatMessage>>)
      .map(([key, msg]) => ({
        id: msg?.id || key,
        senderId: msg?.senderId || '',
        senderName: msg?.senderName || 'Anonymous',
        senderAvatar: msg?.senderAvatar || null,
        senderIsVerified: Boolean(msg?.senderIsVerified),
        text: msg?.text || '',
        timestamp: msg?.timestamp || Date.now(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  return [];
}

/**
 * Creates a new voice room under `/rooms/{roomId}` with 8 vacant seats.
 * Supports categories and optional password protection.
 */
export async function createRoom(
  roomNameOrOptions: string | CreateRoomOptions,
  optionalHostUser?: HostUserInfo,
): Promise<string> {
  const roomsRef = ref(database, 'rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key;

  if (!roomId) {
    throw new Error('Failed to generate a room ID in Firebase.');
  }

  let roomName = '';
  let hostUser: HostUserInfo;
  let category: RoomCategory = 'Gaming';
  let isPrivate = false;
  let password = '';

  if (typeof roomNameOrOptions === 'object') {
    roomName = roomNameOrOptions.roomName.trim();
    hostUser = roomNameOrOptions.hostUser;
    category = roomNameOrOptions.category || 'Gaming';
    isPrivate = Boolean(roomNameOrOptions.isPrivate);
    password = roomNameOrOptions.password || '';
  } else {
    roomName = roomNameOrOptions.trim();
    hostUser = optionalHostUser!;
  }

  const initialSeats = buildInitialSeats();
  const initialWelcomeMessage: ChatMessage = {
    id: `msg_welcome_${Date.now()}`,
    senderId: 'system',
    senderName: 'System',
    text: `Welcome to ${roomName}! Tap any empty seat to take the microphone and begin speaking.`,
    timestamp: Date.now(),
  };

  const newRoomData: Room = {
    id: roomId,
    roomName,
    category,
    isPrivate,
    password,
    hostId: hostUser.uid,
    hostName: hostUser.username,
    hostAvatar: hostUser.avatar || '',
    participantCount: 1,
    seats: initialSeats,
    activeChat: [initialWelcomeMessage],
    createdAt: Date.now(),
  };

  await set(newRoomRef, {
    ...newRoomData,
    activeChat: {
      [initialWelcomeMessage.id]: initialWelcomeMessage,
    },
  });

  return roomId;
}

/**
 * Places a user on an empty, unlocked seat.
 * Atomically ensures:
 * 1. The user is removed from any previous seat they might occupy in this room.
 * 2. The target seat is not already taken or locked.
 */
export async function joinSeat(
  roomId: string,
  seatNo: number,
  user: UserSeatInfo,
): Promise<void> {
  if (seatNo < 1 || seatNo > 16) {
    throw new Error('Seat number must be between 1 and 16.');
  }

  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    let preservedIsMuted = typeof user.isMuted === 'boolean' ? user.isMuted : false;
    let preservedVoiceEffect: VoiceEffectMode = user.voiceEffect || 'normal';

    // 1. Remove the user from any seat they might already occupy, preserving their mute & voice effect state
    for (let i = 0; i < seats.length; i++) {
      if (seats[i].userId === user.uid) {
        preservedIsMuted = Boolean(seats[i].isMuted);
        preservedVoiceEffect = seats[i].voiceEffect || preservedVoiceEffect;
        const prevOccupied = seats[i];
        seats[i] = {
          seatNo: i + 1,
          userId: null,
          username: null,
          avatar: null,
          isMuted: false,
          isLocked: prevOccupied.isLocked || false,
          voiceEffect: 'normal',
          isVip: prevOccupied.isVip || false,
          isPlatinum: prevOccupied.isPlatinum || false,
          seatTier: prevOccupied.seatTier || (prevOccupied.isPlatinum ? 'platinum' : prevOccupied.isVip ? 'vip' : 'standard'),
          vipAssignedName: prevOccupied.vipAssignedName || null,
          vipAssignedUserId: prevOccupied.vipAssignedUserId || null,
        };
      }
    }

    // 2. Target seat validation (0-indexed)
    const targetIndex = seatNo - 1;
    const targetSeat = seats[targetIndex];

    if (!targetSeat) {
      throw new Error(`Target seat ${seatNo} does not exist.`);
    }

    if (targetSeat.isLocked && !user.isAdmin) {
      throw new Error(`Seat ${seatNo} is locked by host.`);
    }

    if (targetSeat.userId && targetSeat.userId !== user.uid) {
      if (!user.isAdmin) {
        throw new Error(`Seat ${seatNo} is already occupied.`);
      }
      // If admin takes an occupied seat, displace the current occupant to admin's previous seat (if admin was on stage)
      if (previousSeatIndex !== -1 && previousSeatIndex !== targetIndex) {
        seats[previousSeatIndex] = {
          ...seats[previousSeatIndex],
          userId: targetSeat.userId,
          username: targetSeat.username,
          avatar: targetSeat.avatar,
          isVerified: targetSeat.isVerified,
          isMuted: targetSeat.isMuted,
          voiceEffect: targetSeat.voiceEffect,
        };
      }
    }

    // Check VIP / Platinum / Iron seat reservation (Admins can sit anywhere!)
    if (!user.isAdmin && (targetSeat.isPlatinum || targetSeat.isVip || targetSeat.isIron)) {
      if (targetSeat.vipAssignedUserId || targetSeat.vipAssignedName) {
        const matchesUid = Boolean(targetSeat.vipAssignedUserId && targetSeat.vipAssignedUserId === user.uid);
        const matchesName = Boolean(
          targetSeat.vipAssignedName &&
          targetSeat.vipAssignedName.trim().toLowerCase() === user.username.trim().toLowerCase(),
        );

        // Strict reservation: ONLY this specific designated user can take this seat!
        if (!matchesUid && !matchesName) {
          const targetLabel = targetSeat.vipAssignedName || 'بەکارهێنەری دیاریکراو';
          const tierLabel = targetSeat.isPlatinum ? 'پلاتینیۆمە (Platinum)' : targetSeat.isIron ? 'ئاسنە (Iron)' : 'VIP';
          throw new Error(`ئەم کورسییە بە تایبەت ${tierLabel} و تەنها بۆ (${targetLabel}) دانراوە! کەسی تر ناتوانێت دابنیشێت.`);
        }
      }
    }

    // 3. Occupy target seat — keep user's previous mute state & voice effect
    seats[targetIndex] = {
      seatNo,
      userId: user.uid,
      username: user.username,
      avatar: user.avatar || '',
      isVerified: Boolean(user.isVerified),
      isMuted: preservedIsMuted,
      isLocked: false,
      voiceEffect: preservedVoiceEffect,
      isVip: targetSeat.isVip || false,
      isPlatinum: targetSeat.isPlatinum || false,
      isIron: targetSeat.isIron || false,
      seatTier: targetSeat.seatTier || (targetSeat.isPlatinum ? 'platinum' : targetSeat.isIron ? 'iron' : targetSeat.isVip ? 'vip' : 'standard'),
      vipAssignedName: targetSeat.vipAssignedName || null,
      vipAssignedUserId: targetSeat.vipAssignedUserId || null,
    };

    return seats;
  });

  // Chat notification removed per user request to prevent chat spam when switching seats
}

/**
 * Vacates a seat by setting user properties to null.
 */
export async function leaveSeat(
  roomId: string,
  seatNo: number,
): Promise<void> {
  if (seatNo < 1 || seatNo > 16) {
    throw new Error('Seat number must be between 1 and 16.');
  }

  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  let departedUsername: string | null = null;

  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    const targetIndex = seatNo - 1;

    if (seats[targetIndex]) {
      departedUsername = seats[targetIndex].username;
      const prevSeat = seats[targetIndex];
      seats[targetIndex] = {
        seatNo,
        userId: null,
        username: null,
        avatar: null,
        isMuted: false,
        isLocked: prevSeat.isLocked || false,
        isVip: prevSeat.isVip || false,
        isPlatinum: prevSeat.isPlatinum || false,
        isIron: prevSeat.isIron || false,
        seatTier: prevSeat.seatTier || (prevSeat.isPlatinum ? 'platinum' : prevSeat.isIron ? 'iron' : prevSeat.isVip ? 'vip' : 'standard'),
        vipAssignedName: prevSeat.vipAssignedName || null,
        vipAssignedUserId: prevSeat.vipAssignedUserId || null,
      };
    }

    return seats;
  });

  // Chat notification removed per user request to prevent chat spam when leaving/switching seats
}

/**
 * Toggles the microphone mute state for a specific seat.
 */
export async function toggleSeatMute(
  roomId: string,
  seatNo: number,
  isMuted: boolean,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatRef = ref(database, `rooms/${roomId}/seats/${targetIndex}`);
  await update(seatRef, {
    isMuted,
  });
}

/**
 * Updates the VIP voice changer effect mode for a specific seat.
 */
export async function setSeatVoiceEffect(
  roomId: string,
  seatNo: number,
  voiceEffect: VoiceEffectMode,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatRef = ref(database, `rooms/${roomId}/seats/${targetIndex}`);
  await update(seatRef, {
    voiceEffect,
  });
}

/**
 * Pushes a new chat message to `/rooms/{roomId}/activeChat`.
 */
export async function sendRoomMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  text: string,
  senderAvatar?: string | null,
  senderIsVerified?: boolean,
): Promise<void> {
  const cleanText = (text || '').trim();
  if (!cleanText || !roomId) return;

  const chatRef = ref(database, `rooms/${roomId}/activeChat`);
  const newMsgRef = push(chatRef);
  const messageId = newMsgRef.key || `msg_${Date.now()}`;

  const message: ChatMessage = {
    id: messageId,
    senderId: senderId || 'user',
    senderName: senderName || 'User',
    senderAvatar: senderAvatar || null,
    senderIsVerified: Boolean(senderIsVerified),
    text: cleanText,
    timestamp: Date.now(),
  };

  await set(newMsgRef, message);
}

/**
 * Clears all chat messages in the room (Host / Admin action).
 */
export async function clearRoomChat(roomId: string): Promise<void> {
  if (!roomId) return;
  const chatRef = ref(database, `rooms/${roomId}/activeChat`);
  await set(chatRef, null);
}

/**
 * Permanently deletes the whole room at once (Host / Admin action).
 * All connected clients are notified through their room subscription.
 */
export async function deleteRoom(roomId: string): Promise<void> {
  if (!roomId) return;
  await set(ref(database, `rooms/${roomId}`), null);
}

/**
 * Broadcasts a live user entrance event into `/rooms/{roomId}/latestEntrance`.
 */
export async function broadcastUserEntrance(
  roomId: string,
  user: { uid: string; username: string; level: number; avatar?: string; isVerified?: boolean },
): Promise<void> {
  const entranceRef = ref(database, `rooms/${roomId}/latestEntrance`);
  const entranceEvent: RoomEntranceEvent = {
    id: `ent_${Date.now()}_${user.uid.slice(0, 5)}`,
    uid: user.uid,
    username: user.username,
    level: user.level,
    avatar: user.avatar || '',
    isVerified: Boolean(user.isVerified),
    timestamp: Date.now(),
  };
  await set(entranceRef, entranceEvent);
}

/**
 * Subscribes to real-time user entrance events for a room.
 */
export function subscribeToRoomEntrance(
  roomId: string,
  onEntrance: (event: RoomEntranceEvent | null) => void,
): Unsubscribe {
  const entranceRef = ref(database, `rooms/${roomId}/latestEntrance`);
  return onValue(entranceRef, (snapshot) => {
    if (snapshot.exists()) {
      onEntrance(snapshot.val() as RoomEntranceEvent);
    } else {
      onEntrance(null);
    }
  });
}

/**
 * Subscribes in real-time to a room's state changes.
 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: Room | null) => void,
): Unsubscribe {
  const roomRef = ref(database, `rooms/${roomId}`);

  return onValue(
    roomRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      const val = snapshot.val();
      const room: Room = {
        id: val.id || roomId,
        roomName: val.roomName || 'Voice Room',
        category: val.category || 'Gaming',
        isPrivate: Boolean(val.isPrivate),
        password: val.password || '',
        hostId: val.hostId || '',
        hostName: val.hostName || 'Host',
        hostAvatar: val.hostAvatar || '',
        participantCount: val.participantCount || 1,
        seats: normalizeSeats(val.seats),
        activeChat: normalizeChat(val.activeChat),
        latestEntrance: val.latestEntrance || null,
        createdAt: val.createdAt || Date.now(),
      };

      onUpdate(room);
    },
    (error) => {
      console.error('Error listening to voice room:', error);
      onUpdate(null);
    },
  );
}

/**
 * Subscribes to the list of all available voice rooms with metadata.
 */
export function subscribeToRoomsList(
  onUpdate: (rooms: Room[]) => void,
): Unsubscribe {
  const roomsRef = ref(database, 'rooms');

  return onValue(roomsRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const val = snapshot.val() as Record<string, any>;
    const rooms: Room[] = Object.entries(val).map(([roomId, data]) => ({
      id: data.id || roomId,
      roomName: data.roomName || 'Voice Room',
      category: data.category || 'Gaming',
      isPrivate: Boolean(data.isPrivate),
      password: data.password || '',
      hostId: data.hostId || '',
      hostName: data.hostName || 'Host',
      hostAvatar: data.hostAvatar || '',
      participantCount: data.participantCount || Math.floor(Math.random() * 8) + 2,
      seats: normalizeSeats(data.seats),
      activeChat: normalizeChat(data.activeChat),
      latestEntrance: data.latestEntrance || null,
      createdAt: data.createdAt || Date.now(),
    }));

    // Sort newest first
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(rooms);
  });
}

/**
 * Strict 4-Room Directory Limit:
 * Fetches exactly 4 active rooms using Firebase query limitToFirst(4).
 */
export function subscribeToFeaturedRooms(
  limitCount: number = 4,
  onUpdate: (rooms: Room[]) => void,
): Unsubscribe {
  const roomsQuery = query(ref(database, 'rooms'), limitToFirst(limitCount));

  return onValue(roomsQuery, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const val = snapshot.val() as Record<string, any>;
    const rooms: Room[] = Object.entries(val).map(([roomId, data]) => ({
      id: data.id || roomId,
      roomName: data.roomName || 'Voice Room',
      category: data.category || 'Gaming',
      isPrivate: Boolean(data.isPrivate),
      password: data.password || '',
      hostId: data.hostId || '',
      hostName: data.hostName || 'Host',
      hostAvatar: data.hostAvatar || '',
      participantCount: data.participantCount || Math.floor(Math.random() * 8) + 2,
      seats: normalizeSeats(data.seats),
      activeChat: normalizeChat(data.activeChat),
      latestEntrance: data.latestEntrance || null,
      createdAt: data.createdAt || Date.now(),
    }));

    onUpdate(rooms.slice(0, limitCount));
  });
}

/**
 * Fetches single room snapshot once.
 */
export async function getRoomById(roomId: string): Promise<Room | null> {
  const snapshot = await get(ref(database, `rooms/${roomId}`));
  if (!snapshot.exists()) return null;

  const val = snapshot.val();
  return {
    id: val.id || roomId,
    roomName: val.roomName || 'Voice Room',
    category: val.category || 'Gaming',
    isPrivate: Boolean(val.isPrivate),
    password: val.password || '',
    hostId: val.hostId || '',
    hostName: val.hostName || 'Host',
    hostAvatar: val.hostAvatar || '',
    participantCount: val.participantCount || 1,
    seats: normalizeSeats(val.seats),
    activeChat: normalizeChat(val.activeChat),
    latestEntrance: val.latestEntrance || null,
    createdAt: val.createdAt || Date.now(),
  };
}

/**
 * Host Control: Evicts a user from a specific seat and sends system announcement.
 */
export async function kickUserFromSeat(
  roomId: string,
  seatNo: number,
  hostName: string,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  let kickedUsername = '';
  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    if (seats[targetIndex] && seats[targetIndex].userId) {
      kickedUsername = seats[targetIndex].username || 'User';
      const prevSeat = seats[targetIndex];
      seats[targetIndex] = {
        seatNo,
        userId: null,
        username: null,
        avatar: null,
        isMuted: false,
        isLocked: prevSeat.isLocked || false,
        isVip: prevSeat.isVip || false,
        isPlatinum: prevSeat.isPlatinum || false,
        isIron: prevSeat.isIron || false,
        seatTier: prevSeat.seatTier || (prevSeat.isPlatinum ? 'platinum' : prevSeat.isIron ? 'iron' : prevSeat.isVip ? 'vip' : 'standard'),
        vipAssignedName: prevSeat.vipAssignedName || null,
        vipAssignedUserId: prevSeat.vipAssignedUserId || null,
      };
    }
    return seats;
  });

  if (kickedUsername) {
    await sendRoomMessage(
      roomId,
      'system',
      'System',
      `[Host Action] ${kickedUsername} was vacated from Seat #${seatNo} by ${hostName}.`,
    );
  }
}

/**
 * Host/Admin Control: Configures VIP or Platinum seat status and designates an assigned user.
 */
export async function setSeatVipConfig(
  roomId: string,
  seatNo: number,
  tierOrIsVip: boolean | SeatTier,
  assignedName?: string | null,
  hostName?: string,
  assignedUserId?: string | null,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  const isPlatinum = tierOrIsVip === 'platinum';
  const isIron = tierOrIsVip === 'iron';
  const isVip = tierOrIsVip === 'vip' || tierOrIsVip === true;
  const seatTier: SeatTier = isPlatinum ? 'platinum' : isIron ? 'iron' : isVip ? 'vip' : 'standard';
  const hasSpecial = isPlatinum || isIron || isVip;

  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    if (!seats[targetIndex]) return seats;

    seats[targetIndex] = {
      ...seats[targetIndex],
      isVip,
      isPlatinum,
      isIron,
      seatTier,
      vipAssignedName: hasSpecial && assignedName ? assignedName.trim() : null,
      vipAssignedUserId: hasSpecial && assignedUserId ? assignedUserId.trim() : null,
    };
    return seats;
  });

  if (hostName) {
    const cleanName = assignedName?.trim();
    let actionText = '';
    if (isPlatinum) {
      actionText = `[Platinum Seat] کورسی #${seatNo} بە شێوەی پلاتینیۆم (Platinum) دیاریکرا${cleanName ? ` تەنها بۆ (${cleanName})` : ''} لەلایەن ${hostName}.`;
    } else if (isIron) {
      actionText = `[Iron Seat] کورسی #${seatNo} بە پلەی ئاسن (Iron) دیاریکرا${cleanName ? ` تەنها بۆ (${cleanName})` : ''} لەلایەن ${hostName}.`;
    } else if (isVip) {
      actionText = `[VIP Seat] کورسی #${seatNo} وەک کورسی VIP دیاریکرا${cleanName ? ` بە ناوی (${cleanName})` : ''} لەلایەن ${hostName}.`;
    } else {
      actionText = `[Seat Setup] تایبەتمەندی تایبەت لەسەر کورسی #${seatNo} لادرا لەلایەن ${hostName}.`;
    }
    await sendRoomMessage(roomId, 'System', actionText);
  }
}

/**
 * Admin/Host Control: Moves a user from one seat to another or swaps two seats.
 */
export async function moveUserToSeat(
  roomId: string,
  fromSeatNo: number,
  toSeatNo: number,
  adminName?: string,
): Promise<void> {
  if (fromSeatNo === toSeatNo) return;
  const fromIndex = fromSeatNo - 1;
  const toIndex = toSeatNo - 1;
  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  let movedUsername = '';
  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    const sourceSeat = seats[fromIndex];
    const targetSeat = seats[toIndex];
    if (!sourceSeat || !targetSeat) return seats;

    movedUsername = sourceSeat.username || 'User';

    const tempUser = {
      userId: sourceSeat.userId,
      username: sourceSeat.username,
      avatar: sourceSeat.avatar,
      isVerified: sourceSeat.isVerified,
      isMuted: sourceSeat.isMuted,
      voiceEffect: sourceSeat.voiceEffect,
    };

    seats[toIndex] = {
      ...targetSeat,
      userId: tempUser.userId,
      username: tempUser.username,
      avatar: tempUser.avatar,
      isVerified: tempUser.isVerified,
      isMuted: tempUser.isMuted,
      voiceEffect: tempUser.voiceEffect,
    };

    seats[fromIndex] = {
      ...sourceSeat,
      userId: targetSeat.userId,
      username: targetSeat.username,
      avatar: targetSeat.avatar,
      isVerified: targetSeat.isVerified,
      isMuted: targetSeat.isMuted,
      voiceEffect: targetSeat.voiceEffect,
    };

    return seats;
  });

  if (adminName && movedUsername) {
    await sendRoomMessage(
      roomId,
      'System',
      `[Admin Action] ${movedUsername} لە کورسی #${fromSeatNo} گوازرایەوە بۆ کورسی #${toSeatNo} لەلایەن ${adminName}.`,
    );
  }
}

/**
 * Admin/Host Control: Directly assigns/places any user onto a designated seat.
 */
export async function assignUserToSeat(
  roomId: string,
  targetSeatNo: number,
  targetUser: {
    uid: string;
    username: string;
    avatar?: string;
    isVerified?: boolean;
    voiceEffect?: VoiceEffectMode;
    isMuted?: boolean;
  },
  adminName?: string,
): Promise<void> {
  const targetIndex = targetSeatNo - 1;
  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  await runTransaction(seatsRef, (currentSeatsData) => {
    const seats = normalizeSeats(currentSeatsData);
    if (!seats[targetIndex]) return seats;

    // If targetUser was seated elsewhere in this room, free their previous seat
    for (let i = 0; i < seats.length; i++) {
      if (seats[i].userId === targetUser.uid && i !== targetIndex) {
        seats[i] = {
          ...seats[i],
          userId: null,
          username: null,
          avatar: null,
          isMuted: false,
        };
      }
    }

    const currentTarget = seats[targetIndex];
    seats[targetIndex] = {
      ...currentTarget,
      userId: targetUser.uid,
      username: targetUser.username,
      avatar: targetUser.avatar || '',
      isVerified: Boolean(targetUser.isVerified),
      isMuted: targetUser.isMuted ?? false,
      voiceEffect: targetUser.voiceEffect ?? 'normal',
    };

    return seats;
  });

  if (adminName) {
    await sendRoomMessage(
      roomId,
      'System',
      `[Admin Action] ${targetUser.username} لەسەر کورسی #${targetSeatNo} داندرا لەلایەن ${adminName}.`,
    );
  }
}

/**
 * Host Control: Locks or unlocks a specific seat so audience cannot sit without permission.
 */
export async function toggleSeatLock(
  roomId: string,
  seatNo: number,
  isLocked: boolean,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatRef = ref(database, `rooms/${roomId}/seats/${targetIndex}`);
  await update(seatRef, { isLocked });
}

/**
 * Host Control: Force mutes a seat speaker.
 */
export async function muteSeatByHost(
  roomId: string,
  seatNo: number,
  isMuted: boolean,
): Promise<void> {
  const targetIndex = seatNo - 1;
  const seatRef = ref(database, `rooms/${roomId}/seats/${targetIndex}`);
  await update(seatRef, { isMuted });
}

/**
 * Host Control: Removes or updates the room password (`isPrivate` & `password`).
 * Passing an empty string or null removes the password and makes the room public.
 */
export async function updateRoomPassword(
  roomId: string,
  newPassword: string | null,
): Promise<void> {
  if (!roomId) return;
  const cleanPassword = (newPassword || '').trim();
  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, {
    isPrivate: Boolean(cleanPassword),
    password: cleanPassword,
  });
}

/**
 * Host Control: Dynamically adjusts room seat count (from 1 up to 16 seats).
 * Expands or shrinks the seat array in Firebase Realtime Database atomically.
 */
export async function updateRoomSeatCount(
  roomId: string,
  newCount: number,
  hostName?: string,
): Promise<void> {
  const safeCount = Math.max(1, Math.min(16, newCount));
  const seatsRef = ref(database, `rooms/${roomId}/seats`);

  await runTransaction(seatsRef, (currentSeatsData) => {
    const currentSeats = normalizeSeats(currentSeatsData);
    if (currentSeats.length === safeCount) return currentSeats;

    if (safeCount > currentSeats.length) {
      // Add new vacant seats
      const newSeats = [...currentSeats];
      for (let i = currentSeats.length; i < safeCount; i++) {
        newSeats.push({
          seatNo: i + 1,
          userId: null,
          username: null,
          avatar: null,
          isMuted: false,
          isLocked: false,
          role: 'speaker',
          isMicBlocked: false,
        });
      }
      return newSeats;
    } else {
      // Truncate to safeCount
      return currentSeats.slice(0, safeCount);
    }
  });

  const roomRef = ref(database, `rooms/${roomId}`);
  await update(roomRef, { seatCount: safeCount });

  if (hostName) {
    await sendRoomMessage(
      roomId,
      'System',
      `[ڕێکخستنی کورسی] ژمارەی کورسییەکانی ژوور بۆ ${safeCount} کورسی گۆڕدرا لەلایەن ${hostName}.`,
    );
  }
}

/**
 * Broadcasts an animated 3D emoji onto a specific seat in real time.
 */
export async function sendSeatEmoji(
  roomId: string,
  seatNo: number,
  emojiId: string,
  userId: string,
  username: string,
): Promise<void> {
  if (!roomId || !seatNo || !emojiId) return;
  const emojiRef = ref(database, `rooms/${roomId}/seatEmojis/${seatNo}`);
  await set(emojiRef, {
    id: `emo_${Date.now()}_${seatNo}`,
    seatNo,
    emojiId,
    userId,
    username,
    timestamp: Date.now(),
  });
}

/**
 * Subscribes to real-time animated seat emojis in a room.
 */
export function subscribeToSeatEmojis(
  roomId: string,
  onUpdate: (
    emojisMap: Record<
      number,
      { id: string; seatNo: number; emojiId: string; userId: string; username: string; timestamp: number }
    >,
  ) => void,
): Unsubscribe {
  const emojisRef = ref(database, `rooms/${roomId}/seatEmojis`);
  return onValue(emojisRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate({});
      return;
    }
    const val = snapshot.val() as Record<string, any>;
    const result: Record<number, any> = {};
    Object.entries(val).forEach(([key, item]) => {
      const sNo = Number(item?.seatNo || key);
      if (sNo && item?.emojiId) {
        result[sNo] = item;
      }
    });
    onUpdate(result);
  });
}


