import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, ChevronLeft, Pencil, Gift as GiftLucide, Crown, HelpCircle } from 'lucide-react';
import { AVAILABLE_GIFTS, formatCoinsK, type GiftItem, type User, type Seat } from '../types';
import GiftIcon from './GiftIcon';
import { sendGiftBatch, type GiftRecipientRef } from './GiftComboButton';

/* ─────────────────────────────────────────────────────────────
   Gift Drawer (live-app style)
   • Top row: seated users avatars + "هەموو" (send to everyone)
   • Tabs: گەرم (all gifts) / ڕێزدار (luxury gifts)
   • 4-column grid, the selected gift shows an inline orange "بنێرە" button
   • Bottom bar: quantity pills (1 · 7 · 77 · 777 · custom) + coin balance
   • After sending, the room shows a floating COMBO button (see GiftComboButton)
   ───────────────────────────────────────────────────────────── */

const QTY_OPTIONS = [1, 7, 77, 777];
type Tab = 'hot' | 'luxury';

interface GiftStoreModalProps {
  roomId: string;
  currentUser: User;
  seats: Seat[];
  initialRecipient?: { uid: string; username: string } | null;
  onClose: () => void;
  /** Called after a successful send so the room can start a combo session */
  onSent?: (gift: GiftItem, recipients: GiftRecipientRef[], qty: number) => void;
}

