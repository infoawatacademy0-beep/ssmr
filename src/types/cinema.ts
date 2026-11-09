/**
 * Real-time Cinema / Movie Mode State Schema
 * Stored under `/rooms/{roomId}/cinema` in Firebase Realtime Database.
 */
export interface RoomCinemaState {
  isActive: boolean;
  videoUrl: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  lastUpdated: number;
  updatedByUid: string;
  updatedByName: string;
  pausedByName?: string;
  pausedByUid?: string;
  seatCount?: number;
  syncType?: 'seek' | 'play_pause' | 'heartbeat' | 'movie_change';
  seekSeq?: number;
}

export interface StartCinemaPayload {
  videoUrl: string;
  title?: string;
  hostUid: string;
  hostName: string;
  seatCount?: number;
}

export interface SavedCinemaMovie {
  id: string;
  title: string;
  url: string;
  addedByUid: string;
  addedByName: string;
  addedAt: number;
  duration?: number;
}

/**
 * Single Episode or Movie item inside a Cinema Folder / Series
 */
export interface CinemaEpisode {
  id: string;
  title: string;
  episodeNumber: number;
  videoUrl: string;
  posterUrl?: string;
  addedAt: number;
}

/**
 * Global Cinema Folder / Movie Series managed by Admin
 * Stored under `/cinemaCatalog/folders/{folderId}` in Firebase RTDB
 */
export interface CinemaFolder {
  id: string;
  title: string;
  category?: string;
  posterUrl: string;
  description?: string;
  episodes: CinemaEpisode[];
  createdAt: number;
  updatedAt: number;
}
