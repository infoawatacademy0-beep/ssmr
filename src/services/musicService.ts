import {
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { MusicTrack, RoomMusicState } from '../types';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   Collaborative Music Room & Media Queue Service
   Handles real-time shared queue, synchronized host playback,
   and track progression.
   ───────────────────────────────────────────────────────────── */

/**
 * Normalizes raw music queue object into ordered MusicTrack[].
 */
function normalizeMusicQueue(rawQueue: unknown): MusicTrack[] {
  if (!rawQueue) return [];
  if (Array.isArray(rawQueue)) return rawQueue.filter(Boolean);

  if (typeof rawQueue === 'object') {
    return Object.entries(rawQueue as Record<string, Partial<MusicTrack>>)
      .map(([key, item]) => ({
        id: item?.id || key,
        title: item?.title || 'Unknown Track',
        artist: item?.artist || 'Unknown Artist',
        duration: item?.duration || 180,
        url: item?.url || '',
        addedBy: item?.addedBy || '',
        addedByName: item?.addedByName || 'Guest',
        addedAt: item?.addedAt || Date.now(),
      }))
      .sort((a, b) => a.addedAt - b.addedAt);
  }

  return [];
}

/**
 * Adds a track to the shared room queue.
 * If no music is currently playing, starts this track immediately.
 */
export async function addTrackToQueue(
  roomId: string,
  trackData: Omit<MusicTrack, 'id' | 'addedAt'>,
): Promise<void> {
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const newTrackRef = push(queueRef);
  const trackId = newTrackRef.key || `track_${Date.now()}`;

  const newTrack: MusicTrack = {
    id: trackId,
    title: trackData.title.trim(),
    artist: trackData.artist.trim(),
    duration: trackData.duration,
    url: trackData.url.trim(),
    addedBy: trackData.addedBy,
    addedByName: trackData.addedByName,
    addedAt: Date.now(),
  };

  await set(newTrackRef, newTrack);

  // If no track is currently playing, set as active track
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const playerSnap = await get(playerRef);

  if (!playerSnap.exists() || !playerSnap.val()?.currentTrackId) {
    await set(playerRef, {
      currentTrackId: trackId,
      isPlaying: true,
      playbackPosition: 0,
      lastSyncTimestamp: Date.now(),
    });
  }

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Music] ${trackData.addedByName} added "${newTrack.title}" to the Music Queue!`,
  );
}

/**
 * Host controls: Master Play / Pause / Seek toggle.
 */
export async function setMusicPlayback(
  roomId: string,
  isPlaying: boolean,
  currentPosition?: number,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const snapshot = await get(playerRef);

  const updates: Record<string, any> = {
    isPlaying,
    lastSyncTimestamp: Date.now(),
  };

  if (typeof currentPosition === 'number') {
    updates.playbackPosition = currentPosition;
  } else if (!snapshot.exists()) {
    updates.playbackPosition = 0;
  }

  await update(playerRef, updates);
}

/**
 * Skips the current track and advances to the next track in queue.
 */
export async function skipToNextTrack(roomId: string): Promise<void> {
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const queueSnap = await get(queueRef);

  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const playerSnap = await get(playerRef);
  const currentTrackId = playerSnap.val()?.currentTrackId;

  if (queueSnap.exists()) {
    const queue = normalizeMusicQueue(queueSnap.val());

    // Remove the current track from queue
    if (currentTrackId) {
      await remove(ref(database, `rooms/${roomId}/musicQueue/${currentTrackId}`));
    }

    const remainingTracks = queue.filter((t) => t.id !== currentTrackId);

    if (remainingTracks.length > 0) {
      const nextTrack = remainingTracks[0];
      await update(playerRef, {
        currentTrackId: nextTrack.id,
        isPlaying: true,
        playbackPosition: 0,
        lastSyncTimestamp: Date.now(),
      });
      await sendRoomMessage(
        roomId,
        'system',
        'System',
        `[Now Playing] "${nextTrack.title}" by ${nextTrack.artist}`,
      );
    } else {
      await update(playerRef, {
        currentTrackId: null,
        isPlaying: false,
        playbackPosition: 0,
        lastSyncTimestamp: Date.now(),
      });
    }
  }
}

/**
 * Removes a specific track from the queue.
 * If the removed track is currently playing, advances to the next track or stops playback.
 */
export async function removeTrackFromQueue(
  roomId: string,
  trackId: string,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const playerSnap = await get(playerRef);
  const currentTrackId = playerSnap.val()?.currentTrackId;

  const trackRef = ref(database, `rooms/${roomId}/musicQueue/${trackId}`);
  await remove(trackRef);

  if (currentTrackId === trackId) {
    const queueSnap = await get(ref(database, `rooms/${roomId}/musicQueue`));
    const remaining = queueSnap.exists() ? normalizeMusicQueue(queueSnap.val()) : [];
    if (remaining.length > 0) {
      await update(playerRef, {
        currentTrackId: remaining[0].id,
        isPlaying: true,
        playbackPosition: 0,
        lastSyncTimestamp: Date.now(),
      });
    } else {
      await update(playerRef, {
        currentTrackId: null,
        isPlaying: false,
        playbackPosition: 0,
        lastSyncTimestamp: Date.now(),
      });
    }
  }
}

/**
 * Cancels and removes the currently playing song and clears the music player.
 */
export async function cancelAndClearMusic(roomId: string): Promise<void> {
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);

  await remove(queueRef);
  await set(playerRef, {
    currentTrackId: null,
    isPlaying: false,
    isRepeat: false,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Immediately changes the currently playing song to a new track (replaces current active song).
 */
export async function changeCurrentTrack(
  roomId: string,
  trackData: Omit<MusicTrack, 'id' | 'addedAt'>,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const playerSnap = await get(playerRef);
  const oldTrackId = playerSnap.val()?.currentTrackId;

  // Remove the previous active track so changing song cleanly swaps it
  if (oldTrackId) {
    await remove(ref(database, `rooms/${roomId}/musicQueue/${oldTrackId}`));
  }

  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const newTrackRef = push(queueRef);
  const trackId = newTrackRef.key || `track_${Date.now()}`;

  const newTrack: MusicTrack = {
    id: trackId,
    title: trackData.title.trim(),
    artist: trackData.artist.trim(),
    duration: trackData.duration,
    url: trackData.url.trim(),
    addedBy: trackData.addedBy,
    addedByName: trackData.addedByName,
    addedAt: Date.now(),
  };

  await set(newTrackRef, newTrack);

  await update(playerRef, {
    currentTrackId: trackId,
    isPlaying: true,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Immediately switches playback to a specific track already in the queue.
 */
export async function selectTrackFromQueue(
  roomId: string,
  trackId: string,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    currentTrackId: trackId,
    isPlaying: true,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Toggles repeat/loop mode for the current song.
 */
export async function toggleMusicRepeat(
  roomId: string,
  isRepeat: boolean,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    isRepeat: Boolean(isRepeat),
  });
}

/**
 * Restarts the currently playing song from the beginning (0:00).
 */
export async function restartCurrentTrack(roomId: string): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    isPlaying: true,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Subscribes to the synchronized music state (queue + player controls).
 */
export function subscribeToMusicState(
  roomId: string,
  onUpdate: (state: RoomMusicState) => void,
): Unsubscribe {
  const musicRef = ref(database, `rooms/${roomId}`);

  return onValue(musicRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate({
        currentTrackId: null,
        isPlaying: false,
        isRepeat: false,
        playbackPosition: 0,
        lastSyncTimestamp: Date.now(),
        queue: [],
      });
      return;
    }

    const val = snapshot.val();
    const queue = normalizeMusicQueue(val.musicQueue);
    const player = val.musicPlayer || {};

    onUpdate({
      currentTrackId: player.currentTrackId ?? (queue[0]?.id || null),
      isPlaying: Boolean(player.isPlaying),
      isRepeat: Boolean(player.isRepeat),
      playbackPosition: Number(player.playbackPosition) || 0,
      lastSyncTimestamp: Number(player.lastSyncTimestamp) || Date.now(),
      queue,
    });
  });
}