export default function GiftStoreModal({
  roomId,
  currentUser,
  seats,
  initialRecipient,
  onClose,
  onSent,
}: GiftStoreModalProps) {
  // Everyone currently sitting on a seat (except me)
  const eligible = seats
    .filter((s) => s.userId && s.userId !== currentUser.uid)
    .map((s) => ({
      uid: s.userId!,
      username: s.username || 'User',
      avatar: (s as any).avatar as string | undefined,
      seatNo: s.seatNo,
    }));

  if (
    initialRecipient &&
    initialRecipient.uid !== currentUser.uid &&
    !eligible.some((r) => r.uid === initialRecipient.uid)
  ) {
    eligible.unshift({ uid: initialRecipient.uid, username: initialRecipient.username, avatar: undefined, seatNo: 0 });
  }

  // Fallback: if alone in room, allow sending to self for testing animations
  if (eligible.length === 0) {
    eligible.push({
      uid: currentUser.uid,
      username: `${currentUser.username} (خۆم)`,
      avatar: currentUser.avatar || currentUser.profileImage || undefined,
      seatNo: seats.find((s) => s.userId === currentUser.uid)?.seatNo || 1,
    });
  }

  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialRecipient?.uid
      ? [initialRecipient.uid]
      : eligible[0]
        ? [eligible[0].uid]
        : [],
  );
  const [tab, setTab] = useState<Tab>('hot');
  const [selectedGift, setSelectedGift] = useState<GiftItem>(AVAILABLE_GIFTS[0]);
  const [qty, setQty] = useState<number>(1);
  const [isSending, setIsSending] = useState(false);

  const allSelected = eligible.length > 0 && selectedIds.length === eligible.length;
  const recipients = eligible.filter((r) => selectedIds.includes(r.uid));
  const totalCost = selectedGift.cost * qty * Math.max(1, recipients.length);
  const coins = currentUser.coins ?? 0;

  const gifts = tab === 'hot' ? AVAILABLE_GIFTS : AVAILABLE_GIFTS.filter((g) => g.cost >= 5000);

  const toggleRecipient = (uid: string) =>
    setSelectedIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const handleCustomQty = () => {
    const v = window.prompt('ژمارەی دیاری بنووسە (1 - 9999)', String(qty));
    const n = Math.floor(Number(v));
    if (n >= 1 && n <= 9999) setQty(n);
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      alert('تکایە کەسێک هەڵبژێرە بۆ ناردنی دیاری.');
      return;
    }
    if (coins < totalCost) {
      alert(`کۆینی پێویستت نییە! پێویستت بە ${totalCost} کۆینە.`);
      return;
    }
    setIsSending(true);
    try {
      const refs = recipients.map((r) => ({ uid: r.uid, username: r.username.replace(' (خۆم)', '') }));
      await sendGiftBatch(roomId, { uid: currentUser.uid, username: currentUser.username }, refs, selectedGift, qty);
      onSent?.(selectedGift, refs, qty);
      onClose();
    } catch (err: any) {
      alert(err.message || 'نەتوانرا دیاری بنێردرێت.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 select-none" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[72dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[#1c1c26]/[0.97] shadow-[0_-12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      >
        {/* ── Recipients row ── */}
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2" dir="ltr">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-none">
            {eligible.length === 0 && (
              <span className="text-[11px] text-slate-400">کەس لەسەر کورسی نییە</span>
            )}
            {eligible.map((r) => {
              const on = selectedIds.includes(r.uid);
              return (
                <button
                  key={r.uid}
                  type="button"
                  onClick={() => toggleRecipient(r.uid)}
                  title={r.username}
                  className={`relative h-10 w-10 shrink-0 rounded-full p-[2px] transition ${
                    on ? 'bg-gradient-to-tr from-amber-300 to-orange-500 scale-105' : 'bg-white/10 opacity-60'
                  }`}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-violet-600 to-pink-500 text-xs font-black text-white">
                    {r.avatar ? (
                      <img src={r.avatar} alt={r.username} className="h-full w-full object-cover" />
                    ) : (
                      r.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  {r.seatNo > 0 && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-1 text-[8px] font-bold text-white">
                      {r.seatNo}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(allSelected ? [] : eligible.map((r) => r.uid))}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              allSelected ? 'border-amber-400 bg-amber-400/15 text-amber-300' : 'border-white/70 text-white'
            }`}
          >
            هەموو
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center justify-between px-4 pt-1">
          <div className="flex items-center gap-5">
            {(
              [
                ['hot', 'گەرم'],
                ['luxury', 'ڕێزدار'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative pb-2 text-[15px] font-bold transition ${tab === key ? 'text-white' : 'text-slate-500'}`}
              >
                {label}
                {tab === key && (
                  <motion.span
                    layoutId="gift-tab-underline"
                    className="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-white"
                  />
                )}
              </button>
            ))}
          </div>
          <GiftLucide className="h-5 w-5 text-slate-500" />
        </div>

        {/* ── Info strip ── */}
        <div className="mx-3 mt-1 flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] text-slate-300">
          <span className="flex items-center gap-1">
            وەرگر: <Coins className="h-3 w-3 text-amber-400" /> +{Math.floor(selectedGift.cost * qty * 0.5)}
            {recipients.length > 1 && <span className="text-slate-500"> × {recipients.length}</span>}
          </span>
          <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
        </div>

        {/* ── Gifts grid ── */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {gifts.map((gift) => {
              const isSel = selectedGift.id === gift.id;
              return (
                <motion.button
                  key={gift.id}
                  type="button"
                  layout
                  onClick={() => setSelectedGift(gift)}
                  className={`relative flex flex-col items-center overflow-hidden rounded-2xl pt-2 transition-colors ${
                    isSel ? 'bg-white/[0.08] ring-1 ring-white/25' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {gift.cost >= 5000 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded bg-white/10">
                      <Crown className="h-2.5 w-2.5 text-amber-300" />
                    </span>
                  )}
                  <motion.div
                    animate={isSel ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] } : { scale: 1 }}
                    transition={isSel ? { duration: 1.2, repeat: Infinity } : {}}
                    className="flex h-14 w-14 items-center justify-center"
                  >
                    <GiftIcon iconKey={gift.iconKey} size={50} />
                  </motion.div>
                  {isSel ? (
                    <>
                      <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-bold text-amber-300">
                        <Coins className="h-3 w-3" />
                        {formatCoinsK(gift.cost)}
                      </span>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSending) handleSend();
                        }}
                        className={`mt-1.5 w-full bg-gradient-to-r from-orange-500 to-amber-500 py-1.5 text-center text-xs font-black text-white ${
                          isSending || coins < totalCost ? 'opacity-60' : 'active:brightness-90'
                        }`}
                      >
                        {isSending ? '...' : 'بنێرە'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mt-0.5 max-w-full truncate px-1 text-[11px] font-semibold text-slate-200">
                        {gift.name}
                      </span>
                      <span className="mb-2 flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                        <Coins className="h-2.5 w-2.5 text-amber-400" />
                        {formatCoinsK(gift.cost)}
                      </span>
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom bar: quantity + balance ── */}
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]" dir="ltr">
          <div className="flex items-center rounded-full bg-white/[0.08] p-1">
            <button
              type="button"
              onClick={handleCustomQty}
              title="ژمارەی تایبەت"
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                !QTY_OPTIONS.includes(qty) ? 'bg-white text-black' : 'text-slate-300'
              }`}
            >
              {!QTY_OPTIONS.includes(qty) ? <span className="text-[11px] font-black">{qty}</span> : <Pencil className="h-3.5 w-3.5" />}
            </button>
            {[...QTY_OPTIONS].reverse().map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQty(q)}
                className={`relative h-8 min-w-8 rounded-full px-2.5 text-[13px] font-black transition ${
                  qty === q ? 'text-black' : 'text-slate-300'
                }`}
              >
                {qty === q && (
                  <motion.span layoutId="gift-qty-pill" className="absolute inset-0 rounded-full bg-white" />
                )}
                <span className="relative">{q}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-2 text-sm font-black text-white"
            title="باڵانسی کۆین"
          >
            <ChevronLeft className="h-4 w-4 text-slate-400" />
            <span>{coins.toLocaleString('en-US')}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-300 to-amber-500">
              <Coins className="h-3 w-3 text-amber-900" />
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
