import {
  ref,
  set,
  update,
  onValue,
  get,
  push,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { RoomCinemaState, StartCinemaPayload, SavedCinemaMovie } from '../types';
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
    syncType: 'movie_change',
    seekSeq: Date.now(),
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

  try {
    await autoSaveToPlaylistIfMissing(
      roomId,
      cleanUrl,
      cinemaData.title,
      payload.hostUid,
      payload.hostName,
    );
  } catch (err) {
    console.warn('Failed to auto-save to cinema playlist:', err);
  }
}

/**
 * Updates video playback state (Play/Pause, Seek, Heartbeat).
 * Synced across all connected clients in real-time.
 */
export async function updateCinemaPlayback(
  roomId: string,
  isPlaying: boolean,
  currentTime: number,
  user?: { uid: string; username: string },
  duration?: number,
  pausedByName?: string | null,
  syncType: 'seek' | 'play_pause' | 'heartbeat' = 'seek',
): Promise<void> {
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  const updates: Record<string, any> = {
    isPlaying,
    currentTime: Math.max(0, currentTime),
    lastUpdated: Date.now(),
    syncType,
    ...(syncType === 'seek' ? { seekSeq: Date.now() } : {}),
    ...(duration !== undefined && duration > 0 ? { duration } : {}),
    ...(user ? { updatedByUid: user.uid, updatedByName: user.username } : {}),
  };

  if (!isPlaying) {
    const pauseName = pausedByName || user?.username || 'ئەندامێک';
    updates.pausedByName = pauseName;
    if (user?.uid) updates.pausedByUid = user.uid;
  } else {
    updates.pausedByName = null;
    updates.pausedByUid = null;
  }

  await update(cinemaRef, updates);
}

/**
 * Safely updates only movie duration in Firebase without resetting currentTime or triggering seek jumps.
 */
export async function updateCinemaDuration(
  roomId: string,
  duration: number,
): Promise<void> {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return;
  const cinemaRef = ref(database, `rooms/${roomId}/cinema`);
  await update(cinemaRef, {
    duration: Math.round(duration),
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
    syncType: 'movie_change',
    seekSeq: Date.now(),
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

  try {
    await autoSaveToPlaylistIfMissing(
      roomId,
      cleanUrl,
      title || 'فیلمی سینەمایی',
      user.uid,
      user.username,
    );
  } catch (err) {
    console.warn('Failed to auto-save to cinema playlist:', err);
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
      duration: val.duration ? Number(val.duration) : undefined,
      lastUpdated: Number(val.lastUpdated) || Date.now(),
      updatedByUid: String(val.updatedByUid || ''),
      updatedByName: String(val.updatedByName || ''),
      pausedByName: val.pausedByName ? String(val.pausedByName) : (!val.isPlaying && val.updatedByName ? String(val.updatedByName) : undefined),
      pausedByUid: val.pausedByUid ? String(val.pausedByUid) : (!val.isPlaying && val.updatedByUid ? String(val.updatedByUid) : undefined),
      seatCount: val.seatCount ? Number(val.seatCount) : 5,
    });
  });
}

/**
 * Normalizes raw cinema playlist object into ordered SavedCinemaMovie[].
 */
export function normalizeCinemaPlaylist(raw: unknown): SavedCinemaMovie[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, Partial<SavedCinemaMovie>>)
    .map(([key, val]) => ({
      id: key,
      title: String(val?.title || 'فیلمی سینەمایی'),
      url: String(val?.url || ''),
      addedByUid: String(val?.addedByUid || ''),
      addedByName: String(val?.addedByName || 'ئەندامێک'),
      addedAt: Number(val?.addedAt) || Date.now(),
      duration: val?.duration ? Number(val.duration) : undefined,
    }))
    .filter((m) => m.url.trim().length > 0)
    .sort((a, b) => b.addedAt - a.addedAt); // Newest first
}

/**
 * Automatically saves a movie URL & title to the room's playlist if not already present.
 */
