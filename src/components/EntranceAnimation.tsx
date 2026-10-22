import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, UserCheck, Volume2 } from 'lucide-react';
import type { RoomEntranceEvent } from '../types';
import { speakUserEntrance } from '../services';

interface EntranceAnimationProps {
  entranceEvent: RoomEntranceEvent | null;
}

/* ─────────────────────────────────────────────────────────────
   Luxury User Entrance Visual Banner & Voice Name Reader System
   Displays floating tier-based banners and reads out the member's
   name when they enter the room.
   ───────────────────────────────────────────────────────────── */

export default function EntranceAnimation({ entranceEvent }: EntranceAnimationProps) {
  const [currentEntrance, setCurrentEntrance] = useState<RoomEntranceEvent | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entranceEvent) return;

    // Discard entrance events older than 8 seconds to prevent stale popups on room load
    if (Date.now() - entranceEvent.timestamp > 8000) return;

    setCurrentEntrance(entranceEvent);

    // Read the entering member's name out loud once per entrance event
    if (lastSpokenIdRef.current !== entranceEvent.id) {
      lastSpokenIdRef.current = entranceEvent.id;
      speakUserEntrance(entranceEvent.username, entranceEvent.level);
    }

    const timer = setTimeout(() => {
      setCurrentEntrance(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [entranceEvent?.id, entranceEvent?.timestamp]);

  if (!currentEntrance) return null;

  const isVip = Boolean(currentEntrance.isVerified || currentEntrance.level >= 10);

  return (
    <div className="pointer-events-none absolute bottom-16 left-3 z-30 max-w-[280px] sm:max-w-[320px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentEntrance.id}
          initial={{ x: -100, opacity: 0, scale: 0.9 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: -50, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`
            relative overflow-hidden rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl border
            ${
              isVip
                ? 'border-amber-400/60 bg-gradient-to-r from-amber-500/30 via-surface-800 to-amber-500/20 shadow-amber-500/25'
                : 'border-violet-500/30 bg-surface-800/90 shadow-violet-500/15'
            }
          `}
        >
          {/* VIP Golden Shimmer Sweep */}
          {isVip && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent"
            />
          )}

          <div className="relative z-10 flex items-center gap-2.5">
            {/* User Avatar with VIP Blazing Fire Stroke */}
            <div
              className={`
                relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs text-white shadow
                ${
                  isVip
                    ? 'vip-fire-avatar bg-gradient-to-tr from-amber-400 via-orange-500 to-red-600 text-black'
                    : 'overflow-hidden bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-violet-500/30'
                }
              `}
            >
              <div className="h-full w-full overflow-hidden rounded-xl flex items-center justify-center">
                {currentEntrance.avatar ? (
                  <img
                    src={currentEntrance.avatar}
                    alt={currentEntrance.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{currentEntrance.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isVip && (
                <div className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 shadow">
                  <Crown className="h-2 w-2 text-black fill-black" strokeWidth={3} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold text-white">
                  {currentEntrance.username}
                </span>

                {isVip ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-amber-400/25 px-1.5 py-0.2 text-[8px] font-black text-amber-300 border border-amber-400/40">
                    <Crown className="h-2 w-2" />
                    <span>Lv.{currentEntrance.level}</span>
                  </span>
                ) : (
                  <span className="rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[8px] font-semibold text-violet-300">
                    Lv.{currentEntrance.level}
                  </span>
                )}
              </div>

              <p className="flex items-center gap-1 text-[10px] text-slate-300">
                <Volume2 className="h-2.5 w-2.5 text-emerald-400 animate-pulse shrink-0" />
                {isVip ? (
                  <>
                    <Sparkles className="h-2.5 w-2.5 text-amber-300 animate-spin" />
                    <span className="font-semibold text-amber-300">بەخێربێیت VIP هاتە ژوورەوە</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-2.5 w-2.5 text-violet-400" />
                    <span>هاتە ناو ژوورەوە</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
