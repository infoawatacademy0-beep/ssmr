import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCoinsK, type RoomGiftEvent } from '../types';
import { playGiftSoundEffect } from '../services';
import GiftIcon from './GiftIcon';
import ChromaKeyVideo from './ChromaKeyVideo';

interface GiftAnimationOverlayProps {
  giftEvent: RoomGiftEvent | null;
}

export default function GiftAnimationOverlay({ giftEvent }: GiftAnimationOverlayProps) {
  const [activeEvent, setActiveEvent] = useState<RoomGiftEvent | null>(null);
  const [queue, setQueue] = useState<RoomGiftEvent[]>([]);
  const [videoErrorMap, setVideoErrorMap] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When a new gift arrives from the Firebase listener
  useEffect(() => {
    if (!giftEvent) return;

    // Check if within last 10 seconds to avoid replay on page refresh
    if (Date.now() - giftEvent.timestamp > 10000) return;

    setQueue((prev) => {
      if (prev.some((e) => e.id === giftEvent.id)) return prev;
      return [...prev, giftEvent];
    });
  }, [giftEvent?.id]);

  // Process the queue — use a ref-based timer so cleanup doesn't kill it prematurely
  useEffect(() => {
    if (activeEvent || queue.length === 0) return;

    const next = queue[0];
    setActiveEvent(next);
    setQueue((prev) => prev.slice(1));

    const isHigh =
      next.gift.tier === 'epic' ||
      next.gift.tier === 'legendary' ||
      next.gift.tier === 'mythic' ||
      next.gift.iconKey === 'lion';
    playGiftSoundEffect(isHigh);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Show cinematic video-grade animation for 4.2 seconds, then auto-dismiss cleanly
    timerRef.current = setTimeout(() => {
      setActiveEvent(null);
      timerRef.current = null;
    }, 4200);
  }, [queue, activeEvent]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!activeEvent) return null;

  const { senderUsername, recipientUsername, gift } = activeEvent;
  const isLion = gift.iconKey === 'lion';
  const isTeapot = gift.iconKey === 'teapot' || gift.iconKey === 'rose';
  const isCar = gift.iconKey === 'sports-car';
  const isRocket = gift.iconKey === 'rocket';
  const isTiger = gift.iconKey === 'white-tiger';
  const isHighTier =
    gift.tier === 'epic' || gift.tier === 'legendary' || gift.tier === 'mythic' || isLion;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none">
      {/* ── 1. Full-Screen Cinematic Video-FX Backdrop ── */}
      <AnimatePresence>
        <motion.div
          key={`video-bg-${activeEvent.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLion
              ? 'radial-gradient(circle at 50% 60%, rgba(234,88,12,0.45) 0%, rgba(153,27,27,0.55) 45%, rgba(0,0,0,0.82) 100%)'
              : isTiger
                ? 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.38) 0%, rgba(15,23,42,0.8) 100%)'
                : isHighTier
                  ? 'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.35) 0%, rgba(0,0,0,0.75) 100%)'
                  : 'radial-gradient(circle at 50% 55%, rgba(245,158,11,0.18) 0%, transparent 70%)',
          }}
        />
      </AnimatePresence>

      {/* ── 2. TikTok Live Top-Left Floating Combo Banner ── */}
      <AnimatePresence>
        <motion.div
          key={`pill-${activeEvent.id}`}
          initial={{ x: -260, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -220, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-16 left-3 sm:left-6 z-50 flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-black/90 via-slate-900/95 to-amber-950/85 pl-2 pr-4 py-1.5 shadow-[0_0_25px_rgba(245,158,11,0.35)] backdrop-blur-xl"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-600 font-black text-sm text-white shadow-md ring-2 ring-amber-400/50">
            {(senderUsername || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 pr-1">
            <p className="truncate text-xs font-black text-white leading-tight">
              {senderUsername}
            </p>
            <p className="truncate text-[10px] text-amber-200 font-semibold">
              ناردنی <strong className="text-amber-400">{gift.name}</strong> بۆ{' '}
              <strong className="text-pink-300">{recipientUsername}</strong>
            </p>
          </div>

          <div className={`shrink-0 ${gift.animClass}`}>
            <GiftIcon iconKey={gift.iconKey} size={38} />
          </div>

          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1] }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="font-black italic text-base text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]"
          >
            x1
          </motion.span>
        </motion.div>
      </AnimatePresence>

      {/* ── 3. LION SPECIAL: Bottom Erupting Fire Wall & Rising Fire Embers ── */}
      {(isLion || gift.iconKey === 'fire') && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Bottom Blazing Fire Wall */}
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            className="absolute bottom-0 inset-x-0 h-56 bg-gradient-to-t from-red-600/70 via-orange-500/35 to-transparent blur-xl"
          />

          {/* 22 Rising Glowing Fire Embers & Sparks */}
          {Array.from({ length: 22 }).map((_, i) => {
            const leftPct = (i * 19) % 100;
            const size = 6 + (i % 4) * 4;
            return (
              <motion.div
                key={`ember-${i}`}
                initial={{
                  left: `${leftPct}%`,
                  bottom: '-20px',
                  scale: 0.4,
                  opacity: 0,
                }}
                animate={{
                  bottom: ['0%', '85%'],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (25 + (i % 3) * 15)],
                  scale: [1, 1.4, 0.2],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2.2 + (i % 3) * 0.5,
                  delay: (i % 6) * 0.2,
                  ease: 'easeOut',
                }}
                className="absolute rounded-full"
                style={{
                  width: size,
                  height: size,
                  background:
                    i % 3 === 0
                      ? 'radial-gradient(circle, #fef08a 0%, #f97316 70%, transparent 100%)'
                      : 'radial-gradient(circle, #fbbf24 0%, #dc2626 75%, transparent 100%)',
                  boxShadow: '0 0 14px #f97316',
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── 4. CENTRAL VIDEO-STYLE STAGE SCENE ── */}
      <AnimatePresence>
        <motion.div
          key={`hero-${activeEvent.id}`}
          initial={{ scale: 0.3, opacity: 0, y: 40 }}
          animate={
            isLion
              ? {
                  scale: [0.3, 1.25, 1.05, 1.12, 1],
                  opacity: 1,
                  y: 0,
                  x: [0, -8, 8, -6, 6, 0], // Roar camera shake!
                }
              : { scale: [0.3, 1.15, 1], opacity: 1, y: 0 }
          }
          exit={{ scale: 0.7, opacity: 0, y: -50 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center justify-center pointer-events-none px-4"
        >
          {/* SCENE A: TEAPOT POURING TEA INTO TEA GLASS (قۆری چای و پیاڵەی چای) */}
          {isTeapot ? (
            <div className="relative flex h-64 w-64 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-radial from-amber-500/35 via-red-600/15 to-transparent blur-2xl animate-pulse" />
              <svg viewBox="0 0 220 220" className="h-60 w-60 drop-shadow-[0_12px_28px_rgba(245,158,11,0.5)]">
                <defs>
                  <linearGradient id="stage-tp-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#92400e" />
                  </linearGradient>
                  <linearGradient id="stage-tp-tea" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="40%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#450a0a" />
                  </linearGradient>
                </defs>

                {/* Tilting Ornate Golden Teapot at Top-Left */}
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="-5 75 65; 22 75 65; 18 75 65; -5 75 65"
                    dur="3.6s"
                    repeatCount="1"
                  />
                  {/* Ornate Handle */}
                  <path
                    d="M42 42 C18 42, 18 85, 45 82"
                    fill="none"
                    stroke="url(#stage-tp-gold)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Teapot Body */}
                  <ellipse cx="75" cy="66" rx="34" ry="28" fill="url(#stage-tp-gold)" />
                  <ellipse cx="75" cy="66" rx="20" ry="13" fill="#fef08a" opacity="0.35" />
                  {/* Crown Lid */}
                  <ellipse cx="75" cy="38" rx="20" ry="7" fill="#fbbf24" />
                  <circle cx="75" cy="30" r="6" fill="#fef08a" />
                  {/* Curved Pouring Spout */}
                  <path
                    d="M102 58 Q126 54 136 74 L129 80 Q116 68 99 73 Z"
                    fill="url(#stage-tp-gold)"
                  />
                </g>

                {/* Animated Pouring Tea Stream into the Glass */}
                <path
                  d="M133 78 Q142 110 140 162"
                  fill="none"
                  stroke="url(#stage-tp-tea)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="14 6"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="40;0"
                    dur="0.35s"
                    repeatCount="indefinite"
                  />
                </path>

                {/* Rising Fragrant Steam Clouds */}
                <path
                  d="M130 118 Q122 100 134 86"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.65"
                >
                  <animate attributeName="opacity" values="0.2;0.85;0.2" dur="1.2s" repeatCount="indefinite" />
                </path>
                <path
                  d="M150 120 Q158 102 146 88"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.65"
                >
                  <animate attributeName="opacity" values="0.85;0.2;0.85" dur="1.2s" repeatCount="indefinite" />
                </path>

                {/* Traditional Red & Gold Saucer (ژێرپیاڵە) */}
                <ellipse cx="140" cy="192" rx="44" ry="10" fill="#b91c1c" stroke="#fbbf24" strokeWidth="3" />
                <ellipse cx="140" cy="191" rx="28" ry="5" fill="#fef08a" opacity="0.4" />

                {/* Sugar Cubes on Saucer (کڵۆ شەکر) */}
                <rect x="104" y="182" width="9" height="8" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="111" y="184" width="8" height="7" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

                {/* Slim-Waisted Crystal Tea Glass (پیاڵە / ئیستکان) */}
                <path
                  d="M114 126 L166 126 Q154 156 160 186 L120 186 Q126 156 114 126 Z"
                  fill="rgba(255,255,255,0.22)"
                  stroke="#fde047"
                  strokeWidth="3"
                />

                {/* Rising Hot Crimson Tea Level Inside Glass */}
                <path
                  d="M118 138 L162 138 Q153 160 158 184 L122 184 Q127 160 118 138 Z"
                  fill="url(#stage-tp-tea)"
                >
                  <animate
                    attributeName="d"
                    values="M122 172 L158 172 Q156 178 158 184 L122 184 Q124 178 122 172 Z; M118 136 L162 136 Q153 160 158 184 L122 184 Q127 160 118 136 Z; M118 136 L162 136 Q153 160 158 184 L122 184 Q127 160 118 136 Z"
                    dur="3.6s"
                    repeatCount="1"
                  />
                </path>

                {/* Golden Rim of Tea Glass */}
                <ellipse cx="140" cy="126" rx="26" ry="5" fill="none" stroke="#fde047" strokeWidth="3.5" />
              </svg>
            </div>
          ) : isLion ? (
            /* SCENE B: TIKTOK GOLDEN FIRE LION VIDEO FX */
            <div className="relative flex h-72 w-72 sm:h-96 sm:w-96 items-center justify-center">
              {gift.videoUrl && !videoErrorMap[activeEvent.id] ? (
                <div className="relative z-20 flex items-center justify-center">
                  <ChromaKeyVideo
                    src={gift.videoUrl}
                    keyColor={gift.videoKeyColor || 'green'}
                    className="h-72 w-72 sm:h-96 sm:w-96"
                    onError={() => {
                      setVideoErrorMap((prev) => ({ ...prev, [activeEvent.id]: true }));
                    }}
                  />
                </div>
              ) : (
                <>
                  {/* Expanding Roar Shockwave Rings */}
                  {[0, 1, 2].map((ringIdx) => (
                    <motion.div
                      key={`roar-ring-${ringIdx}`}
                      initial={{ scale: 0.4, opacity: 0.9 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{
                        duration: 1.6,
                        delay: 0.25 + ringIdx * 0.45,
                        ease: 'easeOut',
                      }}
                      className="absolute h-44 w-44 rounded-full border-4 border-amber-400 shadow-[0_0_30px_#f97316]"
                    />
                  ))}

                  {/* Rotating Ring of Blazing Fire Behind Lion */}
                  <motion.div
                    animate={{ rotate: 360, scale: [1, 1.12, 1] }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                    className="absolute inset-2 rounded-full border-4 border-dashed border-orange-500/70 bg-radial from-amber-400/40 via-red-600/35 to-transparent blur-md"
                  />

                  {/* Giant Animated Fire Lion */}
                  <motion.div
                    animate={{
                      scale: [1, 1.22, 1.08, 1.18, 1],
                      rotate: [0, -4, 4, -2, 0],
                    }}
                    transition={{ duration: 2.4, ease: 'easeInOut' }}
                    className="relative z-10 drop-shadow-[0_0_35px_rgba(249,115,22,0.95)]"
                  >
                    <GiftIcon iconKey="lion" size={200} />
                  </motion.div>
                </>
              )}
            </div>
          ) : isCar ? (
            /* SCENE C: NITRO SUPERCAR DRIFT WITH FLAMES */
            <div className="relative flex h-56 w-80 items-center justify-center">
              {/* Neon Asphalt Drift Track */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                className="absolute bottom-6 h-5 w-72 -skew-x-12 rounded-full bg-gradient-to-r from-rose-600/60 via-amber-400/70 to-pink-600/60 blur-md"
              />
              <motion.div
                initial={{ x: 280, scale: 0.7 }}
                animate={{ x: [280, 0, -15, 0, -280], scale: [0.7, 1.25, 1.2, 1.25, 0.9] }}
                transition={{ duration: 3.6, times: [0, 0.35, 0.55, 0.75, 1], ease: 'easeInOut' }}
                className="relative z-10 drop-shadow-[0_10px_25px_rgba(244,63,94,0.8)]"
              >
                <GiftIcon iconKey={gift.iconKey} size={175} />
              </motion.div>
            </div>
          ) : isRocket ? (
            /* SCENE D: ORBITAL ROCKET LAUNCH */
            <motion.div
              initial={{ y: 220, scale: 0.8 }}
              animate={{ y: [220, 10, -5, -360], scale: [0.8, 1.25, 1.25, 0.9] }}
              transition={{ duration: 3.5, times: [0, 0.35, 0.65, 1], ease: 'easeInOut' }}
              className="drop-shadow-[0_0_30px_rgba(139,92,246,0.9)]"
            >
              <GiftIcon iconKey={gift.iconKey} size={175} />
            </motion.div>
          ) : (
            /* SCENE E: ALL OTHER GIFTS WITH CINEMATIC RADIANCE */
            <motion.div
              animate={{
                scale: [1, 1.2, 1.05, 1.15, 1],
                rotate: [0, -4, 4, -2, 0],
              }}
              transition={{ duration: 2.6, ease: 'easeInOut' }}
              className="drop-shadow-[0_0_30px_rgba(251,191,36,0.65)]"
            >
              <GiftIcon iconKey={gift.iconKey} size={165} />
            </motion.div>
          )}

          {/* ── 5. LUXURY CINEMA GIFT BANNER ── */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-center z-20"
          >
            <div className="inline-flex flex-col items-center rounded-3xl border border-amber-400/50 bg-gradient-to-r from-black/85 via-slate-900/90 to-black/85 px-6 py-2.5 shadow-[0_0_30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <h3 className="font-display text-lg sm:text-xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow">
                {gift.name}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs font-bold">
                <span className="text-white">{senderUsername}</span>
                <span className="text-amber-400">➔</span>
                <span className="text-pink-400">{recipientUsername}</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] text-amber-300">
                  {formatCoinsK(gift.cost)} Coins
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
