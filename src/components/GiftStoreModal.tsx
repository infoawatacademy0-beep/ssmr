import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, X, Send, Sparkles, Flame, Film } from 'lucide-react';
import { AVAILABLE_GIFTS, formatCoinsK, type GiftItem, type GiftTier, type User, type Seat } from '../types';
import { sendGift } from '../services';
import GiftIcon from './GiftIcon';

/* ─────────────────────────────────────────────────────────────
   Luxury TikTok-Live Video-FX Gift Drawer
   Features:
   • 1-Coin Kurdish Teapot pouring tea into a tea glass
   • 10,000-Coin TikTok Fire Lion with erupting flames
   • Instant 1-tap recipient bar + Combo multiplier (x1, x5, x10)
   • Closes immediately on send so the user watches the full-screen
     Video-FX stage animation right inside the room!
   ───────────────────────────────────────────────────────────── */

const TIER_LABELS: Record<GiftTier, { label: string; color: string }> = {
  common: { label: 'LIVE FX', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
  rare: { label: 'RARE FX', color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' },
  epic: { label: 'VIDEO FX', color: 'text-violet-300 bg-violet-500/20 border-violet-400/40' },
  legendary: { label: '🔥 LION FX', color: 'text-amber-300 bg-amber-500/25 border-amber-400/50' },
  mythic: { label: '👑 MYTHIC', color: 'text-rose-300 bg-rose-500/25 border-rose-400/50' },
};

interface GiftStoreModalProps {
  roomId: string;
  currentUser: User;
  seats: Seat[];
  initialRecipient?: { uid: string; username: string } | null;
  onClose: () => void;
}

export default function GiftStoreModal({
  roomId,
  currentUser,
  seats,
  initialRecipient,
  onClose,
}: GiftStoreModalProps) {
  // Available recipients: anyone currently sitting on a seat (including self if testing, or other seated users)
  const eligibleRecipients = seats
    .filter((s) => s.userId && s.userId !== currentUser.uid)
    .map((s) => ({
      uid: s.userId!,
      username: s.username || 'User',
      seatNo: s.seatNo,
    }));

  if (
    initialRecipient &&
    initialRecipient.uid !== currentUser.uid &&
    !eligibleRecipients.some((r) => r.uid === initialRecipient.uid)
  ) {
    eligibleRecipients.unshift({
      uid: initialRecipient.uid,
      username: initialRecipient.username,
      seatNo: 0,
    });
  }

  // Fallback: if the user is alone on a seat and wants to test the gift video animation, allow sending to self!
  if (eligibleRecipients.length === 0) {
    eligibleRecipients.push({
      uid: currentUser.uid,
      username: `${currentUser.username} (خۆم)`,
      seatNo: seats.find((s) => s.userId === currentUser.uid)?.seatNo || 1,
    });
  }

  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    initialRecipient?.uid || eligibleRecipients[0]?.uid || '',
  );
  const [selectedGift, setSelectedGift] = useState<GiftItem>(AVAILABLE_GIFTS[0]);
  const [comboQty, setComboQty] = useState<number>(1);
  const [isSending, setIsSending] = useState(false);

  const totalCost = selectedGift.cost * comboQty;

  const handleSend = async () => {
    const recipient = eligibleRecipients.find((r) => r.uid === selectedRecipientId);
    if (!recipient) {
      alert('تکایە کەسێک هەڵبژێرە بۆ ناردنی دیاری.');
      return;
    }
    if ((currentUser.coins ?? 0) < totalCost) {
      alert(`کۆینی پێویستت نییە! پێویستت بە ${totalCost} کۆینە.`);
      return;
    }

    setIsSending(true);
    try {
      const giftPayload: GiftItem =
        comboQty > 1
          ? {
              ...selectedGift,
              name: `${selectedGift.name} x${comboQty}`,
              cost: totalCost,
            }
          : selectedGift;

      await sendGift(
        roomId,
        { uid: currentUser.uid, username: currentUser.username },
        { uid: recipient.uid, username: recipient.username.replace(' (خۆم)', '') },
        giftPayload,
      );

      // Immediately close modal so the user enjoys the full-screen TikTok Video-FX overlay in the room!
      onClose();
    } catch (err: any) {
      alert(err.message || 'نەتوانرا دیاری بنێردرێت.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-50 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#19162b] via-[#131122] to-[#0d0b18] shadow-[0_-10px_50px_rgba(245,158,11,0.2)]"
      >
        {/* ── Top Luxury Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-black/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 shadow-lg shadow-amber-500/25">
              <Film className="h-4.5 w-4.5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                <span>دیارییە ڤیدیۆییەکان</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-300">
                  TIKTOK FX
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">
                قۆری چای کوردی، شێری ئاگرین و دیاری تایبەت بنێرە
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-xs font-black text-amber-300 shadow">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{formatCoinsK(currentUser.coins)}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* ── Recipient Bar (Send To) ── */}
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ناردن بۆ:
            </span>
            {eligibleRecipients.map((rec) => {
              const isSelected = selectedRecipientId === rec.uid;
              return (
                <button
                  key={rec.uid}
                  type="button"
                  onClick={() => setSelectedRecipientId(rec.uid)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 to-orange-500/20 text-amber-200 shadow-md shadow-amber-500/15 scale-[1.03]'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-pink-500 text-[9px] font-black text-white">
                    {(rec.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold">{rec.username}</span>
                  {rec.seatNo > 0 && (
                    <span className="text-[9px] text-amber-400/80">#{rec.seatNo}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Gifts Grid ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-4 gap-2.5">
            {AVAILABLE_GIFTS.map((gift) => {
              const isSelected = selectedGift.id === gift.id;
              const canAfford = (currentUser.coins ?? 0) >= gift.cost;
              const tierInfo = TIER_LABELS[gift.tier];

              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => setSelectedGift(gift)}
                  className={`relative flex flex-col items-center justify-between rounded-2xl border p-2 pt-3 pb-2 transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-gradient-to-b from-amber-500/25 via-amber-500/10 to-transparent ring-2 ring-amber-400/60 scale-[1.04] shadow-lg shadow-amber-500/20'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  } ${!canAfford ? 'opacity-50' : 'active:scale-95 cursor-pointer'}`}
                >
                  {/* Video-FX Tier Badge */}
                  {tierInfo.label && (
                    <span
                      className={`absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-1.5 py-0 text-[6.5px] font-black uppercase tracking-wider ${tierInfo.color}`}
                    >
                      {tierInfo.label}
                    </span>
                  )}

                  {/* Animated SVG Gift Icon */}
                  <div className="my-0.5 flex h-12 w-12 items-center justify-center">
                    <GiftIcon iconKey={gift.iconKey} size={44} />
                  </div>

                  {/* Gift Name */}
                  <span className="mt-0.5 text-[9.5px] font-bold text-white truncate max-w-full leading-tight">
                    {gift.name}
                  </span>

                  {/* Coin Price */}
                  <div className="mt-0.5 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black text-amber-300">
                    <Coins className="h-2.5 w-2.5 text-amber-400" />
                    <span>{formatCoinsK(gift.cost)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Combo & Instant Send Bar ── */}
        <div className="shrink-0 border-t border-white/[0.08] bg-[#100d1d] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Selected Gift Preview */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10">
                <GiftIcon iconKey={selectedGift.iconKey} size={36} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">
                  {selectedGift.name}
                </p>
                <p className="truncate text-[10px] text-amber-300 font-bold">
                  کۆی گشتی: {formatCoinsK(totalCost)} کۆین
                </p>
              </div>
            </div>

            {/* Combo Multipliers (x1, x5, x10) + Send Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                {[1, 5, 10].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setComboQty(qty)}
                    className={`rounded-lg px-2 py-1.5 text-[10px] font-black transition ${
                      comboQty === qty
                        ? 'bg-amber-400 text-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    x{qty}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSend}
                disabled={
                  isSending ||
                  !selectedRecipientId ||
                  (currentUser.coins ?? 0) < totalCost
                }
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-orange-500/30 transition-transform active:scale-95 disabled:opacity-45"
              >
                <Flame className="h-4 w-4 fill-black" />
                <span>{isSending ? 'دەنێردرێت...' : 'ناردن'}</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
