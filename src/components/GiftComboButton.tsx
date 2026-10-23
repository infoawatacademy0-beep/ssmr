import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GiftItem, User } from '../types';
import { sendGift } from '../services';
import GiftIcon from './GiftIcon';

/* ─────────────────────────────────────────────────────────────
   Gift Combo
   After a gift is sent, a floating round "COMBO" button appears with a
   countdown ring. Every tap re-sends the same gift (same quantity, same
   recipients) and increases the combo counter. The ring resets on each tap.
   ───────────────────────────────────────────────────────────── */

export interface GiftRecipientRef {
  uid: string;
  username: string;
}

export interface GiftComboState {
  gift: GiftItem;
  recipients: GiftRecipientRef[];
  qty: number;
  /** changes every time a new combo session starts */
  sessionId: number;
}

const COMBO_WINDOW_MS = 4000;

/**
 * Sends `gift` × `qty` to every recipient. Quantity is merged into one
 * transaction per recipient so it stays fast even for 777.
 */
export async function sendGiftBatch(
  roomId: string,
  sender: { uid: string; username: string },
  recipients: GiftRecipientRef[],
  gift: GiftItem,
  qty: number,
): Promise<void> {
  const payload: GiftItem =
    qty > 1 ? { ...gift, name: `${gift.name} x${qty}`, cost: gift.cost * qty } : gift;
  for (const r of recipients) {
    await sendGift(roomId, sender, r, payload);
  }
}

export default function GiftComboButton({
  roomId,
  currentUser,
  combo,
  onEnd,
}: {
  roomId: string;
  currentUser: User;
  combo: GiftComboState | null;
  onEnd: () => void;
}) {
  const [count, setCount] = useState(1);
  const [tick, setTick] = useState(0); // restarts countdown ring
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(0);

  const restartTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pendingRef.current === 0) onEnd();
      else restartTimer();
    }, COMBO_WINDOW_MS);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!combo) return;
    setCount(1);
    restartTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo?.sessionId]);

  if (!combo) return null;

  const costPerTap = combo.gift.cost * combo.qty * combo.recipients.length;

  const handleTap = async () => {
    if ((currentUser.coins ?? 0) < costPerTap) {
      alert('کۆینی پێویستت نییە بۆ کۆمبۆ!');
      onEnd();
      return;
    }
    setCount((c) => c + 1);
    restartTimer();
    if (navigator.vibrate) navigator.vibrate(18);
    pendingRef.current += 1;
    try {
      await sendGiftBatch(
        roomId,
        { uid: currentUser.uid, username: currentUser.username },
        combo.recipients,
        combo.gift,
        combo.qty,
      );
    } catch (err: any) {
      alert(err?.message || 'نەتوانرا دیاری بنێردرێت.');
      onEnd();
    } finally {
      pendingRef.current -= 1;
    }
  };

  const R = 36;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      <motion.div
        key={combo.sessionId}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 260 }}
        className="fixed bottom-24 right-4 z-[60] flex flex-col items-center gap-1 select-none"
      >
        {/* Combo counter */}
        <motion.div
          key={count}
          initial={{ scale: 1.8, opacity: 0, y: 6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 400 }}
          className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-600 drop-shadow-[0_2px_6px_rgba(245,158,11,0.7)]"
        >
          x{count * combo.qty}
        </motion.div>

        <button
          type="button"
          onClick={handleTap}
          className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full active:scale-90 transition-transform"
        >
          {/* countdown ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
            <motion.circle
              key={tick}
              cx="42"
              cy="42"
              r={R}
              fill="none"
              stroke="url(#combo-ring)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: C }}
              transition={{ duration: COMBO_WINDOW_MS / 1000, ease: 'linear' }}
            />
            <defs>
              <linearGradient id="combo-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>
          <span className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_0_24px_rgba(249,115,22,0.65)]">
            <GiftIcon
              iconKey={combo.gift.iconKey}
              size={30}
              videoUrl={combo.gift.videoUrl}
              imageUrl={combo.gift.imageUrl}
              videoKeyColor={combo.gift.videoKeyColor}
            />
            <span className="text-[10px] font-black tracking-wider text-white">COMBO</span>
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
