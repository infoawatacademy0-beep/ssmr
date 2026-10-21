import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X, Check, Send, Sparkles } from 'lucide-react';
import { AVAILABLE_GIFTS, type GiftItem, type GiftTier, type User, type Seat } from '../types';
import { sendGift } from '../services';
import GiftIcon from './GiftIcon';

/* ─────────────────────────────────────────────────────────────
   TikTok-Style Gift Store Modal
   Features:
   • SVG animated gift icons (pure CSS + inline SVG animations)
   • Tier-based glow borders (common → mythic)
   • Bottom-sheet UX on mobile with smooth spring transition
   • Full-screen celebration animation on send
   ───────────────────────────────────────────────────────────── */

const TIER_LABELS: Record<GiftTier, { label: string; color: string }> = {
  common: { label: '', color: '' },
  rare: { label: 'RARE', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  epic: { label: 'EPIC', color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  legendary: { label: 'LEGENDARY', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  mythic: { label: 'MYTHIC', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' },
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
  // Available recipients: anyone currently sitting on a seat who is NOT the current user
  const eligibleRecipients = seats
    .filter((s) => s.userId && s.userId !== currentUser.uid)
    .map((s) => ({ uid: s.userId!, username: s.username || 'User' }));

  // Add initialRecipient if not already in list
  if (
    initialRecipient &&
    initialRecipient.uid !== currentUser.uid &&
    !eligibleRecipients.some((r) => r.uid === initialRecipient.uid)
  ) {
    eligibleRecipients.unshift(initialRecipient);
  }

  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    initialRecipient?.uid || eligibleRecipients[0]?.uid || '',
  );
  const [selectedGift, setSelectedGift] = useState<GiftItem>(AVAILABLE_GIFTS[0]);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationGift, setCelebrationGift] = useState<GiftItem | null>(null);

  const handleSend = async () => {
    const recipient = eligibleRecipients.find((r) => r.uid === selectedRecipientId);
    if (!recipient) {
      alert('Please select a recipient to receive the gift.');
      return;
    }
    if ((currentUser.coins ?? 0) < selectedGift.cost) {
      alert(`Insufficient coins! You need ${selectedGift.cost} coins.`);
      return;
    }

    setIsSending(true);
    try {
      await sendGift(
        roomId,
        { uid: currentUser.uid, username: currentUser.username },
        { uid: recipient.uid, username: recipient.username },
        selectedGift,
      );

      // Trigger celebration animation
      setCelebrationGift(selectedGift);
      setShowCelebration(true);

      setSentSuccess(`Sent ${selectedGift.name} to ${recipient.username}!`);
      setTimeout(() => {
        setSentSuccess(null);
        setShowCelebration(false);
        setCelebrationGift(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to send gift.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedRecipientName =
    eligibleRecipients.find((r) => r.uid === selectedRecipientId)?.username || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      {/* Full-Screen Celebration Animation */}
      <AnimatePresence>
        {showCelebration && celebrationGift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            {/* Particle burst */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const distance = 100 + Math.random() * 80;
              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    background:
                      i % 3 === 0
                        ? '#ffd600'
                        : i % 3 === 1
                          ? '#ff4081'
                          : '#7c4dff',
                  }}
                />
              );
            })}

            {/* Flying gift icon */}
            <div className="gift-fly-animation">
              <div className={celebrationGift.animClass}>
                <GiftIcon iconKey={celebrationGift.iconKey} size={96} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal panel - bottom sheet on mobile */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="relative z-50 w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/[0.08] bg-[#1a1a2e] shadow-2xl flex flex-col"
      >
        {/* ── Header with balance ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 shadow-lg">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Gift Store</h2>
              <p className="text-[10px] text-slate-400">Send animated gifts to the stage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{(currentUser.coins ?? 0).toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-500 hover:bg-white/[0.08] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Success State ── */}
        {sentSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-4"
            >
              <Check className="h-8 w-8" />
            </motion.div>
            <p className="text-sm font-bold text-white">{sentSuccess}</p>
            <p className="mt-1 text-xs text-emerald-400">+25 XP awarded!</p>
          </div>
        ) : (
          <>
            {/* ── Recipient Picker ── */}
            <div className="px-5 pt-4 pb-2">
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                Send to
              </label>

              {eligibleRecipients.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                  No other users are currently in the room.
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {eligibleRecipients.map((rec) => {
                    const isSelected = selectedRecipientId === rec.uid;
                    return (
                      <button
                        key={rec.uid}
                        type="button"
                        onClick={() => setSelectedRecipientId(rec.uid)}
                        className={`
                          flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 transition-all
                          ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400/15 text-amber-300 shadow-md shadow-amber-500/10'
                              : 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                          }
                        `}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                          {(rec.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold">{rec.username}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Gifts Grid ── */}
            <div className="flex-1 overflow-y-auto px-5 pb-3">
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                Choose Gift
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_GIFTS.map((gift) => {
                  const isSelected = selectedGift.id === gift.id;
                  const canAfford = (currentUser.coins ?? 0) >= gift.cost;
                  const tierInfo = TIER_LABELS[gift.tier];

                  return (
                    <button
                      key={gift.id}
                      type="button"
                      onClick={() => setSelectedGift(gift)}
                      disabled={!canAfford}
                      className={`
                        relative flex flex-col items-center justify-center rounded-2xl border p-2 pt-2.5 pb-1.5 transition-all
                        gift-tier-${gift.tier}
                        ${
                          isSelected
                            ? 'ring-2 ring-amber-400 bg-amber-400/10 scale-[1.04]'
                            : 'bg-white/[0.02] hover:bg-white/[0.05]'
                        }
                        ${!canAfford ? 'opacity-35 grayscale cursor-not-allowed' : 'active:scale-95 cursor-pointer'}
                      `}
                    >
                      {/* Tier badge */}
                      {tierInfo.label && (
                        <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full border px-1.5 py-0 text-[7px] font-black uppercase tracking-wider ${tierInfo.color}`}>
                          {tierInfo.label}
                        </span>
                      )}

                      {/* Animated Gift Icon */}
                      <div className={isSelected ? gift.animClass : ''}>
                        <GiftIcon iconKey={gift.iconKey} size={38} />
                      </div>

                      {/* Gift name */}
                      <span className="mt-1 text-[9px] font-semibold text-white/80 truncate max-w-full leading-tight">
                        {gift.name}
                      </span>

                      {/* Cost */}
                      <div className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                        <Coins className="h-2.5 w-2.5 text-amber-400" />
                        <span>{gift.cost.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Preview & Send Bar ── */}
            <div className="shrink-0 border-t border-white/[0.06] px-5 py-3.5 bg-[#151525]">
              <div className="flex items-center gap-3">
                {/* Selected gift preview */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`shrink-0 ${selectedGift.animClass}`}>
                    <GiftIcon iconKey={selectedGift.iconKey} size={44} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{selectedGift.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold">
                      <Coins className="h-2.5 w-2.5 text-amber-400" />
                      <span>{selectedGift.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={
                    isSending ||
                    !selectedRecipientId ||
                    (currentUser.coins ?? 0) < selectedGift.cost
                  }
                  className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-rose-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSending ? 'Sending…' : 'Send'}</span>
                </button>
              </div>
              {selectedRecipientName && (
                <p className="mt-1.5 text-[10px] text-slate-500 text-center">
                  Sending to <strong className="text-violet-400">{selectedRecipientName}</strong>
                </p>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
