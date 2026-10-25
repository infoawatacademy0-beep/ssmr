import { useState, useRef } from 'react';
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
} from 'lucide-react';
import type { RoomCinemaState, User } from '../types';
import { startCinemaMode, setCinemaVideoUrl, stopCinemaMode } from '../services';
import { useLanguage } from '../contexts';

interface CinemaConfigModalProps {
  roomId: string;
  currentUser: User;
  cinemaState: RoomCinemaState | null;
  isOpen: boolean;
  onClose: () => void;
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
}: CinemaConfigModalProps) {
  const { tr } = useLanguage();
  const [videoUrl, setVideoUrl] = useState(cinemaState?.videoUrl || '');
  const [movieTitle, setMovieTitle] = useState(cinemaState?.title || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewTest, setPreviewTest] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: MoviePreset) => {
    setVideoUrl(preset.url);
    setMovieTitle(preset.title);
    setErrorMsg(null);
    setPreviewTest(true);
  };

  const handleStartOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = videoUrl.trim().replace(/^['"<]+|['">]+$/g, '');
    if (!cleanUrl) {
      setErrorMsg(tr('تکایە بەستەری فیلمەکە دابنێ.', 'Please provide a video URL.'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalTitle = movieTitle.trim() || tr('تایتانیک · فیلمی ڕاستەوخۆ', 'Titanic · Live Cinema');
      if (cinemaState?.isActive) {
        await setCinemaVideoUrl(roomId, cleanUrl, finalTitle, {
          uid: currentUser.uid,
          username: currentUser.username,
        });
      } else {
        await startCinemaMode(roomId, {
          videoUrl: cleanUrl,
          title: finalTitle,
          hostUid: currentUser.uid,
          hostName: currentUser.username,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('نەتوانرا مۆدی سینەما چالاک بکرێت', 'Failed to activate cinema mode'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopCinema = async () => {
    if (!window.confirm(tr('ئایا دڵنیایت لە داخستنی مۆدی سینەما و گەڕانەوە بۆ شاشەی ئاسایی؟', 'Are you sure you want to exit cinema mode and return to normal stage?'))) return;
    setIsSubmitting(true);
    try {
      await stopCinemaMode(roomId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('نەتوانرا سینەما دابخرێت', 'Failed to stop cinema'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#160b13] via-[#0f0914] to-[#07040a] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.15)] text-white"
      >
        {/* Ambient Top Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-600 text-black shadow-lg shadow-amber-500/25">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm font-black tracking-wide text-white">
                  {tr('مۆدی سینەما و سەیرکردنی فیلم', 'Cinema & Movie Mode')}
                </h3>
                <span className="rounded bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.2 text-[8px] font-black text-rose-300 uppercase tracking-widest">
                  VIP 5-SEAT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {tr(
                  'بەستەری فیلم لە فایەربەیس دابنێ بۆ پەخشکردنی هاوکات لەگەڵ ٥ هاوڕێ لەسەر مایک',
                  'Set movie URL from Firebase for synced playback with 5 friends on mic',
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

        {/* Form Body */}
        <form onSubmit={handleStartOrUpdate} className="mt-4 space-y-4">
          {/* Video URL Input */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
              <Link2 className="h-3.5 w-3.5 text-amber-400" />
              <span>{tr('بەستەری فیلم (هەر بەستەرێکی MP4 لە هەر سێرڤەرێک یان فایەربەیس)', 'Video URL (Any MP4 from any server, hosting, or Firebase)')}</span>
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
                '💡 دەتوانیت بەستەری ڕاستەوخۆی هەر فیلمێکی MP4 لە هەر سێرڤەرێک (وەک serv00, cPanel, Firebase Storage) لێرە دابنێیت.',
                '💡 You can paste any direct MP4 video link from any server (such as serv00, cPanel, Firebase Storage, etc.) here.',
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

          {/* Quick Presets */}
          <div>
            <span className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2">
              {tr('نموونەی خێرا بۆ تاقیکردنەوە (Quick Presets)', 'Quick Presets')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CINEMA_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`rounded-2xl border p-2 text-right rtl:text-right ltr:text-left transition-all ${
                    videoUrl === p.url
                      ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400/40'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="block text-[8px] font-black uppercase text-amber-400">
                    {p.badge}
                  </span>
                  <span className="block text-[11px] font-bold text-white truncate mt-0.5">
                    {p.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Inline Preview Box */}
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

          {errorMsg && (
            <div className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !videoUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition disabled:opacity-40"
            >
              <Tv className="h-4 w-4" />
              <span>
                {cinemaState?.isActive
                  ? tr('نوێکردنەوەی فیلمی سینەما', 'Update Cinema Movie')
                  : tr('پەخشکردن لە سینەما (دەستپێکردن)', 'Start Live Cinema')}
              </span>
            </button>

            {cinemaState?.isActive && (
              <button
                type="button"
                onClick={handleStopCinema}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition disabled:opacity-40"
              >
                <PowerOff className="h-4 w-4" />
                <span>{tr('داخستن', 'Stop')}</span>
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
