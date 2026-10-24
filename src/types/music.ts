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
  isMusicModeActive?: boolean; // Whether Music Mode banner is shown on the room screen
  isRepeat?: boolean; // loop/repeat current track
  volume?: number; // 0.0 to 1.0 (default 0.7)
  playbackPosition: number; // in seconds
  lastSyncTimestamp: number;
  playedBy?: string; // uid of user who initiated current playback
  playedByName?: string; // username
  queue: MusicTrack[];
}

export const SAMPLE_MUSIC_TRACKS: Omit<MusicTrack, 'id' | 'addedBy' | 'addedByName' | 'addedAt'>[] = [
  {
    title: 'Kurdish & Oriental Melodic Vibes',
    artist: 'SSMR Studio Beats',
    duration: 210,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    title: 'Midnight Lounge & Chill Synth',
    artist: 'DJ CyberPulse',
    duration: 240,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    title: 'Electro Party Night Mix',
    artist: 'Club Nova',
    duration: 195,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
  {
    title: 'Neon Nights (Ambient Lounge)',
    artist: 'CyberPulse',
    duration: 165,
    url: 'https://actions.google.com/sounds/v1/ambient/rain_heavy.ogg',
  },
  {
    title: 'Late Night Chill Stream',
    artist: 'Tokyo Midnight',
    duration: 140,
    url: 'https://actions.google.com/sounds/v1/water/creek_water_fast.ogg',
  },
];
