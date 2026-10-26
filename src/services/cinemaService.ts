import {
  ref,
  set,
  update,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { RoomCinemaState, StartCinemaPayload } from '../types';
import { updateRoomSeatCount } from './roomService';

/**
 * Starts or updates cinema / movie mode in a voice room.
 * Only the room host or admin can invoke this.
 */
export async function startCinemaMode(
  roomId: string,
  payload: StartCinemaPayload,
): Promise<void> {
  const cleanUrl = payload.videoUrl.trim();
  if (!cleanUrl) {
    throw new Error('Video URL cannot be empty.');
  }

  const safeSeats = Math.max(1, Math.min(16, payload.seatCount || 5));
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  const cinemaData: RoomCinemaState = {
    isActive: true,
    videoUrl: cleanUrl,
    title: (payload.title || 'تایتانیک · فیلمی ڕاستەوخۆ').trim(),
    isPlaying: true,
    currentTime: 0,
    lastUpdated: Date.now(),
    updatedByUid: payload.hostUid,
    updatedByName: payload.hostName,
    seatCount: safeSeats,
  };

  await set(cinemaRef, cinemaData);

  try {
    await updateRoomSeatCount(roomId, safeSeats, payload.hostName);
  } catch (err) {
    console.warn('Failed to sync room seats in startCinemaMode:', err);
  }
}

/**
 * Updates video playback state (Play/Pause, Seek).
 * Synced across all connected clients in real-time.
 */
export async function updateCinemaPlayback(
  roomId: string,
  isPlaying: boolean,
  currentTime: number,
  user?: { uid: string; username: string },
): Promise<void> {
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  await update(cinemaRef, {
    isPlaying,
    currentTime: Math.max(0, currentTime),
    lastUpdated: Date.now(),
    ...(user ? { updatedByUid: user.uid, updatedByName: user.username } : {}),
  });
}

/**
 * Changes the active video link / title in Cinema mode.
 */
export async function setCinemaVideoUrl(
  roomId: string,
  videoUrl: string,
  title: string,
  user: { uid: string; username: string },
  seatCount?: number,
): Promise<void> {
  const cleanUrl = videoUrl.trim();
  if (!cleanUrl) {
    throw new Error('Video URL cannot be empty.');
  }

  const cleanSeatCount = seatCount ? Math.max(1, Math.min(16, seatCount)) : undefined;
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  await update(cinemaRef, {
    isActive: true,
    videoUrl: cleanUrl,
    title: (title || 'فیلمی ڕاستەوخۆ').trim(),
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    updatedByUid: user.uid,
    updatedByName: user.username,
    ...(cleanSeatCount !== undefined ? { seatCount: cleanSeatCount } : {}),
  });

  if (cleanSeatCount !== undefined) {
    try {
      await updateRoomSeatCount(roomId, cleanSeatCount, user.username);
    } catch (err) {
      console.warn('Failed to sync room seats in setCinemaVideoUrl:', err);
    }
  }
}

/**
 * Updates the custom seat count for Cinema Mode.
 */
export async function updateCinemaSeatCount(
  roomId: string,
  seatCount: number,
  user?: { uid: string; username: string },
): Promise<void> {
  const cleanCount = Math.max(1, Math.min(16, seatCount));
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  await update(cinemaRef, {
    seatCount: cleanCount,
    lastUpdated: Date.now(),
    ...(user ? { updatedByUid: user.uid, updatedByName: user.username } : {}),
  });

  try {
    await updateRoomSeatCount(roomId, cleanCount, user?.username);
  } catch (err) {
    console.warn('Failed to sync room seats in updateCinemaSeatCount:', err);
  }
}

/**
 * Completely closes Cinema mode and returns the room to standard 8-seat stage.
 */
export async function stopCinemaMode(roomId: string): Promise<void> {
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  await set(cinemaRef, null);
}

/**
 * Real-time listener for room cinema state.
 */
export function subscribeToRoomCinema(
  roomId: string,
  onUpdate: (cinema: RoomCinemaState | null) => void,
): Unsubscribe {
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  return onValue(cinemaRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }
    const val = snapshot.val();
    if (!val || val.isActive === false) {
      onUpdate(null);
      return;
    }

    onUpdate({
      isActive: Boolean(val.isActive),
      videoUrl: String(val.videoUrl || ''),
      title: String(val.title || 'فیلمی سینەمایی'),
      isPlaying: Boolean(val.isPlaying),
      currentTime: Number(val.currentTime) || 0,
      lastUpdated: Number(val.lastUpdated) || Date.now(),
      updatedByUid: String(val.updatedByUid || ''),
      updatedByName: String(val.updatedByName || ''),
      seatCount: val.seatCount ? Number(val.seatCount) : 5,
    });
  });
}
