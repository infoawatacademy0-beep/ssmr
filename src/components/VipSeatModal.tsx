import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  X,
  Check,
  Trash2,
  User as UserIcon,
  Sparkles,
  Diamond,
  Shield,
  Search,
  CheckCircle2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Seat, User as UserType, SeatTier } from '../types';
import { useLanguage } from '../contexts';
import { setSeatVipConfig, fetchAllUsers } from '../services';

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
  const [selectedTier, setSelectedTier] = useState<SeatTier>('standard');
  const [assignedName, setAssignedName] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // App-wide user directory
  const [appUsers, setAppUsers] = useState<UserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTab, setUserTab] = useState<'all' | 'room'>('all');

  useEffect(() => {
    if (seat) {
      const tier: SeatTier = seat.isPlatinum || seat.seatTier === 'platinum'
        ? 'platinum'
        : seat.isIron || seat.seatTier === 'iron'
        ? 'iron'
        : seat.isVip || seat.seatTier === 'vip' || seat.vipAssignedName
        ? 'vip'
        : 'standard';

      setSelectedTier(tier);
      setAssignedName(seat.vipAssignedName || (seat.username && (seat.isVip || seat.isPlatinum || seat.isIron) ? seat.username : ''));
      setAssignedUserId(seat.vipAssignedUserId || null);
    }
  }, [seat, isOpen]);

  // Load all app users when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingUsers(true);
    fetchAllUsers()
      .then((users) => {
        if (isMounted) {
          setAppUsers(users || []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch app users for seat modal:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filtered users list based on active tab and search query
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sourceList =
      userTab === 'room' && audienceMembers.length > 0
        ? appUsers.filter((u) => audienceMembers.some((a) => a.uid === u.uid))
        : appUsers;

    if (!q) return sourceList.slice(0, 30);
    return sourceList
      .filter((u) => u.username?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q))
      .slice(0, 35);
  }, [appUsers, userTab, audienceMembers, searchQuery]);

  if (!isOpen || !seat) return null;

  const isPlatinum = selectedTier === 'platinum';
  const isIron = selectedTier === 'iron';
  const isVip = selectedTier === 'vip';
  const isSpecial = isPlatinum || isIron || isVip;

  const handleSelectUser = (userItem: { uid: string; username: string }) => {
    setAssignedName(userItem.username);
    setAssignedUserId(userItem.uid);
    if (selectedTier === 'standard') {
      setSelectedTier('platinum'); // default to platinum when user picked
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await setSeatVipConfig(
        roomId,
        seat.seatNo,
        selectedTier,
        assignedName.trim() || null,
        currentUser.username,
        assignedUserId || null,
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('شکستی هێنا لە ڕێکخستنی کورسی', 'Failed to save seat config'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSpecial = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await setSeatVipConfig(roomId, seat.seatNo, 'standard', null, currentUser.username, null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tr('نەتوانرا تایبەتمەندی کورسی لاببرێت', 'Failed to remove seat tier'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative w-full max-w-md overflow-hidden rounded-3xl border p-5 shadow-2xl transition-colors duration-300 ${
            isPlatinum
              ? 'border-cyan-400/60 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-cyan-500/25'
              : isIron
              ? 'border-slate-400/60 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-slate-400/20'
              : isVip
              ? 'border-amber-500/50 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-amber-500/20'
              : 'border-white/10 bg-slate-950 shadow-black'
          }`}
        >
          {/* Ambient Glow */}
          {isPlatinum ? (
            <>
              <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/25 blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/25 blur-3xl pointer-events-none" />
            </>
          ) : isIron ? (
            <>
              <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-slate-400/20 blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-zinc-500/20 blur-3xl pointer-events-none" />
            </>
          ) : isVip ? (
            <>
              <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
            </>
          ) : null}

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg transition-colors ${
                  isPlatinum
                    ? 'bg-gradient-to-tr from-cyan-400 via-sky-300 to-white text-black shadow-cyan-400/30'
                    : isIron
                    ? 'bg-gradient-to-tr from-slate-300 via-zinc-300 to-slate-100 text-black shadow-slate-400/30'
                    : isVip
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isPlatinum ? (
                  <Diamond className="h-6 w-6 fill-black stroke-black" />
                ) : isIron ? (
                  <Shield className="h-6 w-6 fill-black stroke-black" />
                ) : (
                  <Crown className="h-6 w-6 fill-black stroke-black" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{isPlatinum ? tr('ڕێکخستنی کورسی پلاتینیۆم', 'Platinum Seat Setup') : isIron ? tr('ڕێکخستنی کورسی ئاسن', 'Iron Seat Setup') : isVip ? tr('ڕێکخستنی کورسی VIP', 'VIP Seat Setup') : tr('ڕێکخستنی کورسی سەکۆ', 'Stage Seat Setup')}</span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-black border ${
                      isPlatinum
                        ? 'bg-cyan-400/20 text-cyan-300 border-cyan-400/40'
                        : isIron
                        ? 'bg-slate-400/20 text-slate-300 border-slate-400/40'
                        : isVip
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                        : 'bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    #{seat.seatNo}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isPlatinum
                    ? tr('تەنها ئەو کەسەی دەستنیشانی دەکەیت دەتوانێت دابنیشێت', 'Only the assigned person can take this seat')
                    : isIron
                    ? tr('تەنها ئەو کەسەی دەستنیشانی دەکەیت دەتوانێت دابنیشێت', 'Reserved exclusively for assigned Iron user')
                    : tr('دیاریکردنی جۆری کورسی و نووسینی ناو لەسەری', 'Configure seat tier & write person name')}
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

          {/* Seat Tier Selection Tabs (Standard, Iron, Gold VIP, Platinum) */}
          <div className="mt-3.5 space-y-1.5">
            <span className="text-[11px] font-black text-slate-300">
              {tr('جۆری کورسی هەڵبژێرە:', 'Select Seat Tier:')}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {/* Standard */}
              <button
                type="button"
                onClick={() => setSelectedTier('standard')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 ${
                  selectedTier === 'standard'
                    ? 'border-white/30 bg-white/10 text-white shadow-md'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 mb-1">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-black">{tr('ئاسایی', 'Normal')}</span>
                <span className="text-[8px] text-slate-500">{tr('کراوە', 'Open')}</span>
              </button>

              {/* Iron */}
              <button
                type="button"
                onClick={() => setSelectedTier('iron')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 ${
                  selectedTier === 'iron'
                    ? 'border-slate-300 bg-slate-400/20 text-slate-200 shadow-md shadow-slate-400/25'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-slate-400 to-zinc-300 text-black mb-1">
                  <Shield className="h-3.5 w-3.5 fill-black stroke-black" />
                </div>
                <span className="text-[11px] font-black text-slate-200">{tr('ئاسن', 'Iron')}</span>
                <span className="text-[8px] text-slate-400">{tr('پلەی ئاسن', 'Shield')}</span>
              </button>

              {/* VIP Gold */}
              <button
                type="button"
                onClick={() => setSelectedTier('vip')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 ${
                  selectedTier === 'vip'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-md shadow-amber-500/20'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400 text-black mb-1">
                  <Crown className="h-3.5 w-3.5 fill-black" />
                </div>
                <span className="text-[11px] font-black text-amber-300">{tr('VIP', 'VIP')}</span>
                <span className="text-[8px] text-amber-400/80">{tr('تاج', 'Crown')}</span>
              </button>

              {/* Platinum */}
              <button
                type="button"
                onClick={() => setSelectedTier('platinum')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 ${
                  selectedTier === 'platinum'
                    ? 'border-cyan-300 bg-cyan-500/25 text-cyan-200 shadow-lg shadow-cyan-500/30'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-400 to-sky-200 text-black mb-1">
                  <Diamond className="h-3.5 w-3.5 fill-black stroke-black" />
                </div>
                <span className="text-[11px] font-black text-cyan-300">{tr('پلاتین', 'Plat')}</span>
                <span className="text-[8px] text-cyan-400/90">{tr('ئەڵماس', 'Diamond')}</span>
              </button>
            </div>
          </div>

          {/* Iron Restriction Banner */}
          {isIron && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 rounded-2xl border border-slate-400/40 bg-gradient-to-r from-slate-500/15 via-zinc-500/10 to-slate-500/15 p-2.5 flex items-start gap-2 text-slate-200"
            >
              <Shield className="h-4 w-4 shrink-0 text-slate-300 fill-slate-400/40 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-black text-slate-100">{tr('تایبەتمەندی پلەی ئاسن:', 'Iron Tier Exclusive:')} </span>
                {assignedName
                  ? tr(
                      `ئەم کورسییە بە پلەی ئاسن (Iron) بۆ (${assignedName}) دانراوە و تەنها ئەو دەتوانێت دابنیشێت لەسەری!`,
                      `Reserved for (${assignedName}) as Iron tier. Only they can take this seat!`,
                    )
                  : tr(
                      'تکایە لە خوارەوە کەسێک هەڵبژێرە تاوەکو کورسییەکە بە پلەی ئاسن بۆ ئەو قفڵ ببێت.',
                      'Please select a user below so the Iron seat is reserved for them.',
                    )}
              </div>
            </motion.div>
          )}

          {/* Platinum / VIP Restriction Banner */}
          {isPlatinum && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-cyan-500/15 p-2.5 flex items-start gap-2 text-cyan-200"
            >
              <Diamond className="h-4 w-4 shrink-0 text-cyan-300 fill-cyan-400/50 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-black text-cyan-100">{tr('تایبەتمەندی پلاتینیۆم:', 'Platinum Exclusive:')} </span>
                {assignedName
                  ? tr(
                      `ئەم کورسییە بە شێوەی پلاتینیۆم تەنها بۆ (${assignedName}) دادەنرێت و هیچ کەسێکی تر ناتوانێت دابنیشێت لەسەری!`,
                      `Reserved exclusively for (${assignedName}). No other member can sit on it!`,
                    )
                  : tr(
                      'تکایە لە خوارەوە کەسێک هەڵبژێرە تاوەکو کورسییەکە بە تەنیا بۆ ئەو کەسە قفڵ ببێت.',
                      'Please select a user below so the seat is strictly reserved for them.',
                    )}
              </div>
            </motion.div>
          )}

          {/* Search App Users & Directory */}
          {isSpecial && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                  <span>{tr('لیستی بەکارهێنەرانی ناو ئەپەکە (App Users):', 'App Users Directory:')}</span>
                </label>
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUserTab('all')}
                    className={`rounded-lg px-2 py-0.5 transition ${
                      userTab === 'all' ? 'bg-amber-400 text-black font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tr('هەموو ئەپ', 'All Users')} ({appUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserTab('room')}
                    className={`rounded-lg px-2 py-0.5 transition ${
                      userTab === 'room' ? 'bg-amber-400 text-black font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tr('ناو ژوور', 'In Room')} ({audienceMembers.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tr('گەڕان بەدوای ناوی بەکارهێنەر لە ناو ئەپەکەدا...', 'Search user by username in app...')}
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/90 pl-9 pr-3.5 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable User List */}
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-2xl border border-white/10 bg-black/40 p-1.5 scrollbar-thin">
                {isLoadingUsers ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {tr('خەریکی بارکردنی لیستی بەکارهێنەرانە...', 'Loading users directory...')}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    {tr('هیچ بەکارهێنەرێک نەدۆزرایەوە', 'No users found')}
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected =
                      (assignedUserId && assignedUserId === u.uid) ||
                      (assignedName && assignedName.toLowerCase() === u.username.toLowerCase());
                    return (
                      <div
                        key={u.uid}
                        onClick={() => handleSelectUser(u)}
                        className={`flex cursor-pointer items-center justify-between rounded-xl p-2 transition ${
                          isSelected
                            ? isPlatinum
                              ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-200'
                              : 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                            : 'hover:bg-white/5 border border-transparent text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden bg-slate-800 text-[10px] font-black text-white">
                            {u.avatar || u.profileImage ? (
                              <img src={u.avatar || u.profileImage} alt={u.username} className="h-full w-full object-cover" />
                            ) : (
                              u.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white truncate block">
                              {u.username}
                            </span>
                            <span className="text-[9px] text-slate-400 block truncate">
                              ID: {u.uid.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                              isPlatinum ? 'bg-cyan-400 text-black' : 'bg-amber-400 text-black'
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{tr('هەڵبژێردراو', 'Selected')}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/15"
                          >
                            {tr('دەستنیشانکردن', 'Select')}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected User Badge / Manual Input */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-300">
                  <span>{tr('ناوی کەسی دیاریکراو (Selected Person):', 'Assigned User:')}</span>
                  <span
                    className={`font-black text-xs ${
                      isPlatinum ? 'text-cyan-300' : 'text-amber-400'
                    }`}
                  >
                    {assignedName ? `${isPlatinum ? '💎' : '👑'} ${assignedName}` : tr('(هێشتا کەس دیاری نەکراوە)', '(None selected)')}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={assignedName}
                    onChange={(e) => {
                      setAssignedName(e.target.value);
                      setAssignedUserId(null); // custom manual override
                    }}
                    placeholder={tr('یان ناوی بەکارهێنەر لێرە بنووسە...', 'Or type username here...')}
                    className={`w-full rounded-2xl border bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none transition ${
                      isPlatinum ? 'border-cyan-500/40 focus:border-cyan-400' : 'border-amber-500/40 focus:border-amber-400'
                    }`}
                  />
                  {assignedName && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignedName('');
                        setAssignedUserId(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-5 flex items-center gap-2 pt-2 border-t border-white/10">
            {(seat.isVip || seat.isPlatinum) && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleRemoveSpecial}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{tr('لابردن', 'Remove')}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving || (isSpecial && !assignedName.trim())}
              onClick={handleSave}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-black text-black shadow-lg transition hover:brightness-105 active:scale-95 disabled:opacity-50 ${
                isPlatinum
                  ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-white shadow-cyan-400/30'
                  : isVip
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 shadow-amber-500/20'
                  : 'bg-white text-black shadow-white/20'
              }`}
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>
                {isPlatinum
                  ? tr('پاشەکەوتکردنی کورسی پلاتینیۆم', 'Save Platinum Seat')
                  : isVip
                  ? tr('پاشەکەوتکردنی کورسی VIP', 'Save VIP Seat')
                  : tr('پاشەکەوتکردن وەک ئاسایی', 'Save as Standard')}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
