import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomGiftEvent } from '../types';
import GiftIcon from './GiftIcon';

interface GiftAnimationOverlayProps {
  giftEvent: RoomGiftEvent | null;
}

export default function GiftAnimationOverlay({ giftEvent }: GiftAnimationOverlayProps) {
  const [activeEvent, setActiveEvent] = useState<RoomGiftEvent | null>(null);
  const [queue, setQueue] = useState<RoomGiftEvent[]>([]);

  // When a new gift arrives from the Firebase listener
  useEffect(() => {
    if (!giftEvent) return;

    // Check if within last 10 seconds to avoid replay on page refresh
    if (Date.now() - giftEvent.timestamp > 10000) return;

    setQueue((prev) => {
      // Avoid duplicate queueing of identical event id
      if (prev.some((e) => e.id === giftEvent.id)) return prev;
      return [...prev, giftEvent];
    });
  }, [giftEvent?.id]);

  // Process the queue
  useEffect(() => {
    if (activeEvent || queue.length === 0) return;

    const next = queue[0];
    setActiveEvent(next);
    setQueue((prev) => prev.slice(1));

    // Show animation for 3.8 seconds
    const timer = setTimeout(() => {
      setActiveEvent(null);
    }, 3800);

    return () => clearTimeout(timer);
  }, [queue, activeEvent]);

  if (!activeEvent) return null;

  const { senderUsername, recipientUsername, gift } = activeEvent;
  const isHighTier =
    gift.tier === 'epic' || gift.tier === 'legendary' || gift.tier === 'mythic';

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none">
      {/* ── 1. TikTok-Style Floating Notification Pill (Top Left) ── */}
      <AnimatePresence>
        <motion.div
          key={`pill-${activeEvent.id}`}
          initial={{ x: -250, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -200, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-16 left-3 sm:left-6 z-50 flex items-center gap-2.5 rounded-full border border-white/20 bg-gradient-to-r from-black/80 via-slate-900/90 to-purple-950/80 pl-2 pr-4 py-1.5 shadow-2xl backdrop-blur-xl"
        >
          {/* Sender Avatar Circle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-rose-600 font-bold text-sm text-white shadow-md">
            {(senderUsername || 'U').charAt(0).toUpperCase()}
          </div>

          {/* Text Details */}
          <div className="min-w-0 pr-1">
            <p className="truncate text-xs font-bold text-white leading-tight">
              {senderUsername}
            </p>
            <p className="truncate text-[10px] text-pink-300 font-medium">
              Sent <strong className="text-amber-300">{gift.name}</strong> to{' '}
              <strong className="text-white">{recipientUsername}</strong>
            </p>
          </div>

          {/* Animated Mini Icon */}
          <div className={`shrink-0 ${gift.animClass}`}>
            <GiftIcon iconKey={gift.iconKey} size={36} />
          </div>

          {/* Multiplier Badge x1 */}
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.4, 1] }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="font-black italic text-sm text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          >
            x1
          </motion.span>
        </motion.div>
      </AnimatePresence>

      {/* ── 2. Full-Screen Visual Effects for Epic/Mythic/High-Tier Gifts ── */}
      <AnimatePresence>
        {isHighTier && (
          <motion.div
            key={`backdrop-${activeEvent.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-radial from-violet-900/25 via-transparent to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ── 3. Central Stage Hero Animation ── */}
      <AnimatePresence>
        <motion.div
          key={`hero-${activeEvent.id}`}
          initial={{ scale: 0.2, opacity: 0, y: 50 }}
          animate={{ scale: [0.2, 1.25, 1], opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: -60 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Radial Light Glow Behind Hero */}
          <div
            className="absolute -inset-10 rounded-full opacity-40 blur-3xl animate-pulse"
            style={{
              background:
                gift.tier === 'mythic'
                  ? 'radial-gradient(circle, #f43f5e 0%, #7c3aed 70%, transparent 100%)'
                  : gift.tier === 'legendary'
                    ? 'radial-gradient(circle, #fbbf24 0%, #f59e0b 60%, transparent 100%)'
                    : 'radial-gradient(circle, #06b6d4 0%, #8b5cf6 60%, transparent 100%)',
            }}
          />

          {/* Specific Hero Animation Variations */}
          {gift.iconKey === 'sports-car' ? (
            /* Supercar drifting across screen */
            <motion.div
              initial={{ x: 260, scale: 0.8 }}
              animate={{ x: [260, 0, -260] }}
              transition={{ duration: 3.2, times: [0, 0.45, 1], ease: 'easeInOut' }}
              className={gift.animClass}
            >
              <GiftIcon iconKey={gift.iconKey} size={150} />
            </motion.div>
          ) : gift.iconKey === 'rocket' ? (
            /* Rocket launching to the sky */
            <motion.div
              initial={{ y: 200, scale: 0.8 }}
              animate={{ y: [200, 0, -350] }}
              transition={{ duration: 3.2, times: [0, 0.4, 1], ease: 'easeIn' }}
              className={gift.animClass}
            >
              <GiftIcon iconKey={gift.iconKey} size={150} />
            </motion.div>
          ) : (
            /* All other gifts: Center hero with energetic pulsation & scale */
            <motion.div
              animate={{
                scale: [1, 1.15, 1, 1.1, 1],
                rotate: [0, -3, 3, -2, 0],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className={gift.animClass}
            >
              <GiftIcon iconKey={gift.iconKey} size={135} />
            </motion.div>
          )}

          {/* Gift Title & Hype Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-3 text-center"
          >
            <h3 className="font-display text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {gift.name}
            </h3>
            <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/60 px-3 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
              <span>{gift.cost.toLocaleString()} Coins</span>
              <span className="text-white/40">&bull;</span>
              <span className="text-pink-300">{recipientUsername}</span>
            </div>
          </motion.div>

          {/* Floating Particle Stars */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            const dist = 80 + (i % 3) * 25;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  scale: [0, 1.2, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeOut',
                }}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  background:
                    i % 2 === 0 ? '#ffd600' : '#ff4081',
                  boxShadow: '0 0 8px currentColor',
                }}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
