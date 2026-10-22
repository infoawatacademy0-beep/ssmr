import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Play,
  Pause,
  Plus,
  Volume2,
  VolumeX,
  Disc3,
  X,
  Trash2,
  Repeat,
  Minus,
} from 'lucide-react';
import type { RoomMusicState, User, Seat } from '../types';
import { SAMPLE_MUSIC_TRACKS } from '../types';
import {
  setMusicPlayback,
  skipToNextTrack,
  cancelAndClearMusic,
  changeCurrentTrack,
  toggleMusicRepeat,
  restartCurrentTrack,
  setMusicVolume,
} from '../services';

interface MusicPlayerPanelProps {
  roomId: string;
  currentUser: User;
  isHost: boolean;
  seats: Seat[];
  musicState: RoomMusicState;
  isOpenModal?: boolean;
  onOpenPanel?: () => void;
  onClosePanel?: () => void;
}

export default function MusicPlayerPanel({
  roomId,
  currentUser,
  isHost,
  seats,
  musicState,
  isOpenModal = false,
  onOpenPanel,
  onClosePanel,
}: MusicPlayerPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState<number>(musicState.volume ?? 0.7);
  const [showCustomUrl, setShowCustomUrl] = useState(false);

  // Custom track form inputs
  const [trackTitle, setTrackTitle] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync modal state with parent button in VoiceRoom header
  useEffect(() => {
    setIsModalOpen(isOpenModal);
  }, [isOpenModal]);

  const openModal = () => {
    setIsModalOpen(true);
    if (onOpenPanel) onOpenPanel();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    if (onClosePanel) onClosePanel();
  };

  // User is seated on stage OR is Room Host / Admin
  const canControlMusic = Boolean(
    isHost || currentUser.isAdmin || seats.some((s) => s.userId === currentUser.uid),
  );

  // Find currently active track
  const currentTrack =
    musicState.queue.find((t) => t.id === musicState.currentTrackId) ||
    musicState.queue[0] ||
    null;

  // Sync volume from Firebase room state when updated by host
  useEffect(() => {
    if (typeof musicState.volume === 'number') {
      setLocalVolume(musicState.volume);
    }
  }, [musicState.volume]);

  // Apply volume to HTML5 audio element immediately
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, localVolume));
    }
  }, [localVolume]);

  /* ─────────────────────────────────────────────────────────────
     Synchronized Audio Playback with Firebase
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // If song was canceled/removed, immediately stop audio playback
    if (!currentTrack) {
      audio.pause();
      if (audio.src) {
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    // If audio source changed
    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
    }

    audio.loop = Boolean(musicState.isRepeat);
    audio.volume = Math.max(0, Math.min(1, localVolume));

    if (musicState.isPlaying) {
      const elapsedSinceSync = Math.max(0, (Date.now() - musicState.lastSyncTimestamp) / 1000);
      const duration = currentTrack.duration || 180;
      const rawTarget = musicState.playbackPosition + elapsedSinceSync;
      const targetTime = musicState.isRepeat
        ? rawTarget % duration
        : Math.min(duration, rawTarget);

      if (Math.abs(audio.currentTime - targetTime) > 1.5) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // Ignore seek errors before metadata loads
        }
      }

      audio.play().catch((err) => {
        console.warn('Playback paused due to browser autoplay restriction:', err);
      });
    } else {
      audio.pause();
      if (typeof musicState.playbackPosition === 'number') {
        try {
          audio.currentTime = musicState.playbackPosition;
        } catch {
          // Ignore seek errors
        }
      }
    }
  }, [
    musicState.isPlaying,
    musicState.isRepeat,
    musicState.currentTrackId,
    musicState.lastSyncTimestamp,
    musicState.playbackPosition,
    currentTrack,
  ]);

  // Audio track ended listener -> repeat if isRepeat is enabled, otherwise skip
  const handleAudioEnded = () => {
    if (musicState.isRepeat && currentTrack) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      }
      if (isHost) {
        restartCurrentTrack(roomId).catch(console.error);
      }
      return;
    }

    if (isHost) {
      skipToNextTrack(roomId).catch(console.error);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Unified Control Handlers
     ───────────────────────────────────────────────────────────── */
  const handleVolumeChange = async (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(newVol * 100) / 100));
    setLocalVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (canControlMusic) {
      await setMusicVolume(roomId, clamped).catch(console.error);
    }
  };

  const handleTogglePlay = async () => {
    if (!canControlMusic || !currentTrack) return;
    const audio = audioRef.current;
    const currentPos = audio ? audio.currentTime : musicState.playbackPosition;
    await setMusicPlayback(roomId, !musicState.isPlaying, currentPos);
  };

  // Single Unified Repeat Button: toggles repeat mode and restarts if track ended
  const handleSingleRepeatButton = async () => {
    if (!canControlMusic || !currentTrack) return;
    const nextRepeat = !musicState.isRepeat;
    await toggleMusicRepeat(roomId, nextRepeat);
    if (nextRepeat && audioRef.current) {
      audioRef.current.loop = true;
      if (audioRef.current.paused) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        await restartCurrentTrack(roomId);
      }
    }
  };

  const handleCancelAndRemoveMusic = async () => {
    if (!canControlMusic) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    await cancelAndClearMusic(roomId);
    closeModal();
  };

  const handleSelectSong = async (sample: (typeof SAMPLE_MUSIC_TRACKS)[0]) => {
    if (!canControlMusic || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await changeCurrentTrack(roomId, {
        title: sample.title,
        artist: sample.artist,
        duration: sample.duration || 180,
        url: sample.url,
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە بگۆڕدرێت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSongSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || !trackUrl.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await changeCurrentTrack(roomId, {
        title: trackTitle.trim(),
        artist: currentUser.username,
        duration: 180,
        url: trackUrl.trim(),
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });
      setTrackTitle('');
      setTrackUrl('');
      setShowCustomUrl(false);
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە پێبکرێت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const volumePercent = Math.round(localVolume * 100);

  return (
    <>
      {/* Hidden Synchronized HTML5 Audio Element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} preload="auto" />

      {/* ── Ultra-Clean Compact Mini Bar (Only shown when a song is active) ── */}
      {currentTrack && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-violet-500/30 bg-surface-800/90 px-3 py-2 shadow-lg backdrop-blur-xl">
          {/* Spinning Disc + Song Title */}
          <div
            onClick={openModal}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          >
            <motion.div
              animate={musicState.isPlaying ? { rotate: 360 } : { rotate: 0 }}
              transition={
                musicState.isPlaying
                  ? { duration: 4, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.3 }
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-surface-900 to-violet-900 border border-violet-400"
            >
              <Disc3 className="h-4 w-4 text-violet-300" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white flex items-center gap-1.5">
                {musicState.isRepeat && <span className="text-emerald-400 text-[10px]">🔁</span>}
                <span className="truncate">{currentTrack.title}</span>
              </p>
              <p className="truncate text-[10px] text-slate-400">
                دەنگ: {volumePercent}% · کرتە بکە بۆ کۆنترۆڵی گۆرانی
              </p>
            </div>
          </div>

          {/* ONE Single Unified Button to Open Music Control */}
          <button
            onClick={openModal}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-black text-white shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Music className="h-3.5 w-3.5" />
            <span>کۆنترۆڵی گۆرانی</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
         SINGLE UNIFIED MUSIC CONTROL MODAL (No clutter, all-in-one)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-white/[0.1] bg-surface-800 p-5 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                    <Music className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">بەشی گۆرانی ژوور</h3>
                    <p className="text-[10px] text-slate-400">
                      {currentTrack ? currentTrack.title : 'هیچ گۆرانییەک هەڵنەبژێردراوە'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 1. VOLUME CONTROL (کەم و زیادکردنی دەنگی گۆرانی) */}
              <div className="rounded-2xl border border-white/[0.08] bg-surface-900/80 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    {localVolume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-violet-400" />
                    )}
                    <span>دەنگی گۆرانی</span>
                  </span>
                  <span className="rounded-lg bg-violet-500/20 px-2 py-0.5 text-xs font-black text-violet-300">
                    {volumePercent}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVolumeChange(localVolume - 0.1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/[0.1] active:scale-90"
                    title="کەمکردنی دەنگ"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volumePercent}
                    onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-violet-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleVolumeChange(localVolume + 0.1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/[0.1] active:scale-90"
                    title="زیادکردنی دەنگ"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. UNIFIED ACTION BUTTONS (Play/Pause, 1 Repeat Button, Remove) */}
              {canControlMusic && currentTrack && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-violet-600 py-2.5 text-xs font-black text-white shadow-md active:scale-95"
                  >
                    {musicState.isPlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>وەستاندن</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>پێکردن</span>
                      </>
                    )}
                  </button>

                  {/* ONE Single Repeat Button (دووبارەبوونەوە) */}
                  <button
                    type="button"
                    onClick={handleSingleRepeatButton}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 text-xs font-black transition-all active:scale-95 ${
                      musicState.isRepeat
                        ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : 'border-white/[0.1] bg-white/[0.04] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Repeat className="h-4 w-4" />
                    <span>{musicState.isRepeat ? 'دووبارە: چالاکە' : 'دووبارەکردنەوە'}</span>
                  </button>

                  {/* Cancel & Remove Song (لابردنی گۆرانی) */}
                  <button
                    type="button"
                    onClick={handleCancelAndRemoveMusic}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-500/40 bg-rose-500/15 py-2.5 text-xs font-black text-rose-300 hover:bg-rose-500/25 active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>لابردن</span>
                  </button>
                </div>
              )}

              {/* 3. CHANGE / SELECT SONG LIST (گۆڕین و هەڵبژاردنی گۆرانی) */}
              {canControlMusic && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-300">
                      گۆڕین یان هەڵبژاردنی گۆرانی:
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCustomUrl((v) => !v)}
                      className="text-[11px] font-bold text-violet-400 hover:text-violet-300"
                    >
                      {showCustomUrl ? 'داخستنی لینک' : '+ دانانی لینکی MP3'}
                    </button>
                  </div>

                  {/* Optional Custom URL Input */}
                  {showCustomUrl && (
                    <form
                      onSubmit={handleCustomSongSubmit}
                      className="space-y-2 rounded-2xl border border-white/[0.08] bg-surface-900 p-2.5"
                    >
                      <input
                        type="text"
                        value={trackTitle}
                        onChange={(e) => setTrackTitle(e.target.value)}
                        placeholder="ناوی گۆرانی..."
                        required
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                      />
                      <input
                        type="url"
                        value={trackUrl}
                        onChange={(e) => setTrackUrl(e.target.value)}
                        placeholder="https://...audio.mp3"
                        required
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white"
                      >
                        پێکردنی ئەم گۆرانییە
                      </button>
                    </form>
                  )}

                  {/* 1-Click Song Selection List */}
                  <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                    {SAMPLE_MUSIC_TRACKS.map((sample) => {
                      const isCurrent = currentTrack?.url === sample.url;
                      return (
                        <button
                          key={sample.title}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectSong(sample)}
                          className={`flex w-full items-center justify-between rounded-2xl border p-2.5 text-left text-xs transition-all ${
                            isCurrent
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                              : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.08] text-white'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold truncate">{sample.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{sample.artist}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black ${
                              isCurrent
                                ? 'bg-emerald-500 text-black'
                                : 'bg-violet-500/20 text-violet-300'
                            }`}
                          >
                            {isCurrent ? '🎵 لێدەدرێت' : '▶ پێکردن'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
