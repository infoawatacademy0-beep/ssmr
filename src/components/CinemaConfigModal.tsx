import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  X,
  Play,
  Check,
  AlertCircle,
  Clapperboard,
  PowerOff,
  Sparkles,
  Link2,
  Tv,
  Users,
  Trash2,
  Plus,
  ListVideo,
  Settings,
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

  const [activeTab, setActiveTab] = useState<'playlist' | 'add'>('playlist');
  const [playlist, setPlaylist] = useState<SavedCinemaMovie[]>([]);
  const [videoUrl, setVideoUrl] = useState(cinemaState?.videoUrl || '');
  const [movieTitle, setMovieTitle] = useState(cinemaState?.title || '');
  const [seatCount, setSeatCount] = useState(cinemaState?.seatCount || 5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewTest, setPreviewTest] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Subscribe to room's saved cinema movies
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToCinemaPlaylist(roomId, (movies) => {
      setPlaylist(movies);
    });
    return () => unsub();
  }, [roomId, isOpen]);

  useEffect(() => {
    if (cinemaState) {
      setVideoUrl(cinemaState.videoUrl || '');
      setMovieTitle(cinemaState.title || '');
      setSeatCount(cinemaState.seatCount || 5);
    }
  }, [cinemaState, isOpen]);

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
    setActiveTab('add');
  };

  const handleSavePresetToRoom = async (preset: MoviePreset) => {
    try {
      await saveCinemaMovie(roomId, {
        title: preset.title,
        url: preset.url,
        addedByUid: currentUser.uid,
        addedByName: currentUser.username,
      });
      showNotification(tr(`فیلمی "${preset.title}" پاشەکەوت کرا لە ژووردا`, `"${preset.title}" saved to room playlist`));
    } catch (err: any) {
      showNotification(err.message || 'Failed to save preset', false);
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
      showNotification(tr('فیلمە نموونەییەکان بە سەرکەوتوویی زیادکران', 'Sample movies added to room playlist'));
    } catch (err: any) {
      showNotification(err.message || 'Failed to seed presets', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch to a movie (open to all members)
  const handlePlayMovie = async (movie: SavedCinemaMovie) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await switchCinemaMovie(
        roomId,
        movie,
        { uid: currentUser.uid, username: currentUser.username },
        Boolean(cinemaState?.isActive),
      );
      showNotification(tr(`فیلمەکە گۆڕدرا بۆ: ${movie.title}`, `Movie switched to: ${movie.title}`));
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
        `ئایا دڵنیایت لە سڕینەوەی فیلمی "${movie.title}" لە ژوورەکەدا؟`,
        `Are you sure you want to delete "${movie.title}" from this room?`,
      ),
    );
    if (!confirmDelete) return;

    try {
      await deleteCinemaMovie(roomId, movie.id);
      showNotification(tr('فیلمەکە بە سەرکەوتوویی لە ژوورەکە سڕدرایەوە', 'Movie deleted from room playlist'));
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا بسڕدرێتەوە', 'Failed to delete movie'), false);
    }
  };

  // Save new movie to room playlist without playing
  const handleSaveOnly = async () => {
    const cleanUrl = videoUrl.trim().replace(/^['"<]+|['">]+$/g, '');
    if (!cleanUrl) {
      showNotification(tr('تکایە بەستەری فیلمەکە دابنێ.', 'Please provide a video URL.'), false);
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
      setVideoUrl('');
      setMovieTitle('');
      setPreviewTest(false);
      showNotification(tr('فیلمەکە بە سەرکەوتوویی لە ژوورەکەدا پاشەکەوت کرا', 'Movie saved to room playlist successfully'));
      setActiveTab('playlist');
    } catch (err: any) {
      showNotification(err.message || tr('نەتوانرا فیلمەکە پاشەکەوت بکرێت', 'Failed to save movie'), false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start or Update Cinema playback (also auto-saves to playlist)
  const handleStartOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = videoUrl.trim().replace(/^['"<]+|['">]+$/g, '');
    if (!cleanUrl) {
      showNotification(tr('تکایە بەستەری فیلمەکە دابنێ.', 'Please provide a video URL.'), false);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalTitle = movieTitle.trim() || tr('تایتانیک · فیلمی ڕاستەوخۆ', 'Titanic · Live Cinema');
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
    if (!window.confirm(tr('ئایا دڵنیایت لە داخستنی مۆدی سینەما و گەڕانەوە بۆ شاشەی ئاسایی؟', 'Are you sure you want to exit cinema mode and return to normal stage?'))) return;
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
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative flex flex-col w-full max-w-xl max-h-[90vh] overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#160b13] via-[#0f0914] to-[#07040a] p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.15)] text-white"
      >
        {/* Ambient Top Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-600 text-black shadow-lg shadow-amber-500/25">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-display text-sm font-black tracking-wide text-white">
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
              <p className="text-[10px] text-slate-400 mt-0.5">
                {tr(
                  'ئەندامان دەتوانن فیلم بگۆڕن · تەنها ئەدمین دەتوانێت فیلم لە ژوورەکە بسڕێتەوە',
                  'Members can switch movies · Only admin can delete movies from the room',
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400 hover:bg-white/[0.1] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-3 pb-1 border-b border-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab('playlist')}
            className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition ${
              activeTab === 'playlist'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/25'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ListVideo className="h-3.5 w-3.5" />
            <span>{tr('فیلمە پاشەکەوتکراوەکان', 'Saved Movies')}</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
              activeTab === 'playlist' ? 'bg-black text-amber-300' : 'bg-white/10 text-slate-300'
            }`}>
              {playlist.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition ${
              activeTab === 'add'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/25'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{tr('زیادکردنی بەستەر / ڕێکخستن', 'Add Link / Settings')}</span>
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-300 animate-in fade-in">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 p-2 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-4">
          {activeTab === 'playlist' && (
            <div className="space-y-3">
              {playlist.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                  <Film className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-300">
                    {tr('هیچ فیلمێک بۆ ئەم ژوورە پاشەکەوت نەکراوە', 'No movies saved in this room yet')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    {tr(
                      'دەتوانیت بەستەری فیلم دابنێیت یان فیلمە نموونەییەکان بە یەک کلیک زیاد بکەیت.',
                      'You can add a movie link or add sample movies with one click.',
                    )}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSeedAllPresets}
                      className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3.5 py-2 text-xs font-black text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-40"
                    >
                      + {tr('زیادکردنی فیلمە پێشوەختەکان بۆ ژوور', 'Add Preset Sample Movies')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('add')}
                      className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
                    >
                      + {tr('دانانی بەستەری تایبەت', 'Add Custom URL')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>{tr('کلیک لەسەر "پەخشکردن" بکە بۆ گۆڕینی فیلم', 'Click "Play" to switch to any movie')}</span>
                    <span className="font-bold text-amber-400">{playlist.length} {tr('فیلم', 'movies')}</span>
                  </div>

                  {playlist.map((movie) => {
                    const isCurrentlyPlaying = Boolean(
                      cinemaState?.isActive &&
                      cinemaState.videoUrl &&
                      cinemaState.videoUrl.trim() === movie.url.trim(),
                    );

                    return (
                      <div
                        key={movie.id}
                        className={`group relative flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                          isCurrentlyPlaying
                            ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-900/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-amber-400/30 hover:bg-white/[0.06]'
                        }`}
                      >
                        {/* Movie Info */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black ${
                            isCurrentlyPlaying
                              ? 'bg-gradient-to-tr from-emerald-400 to-teal-400 shadow-md shadow-emerald-500/30'
                              : 'bg-gradient-to-tr from-amber-400 to-rose-400 text-black'
                          }`}>
                            <Film className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs text-white truncate max-w-[200px] sm:max-w-xs">
                                {movie.title}
                              </h4>
                              {isCurrentlyPlaying && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.2 text-[8px] font-black text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  {tr('ئێستا پەخش دەکرێت', 'Playing Now')}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {tr('زیادکراوە لەلایەن', 'Added by')}: <span className="text-slate-300 font-semibold">{movie.addedByName}</span>
                            </p>
                          </div>
                        </div>

                        {/* Actions: Switch (Anyone) & Delete (Admin Only) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isSubmitting || isCurrentlyPlaying}
                            onClick={() => handlePlayMovie(movie)}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                              isCurrentlyPlaying
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                                : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black shadow-md shadow-amber-400/20 hover:brightness-110'
                            }`}
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>{isCurrentlyPlaying ? tr('چالاکە', 'Active') : tr('پەخشکردن', 'Play')}</span>
                          </button>

                          {/* Strictly Admin Only Deletion */}
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

              {/* Quick Preset Seeding Section */}
              <div className="pt-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    {tr('فیلمە نموونەییەکان (پاشەکەوتکردن بە یەک کلیک)', 'Sample Presets (1-Click Save)')}
                  </span>
                </div>
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
                        <span className="block text-[11px] font-bold text-white truncate mt-0.5">
                          {p.title}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSavePresetToRoom(p)}
                          className="flex-1 rounded-lg bg-amber-500/15 border border-amber-400/30 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-500/25 transition"
                        >
                          + {tr('پاشەکەوتکردن', 'Save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(p)}
                          className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition"
                        >
                          {tr('تاقیکردنەوە', 'Test')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <form onSubmit={handleStartOrUpdate} className="space-y-4">
              {/* Video URL Input */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
                  <Link2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>{tr('بەستەری فیلم (هەر بەستەرێکی ڕاستەوخۆی MP4)', 'Video URL (Direct MP4 URL)')}</span>
                </label>
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setPreviewTest(true);
                  }}
                  placeholder="https://teamteam.serv00.net/.../video.mp4"
                  className="w-full rounded-2xl border border-white/[0.09] bg-black/60 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {tr(
                    '💡 دەتوانیت بەستەری ڕاستەوخۆی هەر فیلمێکی MP4 لە هەر هۆست یان سێرڤەرێک لێرە دابنێیت.',
                    '💡 You can paste any direct MP4 video link from any server or hosting here.',
                  )}
                </p>
              </div>

              {/* Movie Title Input */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
                  <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
                  <span>{tr('ناوی فیلم یان ڤیدیۆ', 'Movie Title')}</span>
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={movieTitle}
                  onChange={(e) => setMovieTitle(e.target.value)}
                  placeholder={tr('تایتانیک · فیلمی کوردی (یان هەر ناوێک)', 'e.g. Titanic 4K Special Edition')}
                  className="w-full rounded-2xl border border-white/[0.09] bg-black/60 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                />
              </div>

              {/* Custom Seat Count Selector (Admin Only) */}
              {isAdmin && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Users className="h-3.5 w-3.5 text-amber-400" />
                      <span>{tr('ژمارەی کورسییەکان لە مۆدی فیلم (تەنها ئەدمین)', 'Cinema Seat Count (Admin Only)')}</span>
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
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-rose-600 transition font-black text-sm active:scale-95"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-black text-amber-300">{seatCount}</span>
                      <button
                        type="button"
                        onClick={() => setSeatCount((prev) => Math.min(16, prev + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-emerald-600 transition font-black text-sm active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSeatCount(num)}
                          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition ${
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
              )}

              {/* Inline Preview Box */}
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

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !videoUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition disabled:opacity-40"
                  >
                    <Tv className="h-4 w-4" />
                    <span>
                      {cinemaState?.isActive
                        ? tr('پەخشکردن و گۆڕینی فیلم', 'Play & Switch Cinema Movie')
                        : tr('پەخشکردن لە سینەما (دەستپێکردن)', 'Start Live Cinema')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveOnly}
                    disabled={isSubmitting || !videoUrl.trim()}
                    className="flex items-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-3 py-3 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{tr('پاشەکەوتکردن', 'Save Only')}</span>
                  </button>
                </div>

                {isAdmin && cinemaState?.isActive && (
                  <button
                    type="button"
                    onClick={handleStopCinema}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/15 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition disabled:opacity-40"
                  >
                    <PowerOff className="h-4 w-4" />
                    <span>{tr('داخستنی سینەما و گەڕانەوە بۆ ژووری ئاسایی (تەنها ئەدمین)', 'Stop Cinema Mode (Admin Only)')}</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
