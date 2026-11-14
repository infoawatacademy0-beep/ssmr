import {
  ref,
  set,
  onValue,
  onDisconnect,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { RoomScreenShareState, ScreenShareDeviceType } from '../types/screenShare';

/**
 * Detects whether the user is currently on a Mobile phone/tablet, Laptop, or PC.
 */
export function detectScreenShareDeviceType(): ScreenShareDeviceType {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  if (/Macintosh|MacIntel|CrOS/i.test(ua)) {
    return 'laptop';
  }
  return 'pc';
}

/**
 * Broadcasts in Firebase that a user/device has started live screen sharing in the room.
 * Supports multiple simultaneous streams (e.g. PC + Mobile at the same time, or multiple members).
 * Automatically cleans up via onDisconnect if that specific device's connection drops.
 */
export async function startRoomScreenShare(
  roomId: string,
  payload: {
    streamId?: string;
    presenterUid: string;
    presenterName: string;
    presenterAvatar?: string | null;
    deviceType?: ScreenShareDeviceType;
    hasSystemAudio?: boolean;
  },
): Promise<string> {
  if (!roomId) return '';
  const deviceType = payload.deviceType || detectScreenShareDeviceType();
  const streamId =
    payload.streamId || `${payload.presenterUid}_${deviceType}`;

  const shareEntryRef = ref(database, `rooms/${roomId}/screenShares/${streamId}`);
  const frameEntryRef = ref(database, `rooms/${roomId}/screenShareFrames/${streamId}`);

  const now = Date.now();
  const state: RoomScreenShareState = {
    streamId,
    isActive: true,
    presenterUid: payload.presenterUid,
    presenterName: payload.presenterName,
    presenterAvatar: payload.presenterAvatar || null,
    deviceType,
    hasSystemAudio: Boolean(payload.hasSystemAudio),
    startedAt: now,
    updatedAt: now,
  };

  await set(shareEntryRef, state);

  try {
    onDisconnect(shareEntryRef).remove();
    onDisconnect(frameEntryRef).remove();
  } catch (err) {
    console.warn('Could not register onDisconnect for screenShare:', err);
  }

  return streamId;
}

/**
 * Publishes a compressed live JPEG frame of a shared screen to Firebase
 * so all viewers see every active screen (PC + Mobile) immediately.
 */
export async function publishScreenShareFrame(
  roomId: string,
  frameDataUrl: string,
  presenterUid: string,
  streamId?: string,
): Promise<void> {
  if (!roomId || !frameDataUrl) return;
  const key = streamId || presenterUid;
  const now = Date.now();
  const frameRef = ref(database, `rooms/${roomId}/screenShareFrames/${key}`);
  const heartbeatRef = ref(database, `rooms/${roomId}/screenShares/${key}/updatedAt`);
  await Promise.all([
    set(frameRef, {
      frame: frameDataUrl,
      presenterUid,
      streamId: key,
      updatedAt: now,
    }),
    set(heartbeatRef, now).catch(() => {}),
  ]);
}

/**
 * Subscribes in real-time to all active screen share frames in the room (keyed by streamId).
 */
export function subscribeToRoomScreenShareFrames(
  roomId: string,
  callback: (framesMap: Record<string, string>) => void,
): Unsubscribe {
  const framesRef = ref(database, `rooms/${roomId}/screenShareFrames`);
  return onValue(framesRef, (snap) => {
    if (!snap.exists()) {
      callback({});
      return;
    }
    const val = snap.val();
    if (!val || typeof val !== 'object') {
      callback({});
      return;
    }
    const map: Record<string, string> = {};
    for (const [k, item] of Object.entries(val as Record<string, any>)) {
      if (item && typeof item === 'object' && item.frame) {
        map[k] = String(item.frame);
      }
    }
    callback(map);
  });
}

/**
 * Legacy single-frame subscriber wrapper.
 */
export function subscribeToRoomScreenShareFrame(
  roomId: string,
  callback: (frameDataUrl: string | null) => void,
): Unsubscribe {
  return subscribeToRoomScreenShareFrames(roomId, (map) => {
    const first = Object.values(map)[0] || null;
    callback(first);
  });
}

/**
 * Stops a specific screen share stream (if streamId is provided) or stops all screen shares in the room.
 */
export async function stopRoomScreenShare(
  roomId: string,
  streamId?: string,
): Promise<void> {
  if (!roomId) return;

  if (streamId) {
    const shareEntryRef = ref(database, `rooms/${roomId}/screenShares/${streamId}`);
    const frameEntryRef = ref(database, `rooms/${roomId}/screenShareFrames/${streamId}`);
    try {
      onDisconnect(shareEntryRef).cancel();
      onDisconnect(frameEntryRef).cancel();
    } catch {}
    await Promise.all([
      set(shareEntryRef, null).catch(() => {}),
      set(frameEntryRef, null).catch(() => {}),
    ]);
    return;
  }

  // Stop ALL active screen shares in the room
  const allSharesRef = ref(database, `rooms/${roomId}/screenShares`);
  const allFramesRef = ref(database, `rooms/${roomId}/screenShareFrames`);
  const legacyScreenRef = ref(database, `rooms/${roomId}/screenShare`);
  const legacyFrameRef = ref(database, `rooms/${roomId}/screenShareFrame`);
  try {
    onDisconnect(allSharesRef).cancel();
    onDisconnect(allFramesRef).cancel();
    onDisconnect(legacyScreenRef).cancel();
    onDisconnect(legacyFrameRef).cancel();
  } catch {}
  await Promise.all([
    set(allSharesRef, null).catch(() => {}),
    set(allFramesRef, null).catch(() => {}),
    set(legacyScreenRef, null).catch(() => {}),
    set(legacyFrameRef, null).catch(() => {}),
  ]);
}

/**
 * Subscribes in real-time to ALL active screen shares in the room (e.g. PC + Mobile simultaneously).
 */
export function subscribeToRoomScreenShares(
  roomId: string,
  callback: (shares: RoomScreenShareState[]) => void,
): Unsubscribe {
  const sharesRef = ref(database, `rooms/${roomId}/screenShares`);
  return onValue(sharesRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val();
    if (!val || typeof val !== 'object') {
      callback([]);
      return;
    }
    const now = Date.now();
    const list: RoomScreenShareState[] = [];
    for (const [key, item] of Object.entries(val as Record<string, any>)) {
      if (!item || !item.isActive || !item.presenterUid) continue;
      const lastSeen = Number(item.updatedAt || item.startedAt || 0);
      // Ignore abandoned entries older than 2 hours (onDisconnect cleans up live disconnects automatically)
      if (lastSeen > 0 && now - lastSeen > 2 * 60 * 60 * 1000) {
        continue;
      }
      list.push({
        streamId: String(item.streamId || key),
        isActive: Boolean(item.isActive),
        presenterUid: String(item.presenterUid),
        presenterName: String(item.presenterName || 'User'),
        presenterAvatar: item.presenterAvatar || null,
        deviceType: (item.deviceType as ScreenShareDeviceType) || 'pc',
        hasSystemAudio: Boolean(item.hasSystemAudio),
        startedAt: Number(item.startedAt) || now,
        updatedAt: lastSeen || now,
      });
    }
    list.sort((a, b) => a.startedAt - b.startedAt);
    callback(list);
  });
}

/**
 * Legacy single-share subscriber wrapper.
 */
export function subscribeToRoomScreenShare(
  roomId: string,
  callback: (state: RoomScreenShareState | null) => void,
): Unsubscribe {
  return subscribeToRoomScreenShares(roomId, (shares) => {
    callback(shares[0] || null);
  });
}
