import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

/* ─────────────────────────────────────────────────────────────
   AudioStreams Component
   Manages LiveKit audio status indicators, connection pill,
   and handles browser autoplay unlock banners.
   ───────────────────────────────────────────────────────────── */

interface AudioStreamsProps {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  audioAutoplayBlocked: boolean;
  onUnlockAudio: () => void;
  activeSpeakersCount: number;
}

export default function AudioStreams({
  audioAutoplayBlocked,
  onUnlockAudio,
  connectionError,
}: AudioStreamsProps) {
  const { tr } = useLanguage();
  return (
    <>
      {/* ── Browser Autoplay Blocked Banner ── */}
      <AnimatePresence>
        {audioAutoplayBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={onUnlockAudio}
            className="fixed top-16 left-4 right-4 z-[10002] mx-auto max-w-sm cursor-pointer rounded-2xl border border-amber-500/40 bg-surface-800/95 p-3.5 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black">
                <Volume2 className="h-5 w-5 animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-white">{tr('دەنگ لەلایەن وێبگەڕەوە وەستێنراوە', 'Audio muted by browser')}</p>
                <p className="text-[10px] text-amber-300">{tr('لێرە دابگرە بۆ چالاککردنی دەنگی ژوورەکە', 'Tap here to enable room audio')}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Connection Error Toast ── */}
      <AnimatePresence>
        {connectionError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 backdrop-blur-md"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="truncate">{connectionError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
