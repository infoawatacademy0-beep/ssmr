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
