import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  Plus,
  ListMusic,
  Volume2,
  Disc3,
  X,
  Sparkles,
  Trash2,
  Radio,
} from 'lucide-react';
import type { MusicTrack, RoomMusicState, User, Seat } from '../types';
import { SAMPLE_MUSIC_TRACKS } from '../types';
import {
  addTrackToQueue,
  setMusicPlayback,
  skipToNextTrack,
  removeTrackFromQueue,
} from '../services';

interface MusicPlayerPanelProps {
  roomId: string;
  currentUser: User;
  isHost: boolean;
  seats: Seat[];
  musicState: RoomMusicState;
}

export default function MusicPlayerPanel({
  roomId,
  currentUser,
  isHost,
  seats,
  musicState,
}: MusicPlayerPanelProps) {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New track form inputs
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // User is seated on stage OR is Room Host / Admin
  const canControlMusic = Boolean(
    isHost || currentUser.isAdmin || seats.some((s) => s.userId === currentUser.uid),
  );

  // Find currently active track
  const currentTrack = musicState.queue.find((t) => t.id === musicState.currentTrackId) || musicState.queue[0] || null;

  /* ─────────────────────────────────────────────────────────────
     Synchronized Audio Playback with Firebase
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // If audio source changed
    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
    }

    // Calculate approximate synchronized position
    if (musicState.isPlaying) {
      const elapsedSinceSync = Math.max(0, (Date.now() - musicState.lastSyncTimestamp) / 1000);
      const targetTime = Math.min(
        currentTrack.duration,
        musicState.playbackPosition + elapsedSinceSync,
      );

      // If out of sync by more than 1.5 seconds, resync
      if (Math.abs(audio.currentTime - targetTime) > 1.5) {
        audio.currentTime = targetTime;
      }

      audio.play().catch((err) => {
        console.warn('Playback paused due to browser autoplay restriction:', err);
      });
    } else {
      audio.pause();
      if (typeof musicState.playbackPosition === 'number') {
        audio.currentTime = musicState.playbackPosition;
      }
    }
  }, [musicState.isPlaying, musicState.currentTrackId, musicState.lastSyncTimestamp, currentTrack]);

  // Audio track ended listener -> auto skip for host
  const handleAudioEnded = () => {
    if (isHost) {
      skipToNextTrack(roomId).catch(console.error);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Playback Control Handlers (Host Only)
     ───────────────────────────────────────────────────────────── */
  const handleTogglePlay = async () => {
    if (!isHost || !currentTrack) return;
    const audio = audioRef.current;
    const currentPos = audio ? audio.currentTime : musicState.playbackPosition;
    await setMusicPlayback(roomId, !musicState.isPlaying, currentPos);
  };

  const handleSkip = async () => {
    if (!isHost) return;
    await skipToNextTrack(roomId);
  };

  /* ─────────────────────────────────────────────────────────────
     Add Track Handler (Any Seated User)
     ───────────────────────────────────────────────────────────── */
  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || !trackUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addTrackToQueue(roomId, {
        title: trackTitle.trim(),
        artist: trackArtist.trim() || 'Featured Artist',
        duration: 180,
        url: trackUrl.trim(),
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });

      setTrackTitle('');
      setTrackArtist('');
      setTrackUrl('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add track to queue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_MUSIC_TRACKS[0]) => {
    setTrackTitle(sample.title);
    setTrackArtist(sample.artist);
    setTrackUrl(sample.url);
  };

  return (
    <>
      {/* Hidden Synchronized HTML5 Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        preload="auto"
      />

      {/* ── Floating Synchronized Music Player Controller ── */}
      <div className="relative mx-3 mb-2 rounded-2xl border border-violet-500/30 bg-surface-800/90 p-3 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {/* Animated Vinyl Record Disc */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <motion.div
              animate={musicState.isPlaying ? { rotate: 360 } : { rotate: 0 }}
              transition={
                musicState.isPlaying
                  ? { duration: 4, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.3 }
              }
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-surface-900 via-surface-700 to-violet-900 p-1 border-2 border-violet-400 shadow-md shadow-violet-500/20"
            >
              <Disc3 className="h-5 w-5 text-violet-300" />
            </motion.div>
            {musicState.isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
            )}
          </div>

          {/* Current Track Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-violet-500/20 px-1 py-0.2 text-[8px] font-bold text-violet-300 uppercase">
                Music Room
              </span>
              <p className="truncate text-xs font-bold text-white">
                {currentTrack ? currentTrack.title : 'Queue is empty'}
              </p>
            </div>
            <p className="truncate text-[10px] text-slate-400">
              {currentTrack
                ? `${currentTrack.artist} · Added by ${currentTrack.addedByName}`
                : 'Seated performers can add tracks to queue'}
            </p>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1.5">
            {isHost && currentTrack && (
              <>
                <button
                  onClick={handleTogglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-transform active:scale-95"
                  title={musicState.isPlaying ? 'Pause' : 'Play'}
                >
                  {musicState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <button
                  onClick={handleSkip}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white"
                  title="Skip Track"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Quick Play Preset if Queue is Empty (Host) */}
            {isHost && !currentTrack && (
              <button
                onClick={async () => {
                  const firstSample = SAMPLE_MUSIC_TRACKS[0];
                  if (firstSample) {
                    await addTrackToQueue(roomId, {
                      title: firstSample.title,
                      artist: firstSample.artist,
                      duration: firstSample.duration || 180,
                      url: firstSample.url,
                      addedBy: currentUser.uid,
                      addedByName: currentUser.username,
                    });
                  } else {
                    setIsAddModalOpen(true);
                  }
                }}
                className="flex h-8 items-center gap-1 rounded-xl bg-emerald-500 px-2.5 text-xs font-black text-black shadow-md transition-transform active:scale-95"
                title="پێکردنی گۆرانی (Play Music)"
              >
                <Play className="h-3.5 w-3.5 fill-black" />
                <span>Play</span>
              </button>
            )}

            {/* View Queue Drawer */}
            <button
              onClick={() => setIsQueueOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white"
              title="Music Queue"
            >
              <ListMusic className="h-4 w-4" />
              {musicState.queue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                  {musicState.queue.length}
                </span>
              )}
            </button>

            {/* Add Track Button (Host or seated speaker) */}
            {canControlMusic && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex h-8 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 text-xs font-bold text-white shadow transition-transform active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">گۆرانی</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
         MODAL: Music Queue Drawer
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isQueueOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-white/[0.1] bg-surface-800 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                    <ListMusic className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Music Queue ({musicState.queue.length})
                  </h3>
                </div>
                <button
                  onClick={() => setIsQueueOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Queue List */}
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {musicState.queue.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-40 text-violet-400" />
                    No tracks in queue. Add one to start the party!
                  </div>
                ) : (
                  musicState.queue.map((track, i) => {
                    const isPlayingThis = track.id === currentTrack?.id;

                    return (
                      <div
                        key={track.id}
                        className={`
                          flex items-center justify-between gap-2.5 rounded-2xl border p-2.5 text-xs transition-all
                          ${
                            isPlayingThis
                              ? 'border-violet-500/50 bg-violet-500/15'
                              : 'border-white/[0.06] bg-white/[0.02]'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-slate-500 w-4">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">
                              {track.title}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {track.artist} · Added by {track.addedByName}
                            </p>
                          </div>
                        </div>

                        {isHost && (
                          <button
                            onClick={() => removeTrackFromQueue(roomId, track.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Track CTA */}
              {canControlMusic && (
                <button
                  onClick={() => {
                    setIsQueueOpen(false);
                    setIsAddModalOpen(true);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>زیادکردنی گۆرانی (Add Track)</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL: Add Track to Queue (URL or Presets)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-white/[0.1] bg-surface-800 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                    <Music className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Add Music Track</h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Fast Presets */}
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Quick Sample Streams
                </p>
                <div className="space-y-1.5">
                  {SAMPLE_MUSIC_TRACKS.map((sample) => (
                    <button
                      key={sample.title}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-left text-xs transition-colors hover:bg-white/[0.06]"
                    >
                      <span className="font-semibold text-white truncate mr-2">
                        {sample.title}
                      </span>
                      <span className="text-[10px] text-violet-400 font-bold shrink-0">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleAddTrack} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Track Title
                  </label>
                  <input
                    type="text"
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="e.g. Midnight Waves"
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Artist Name
                  </label>
                  <input
                    type="text"
                    value={trackArtist}
                    onChange={(e) => setTrackArtist(e.target.value)}
                    placeholder="e.g. DJ Cyber"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Audio Stream URL (MP3/OGG)
                  </label>
                  <input
                    type="url"
                    value={trackUrl}
                    onChange={(e) => setTrackUrl(e.target.value)}
                    placeholder="https://...audio.mp3"
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !trackTitle.trim() || !trackUrl.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-violet-500/25 active:scale-95 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isSubmitting ? 'Adding…' : 'Add to Room Queue'}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
