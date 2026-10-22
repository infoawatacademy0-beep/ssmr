import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  Plus,
  ListMusic,
  Disc3,
  X,
  Trash2,
  Repeat,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import type { RoomMusicState, User, Seat } from '../types';
import { SAMPLE_MUSIC_TRACKS } from '../types';
import {
  addTrackToQueue,
  setMusicPlayback,
  skipToNextTrack,
  removeTrackFromQueue,
  cancelAndClearMusic,
  changeCurrentTrack,
  selectTrackFromQueue,
  toggleMusicRepeat,
  restartCurrentTrack,
} from '../services';

interface MusicPlayerPanelProps {
  roomId: string;
  currentUser: User;
  isHost: boolean;
  seats: Seat[];
  musicState: RoomMusicState;
  onClosePanel?: () => void;
}

export default function MusicPlayerPanel({
  roomId,
  currentUser,
  isHost,
  seats,
  musicState,
  onClosePanel,
}: MusicPlayerPanelProps) {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'change'>('change');

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
  const currentTrack =
    musicState.queue.find((t) => t.id === musicState.currentTrackId) ||
    musicState.queue[0] ||
    null;

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

    // Keep loop attribute synced with repeat state
    audio.loop = Boolean(musicState.isRepeat);

    // Calculate approximate synchronized position
    if (musicState.isPlaying) {
      const elapsedSinceSync = Math.max(0, (Date.now() - musicState.lastSyncTimestamp) / 1000);
      const duration = currentTrack.duration || 180;
      const rawTarget = musicState.playbackPosition + elapsedSinceSync;
      const targetTime = musicState.isRepeat
        ? rawTarget % duration
        : Math.min(duration, rawTarget);

      // If out of sync by more than 1.5 seconds, resync
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

  // Audio track ended listener -> repeat if isRepeat is enabled, otherwise skip to next track
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
     Playback Control Handlers (Host / Controller)
     ───────────────────────────────────────────────────────────── */
  const handleTogglePlay = async () => {
    if (!canControlMusic || !currentTrack) return;
    const audio = audioRef.current;
    const currentPos = audio ? audio.currentTime : musicState.playbackPosition;
    await setMusicPlayback(roomId, !musicState.isPlaying, currentPos);
  };

  const handleRestartTrack = async () => {
    if (!canControlMusic || !currentTrack) return;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(console.error);
    }
    await restartCurrentTrack(roomId);
  };

  const handleToggleRepeat = async () => {
    if (!canControlMusic) return;
    await toggleMusicRepeat(roomId, !musicState.isRepeat);
  };

  const handleSkip = async () => {
    if (!canControlMusic) return;
    await skipToNextTrack(roomId);
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
    if (onClosePanel) {
      onClosePanel();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Add or Change Track Handler
     ───────────────────────────────────────────────────────────── */
  const handleAddOrChangeTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || !trackUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: trackTitle.trim(),
        artist: trackArtist.trim() || 'SSMR Music',
        duration: 180,
        url: trackUrl.trim(),
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      };

      if (modalMode === 'change' || !currentTrack) {
        await changeCurrentTrack(roomId, payload);
      } else {
        await addTrackToQueue(roomId, payload);
      }

      setTrackTitle('');
      setTrackArtist('');
      setTrackUrl('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە پێبکرێت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Immediately play a preset sample track with 1 click when changing song
  const handleQuickPlaySample = async (sample: (typeof SAMPLE_MUSIC_TRACKS)[0]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title: sample.title,
        artist: sample.artist,
        duration: sample.duration || 180,
        url: sample.url,
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      };

      if (modalMode === 'change' || !currentTrack) {
        await changeCurrentTrack(roomId, payload);
      } else {
        await addTrackToQueue(roomId, payload);
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە بگۆڕدرێت.');
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="relative mx-3 mb-2 rounded-2xl border border-violet-500/30 bg-surface-800/95 p-3 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Animated Vinyl Record Disc + Current Track Info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <motion.div
                animate={musicState.isPlaying ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  musicState.isPlaying
                    ? { duration: 4, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.3 }
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-surface-900 via-surface-700 to-violet-900 p-1 border-2 border-violet-400 shadow-md shadow-violet-500/20"
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

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-bold text-violet-300 uppercase shrink-0">
                  {musicState.isRepeat ? '🔁 دووبارە' : '🎵 گۆرانی'}
                </span>
                <p className="truncate text-xs font-bold text-white">
                  {currentTrack ? currentTrack.title : 'هیچ گۆرانییەک لێنادرێت'}
                </p>
              </div>
              <p className="truncate text-[10px] text-slate-400">
                {currentTrack
                  ? `${currentTrack.artist} · لەلایەن ${currentTrack.addedByName}`
                  : 'گۆرانی هەڵبژێرە بۆ پێکردن لە ژوورەکەدا'}
              </p>
            </div>
          </div>

          {/* Playback & Song Management Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {canControlMusic && currentTrack && (
              <>
                {/* Play / Pause */}
                <button
                  onClick={handleTogglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-transform active:scale-95"
                  title={musicState.isPlaying ? 'وەستاندنی کاتی (Pause)' : 'پێکردن (Play)'}
                >
                  {musicState.isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                {/* Restart Song from 0:00 (دووبارەکردنەوە لە سەرەتاوە) */}
                <button
                  onClick={handleRestartTrack}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors active:scale-95"
                  title="لێدانەوە لە سەرەتاوە (Restart Song)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Repeat / Loop Toggle (دووبارەبوونەوەی بەردەوام) */}
                <button
                  onClick={handleToggleRepeat}
                  className={`flex h-8 items-center gap-1 rounded-xl border px-2 text-[10px] font-black transition-all active:scale-95 ${
                    musicState.isRepeat
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white'
                  }`}
                  title="دووبارەبوونەوەی گۆرانی (Repeat / Loop Song)"
                >
                  <Repeat className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">دووبارە</span>
                </button>

                {/* Change Song Button (گۆڕینی گۆرانی) */}
                <button
                  onClick={() => {
                    setModalMode('change');
                    setIsAddModalOpen(true);
                  }}
                  className="flex h-8 items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-2 text-[10px] font-black text-amber-300 hover:bg-amber-500/25 transition-colors active:scale-95"
                  title="گۆڕینی گۆرانی (Change Song)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>گۆڕین</span>
                </button>

                {/* Next Track in Queue (if more than 1 track) */}
                {musicState.queue.length > 1 && (
                  <button
                    onClick={handleSkip}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white active:scale-95"
                    title="گۆرانی دواتر (Next Track)"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                )}

                {/* Cancel & Remove Song (لابردن و وەستاندنی گۆرانی) */}
                <button
                  onClick={handleCancelAndRemoveMusic}
                  className="flex h-8 items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/20 px-2 text-[10px] font-black text-rose-300 hover:bg-rose-500/30 transition-colors active:scale-95"
                  title="لابردن و وەستاندنی گۆرانی (Cancel & Remove Song)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>لابردن</span>
                </button>
              </>
            )}

            {/* Quick Select / Play if Queue is Empty */}
            {canControlMusic && !currentTrack && (
              <>
                <button
                  onClick={() => {
                    setModalMode('change');
                    setIsAddModalOpen(true);
                  }}
                  className="flex h-8 items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-xs font-black text-black shadow-md transition-transform active:scale-95"
                  title="هەڵبژاردن و پێکردنی گۆرانی"
                >
                  <Play className="h-3.5 w-3.5 fill-black" />
                  <span>هەڵبژاردنی گۆرانی</span>
                </button>
                {onClosePanel && (
                  <button
                    onClick={onClosePanel}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-rose-400"
                    title="داخستن"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </>
            )}

            {/* View Queue Drawer */}
            <button
              onClick={() => setIsQueueOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white"
              title="لیستی گۆرانییەکان (Music Queue)"
            >
              <ListMusic className="h-4 w-4" />
              {musicState.queue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                  {musicState.queue.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
         MODAL: Music Queue Drawer (Click any song to switch, or clear all)
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
                    لیستی گۆرانییەکان ({musicState.queue.length})
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {canControlMusic && musicState.queue.length > 0 && (
                    <button
                      onClick={async () => {
                        await handleCancelAndRemoveMusic();
                        setIsQueueOpen(false);
                      }}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[10px] font-black text-rose-300 hover:bg-rose-500/25"
                    >
                      سڕینەوەی هەمووی
                    </button>
                  )}
                  <button
                    onClick={() => setIsQueueOpen(false)}
                    className="rounded-full p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Queue List */}
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {musicState.queue.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-40 text-violet-400" />
                    هیچ گۆرانییەک لە لیستدا نییە.
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
                        <div
                          onClick={() => {
                            if (canControlMusic && !isPlayingThis) {
                              selectTrackFromQueue(roomId, track.id);
                            }
                          }}
                          className={`flex items-center gap-2 min-w-0 flex-1 ${
                            canControlMusic && !isPlayingThis ? 'cursor-pointer hover:opacity-80' : ''
                          }`}
                        >
                          <span className="text-[10px] font-bold text-slate-500 w-4">
                            {isPlayingThis ? '▶' : i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">
                              {track.title}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {track.artist} · {track.addedByName}
                            </p>
                          </div>
                        </div>

                        {canControlMusic && (
                          <div className="flex items-center gap-1">
                            {!isPlayingThis && (
                              <button
                                onClick={() => selectTrackFromQueue(roomId, track.id)}
                                className="rounded-lg bg-violet-500/20 px-2 py-1 text-[10px] font-bold text-violet-300 hover:bg-violet-500/30"
                                title="پێکردنی ئەم گۆرانییە"
                              >
                                پێکردن
                              </button>
                            )}
                            <button
                              onClick={() => removeTrackFromQueue(roomId, track.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="سڕینەوەی گۆرانی"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add / Change Track CTA */}
              {canControlMusic && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsQueueOpen(false);
                      setModalMode('change');
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/15 py-2.5 text-xs font-bold text-amber-300 active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>گۆڕینی گۆرانی</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsQueueOpen(false);
                      setModalMode('add');
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>زیادکردن بۆ لیست</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL: Change or Add Track (1-Click Presets or Custom URL)
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
                  <h3 className="text-sm font-bold text-white">
                    {modalMode === 'change' ? 'گۆڕین و هەڵبژاردنی گۆرانی' : 'زیادکردنی گۆرانی بۆ لیست'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mode Switch Tabs */}
              <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-surface-900 p-1">
                <button
                  type="button"
                  onClick={() => setModalMode('change')}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                    modalMode === 'change'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔄 گۆڕینی دەستبەجێ
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('add')}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                    modalMode === 'add'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ➕ زیادکردن بۆ ڕیز
                </button>
              </div>

              {/* 1-Click Fast Presets */}
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  کرتە لە هەر گۆرانییەک بکە بۆ پێکردنی ڕاستەوخۆ:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {SAMPLE_MUSIC_TRACKS.map((sample) => {
                    const isCurrent = currentTrack?.url === sample.url;
                    return (
                      <button
                        key={sample.title}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleQuickPlaySample(sample)}
                        className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-colors ${
                          isCurrent
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.08] text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold truncate">{sample.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{sample.artist}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-violet-500/20 px-2 py-1 text-[10px] font-black text-violet-300">
                          {isCurrent ? '🎵 لێدەدرێت' : modalMode === 'change' ? '▶ پێکردن' : '+ زیادکردن'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom URL Form Input */}
              <form onSubmit={handleAddOrChangeTrack} className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-3">
                <p className="text-[10px] font-semibold text-slate-400">
                  یان بەستەری گۆرانی (MP3 / OGG) دابنێ:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="ناوی گۆرانی..."
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                  <input
                    type="text"
                    value={trackArtist}
                    onChange={(e) => setTrackArtist(e.target.value)}
                    placeholder="هونەرمەند..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                </div>

                <input
                  type="url"
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  placeholder="https://...audio.mp3"
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                />

                <button
                  type="submit"
                  disabled={isSubmitting || !trackTitle.trim() || !trackUrl.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-500/25 active:scale-95 disabled:opacity-50"
                >
                  {modalMode === 'change' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{isSubmitting ? 'خەریکە...' : 'گۆڕین و پێکردنی گۆرانی'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>{isSubmitting ? 'خەریکە...' : 'زیادکردن بۆ لیستی گۆرانی'}</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
