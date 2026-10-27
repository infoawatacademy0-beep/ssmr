import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Film,
  X,
  Play,
  Check,
  AlertCircle,
  Clapperboard,
  PowerOff,
  Link2,
  Tv,
  Users,
  Trash2,
  Plus,
  BookmarkPlus,
} from 'lucide-react';
import type { RoomCinemaState, User, SavedCinemaMovie } from '../types';
import {
  startCinemaMode,
  setCinemaVideoUrl,
  stopCinemaMode,
  saveCinemaMovie,
  deleteCinemaMovie,
  subscribeToCinemaPlaylist,
  switchCinemaMovie,
} from '../services';
import { useLanguage } from '../contexts';

interface CinemaConfigModalProps {
  roomId: string;
  currentUser: User;
  cinemaState: RoomCinemaState | null;
  isOpen: boolean;
  onClose: () => void;
  isHost?: boolean;
}

interface MoviePreset {
  title: string;
  url: string;
  badge: string;
}

const CINEMA_PRESETS: MoviePreset[] = [
  {
    title: 'تایتانیک · ترەیلەری 4K (Titanic Cinematic)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    badge: '4K Cinema',
  },
  {
    title: 'گەشتی ئەستێرەکان و گەردوون (Cosmic Journey)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    badge: 'Sci-Fi VIP',
  },
  {
    title: 'خێرایی و سەمای ئۆتۆمبێلەکان (Action Drift)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    badge: 'Action HD',
  },
];