async function autoSaveToPlaylistIfMissing(
  roomId: string,
  url: string,
  title: string,
  uid: string,
  username: string,
): Promise<void> {
  const cleanUrl = url.trim();
  if (!cleanUrl) return;

  const playlistRef = ref(database, `rooms/${roomId}/cinemaPlaylist`);
  const snap = await get(playlistRef);
  if (snap.exists()) {
    const list = Object.values(snap.val() as Record<string, Partial<SavedCinemaMovie>>);
    const existing = list.find((m) => m?.url?.trim() === cleanUrl);
    if (existing) return;
  }

  const newRef = push(playlistRef);
  await set(newRef, {
    id: newRef.key || `movie_${Date.now()}`,
    title: (title || 'فیلمی سینەمایی').trim(),
    url: cleanUrl,
    addedByUid: uid,
    addedByName: username,
    addedAt: Date.now(),
  });
}

/**
 * Saves a new movie to the room's permanent cinema playlist.
 */
export async function saveCinemaMovie(
  roomId: string,
  movie: {
    id?: string;
    title: string;
    url: string;
    addedByUid: string;
    addedByName: string;
    duration?: number;
  },
): Promise<SavedCinemaMovie> {
  const cleanUrl = movie.url.trim();
  if (!cleanUrl) {
    throw new Error('Video URL cannot be empty.');
  }

  const playlistRef = ref(database, `rooms/${roomId}/cinemaPlaylist`);
  const newRef = movie.id
    ? ref(database, `rooms/${roomId}/cinemaPlaylist/${movie.id}`)
    : push(playlistRef);
  const movieId = movie.id || newRef.key || `movie_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const savedMovie: SavedCinemaMovie = {
    id: movieId,
    title: (movie.title || 'فیلمی بێ‌ناونیشان').trim(),
    url: cleanUrl,
    addedByUid: movie.addedByUid || 'admin',
    addedByName: movie.addedByName || 'Admin',
    addedAt: Date.now(),
    ...(movie.duration ? { duration: movie.duration } : {}),
  };

  await set(ref(database, `rooms/${roomId}/cinemaPlaylist/${movieId}`), savedMovie);
  return savedMovie;
}

/**
 * Deletes a movie from the room's cinema playlist.
 * Only room hosts or admins should call this.
 */
export async function deleteCinemaMovie(
  roomId: string,
  movieId: string,
): Promise<void> {
  const movieRef = ref(database, `rooms/${roomId}/cinemaPlaylist/${movieId}`);
  await set(movieRef, null);
}

/**
 * Subscribes in real-time to the room's saved cinema movies playlist.
 */
export function subscribeToCinemaPlaylist(
  roomId: string,
  onUpdate: (movies: SavedCinemaMovie[]) => void,
): Unsubscribe {
  const playlistRef = ref(database, `rooms/${roomId}/cinemaPlaylist`);
  return onValue(playlistRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const list = normalizeCinemaPlaylist(snapshot.val());
    onUpdate(list);
  });
}

/**
 * Switches the active cinema video to a saved movie.
 * Can be called by any member in the room.
 */
export async function switchCinemaMovie(
  roomId: string,
  movie: SavedCinemaMovie,
  user: { uid: string; username: string },
  isCinemaActive: boolean = true,
): Promise<void> {
  if (isCinemaActive) {
    await setCinemaVideoUrl(roomId, movie.url, movie.title, user);
  } else {
    await startCinemaMode(roomId, {
      videoUrl: movie.url,
      title: movie.title,
      hostUid: user.uid,
      hostName: user.username,
      seatCount: 5,
    });
  }

  try {
    const { sendRoomMessage } = await import('./roomService');
    await sendRoomMessage(
      roomId,
      'system',
      'Cinema',
      `🎬 ${user.username} فیلمەکەی دەستپێکرد / گۆڕی بۆ: ${movie.title}`,
    );
  } catch (err) {
    console.warn('Could not broadcast movie switch message:', err);
  }
}
