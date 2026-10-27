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
  Smartphone,
  ChevronDown,
  ChevronUp,
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
  removeTrackFromQueue,
  clearAllTracksFromQueue,
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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [dismissedSampleIds, setDismissedSampleIds] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const loadedTrackUrlRef = useRef<string | null>(null);

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
    )
      .map((sample, idx) => ({
        id: `sample_${idx}`,
        title: sample.title,
        artist: sample.artist,
        duration: sample.duration,
        url: sample.url,
        addedBy: 'system',
        addedByName: 'System',
        addedAt: 0,
      }))
      .filter((s) => !dismissedSampleIds.includes(s.id)),
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
     Uses strict track ID and URL reference locking to NEVER
     reload or restart audio when seats, entrances, or room state changes!
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
      loadedTrackIdRef.current = null;
      loadedTrackUrlRef.current = null;
      return;
    }

    const isTrackChanged =
      loadedTrackIdRef.current !== currentTrack.id ||
      loadedTrackUrlRef.current !== currentTrack.url;

    if (isTrackChanged) {
      // Actually changing to a different song
      loadedTrackIdRef.current = currentTrack.id;
      loadedTrackUrlRef.current = currentTrack.url;
      audio.src = currentTrack.url;
      audio.loop = Boolean(musicState.isRepeat);
      audio.volume = Math.max(0, Math.min(1, localVolume));
      audio.load();

      const elapsedSinceSync = Math.max(0, (Date.now() - musicState.lastSyncTimestamp) / 1000);
      const duration = currentTrack.duration || 180;
      const rawTarget = musicState.playbackPosition + elapsedSinceSync;
      const targetTime = musicState.isRepeat
        ? rawTarget % duration
        : Math.min(duration, rawTarget);

      const onReady = () => {
        try {
          if (targetTime > 0.5 && targetTime < (audio.duration || Infinity)) {
            audio.currentTime = targetTime;
          }
        } catch {
          // Ignore initial seek error
        }
        if (musicState.isPlaying) {
          audio.play().catch((err) => {
            console.warn('Playback paused due to autoplay restriction:', err);
          });
        }
      };

      audio.addEventListener('loadedmetadata', onReady, { once: true });
    } else {
      // SAME TRACK: Never reload media or reset buffer!
      audio.loop = Boolean(musicState.isRepeat);
      audio.volume = Math.max(0, Math.min(1, localVolume));

      if (musicState.isPlaying) {
        if (audio.paused) {
          audio.play().catch((err) => {
            console.warn('Playback paused due to autoplay restriction:', err);
          });
        }

        // Only correct drift if significant (> 4.5 seconds) to avoid any audio stutter
        const elapsedSinceSync = Math.max(0, (Date.now() - musicState.lastSyncTimestamp) / 1000);
        const duration = currentTrack.duration || 180;
        const rawTarget = musicState.playbackPosition + elapsedSinceSync;
        const targetTime = musicState.isRepeat
          ? rawTarget % duration
          : Math.min(duration, rawTarget);

        const drift = Math.abs(audio.currentTime - targetTime);
        if (drift > 4.5 && !audio.seeking && audio.readyState >= 2) {
          try {
            audio.currentTime = targetTime;
          } catch {
            // Ignore drift seek error
          }
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
        if (
          typeof musicState.playbackPosition === 'number' &&
          Math.abs(audio.currentTime - musicState.playbackPosition) > 2
        ) {
          try {
            audio.currentTime = musicState.playbackPosition;
          } catch {
            // Ignore seek error
          }
        }
      }
    }
  }, [
    musicState.isPlaying,
    musicState.isRepeat,
    musicState.currentTrackId,
    currentTrack?.id,
    currentTrack?.url,
    musicState.lastSyncTimestamp,
    musicState.playbackPosition,
    localVolume,
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
      alert(err.message || tr('نەتوانرا گۆرانییەکە لێبدرێت.', 'Failed to play song.'));
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
      alert(err.message || tr('نەتوانرا گۆرانییەکە پێبکرێت.', 'Failed to play song.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Allows ALL members to delete any individual song from the playlist.
   */
  const handleDeleteSong = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (songId.startsWith('sample_')) {
        setDismissedSampleIds((prev) => [...prev, songId]);
      } else {
        await removeTrackFromQueue(roomId, songId);
      }
    } catch (err: any) {
      alert(err.message || tr('نەتوانرا گۆرانییەکە بسڕدرێتەوە', 'Failed to delete song.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Allows members to clear all custom songs from the room queue.
   */
  const handleClearAllSongs = async () => {
    if (isSubmitting) return;
    if (!window.confirm(tr('دڵنیایت لە سڕینەوەی هەموو گۆرانییەکان؟', 'Are you sure you want to clear all songs?'))) {
      return;
    }
    try {
      setIsSubmitting(true);
      await clearAllTracksFromQueue(roomId);
    } catch (err: any) {
      alert(err.message || tr('نەتوانرا گۆرانییەکان بسڕدرێنەوە', 'Failed to clear playlist.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Uploads ANY audio / song file format directly to Internet Archive,
   * automatically extracts the title and artist from the phone's file name,
   * saves to Firebase, and immediately plays it across the room.
   */
  const handleLocalAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detect format and clean name
    const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
    const fileExt = extMatch ? extMatch[1].toUpperCase() : 'AUDIO';

    // Parse mobile file name automatically:
    // e.g. "Hasan Zirak - Aman Doctor.mp3" -> Artist: "Hasan Zirak", Title: "Aman Doctor"
    // e.g. "Zakaria_Bochi.mp3" -> Title: "Zakaria Bochi"
    const rawBaseName = file.name.replace(/\.[^/.]+$/, '').trim().replace(/[_]+/g, ' ');
    let finalTitle = rawBaseName || tr('گۆرانی نوێ', 'New Song');
    let finalArtist = currentUser.username;

    if (rawBaseName.includes(' - ')) {
      const parts = rawBaseName.split(' - ');
      if (parts[0]?.trim() && parts[1]?.trim()) {
        finalArtist = parts[0].trim();
        finalTitle = parts.slice(1).join(' - ').trim();
      }
    } else if (rawBaseName.includes(' — ')) {
      const parts = rawBaseName.split(' — ');
      if (parts[0]?.trim() && parts[1]?.trim()) {
        finalArtist = parts[0].trim();
        finalTitle = parts.slice(1).join(' — ').trim();
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(tr(`خەریکی بارکردنی (${finalTitle})...`, `Uploading (${finalTitle})...`));

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
      // 1. Upload to Internet Archive with live progress
      const uploadResult = await uploadSongFile(file, (percent) => {
        setUploadProgress(percent);
        setUploadStatus(tr(`خەریکی بارکردنی (${finalTitle})... %${percent}`, `Uploading (${finalTitle})... ${percent}%`));
      });
      const directLink = uploadResult.directLink;

      setUploadStatus(tr('دەستپێکردنی پەخش بۆ هەموو ژوورەکە...', 'Broadcasting playback to room...'));

      // 2. Immediately save direct link and start playing in room with the auto-detected mobile song name
      await changeCurrentTrack(roomId, {
        title: finalTitle,
        artist: finalArtist,
        duration: detectedDuration,
        url: directLink,
        addedBy: currentUser.uid,
        addedByName: currentUser.username,
      });

      closeModal();
    } catch (err: any) {
      console.error('Audio upload error:', err);
      alert(err.message || tr('هەڵەیەک ڕوویدا لە کاتی بارکردنی گۆرانییەکە', 'Error occurred while uploading song.'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md pointer-events-auto"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col w-full max-w-md max-h-[85vh] sm:max-h-[88vh] rounded-3xl border border-violet-500/30 bg-gradient-to-b from-surface-900 via-surface-900 to-surface-950 p-0 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(139,92,246,0.2)] overflow-hidden text-white"
            >
              {/* Ambient Top Glow Bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500 z-10" />

              {/* Sticky Header with Prominent Close Button */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-surface-900/95 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow font-bold">
                    <Music className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate">
                      {tr('گۆرانییەکانی ژوور (موزیک)', 'Room Music & Songs')}
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                      {currentTrack
                        ? `${currentTrack.title}${musicState.playedByName ? ` (${musicState.playedByName})` : ''}`
                        : tr('هیچ گۆرانییەک هەڵنەبژێردراوە', 'No track selected')}
                    </p>
                  </div>
                </div>

                {/* Prominent High-Visibility Close Button */}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/15 transition shadow-md active:scale-90"
                  title={tr('داخستن', 'Close')}
                >
                  <X className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Scrollable Content Body (Header stays fixed at top!) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain min-h-0">
                {/* Uploading Status Overlay (If uploading file to Archive S3) */}
                {isUploading && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center space-y-2">
                    <Loader2 className="h-6 w-6 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-emerald-300">{uploadStatus}</p>
                    {uploadProgress > 0 && (
                      <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">
                      {tr('فایل ڕاستەوخۆ باردەکرێت بۆ ئەرشیف بۆ لینکی هەمیشەیی...', 'Directly uploading to Internet Archive S3...')}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-violet-300 flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    <span>{tr('بارکردنی گۆرانی لە ناو مۆبایل', 'Upload Song from Phone')}</span>
                  </p>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {tr('خۆکار', 'Auto')}
                  </span>
                </div>

                {/* Primary Action: Pick Audio File from Device */}
                <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 text-center space-y-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-black text-white shadow-lg shadow-emerald-950/40 hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    <span>
                      {isUploading
                        ? tr(`خەریکی بارکردنە... %${uploadProgress}`, `Uploading... ${uploadProgress}%`)
                        : tr('🎵 دەست بنێ لێرە و فایلی گۆرانی هەڵبژێرە', '🎵 Tap here to pick song from mobile')}
                    </span>
                  </button>

                  <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                    {tr(
                      '⚡ ناوی گۆرانییەکە خۆکارانە لە ناوی فایلەکەی ناو مۆبایلت وەردەگیرێت و پێویست ناکات هیچ بنووسیت!',
                      '⚡ The song name is automatically read from your phone file — no typing needed!'
                    )}
                  </p>
                </div>

                {/* Optional Collapsible: Manual URL / Link */}
                <div className="border-t border-white/[0.06] pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="flex w-full items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition py-1"
                  >
                    <span>{tr('یان دانانی لینکی گۆرانی بە دەست (Manual Link)', 'Or enter song URL manually')}</span>
                    {showManualForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showManualForm && (
                    <form onSubmit={handleCustomSongSubmit} className="space-y-2 pt-2">
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
                  )}
                </div>
              </div>

              {/* 4. PRESERVED SONGS LIST (Click any song to immediately play & cut off other songs!) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-300">
                    {tr('لیستی گۆرانییەکان', 'Room Playlist')} ({allSavedSongs.length}):
                  </p>
                  <div className="flex items-center gap-2">
                    {musicState.queue.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllSongs}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-lg active:scale-95 transition"
                        title={tr('سڕینەوەی هەموو گۆرانییەکانی ژوور', 'Clear all custom songs')}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{tr('سڕینەوەی هەموو', 'Clear all')}</span>
                      </button>
                    )}
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{tr('ئەندامان دەتوانن لێیبدەن و بسڕنەوە', 'Members can play & delete')}</span>
                    </span>
                  </div>
                </div>

                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {allSavedSongs.map((song) => {
                    const isCurrent = Boolean(currentTrack && currentTrack.url === song.url);
                    return (
                      <div
                        key={song.id || song.url}
                        className={`group flex w-full items-center justify-between rounded-2xl border p-2.5 text-left text-xs transition-all ${
                          isCurrent
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.08] text-white'
                        }`}
                      >
                        {/* Song Title and Artist (Tap to Play) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            handleSelectSong({
                              id: song.id,
                              title: song.title,
                              artist: song.artist,
                              duration: song.duration || 180,
                              url: song.url,
                            })
                          }
                          className="min-w-0 flex-1 pr-2 cursor-pointer select-none"
                        >
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

                        {/* Action buttons: Play + Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
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
                            className={`rounded-xl px-2.5 py-1 text-[10px] font-black transition active:scale-95 ${
                              isCurrent
                                ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                                : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500 hover:text-white'
                            }`}
                          >
                            {isCurrent ? tr('🎵 لێدەدرێت', '🎵 Playing') : tr('▶ پێکردن', '▶ Play')}
                          </button>

                          {/* Delete Button for Members & Hosts */}
                          <button
                            type="button"
                            disabled={isSubmitting || isUploading}
                            onClick={(e) => handleDeleteSong(e, song.id)}
                            title={tr('سڕینەوەی ئەم گۆرانییە لە لایەن هەمووان', 'Delete this song')}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-400 hover:bg-rose-500/30 hover:text-rose-200 active:scale-90 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
