import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Check, Trash2, User, Sparkles, Shield } from 'lucide-react';
import type { Seat, User as UserType } from '../types';
import { useLanguage } from '../contexts';
import { setSeatVipConfig } from '../services';

interface VipSeatModalProps {
  isOpen: boolean;
  roomId: string;
  seat: Seat | null;
  currentUser: UserType;
  audienceMembers?: { uid: string; username: string }[];
  onClose: () => void;
}

export default function VipSeatModal({
  isOpen,
  roomId,
  seat,
  currentUser,
  audienceMembers = [],
  onClose,
}: VipSeatModalProps) {
  const { tr } = useLanguage();
  const [isVip, setIsVip] = useState(false);
  const [assignedName, setAssignedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (seat) {
      setIsVip(Boolean(seat.isVip || seat.vipAssignedName));
      setAssignedName(seat.vipAssignedName || (seat.username && seat.isVip ? seat.username : ''));
    }
  }, [seat, isOpen]);

  if (!isOpen || !seat) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await setSeatVipConfig(
        roomId,
        seat.seatNo,
        isVip,
        assignedName.trim() || null,
        currentUser.username,
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('شکستی هێنا لە ڕێکخستنی کورسی VIP', 'Failed to save VIP seat'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVip = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await setSeatVipConfig(roomId, seat.seatNo, false, null, currentUser.username);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('نەتوانرا کورسی VIP لاببرێت', 'Failed to remove VIP seat'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-5 shadow-2xl shadow-amber-500/20"
        >
          {/* Top Gold Ambient Glow */}
          <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-lg shadow-amber-500/30">
                <Crown className="h-5 w-5 fill-black stroke-black" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{tr('ڕێکخستنی کورسی VIP', 'VIP Seat Setup')}</span>
                  <span className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-[11px] font-black text-amber-300 border border-amber-400/30">
                    #{seat.seatNo}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {tr('تەرخانکردنی کورسی تایبەت و نووسینی ناو لەسەری', 'Reserve VIP seat with custom person name')}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Form Controls */}
          <div className="mt-4 space-y-4">
            {/* VIP Status Toggle */}
            <div
              onClick={() => setIsVip(!isVip)}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition ${
                isVip
                  ? 'border-amber-400/50 bg-amber-500/10 shadow-sm shadow-amber-500/10'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                    isVip ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">
                    {tr('چالاککردنی وەک کورسی VIP', 'Enable VIP Seat Status')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {tr('کورسییەکە تاجی زێڕین و شێوازی VIP وەردەگرێت', 'Seat receives gold crown & VIP glow')}
                  </div>
                </div>
              </div>

              <div
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                  isVip ? 'bg-amber-400 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <motion.div
                  layout
                  className={`h-5 w-5 rounded-full ${isVip ? 'bg-black' : 'bg-slate-400'}`}
                />
              </div>
            </div>

            {/* Assigned Name Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-300 flex items-center justify-between">
                <span>{tr('ناوی کەسی دیاریکراو لەسەر کورسییەکە:', 'Assigned Person Name:')}</span>
                <span className="text-[10px] text-amber-400 font-bold">
                  {assignedName ? `👑 ${assignedName}` : tr('(بەتاڵە بۆ هەمووان)', '(Open to all if empty)')}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={assignedName}
                  onChange={(e) => {
                    setAssignedName(e.target.value);
                    if (e.target.value.trim() && !isVip) {
                      setIsVip(true);
                    }
                  }}
                  placeholder={tr('ناوی کەسەکە بنووسە (بۆ نموونە: شازادە، VIP Guest)...', 'Enter name (e.g. Prince, VIP Guest)...')}
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/90 px-3.5 py-2.5 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-400 transition"
                />
                {assignedName && (
                  <button
                    type="button"
                    onClick={() => setAssignedName('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {tr(
                  'ئەم ناوە ڕاستەوخۆ بە تاجی زێڕین لەسەر کورسییەکە پیشان دەدرێت.',
                  'This name will be directly displayed on the seat with gold crown.',
                )}
              </p>
            </div>

            {/* Quick Pick from Audience or Current Speakers */}
            {audienceMembers.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400">
                  {tr('هەڵبژاردنی خێرا لە ئامادەبووان:', 'Quick select from room members:')}
                </span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {audienceMembers.slice(0, 10).map((member) => (
                    <button
                      key={member.uid}
                      type="button"
                      onClick={() => {
                        setAssignedName(member.username);
                        setIsVip(true);
                      }}
                      className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold transition active:scale-95 ${
                        assignedName.toLowerCase() === member.username.toLowerCase()
                          ? 'bg-amber-400 text-black font-black'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <User className="h-2.5 w-2.5" />
                      <span>{member.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center gap-2 pt-2 border-t border-white/10">
            {seat.isVip && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRemoveVip}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{tr('لابردن', 'Remove')}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>{tr('پاشەکەوتکردنی کورسی VIP', 'Save VIP Seat')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
