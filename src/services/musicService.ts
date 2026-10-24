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
 * Skips the current track and advances to the next track in queue
 * WITHOUT deleting tracks from the preserved song list.
 */
export async function skipToNextTrack(roomId: string): Promise<void> {
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const queueSnap = await get(queueRef);

  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const playerSnap = await get(playerRef);
  const currentTrackId = playerSnap.val()?.currentTrackId;

  if (queueSnap.exists()) {
    const queue = normalizeMusicQueue(queueSnap.val());

    if (queue.length > 0) {
      const currentIdx = queue.findIndex((t) => t.id === currentTrackId);
      const nextTrack = queue[(currentIdx + 1) % queue.length];
      await update(playerRef, {
        currentTrackId: nextTrack.id,
        isPlaying: true,
        isMusicModeActive: true,
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
 * Removes ALL custom songs from the room music queue.
 */
export async function clearAllTracksFromQueue(roomId: string): Promise<void> {
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  await remove(queueRef);

  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    currentTrackId: null,
    isPlaying: false,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Ends Music Mode on the room screen and stops playback,
 * while keeping the entire song list (musicQueue) 100% preserved!
 */
export async function cancelAndClearMusic(roomId: string): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);

  await update(playerRef, {
    currentTrackId: null,
    isPlaying: false,
    isMusicModeActive: false,
    isRepeat: false,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
  });
}

/**
 * Toggles whether the Music Mode bar is visible on the room screen (Admin only).
 */
export async function setMusicModeActive(
  roomId: string,
  isActive: boolean,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  if (isActive) {
    await update(playerRef, {
      isMusicModeActive: true,
      lastSyncTimestamp: Date.now(),
    });
  } else {
    await update(playerRef, {
      isMusicModeActive: false,
      isPlaying: false,
      currentTrackId: null,
      playbackPosition: 0,
      lastSyncTimestamp: Date.now(),
    });
  }
}

/**
 * Immediately plays a song or adds a new song to the preserved room song list
 * WITHOUT deleting any existing songs from the list.
 */
export async function changeCurrentTrack(
  roomId: string,
  trackData: Omit<MusicTrack, 'id' | 'addedAt'>,
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  const queueRef = ref(database, `rooms/${roomId}/musicQueue`);
  const queueSnap = await get(queueRef);
  const existingQueue = queueSnap.exists() ? normalizeMusicQueue(queueSnap.val()) : [];

  const cleanUrl = trackData.url.trim();
  const existingTrack = existingQueue.find((t) => t.url === cleanUrl);

  let trackId: string;

  if (existingTrack) {
    trackId = existingTrack.id;
  } else {
    const newTrackRef = push(queueRef);
    trackId = newTrackRef.key || `track_${Date.now()}`;

    const newTrack: MusicTrack = {
      id: trackId,
      title: trackData.title.trim(),
      artist: trackData.artist.trim(),
      duration: trackData.duration,
      url: cleanUrl,
      addedBy: trackData.addedBy,
      addedByName: trackData.addedByName,
      addedAt: Date.now(),
    };

    await set(newTrackRef, newTrack);
  }

  await update(playerRef, {
    currentTrackId: trackId,
    isPlaying: true,
    isMusicModeActive: true,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
    playedBy: trackData.addedBy,
    playedByName: trackData.addedByName,
  });

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `🎵 ${trackData.addedByName} گۆرانی "${trackData.title}"ی لێدا`,
  );
}

const ARCHIVE_S3_ACCESS_KEY = '8rf2XcHvDimQ65dX';
const ARCHIVE_S3_SECRET_KEY = 'zHvX8RH0QTna93bN';

/**
 * Calculates S3 V2 HMAC-SHA1 signature using standard Web Crypto API.
 * Works natively in all modern browsers (iOS/Android mobile and desktop).
 */
async function computeArchiveS3Signature(stringToSign: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign));
  const bytes = new Uint8Array(sigBuf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Uploads an audio file directly to Internet Archive S3 with automatic container creation.
 * Works seamlessly on Vercel without serverless size limits.
 * Falls back to local /api/upload-song if direct request is blocked.
 */
export async function uploadSongFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ directLink: string; fileName: string; originalName: string }> {
  const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
  const fileExtension = extMatch ? extMatch[1].toLowerCase() : 'mp3';
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const itemIdentifier = `web-songs-${uniqueSuffix}`;
  const fileName = `song-${uniqueSuffix}.${fileExtension}`;

  try {
    const date = new Date().toUTCString();
    const canonicalResource = `/${itemIdentifier}/${fileName}`;
    const stringToSign = `PUT\n\n\n${date}\n${canonicalResource}`;

    const signature = await computeArchiveS3Signature(stringToSign, ARCHIVE_S3_SECRET_KEY);
    const authHeader = `AWS ${ARCHIVE_S3_ACCESS_KEY}:${signature}`;
    const uploadUrl = `https://s3.us.archive.org/${itemIdentifier}/${fileName}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);

      xhr.setRequestHeader('Authorization', authHeader);
      xhr.setRequestHeader('Date', date);
      xhr.setRequestHeader('x-archive-auto-make-bucket', '1');
      xhr.setRequestHeader('x-archive-meta-mediatype', 'audio');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Archive.org upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error uploading to Archive.org'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload to Archive.org timed out'));
      };

      xhr.send(file);
    });

    const directLink = `https://archive.org/download/${itemIdentifier}/${fileName}`;
    return {
      directLink,
      fileName,
      originalName: file.name,
    };
  } catch (directErr) {
    console.warn('Direct Archive S3 upload failed, trying backend fallback...', directErr);

    // Fallback to local server API if running local server.js
    const formData = new FormData();
    formData.append('songFile', file);

    const response = await fetch('/api/upload-song', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.directLink) {
      throw new Error(data.error || 'هەڵەیەک ڕوویدا لە بارکردنی گۆرانییەکە بۆ ئەرشیف');
    }

    return data;
  }
}

/**
 * Immediately switches playback to a specific track already in the queue,
 * stopping any other currently playing song.
 */
export async function selectTrackFromQueue(
  roomId: string,
  trackId: string,
  user?: { uid: string; username: string },
): Promise<void> {
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    currentTrackId: trackId,
    isPlaying: true,
    isMusicModeActive: true,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
    playedBy: user?.uid,
    playedByName: user?.username,
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
 * Updates the synchronized room music volume (0.0 to 1.0).
 */
export async function setMusicVolume(
  roomId: string,
  volume: number,
): Promise<void> {
  const clamped = Math.max(0, Math.min(1, Number(volume)));
  const playerRef = ref(database, `rooms/${roomId}/musicPlayer`);
  await update(playerRef, {
    volume: clamped,
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
        isMusicModeActive: false,
        isRepeat: false,
        volume: 0.7,
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
      currentTrackId: player.currentTrackId ?? null,
      isPlaying: Boolean(player.isPlaying),
      isMusicModeActive:
        typeof player.isMusicModeActive === 'boolean'
          ? player.isMusicModeActive
          : Boolean(player.isPlaying),
      isRepeat: Boolean(player.isRepeat),
      volume: typeof player.volume === 'number' ? Math.max(0, Math.min(1, player.volume)) : 0.7,
      playbackPosition: Number(player.playbackPosition) || 0,
      lastSyncTimestamp: Number(player.lastSyncTimestamp) || Date.now(),
      playedBy: player.playedBy || undefined,
      playedByName: player.playedByName || undefined,
      queue,
    });
  });
}
