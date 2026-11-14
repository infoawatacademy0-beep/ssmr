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
 * Broadcasts in Firebase that a user has started live screen sharing in the room.
 * Automatically cleans up via onDisconnect if the presenter's connection drops.
 */
export async function startRoomScreenShare(
  roomId: string,
  payload: {
    presenterUid: string;
    presenterName: string;
    presenterAvatar?: string | null;
    deviceType?: ScreenShareDeviceType;
    hasSystemAudio?: boolean;
  },
): Promise<void> {
  if (!roomId) return;
  const screenRef = ref(database, `rooms/${roomId}/screenShare`);
  const frameRef = ref(database, `rooms/${roomId}/screenShareFrame`);
  const state: RoomScreenShareState = {
    isActive: true,
    presenterUid: payload.presenterUid,
    presenterName: payload.presenterName,
    presenterAvatar: payload.presenterAvatar || null,
    deviceType: payload.deviceType || detectScreenShareDeviceType(),
    hasSystemAudio: Boolean(payload.hasSystemAudio),
    startedAt: Date.now(),
  };

  await set(screenRef, state);

  try {
    onDisconnect(screenRef).remove();
    onDisconnect(frameRef).remove();
  } catch (err) {
    console.warn('Could not register onDisconnect for screenShare:', err);
  }
}

/**
 * Publishes a compressed live JPEG frame of the shared screen to Firebase
 * so all viewers see the screen immediately (even while WebRTC is connecting or across strict mobile NATs).
 */
export async function publishScreenShareFrame(
  roomId: string,
  frameDataUrl: string,
  presenterUid: string,
): Promise<void> {
  if (!roomId || !frameDataUrl) return;
  const frameRef = ref(database, `rooms/${roomId}/screenShareFrame`);
  await set(frameRef, {
    frame: frameDataUrl,
    presenterUid,
    updatedAt: Date.now(),
  });
}

/**
 * Subscribes in real-time to the room's live screen share frame fallback stream.
 */
export function subscribeToRoomScreenShareFrame(
  roomId: string,
  callback: (frameDataUrl: string | null) => void,
): Unsubscribe {
  const frameRef = ref(database, `rooms/${roomId}/screenShareFrame`);
  return onValue(frameRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const val = snap.val();
    callback(val?.frame ? String(val.frame) : null);
  });
}

/**
 * Stops the active screen share session in Firebase for the room.
 */
export async function stopRoomScreenShare(roomId: string): Promise<void> {
  if (!roomId) return;
  const screenRef = ref(database, `rooms/${roomId}/screenShare`);
  const frameRef = ref(database, `rooms/${roomId}/screenShareFrame`);
  try {
    onDisconnect(screenRef).cancel();
    onDisconnect(frameRef).cancel();
  } catch {}
  await Promise.all([
    set(screenRef, null).catch(() => {}),
    set(frameRef, null).catch(() => {}),
  ]);
}

/**
 * Subscribes in real-time to the room's screen share state.
 */
export function subscribeToRoomScreenShare(
  roomId: string,
  callback: (state: RoomScreenShareState | null) => void,
): Unsubscribe {
  const screenRef = ref(database, `rooms/${roomId}/screenShare`);
  return onValue(screenRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const val = snap.val();
    if (!val || !val.isActive || !val.presenterUid) {
      callback(null);
      return;
    }
    callback({
      isActive: Boolean(val.isActive),
      presenterUid: String(val.presenterUid),
      presenterName: String(val.presenterName || 'User'),
      presenterAvatar: val.presenterAvatar || null,
      deviceType: (val.deviceType as ScreenShareDeviceType) || 'pc',
      hasSystemAudio: Boolean(val.hasSystemAudio),
      startedAt: Number(val.startedAt) || Date.now(),
    });
  });
}