export default function CinemaConfigModal({
  roomId,
  currentUser,
  cinemaState,
  isOpen,
  onClose,
  isHost = false,
}: CinemaConfigModalProps) {
  const { tr } = useLanguage();
  const isAdmin = Boolean(currentUser.isAdmin || isHost);

  const [playlist, setPlaylist] = useState<SavedCinemaMovie[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [movieTitle, setMovieTitle] = useState('');
  const [seatCount, setSeatCount] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewTest, setPreviewTest] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Subscribe to room's saved cinema movies playlist
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToCinemaPlaylist(roomId, (movies) => {
      setPlaylist(movies);
    });
    return () => unsub();
  }, [roomId, isOpen]);

  // When modal is opened, initialize inputs with current cinema state or last saved memory
  useEffect(() => {
    if (isOpen) {
      const savedUrl =
        cinemaState?.videoUrl ||
        localStorage.getItem('ssmr_last_cinema_url') ||
        '';
      const savedTitle =
        cinemaState?.title ||
        localStorage.getItem('ssmr_last_cinema_title') ||
        '';
      const initialSeats = cinemaState?.seatCount || 5;

      setVideoUrl(savedUrl);
      setMovieTitle(savedTitle);
      setSeatCount(initialSeats);
      setErrorMsg(null);
      setSuccessMsg(null);
      setPreviewTest(Boolean(savedUrl));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (msg: string, isSuccess = true) => {
    if (isSuccess) {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(msg);
      setSuccessMsg(null);
    }
  };

  const handleApplyPreset = (preset: MoviePreset) => {
    setVideoUrl(preset.url);
    setMovieTitle(preset.title);
    setErrorMsg(null);
    setPreviewTest(true);
  };

  const handleSavePresetToRoom = async (preset: MoviePreset) => {
    setIsSubmitting(true);
    try {
      await saveCinemaMovie(roomId, {
        title: preset.title,
        url: preset.url,
        addedByUid: currentUser.uid,
        addedByName: currentUser.username,
      });
      localStorage.setItem('ssmr_last_cinema_url', preset.url);
      localStorage.setItem('ssmr_last_cinema_title', preset.title);
      showNotification(
        tr(
          `فیلمی "${preset.title}" بە سەرکەوتوویی لە ژووردا پاشەکەوت کرا`,
          `"${preset.title}" successfully saved to room playlist`,
        ),
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save preset', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedAllPresets = async () => {
    setIsSubmitting(true);
    try {
      for (const p of CINEMA_PRESETS) {
        await saveCinemaMovie(roomId, {
          title: p.title,
          url: p.url,
          addedByUid: currentUser.uid,
          addedByName: currentUser.username,
        });
      }
      showNotification(
        tr(
          'فیلمە نموونەییەکان بە سەرکەوتوویی زیادکران بۆ ژوورەکە',
          'Sample movies added to room playlist',
        ),
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to seed presets', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch to a movie from the playlist (open to all members)
  const handlePlaySavedMovie = async (movie: SavedCinemaMovie) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await switchCinemaMovie(
        roomId,
        movie,
        { uid: currentUser.uid, username: currentUser.username },
        Boolean(cinemaState?.isActive),
      );
      localStorage.setItem('ssmr_last_cinema_url', movie.url);
      localStorage.setItem('ssmr_last_cinema_title', movie.title);
      setVideoUrl(movie.url);
      setMovieTitle(movie.title);
      showNotification(
        tr(`فیلمەکە گۆڕدرا بۆ: ${movie.title}`, `Movie switched to: ${movie.title}`),
      );
      onClose();
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا فیلمەکە بگۆڕدرێت', 'Failed to switch movie'), false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete movie from room (strictly restricted to Admin)
  const handleDeleteMovie = async (movie: SavedCinemaMovie) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm(
      tr(
        `ئایا دڵنیایت لە سڕینەوەی فیلمی "${movie.title}" لەم ژوورەدا؟`,
        `Are you sure you want to delete "${movie.title}" from this room?`,
      ),
    );
    if (!confirmDelete) return;

    try {
      await deleteCinemaMovie(roomId, movie.id);
      showNotification(
        tr('فیلمەکە لە قایمەی ژوورەکە سڕدرایەوە', 'Movie deleted from room playlist'),
      );
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا بسڕدرێتەوە', 'Failed to delete movie'), false);
    }
  };

  // Save new movie to room playlist without interrupting current playback
  const handleSaveOnly = async () => {
    const cleanUrl = videoUrl.trim().replace(/^['"<]+|['">]+$/g, '');
    if (!cleanUrl) {
      showNotification(tr('تکایە بەستەری فیلمەکە دابنێ بۆ پاشەکەوتکردن.', 'Please provide a video URL.'), false);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalTitle = movieTitle.trim() || tr('فیلمی سینەمایی', 'Cinema Movie');
      await saveCinemaMovie(roomId, {
        title: finalTitle,
        url: cleanUrl,
        addedByUid: currentUser.uid,
        addedByName: currentUser.username,
      });

      // Keep in localStorage for persistence
      localStorage.setItem('ssmr_last_cinema_url', cleanUrl);
      localStorage.setItem('ssmr_last_cinema_title', finalTitle);

      showNotification(
        tr(
          `فیلمی "${finalTitle}" بە سەرکەوتوویی لە ژوورەکەدا پاشەکەوت کرا`,
          `Movie "${finalTitle}" saved to room playlist successfully`,
        ),
      );
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا فیلمەکە پاشەکەوت بکرێت', 'Failed to save movie'), false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Play in Cinema AND save to room playlist
  const handlePlayAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = videoUrl.trim().replace(/^['"<]+|['">]+$/g, '');
    if (!cleanUrl) {
      showNotification(tr('تکایە بەستەری فیلمەکە دابنێ.', 'Please provide a video URL.'), false);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalTitle = movieTitle.trim() || tr('فیلمی سینەمایی', 'Cinema Movie');

      // 1. Explicitly save to room playlist so it's guaranteed to be in the library
      await saveCinemaMovie(roomId, {
        title: finalTitle,
        url: cleanUrl,
        addedByUid: currentUser.uid,
        addedByName: currentUser.username,
      });

      // 2. Persist in localStorage
      localStorage.setItem('ssmr_last_cinema_url', cleanUrl);
      localStorage.setItem('ssmr_last_cinema_title', finalTitle);

      // 3. Start or update room cinema playback
      if (cinemaState?.isActive) {
        await setCinemaVideoUrl(
          roomId,
          cleanUrl,
          finalTitle,
          {
            uid: currentUser.uid,
            username: currentUser.username,
          },
          isAdmin ? seatCount : undefined,
        );
      } else {
        await startCinemaMode(roomId, {
          videoUrl: cleanUrl,
          title: finalTitle,
          hostUid: currentUser.uid,
          hostName: currentUser.username,
          seatCount: isAdmin ? seatCount : 5,
        });
      }
      onClose();
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا مۆدی سینەما چالاک بکرێت', 'Failed to activate cinema mode'), false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopCinema = async () => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        tr(
          'ئایا دڵنیایت لە داخستنی مۆدی سینەما و گەڕانەوە بۆ شاشەی ئاسایی؟',
          'Are you sure you want to exit cinema mode and return to normal stage?',
        ),
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await stopCinemaMode(roomId);
      onClose();
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا سینەما دابخرێت', 'Failed to stop cinema'), false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-xl max-h-[85vh] sm:max-h-[88vh] overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#160b13] via-[#0f0914] to-[#07040a] p-0 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.2)] text-white"
      >
        {/* Ambient Top Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600 z-10" />

        {/* Sticky Modal Header with Prominent Close Button */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-[#160b13]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-600 text-black shadow-lg shadow-amber-500/25 font-bold">
              <Film className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-display text-sm font-black tracking-wide text-white truncate">
                  {tr('قایمە و مۆدی فیلمی سینەما', 'Cinema & Room Movie Playlist')}
                </h3>
                {cinemaState?.seatCount && (
                  <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.2 text-[8px] font-black text-rose-300 uppercase tracking-widest">
                    VIP {cinemaState.seatCount}-SEAT
                  </span>
                )}
                {isAdmin && (
                  <span className="rounded bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                    {tr('ئەدمین', 'Admin')}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[210px] sm:max-w-xs mt-0.5">
                {tr(
                  'بەستەری فیلم لێرە دابنێ بۆ پاشەکەوتکردن · هەموو ئەندامێک دەتوانێت فیلم بگۆڕێت',
                  'Set movie link & save here · All members can switch movies',
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/15 transition shadow-md active:scale-90"
            title={tr('داخستن', 'Close')}
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Notifications Banner */}
        {successMsg && (
          <div className="mx-4 sm:mx-5 mt-2.5 flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-2 text-xs text-emerald-300 animate-in fade-in shrink-0">
            <Check className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-4 sm:mx-5 mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 p-2 text-xs text-rose-300 animate-in fade-in shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-4 overscroll-contain min-h-0">
          {/* ─────────────────────────────────────────────────────────────
              SECTION 1: ADD / SAVE / PLAY MOVIE INPUTS (ALWAYS VISIBLE)
              ───────────────────────────────────────────────────────────── */}
          <form onSubmit={handlePlayAndSave} className="space-y-3 rounded-2xl border border-amber-500/20 bg-black/40 p-3 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Link2 className="h-3.5 w-3.5 text-amber-400" />
                <span>{tr('بەستەر و ناوی فیلم بۆ ژوورەکە', 'Movie Link & Name')}</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {tr('هەمیشە دەمێنێتەوە', 'Saved Permanently')}
              </span>
            </div>

            {/* Video URL Input */}
            <div>
              <input
                type="url"
                required
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setPreviewTest(true);
                }}
                placeholder="https://teamteam.serv00.net/.../video.mp4"
                className="w-full rounded-xl border border-white/[0.12] bg-black/70 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 font-mono"
              />
            </div>

            {/* Movie Title Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={60}
                  value={movieTitle}
                  onChange={(e) => setMovieTitle(e.target.value)}
                  placeholder={tr('ناوی فیلم (وەک: تایتانیک، جەنگاوەر...)', 'Movie Title (e.g. Titanic 4K)')}
                  className="w-full rounded-xl border border-white/[0.12] bg-black/70 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                />
              </div>

              {/* Save Only Button */}
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={isSubmitting || !videoUrl.trim()}
                title={tr('پاشەکەوتکردن لە قایمەی ژوور بەبێ پەخشکردن', 'Save to room playlist without playing')}
                className="flex items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-500/20 px-3 py-2 text-xs font-black text-amber-300 hover:bg-amber-500/30 active:scale-95 transition disabled:opacity-40"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{tr('پاشەکەوتکردن', 'Save')}</span>
              </button>
            </div>

            {/* Play & Save Main Action Button */}
            <button
              type="submit"
              disabled={isSubmitting || !videoUrl.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition disabled:opacity-40"
            >
              <Tv className="h-4 w-4" />
              <span>
                {cinemaState?.isActive
                  ? tr('پەخشکردن و پاشەکەوتکردن لە سینەما', 'Play & Save to Cinema')
                  : tr('دەستپێکردن و پاشەکەوتکردن لە سینەما', 'Start Cinema & Save')}
              </span>
            </button>
          </form>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: SAVED MOVIES PLAYLIST (ROOM LIBRARY)
              ───────────────────────────────────────────────────────────── */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-black text-white">
                  {tr('قایمەی فیلمە پاشەکەوتکراوەکانی ژوور', 'Saved Room Movies Playlist')}
                </h4>
              </div>
              <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[9px] font-black text-amber-300">
                {playlist.length} {tr('فیلم', 'movies')}
              </span>
            </div>

            {playlist.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <Film className="h-8 w-8 text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-300">
                  {tr('هیچ فیلمێک پاشەکەوت نەکراوە', 'No movies saved in this room yet')}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {tr(
                    'بەستەر و ناوی فیلم لە سەرەوە بنووسە و کلیك لە "پاشەکەوتکردن" بکە.',
                    'Enter URL & Title above and click "Save".',
                  )}
                </p>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSeedAllPresets}
                  className="mt-3 rounded-xl bg-amber-500/20 border border-amber-400/40 px-3.5 py-1.5 text-xs font-black text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-40"
                >
                  + {tr('زیادکردنی فیلمە پێشوەختەکان بە ١ کلیک', 'Add Sample Presets (1-Click)')}
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {playlist.map((movie) => {
                  const isCurrentlyPlaying = Boolean(
                    cinemaState?.isActive &&
                    cinemaState.videoUrl &&
                    cinemaState.videoUrl.trim() === movie.url.trim(),
                  );

                  return (
                    <div
                      key={movie.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-2.5 transition ${
                        isCurrentlyPlaying
                          ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-900/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-amber-400/30 hover:bg-white/[0.06]'
                      }`}
                    >
                      {/* Movie Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-black ${
                            isCurrentlyPlaying
                              ? 'bg-gradient-to-tr from-emerald-400 to-teal-400 shadow-md shadow-emerald-500/30'
                              : 'bg-gradient-to-tr from-amber-400 to-rose-400'
                          }`}
                        >
                          <Film className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="font-bold text-xs text-white truncate max-w-[180px] sm:max-w-xs">
                              {movie.title}
                            </h5>
                            {isCurrentlyPlaying && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.2 text-[8px] font-black text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                {tr('ئێستا پەخش دەکرێت', 'Playing Now')}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400 truncate mt-0.5">
                            {tr('زیادکراوە لەلایەن', 'Added by')}:{' '}
                            <span className="text-slate-300 font-semibold">{movie.addedByName}</span>
                          </p>
                        </div>
                      </div>

                      {/* Actions: Play (All Members) & Delete (Admin Only) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isSubmitting || isCurrentlyPlaying}
                          onClick={() => handlePlaySavedMovie(movie)}
                          className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black transition active:scale-95 ${
                            isCurrentlyPlaying
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                              : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black shadow hover:brightness-110'
                          }`}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>{isCurrentlyPlaying ? tr('چالاکە', 'Active') : tr('پەخشکردن', 'Play')}</span>
                        </button>

                        {/* Delete button: strictly restricted to Admin */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMovie(movie)}
                            title={tr('سڕینەوە لە ژوور (تەنها ئەدمین)', 'Delete from room (Admin only)')}
                            className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-rose-600 hover:text-white transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: SAMPLE PRESETS QUICK-ADD
              ───────────────────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-white/[0.06]">
            <span className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1.5">
              {tr('فیلمە پێشوەختەکان (نموونەی خێرا)', 'Sample Presets')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CINEMA_PRESETS.map((p, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 hover:border-white/20 transition"
                >
                  <div>
                    <span className="block text-[8px] font-black uppercase text-amber-400">
                      {p.badge}
                    </span>
                    <span className="block text-[10px] font-bold text-white truncate mt-0.5">
                      {p.title}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSavePresetToRoom(p)}
                      className="flex-1 rounded-lg bg-amber-500/15 border border-amber-400/30 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-500/25 transition"
                    >
                      + {tr('پاشەکەوت', 'Save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition"
                    >
                      {tr('دانان', 'Load')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Inline Preview */}
          {previewTest && videoUrl && (
            <div className="rounded-2xl border border-white/[0.08] bg-black p-2 overflow-hidden">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 px-1">
                <span>{tr('پێشبینینی ڤیدیۆ', 'Live Preview')}</span>
                <span className="text-emerald-400 font-bold">{tr('چالاکە', 'Online')}</span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950">
                <video
                  ref={previewVideoRef}
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                >
                  <source src={videoUrl} type="video/mp4" />
                </video>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: ADMIN CONTROLS (SEATS & STOP CINEMA)
              ───────────────────────────────────────────────────────────── */}
          {isAdmin && (
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              {/* Seat Count Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Users className="h-3.5 w-3.5 text-amber-400" />
                    <span>{tr('ژمارەی کورسییەکان لە مۆدی فیلم', 'Cinema Seat Count')}</span>
                  </label>
                  <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-400/30">
                    {seatCount} {tr('کورسی', 'Seats')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-2xl border border-white/10 bg-black/60 p-1">
                    <button
                      type="button"
                      onClick={() => setSeatCount((prev) => Math.max(1, prev - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-rose-600 transition font-black text-xs active:scale-95"
                    >
                      -
                    </button>
                    <span className="px-2.5 text-xs font-black text-amber-300">{seatCount}</span>
                    <button
                      type="button"
                      onClick={() => setSeatCount((prev) => Math.min(16, prev + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-emerald-600 transition font-black text-xs active:scale-95"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 flex-1">
                    {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSeatCount(num)}
                        className={`rounded-xl px-2 py-1 text-[10px] font-black transition ${
                          seatCount === num
                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                            : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stop Cinema Mode Button */}
              {cinemaState?.isActive && (
                <button
                  type="button"
                  onClick={handleStopCinema}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition disabled:opacity-40"
                >
                  <PowerOff className="h-4 w-4" />
                  <span>{tr('داخستنی سینەما و گەڕانەوە بۆ شاشەی ئاسایی', 'Stop Cinema Mode')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
