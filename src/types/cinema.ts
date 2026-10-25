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
  lastUpdated: number;
  updatedByUid: string;
  updatedByName: string;
}

export interface StartCinemaPayload {
  videoUrl: string;
  title?: string;
  hostUid: string;
  hostName: string;
}
