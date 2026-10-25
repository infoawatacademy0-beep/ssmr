import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';

/* ──────────────────────────────────────────────
   Full-screen loading spinner shown while the
   initial Firebase Auth state is resolving.
   ────────────────────────────────────────────── */

export default function LoadingScreen() {
  const isEn = typeof window !== 'undefined' && localStorage.getItem('ssmr_language') === 'en';
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-surface-900">
      {/* Animated logo */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative flex h-20 w-20 items-center justify-center"
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 animate-pulse-glow" />
        <div className="absolute inset-[2px] rounded-2xl bg-surface-900" />
        <Gamepad2 className="relative z-10 h-10 w-10 text-violet-400" strokeWidth={1.5} />
      </motion.div>

      {/* Brand */}
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-widest text-white">SSMR</h1>
        <p className="mt-1 text-xs tracking-widest text-violet-400/60 uppercase">
          {isEn ? 'Please wait…' : 'چاوەڕوانبە…'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '60%' }}
        />
      </div>
    </div>
  );
}
