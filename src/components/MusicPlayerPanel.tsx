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
  Loader2,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import type { RoomMusicState, User, Seat } from '../types';
import { useLanguage } from '../contexts';
import { SAMPLE_MUSIC_TRACKS } from '../types';
import {
  setMusicPlayback,
  skipToNextTrack,
  cancelAndClearMusic,
  changeCurrentTrack,
  selectTrackFromQueue,
  toggleMusicRepeat,
  restartCurrentTrack,
  setMusicVolume,
  uploadSongFile,
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
  const { tr } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState<number>(musicState.volume ?? 0.7);

  // Custom track form inputs
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Uploading to Internet Archive S3 state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync modal state with parent
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

  // Host/Admin has master moderation rights, but ALL members can add and play songs
  const isRoomAdmin = Boolean(isHost || currentUser.isAdmin);

  // Find currently active track
  const currentTrack =
    (musicState.currentTrackId
      ? musicState.queue.find((t) => t.id === musicState.currentTrackId)
      : null) || null;

  // Combine saved custom room songs (musicState.queue) + ready sample songs without duplicates
  const allSavedSongs = [
    ...musicState.queue,
    ...SAMPLE_MUSIC_TRACKS.filter(
      (sample) => !musicState.queue.some((q) => q.url === sample.url),
    ).map((sample, idx) => ({
      id: `sample_${idx}`,
      title: sample.title,
      artist: sample.artist,
      duration: sample.duration,
      url: sample.url,
      addedBy: 'system',
      addedByName: 'System',
      addedAt: 0,
    })),
  ];

  // Sync volume from Firebase room state
  useEffect(() => {
    if (typeof musicState.volume === 'number') {
      setLocalVolume(musicState.volume);
    }
  }, [musicState.volume]);

  // Apply volume to HTML5 audio element
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

    if (!currentTrack) {
      audio.pause();
      if (audio.src) {
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

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
        console.warn('Playback paused due to autoplay restriction:', err);
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
    if (isRoomAdmin) {
      await setMusicVolume(roomId, clamped).catch(console.error);
    }
  };

  const handleTogglePlay = async () => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    const currentPos = audio ? audio.currentTime : musicState.playbackPosition;
    await setMusicPlayback(roomId, !musicState.isPlaying, currentPos);
  };

  const handleSingleRepeatButton = async () => {
    if (!currentTrack) return;
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
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    await cancelAndClearMusic(roomId);
    closeModal();
  };

  /**
   * When any member clicks a song from the list,
   * immediately stops the current playing song and starts this new song across the room!
   */
  const handleSelectSong = async (song: (typeof allSavedSongs)[0]) => {
    if (isSubmitting || isUploading) return;
    setIsSubmitting(true);
    try {
      if (song.id && !song.id.startsWith('sample_')) {
        await selectTrackFromQueue(roomId, song.id, {
          uid: currentUser.uid,
          username: currentUser.username,
        });
      } else {
        await changeCurrentTrack(roomId, {
          title: song.title,
          artist: song.artist,
          duration: song.duration || 180,
          url: song.url,
          addedBy: currentUser.uid,
          addedByName: currentUser.username,
        });
      }
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە لێبدرێت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles custom song submission via direct URL.
   */
  const handleCustomSongSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || !trackUrl.trim() || isSubmitting || isUploading) return;
    setIsSubmitting(true);
    try {
      await changeCurrentTrack(roomId, {
        title: trackTitle.trim(),
        artist: trackArtist.trim() || currentUser.username,
        duration: 200,
        url: trackUrl.trim(),
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });
      setTrackTitle('');
      setTrackArtist('');
      setTrackUrl('');
      closeModal();
    } catch (err: any) {
      alert(err.message || 'نەتوانرا گۆرانییەکە پێبکرێت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Uploads ANY audio / song file format to Internet Archive via backend S3 API,
   * receives the direct permanent streaming link, saves to Firebase,
   * and immediately starts playing it across the room (interrupting any prior song).
   */
  const handleLocalAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detect format and clean name
    const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
    const fileExt = extMatch ? extMatch[1].toUpperCase() : 'AUDIO';
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'گۆرانی نوێ';

    setIsUploading(true);
    setUploadStatus(tr(`خەریکی بارکردنی فایلی (${fileExt}) بۆ ئەرشیف...`, `Uploading (${fileExt}) audio file to archive...`));

    // Probe duration using client Audio metadata
    let detectedDuration = 210;
    try {
      const tempAudio = new Audio();
      const tempUrl = URL.createObjectURL(file);
      tempAudio.src = tempUrl;
      await new Promise<void>((resolve) => {
        tempAudio.onloadedmetadata = () => {
          if (tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 0) {
            detectedDuration = Math.round(tempAudio.duration);
          }
          URL.revokeObjectURL(tempUrl);
          resolve();
        };
        tempAudio.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve();
        };
        setTimeout(() => {
          URL.revokeObjectURL(tempUrl);
          resolve();
        }, 1200);
      });
    } catch {
      // fallback
    }

    try {
      // 1. Upload to Internet Archive via backend endpoint (supports all formats)
      const uploadResult = await uploadSongFile(file);
      const directLink = uploadResult.directLink;

      setUploadStatus(tr('دەستپێکردنی پەخش بۆ هەموو ژوورەکە...', 'Broadcasting playback to room...'));

      // 2. Immediately save direct link and start playing in room
      await changeCurrentTrack(roomId, {
        title: cleanTitle,
        artist: currentUser.username,
        duration: detectedDuration,
        url: directLink,
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });

      closeModal();
    } catch (err: any) {
      console.error('Audio upload error:', err);
      alert(err.message || 'هەڵەیەک ڕوویدا لە کاتی بارکردنی گۆرانییەکە');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      e.target.value = '';
    }
  };

  const volumePercent = Math.round(localVolume * 100);

  return (
    <>
      {/* Hidden Synchronized HTML5 Audio Element with universal format support */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={(err) => {
          console.warn('Audio playback format warning:', err);
        }}
        preload="auto"
        playsInline
      />

      {/* Hidden Universal File Input for ALL Device Audio / Media Formats */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.wma,.webm,.mp4,.3gp,.amr,*/*"
        onChange={handleLocalAudioFileSelect}
        className="hidden"
      />

      {/* ── Room Screen Music Bar (Visible when active; All members can click to view/change song) ── */}
      {(musicState.isMusicModeActive || musicState.isPlaying) && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-violet-500/30 bg-surface-800/90 px-3 py-2 shadow-lg backdrop-blur-xl">
          {/* Spinning Disc + Song Title + Playing info */}
          <div
            onClick={openModal}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
          >
            <motion.div
              animate={musicState.isPlaying ? { rotate: 360 } : { rotate: 0 }}
              transition={
                musicState.isPlaying
                  ? { duration: 4, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.3 }
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-surface-900 to-violet-900 border border-violet-400 group-hover:scale-105 transition"
            >
              <Disc3 className="h-4 w-4 text-violet-300" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white flex items-center gap-1.5">
                {musicState.isRepeat && <span className="text-emerald-400 text-[10px]">🔁</span>}
                <span className="truncate group-hover:text-violet-300 transition">
                  {currentTrack ? currentTrack.title : tr('بەشی گۆرانی ژوور', 'Room Music Player')}
                </span>
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {currentTrack ? (
                  <>
                    <span>{currentTrack.artist}</span>
                    {musicState.playedByName && (
                      <span className="text-amber-400">
                        {' '}&bull; {tr('لە لایەن:', 'By:')} {musicState.playedByName}
                      </span>
                    )}
                  </>
                ) : (
                  tr('کرتە بکە بۆ زیادکردن و پێکردنی گۆرانی', 'Click to add & play music')
                )}
              </p>
            </div>
          </div>

          {/* Action buttons on banner */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openModal}
              className="flex h-8 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 text-xs font-black text-white shadow-md transition-transform active:scale-95"
            >
              <Music className="h-3.5 w-3.5" />
              <span>{tr('گۆرانییەکان', 'Music')}</span>
            </button>

            {isRoomAdmin && (
              <button
                type="button"
                onClick={handleCancelAndRemoveMusic}
                title={tr('داخستنی مۆدی گۆرانی', 'Close music mode')}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 transition hover:bg-rose-500/30 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
         SINGLE UNIFIED MUSIC & ADD SONG MODAL (For Host & All Members)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm max-h-[88vh] overflow-y-auto rounded-3xl border border-white/[0.1] bg-surface-800 p-5 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                    <Music className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {tr('گۆرانییەکانی ژوور (موزیک)', 'Room Music & Songs')}
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                      {currentTrack
                        ? `${currentTrack.title}${musicState.playedByName ? ` (${musicState.playedByName})` : ''}`
                        : tr('هیچ گۆرانییەک هەڵنەبژێردراوە', 'No track selected')}
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

              {/* Uploading Status Overlay (If uploading file to Archive S3) */}
              {isUploading && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-center space-y-2">
                  <Loader2 className="h-6 w-6 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-amber-300">{uploadStatus}</p>
                  <p className="text-[10px] text-slate-400">
                    {tr('فایل باردەکرێت بۆ ئەرشیف بۆ لینکی ڕاستەوخۆ...', 'Uploading to Internet Archive S3...')}
                  </p>
                </div>
              )}

              {/* 1. VOLUME CONTROL */}
              <div className="rounded-2xl border border-white/[0.08] bg-surface-900/80 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    {localVolume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-violet-400" />
                    )}
                    <span>{tr('دەنگی گۆرانی', 'Music Volume')}</span>
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
                    title={tr('کەمکردنی دەنگ', 'Decrease Volume')}
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
                    title={tr('زیادکردنی دەنگ', 'Increase Volume')}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. PLAYBACK ACTION BUTTONS (Play/Pause, Repeat, Stop) */}
              {currentTrack && (
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
                        <span>{tr('وەستاندن', 'Pause')}</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>{tr('پێکردن', 'Play')}</span>
                      </>
                    )}
                  </button>

                  {/* Single Repeat Button */}
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
                    <span>
                      {musicState.isRepeat
                        ? tr('دووبارە: چالاکە', 'Repeat: ON')
                        : tr('دووبارەکردنەوە', 'Repeat')}
                    </span>
                  </button>

                  {/* Stop/Close Mode Button */}
                  <button
                    type="button"
                    onClick={handleCancelAndRemoveMusic}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-500/40 bg-rose-500/15 py-2.5 text-xs font-black text-rose-300 hover:bg-rose-500/25 active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{tr('ڕاگرتن', 'Stop')}</span>
                  </button>
                </div>
              )}

              {/* 3. ADD / UPLOAD SONG SECTION (Available to Members & Host!) */}
              <div className="space-y-3 rounded-2xl border border-violet-500/25 bg-surface-900/70 p-3">
                <p className="text-xs font-black text-violet-300 flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span>{tr('زیادکردن و بارکردنی گۆرانی', 'Add & Upload Song')}</span>
                </p>

                {/* Option A: Pick Audio File from Device (Uploads via Internet Archive S3 API) */}
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50 transition"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  <span>
                    {isUploading
                      ? tr('خەریکی بارکردنە...', 'Uploading...')
                      : tr('بارکردنی هەموو جۆرە فایلی دەنگ (MP3, M4A, WAV, OGG, FLAC...)', 'Upload any audio format (MP3, M4A, WAV, OGG, FLAC...)')}
                  </span>
                </button>

                {/* Option B: Add by Title & Audio Link */}
                <form onSubmit={handleCustomSongSubmit} className="space-y-2 border-t border-white/[0.06] pt-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                      placeholder={tr('ناوی گۆرانی...', 'Track title...')}
                      required
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                    />
                    <input
                      type="text"
                      value={trackArtist}
                      onChange={(e) => setTrackArtist(e.target.value)}
                      placeholder={tr('ناوی هونەرمەند...', 'Artist name...')}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                    />
                  </div>
                  <input
                    type="url"
                    value={trackUrl}
                    onChange={(e) => setTrackUrl(e.target.value)}
                    placeholder={tr('لینکی ڕاستەوخۆ (https://...mp3)', 'Direct MP3 link...')}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading || !trackTitle.trim() || !trackUrl.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      {isSubmitting
                        ? tr('خەریکە...', 'Adding...')
                        : tr('پێکردن و زیادکردن بۆ ژوور', 'Play & Add to Room')}
                    </span>
                  </button>
                </form>
              </div>

              {/* 4. PRESERVED SONGS LIST (Click any song to immediately play & cut off other songs!) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-300">
                    {tr('لیستی گۆرانییەکان', 'Room Playlist')} ({allSavedSongs.length}):
                  </p>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{tr('ئەندامان دەتوانن لێیبدەن', 'Members can play')}</span>
                  </span>
                </div>

                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {allSavedSongs.map((song) => {
                    const isCurrent = Boolean(currentTrack && currentTrack.url === song.url);
                    return (
                      <button
                        key={song.id || song.url}
                        type="button"
                        disabled={isSubmitting || isUploading}
                        onClick={() =>
                          handleSelectSong({
                            id: song.id,
                            title: song.title,
                            artist: song.artist,
                            duration: song.duration || 180,
                            url: song.url,
                          })
                        }
                        className={`flex w-full items-center justify-between rounded-2xl border p-2.5 text-left text-xs transition-all ${
                          isCurrent
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.08] text-white active:scale-98'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold truncate">{song.title}</p>
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            <span>{song.artist}</span>
                            {song.addedByName && (
                              <span className="text-slate-500">
                                &bull; {song.addedByName}
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black ${
                            isCurrent
                              ? 'bg-emerald-500 text-black'
                              : 'bg-violet-500/20 text-violet-300 group-hover:bg-violet-500 group-hover:text-white'
                          }`}
                        >
                          {isCurrent ? tr('🎵 لێدەدرێت', '🎵 Playing') : tr('▶ پێکردن', '▶ Play')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
