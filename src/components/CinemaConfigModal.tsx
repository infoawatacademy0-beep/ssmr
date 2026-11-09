import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Film,
  X,
  Play,
  Check,
  AlertCircle,
  PowerOff,
  Users,
  FolderOpen,
  Layers,
  ArrowLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  RoomCinemaState,
  User,
  CinemaFolder,
  CinemaEpisode,
} from '../types';
import {
  stopCinemaMode,
  updateCinemaSeatCount,
  subscribeToCinemaFolders,
  playCinemaEpisodeInRoom,
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

export default function CinemaConfigModal({
  roomId,
  currentUser,
  cinemaState,
  isOpen,
  onClose,
  isHost = false,
}: CinemaConfigModalProps) {
  const { tr } = useLanguage();
  const isAdminOrHost = Boolean(currentUser.isAdmin || isHost);

  const [folders, setFolders] = useState<CinemaFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [seatCount, setSeatCount] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Subscribe to global Admin-managed Cinema Folders
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToCinemaFolders((list) => {
      setFolders(list);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSeatCount(cinemaState?.seatCount || 5);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, cinemaState?.seatCount]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    folders.forEach((f) => {
      if (f.category?.trim()) set.add(f.category.trim());
    });
    return Array.from(set);
  }, [folders]);

  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      const matchesCat =
        selectedCategory === 'ALL' || (f.category || 'گشتی') === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        f.title.toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [folders, selectedCategory, searchQuery]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

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

  const handlePlayEpisode = async (folder: CinemaFolder, episode: CinemaEpisode) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await playCinemaEpisodeInRoom(
        roomId,
        folder,
        episode,
        { uid: currentUser.uid, username: currentUser.username },
        Boolean(cinemaState?.isActive),
        isAdminOrHost ? seatCount : cinemaState?.seatCount || 5,
      );
      showNotification(
        tr(
          `فیلمەکە گۆڕدرا بۆ: ${folder.title} - ${episode.title}`,
          `Now playing: ${folder.title} - ${episode.title}`,
        ),
      );
      onClose();
    } catch (err: any) {
      showNotification(
        err.message || tr('نەتوانرا فیلمەکە پەخش بکرێت', 'Failed to play episode'),
        false,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeatCountChange = async (nextSeats: number) => {
    const clamped = Math.max(1, Math.min(16, nextSeats));
    setSeatCount(clamped);
    if (cinemaState?.isActive && isAdminOrHost) {
      try {
        await updateCinemaSeatCount(roomId, clamped, {
          uid: currentUser.uid,
          username: currentUser.username,
        });
      } catch (err) {
        console.warn('Failed to update cinema seat count:', err);
      }
    }
  };

  const handleStopCinema = async () => {
    if (!isAdminOrHost) return;
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
      showNotification(
        err.message || tr('نەتوانرا سینەما دابخرێت', 'Failed to stop cinema'),
        false,
      );
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
        className="relative flex flex-col w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#160b13] via-[#0f0914] to-[#07040a] p-0 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.2)] text-white"
      >
        {/* Ambient Top Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-purple-600 z-10" />

        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/[0.08] bg-[#160b13]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-amber-500/25 font-bold">
              <Film className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-display text-sm sm:text-base font-black tracking-wide text-white truncate">
                  {tr('فۆڵدەری فیلم و زنجیرەکانی سینەما', 'Cinema Folders & Series Library')}
                </h3>
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[9px] font-black text-amber-300">
                  {folders.length} {tr('فۆڵدەر', 'Folders')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {tr(
                  'رتە لە هەر فیلمێک بکە بۆ بینینی هەموو ئەڵقەکانی و سەیرکردنی لە ژووردا',
                  'Select any movie folder to view and watch all its episodes',
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
          <div className="mx-4 sm:mx-5 mt-2.5 flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-2 text-xs text-emerald-300 shrink-0">
            <Check className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-4 sm:mx-5 mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 p-2 text-xs text-rose-300 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area: Folder Grid OR Inside Folder Episodes List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-4 overscroll-contain min-h-0">
          {activeFolder ? (
            /* ── VIEW 2: INSIDE A MOVIE FOLDER -> SHOW ALL EPISODES ── */
            <div className="space-y-3.5">
              {/* Back Button & Folder Banner Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-black/50 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(null)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-black text-white transition active:scale-95 shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>{tr('گەڕانەوە', 'Back')}</span>
                  </button>

                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-400/30 bg-slate-900 shadow-md">
                    {activeFolder.posterUrl ? (
                      <img
                        src={activeFolder.posterUrl}
                        alt={activeFolder.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900 to-slate-900 text-amber-300">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm sm:text-base font-black text-white truncate">
                        {activeFolder.title}
                      </h4>
                      {activeFolder.category && (
                        <span className="rounded-lg bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                          {activeFolder.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {activeFolder.episodes.length}{' '}
                      {tr('ئەڵقە بەردەستە بۆ سەیرکردن', 'episodes available to watch')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Episodes List */}
              {activeFolder.episodes.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                  <Film className="h-9 w-9 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-300">
                    {tr('هێشتا هیچ ئەڵقەیەک لەم فۆڵدەرەدا دانەنراوە', 'No episodes in this folder yet')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeFolder.episodes.map((ep) => {
                    const isPlayingThis = Boolean(
                      cinemaState?.isActive &&
                        cinemaState.videoUrl &&
                        cinemaState.videoUrl.trim() === ep.videoUrl.trim(),
                    );

                    return (
                      <div
                        key={ep.id}
                        onClick={() => !isSubmitting && handlePlayEpisode(activeFolder, ep)}
                        className={`group flex items-center justify-between gap-3 rounded-2xl border p-2.5 cursor-pointer transition-all ${
                          isPlayingThis
                            ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/60 to-slate-900/80 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'border-white/10 bg-white/[0.04] hover:border-amber-400/50 hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Poster Thumbnail with Episode Number Badge */}
                          <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                            {ep.posterUrl || activeFolder.posterUrl ? (
                              <img
                                src={ep.posterUrl || activeFolder.posterUrl}
                                alt={ep.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-amber-500/20 text-amber-300">
                                <Film className="h-4 w-4" />
                              </div>
                            )}
                            <span className="absolute bottom-0 inset-x-0 bg-black/80 text-center font-mono text-[9px] font-black text-amber-300 py-0.5">
                              #{ep.episodeNumber}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors">
                              {ep.title}
                            </h5>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {isPlayingThis
                                ? tr('ئێستا پەخش دەکرێت لە ژوورەکەدا', 'Currently playing in room')
                                : `${activeFolder.title} · ${tr('ئەڵقەی', 'Ep')} ${ep.episodeNumber}`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayEpisode(activeFolder, ep);
                          }}
                          className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-black transition shrink-0 ${
                            isPlayingThis
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                              : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black shadow-md hover:brightness-110 active:scale-95'
                          }`}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>{isPlayingThis ? tr('چالاکە', 'Active') : tr('پەخشکردن', 'Play')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── VIEW 1: ALL FOLDERS GRID WITH POSTER IMAGES ── */
            <div className="space-y-3">
              {/* Search & Category Filter Bar */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tr('گەڕان بۆ ناوی فیلم یان زنجیرە...', 'Search movies or series...')}
                    className="w-full rounded-2xl border border-white/10 bg-black/50 pr-9 pl-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400/60"
                  />
                </div>

                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`shrink-0 rounded-xl px-3 py-1 text-[10px] font-black transition ${
                        selectedCategory === 'ALL'
                          ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-black shadow-md'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {tr('هەموو فیلمەکان', 'All')} ({folders.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`shrink-0 rounded-xl px-3 py-1 text-[10px] font-bold transition ${
                          selectedCategory === cat
                            ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-black shadow-md'
                            : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Movie Folders Poster Grid */}
              {filteredFolders.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                  <FolderOpen className="h-10 w-10 text-amber-400/40 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-200">
                    {tr('هیچ فۆڵدەرێکی فیلم نەدۆزرایەوە', 'No movie folders available yet')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {tr(
                      'تەنها ئەدمین لە پانێڵی ئەدمینەوە دەتوانێت فۆڵدەری فیلم و ئەڵقەکان زیاد بکات.',
                      'Only Admins can add movie folders and episodes from the Admin Panel.',
                    )}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredFolders.map((folder) => {
                    const hasActiveEpisode = Boolean(
                      cinemaState?.isActive &&
                        folder.episodes.some(
                          (ep) => ep.videoUrl.trim() === cinemaState.videoUrl?.trim(),
                        ),
                    );

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
                          hasActiveEpisode
                            ? 'border-emerald-400/70 bg-slate-900/90 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                            : 'border-white/10 bg-white/[0.03] hover:border-amber-400/50 hover:shadow-[0_10px_25px_rgba(0,0,0,0.7)]'
                        }`}
                      >
                        {/* Movie Poster Image */}
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                          {folder.posterUrl ? (
                            <img
                              src={folder.posterUrl}
                              alt={folder.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-rose-950 p-3 text-center">
                              <Film className="h-10 w-10 text-amber-400/60 mb-1.5" />
                              <span className="text-[11px] font-black text-white/80 line-clamp-2">
                                {folder.title}
                              </span>
                            </div>
                          )}

                          {/* Dark bottom vignette */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

                          {/* Category Badge */}
                          {folder.category && (
                            <span className="absolute top-2 right-2 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                              {folder.category}
                            </span>
                          )}

                          {/* Episode Count Badge */}
                          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-lg bg-purple-600/90 backdrop-blur-md px-2 py-0.5 text-[9px] font-black text-white shadow-md">
                            <Layers className="h-2.5 w-2.5" />
                            <span>
                              {folder.episodes.length} {tr('ئەڵقە', 'Ep')}
                            </span>
                          </span>

                          {hasActiveEpisode && (
                            <span className="absolute bottom-11 left-2 right-2 flex items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-0.5 text-[9px] font-black text-black shadow">
                              <Sparkles className="h-2.5 w-2.5" />
                              <span>{tr('ئێستا پەخش دەکرێت', 'Playing Now')}</span>
                            </span>
                          )}

                          {/* Title & Open Folder CTA overlaid at bottom of poster */}
                          <div className="absolute bottom-0 inset-x-0 p-2.5">
                            <h4 className="text-xs font-black text-white truncate drop-shadow">
                              {folder.title}
                            </h4>
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="text-[9px] font-semibold text-slate-300">
                                {tr('کردنەوەی ئەڵقەکان', 'View Episodes')}
                              </span>
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow group-hover:scale-110 transition-transform">
                                <Play className="h-3 w-3 fill-current" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              ADMIN / HOST CONTROLS (SEATS & STOP CINEMA)
              ───────────────────────────────────────────────────────────── */}
          {isAdminOrHost && (
            <div className="space-y-3 pt-3 border-t border-white/[0.08]">
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
                      onClick={() => handleSeatCountChange(seatCount - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-rose-600 transition font-black text-xs active:scale-95"
                    >
                      -
                    </button>
                    <span className="px-2.5 text-xs font-black text-amber-300">{seatCount}</span>
                    <button
                      type="button"
                      onClick={() => handleSeatCountChange(seatCount + 1)}
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
                        onClick={() => handleSeatCountChange(num)}
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
