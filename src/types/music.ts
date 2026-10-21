export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  url: string;
  addedBy: string; // uid
  addedByName: string;
  addedAt: number;
}

export interface RoomMusicState {
  currentTrackId: string | null;
  isPlaying: boolean;
  playbackPosition: number; // in seconds
  lastSyncTimestamp: number;
  queue: MusicTrack[];
}

export const SAMPLE_MUSIC_TRACKS: Omit<MusicTrack, 'id' | 'addedBy' | 'addedByName' | 'addedAt'>[] = [
  {
    title: 'Neon Nights (Synthwave Lounge)',
    artist: 'CyberPulse',
    duration: 165,
    url: 'https://actions.google.com/sounds/v1/ambient/rain_heavy.ogg', // reliable public audio stream
  },
  {
    title: 'Arabic Oud & Lo-Fi Beats',
    artist: 'Habibi Vibes',
    duration: 180,
    url: 'https://actions.google.com/sounds/v1/science_fiction/alien_spaceship_pass_by.ogg',
  },
  {
    title: 'Late Night Chill Hop',
    artist: 'Tokyo Midnight',
    duration: 140,
    url: 'https://actions.google.com/sounds/v1/water/creek_water_fast.ogg',
  },
];
