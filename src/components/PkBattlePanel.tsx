import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Trophy,
  Clock,
  X,
  RotateCcw,
  Crown,
  Flame,
  Gift,
  Settings2,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type {
  PkBattleState,
  PkTeam,
  PkMode,
  PkContributor,
  StartPkBattleOptions,
  User,
  Seat,
} from '../types';
import { useLanguage } from '../contexts';
import { startPkBattle, endPkBattle, resetPkBattle } from '../services';

interface PkBattlePanelProps {
  roomId: string;
  currentUser: User;
  isHost: boolean;
  seats: Seat[];
  pkBattle: PkBattleState | null;
  onOpenGiftStore?: (targetUserId?: string, targetUsername?: string) => void;
}

const PENALTY_PRESETS = [
  { id: 'sing', ku: '🎤 گۆرانی گوتن', en: '🎤 Sing a song' },
  { id: 'pushups', ku: '💪 ١٠ جاران شناو', en: '💪 10 Push-ups' },
  { id: 'silent', ku: '🤫 بێدەنگبوون بۆ ١ خولەک', en: '🤫 Silent for 1 min' },
  { id: 'avatar', ku: '🎭 گۆڕینی وێنەی پرۆفایل بۆ ١٠ خولەک', en: '🎭 Change profile pic for 10 min' },
  { id: 'water', ku: '🚰 خواردنەوەی پەرداخێک ئاو', en: '🚰 Drink a glass of water' },
  { id: 'none', ku: '🚫 بەبێ سزا', en: '🚫 No Penalty' },
];

export default function PkBattlePanel({
  roomId,
  currentUser,
  isHost,
  seats,
  pkBattle,
  onOpenGiftStore,
}: PkBattlePanelProps) {
  const { tr } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [showContributors, setShowContributors] = useState<boolean>(false);

  // Setup form states
  const [selectedMode, setSelectedMode] = useState<PkMode>('4v4');
  const [selectedDuration, setSelectedDuration] = useState<number>(300); // 5 min default
  const [selectedPenalty, setSelectedPenalty] = useState<string>('sing');
  const [customPenaltyText, setCustomPenaltyText] = useState<string>('');
  const [customRedSeats, setCustomRedSeats] = useState<number[]>([1, 2]);
  const [customBlueSeats, setCustomBlueSeats] = useState<number[]>([3, 4]);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Timer countdown
  useEffect(() => {
    if (!pkBattle || pkBattle.status !== 'active') {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const remainingMs = Math.max(0, pkBattle.endTime - Date.now());
      const remainingSec = Math.floor(remainingMs / 1000);
      setTimeLeft(remainingSec);

      if (remainingSec <= 0 && pkBattle.status === 'active') {
        endPkBattle(roomId).catch(console.error);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pkBattle?.status, pkBattle?.endTime, roomId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const redScore = pkBattle?.redScore || 0;
  const blueScore = pkBattle?.blueScore || 0;
  const totalScore = redScore + blueScore;
  const redPercentage =
    totalScore === 0 ? 50 : Math.min(90, Math.max(10, Math.round((redScore / totalScore) * 100)));
  const bluePercentage = 100 - redPercentage;

  // Seats assigned to Red and Blue
  const redSeatsList = useMemo(() => {
    return pkBattle?.redSeats || (selectedMode === '1v1' ? [1] : selectedMode === '2v2' ? [1, 2] : [1, 2, 5, 6]);
  }, [pkBattle?.redSeats, selectedMode]);

  const blueSeatsList = useMemo(() => {
    return pkBattle?.blueSeats || (selectedMode === '1v1' ? [2] : selectedMode === '2v2' ? [3, 4] : [3, 4, 7, 8]);
  }, [pkBattle?.blueSeats, selectedMode]);

  // Identify current user's team
  const mySeat = seats.find((s) => s.userId === currentUser.uid);
  const myTeam: PkTeam | null = mySeat
    ? redSeatsList.includes(mySeat.seatNo)
      ? 'red'
      : blueSeatsList.includes(mySeat.seatNo)
      ? 'blue'
      : null
    : null;

  // Top contributors sorted by points
  const topRedContributors: PkContributor[] = useMemo(() => {
    if (!pkBattle?.redContributors) return [];
    return Object.values(pkBattle.redContributors).sort((a, b) => b.points - a.points);
  }, [pkBattle?.redContributors]);

  const topBlueContributors: PkContributor[] = useMemo(() => {
    if (!pkBattle?.blueContributors) return [];
    return Object.values(pkBattle.blueContributors).sort((a, b) => b.points - a.points);
  }, [pkBattle?.blueContributors]);

  // Overall battle MVP
  const battleMvp = useMemo<PkContributor | null>(() => {
    const all = [...topRedContributors, ...topBlueContributors];
    if (all.length === 0) return null;
    all.sort((a, b) => b.points - a.points);
    return all[0].points > 0 ? all[0] : null;
  }, [topRedContributors, topBlueContributors]);

  // Calculate default seats when mode changes in setup
  const handleModeChange = (mode: PkMode) => {
    setSelectedMode(mode);
    if (mode === '1v1') {
      // Find first 2 occupied seats or default to 1 and 2
      const occupied = seats.filter((s) => s.userId).map((s) => s.seatNo);
      setCustomRedSeats(occupied[0] ? [occupied[0]] : [1]);
      setCustomBlueSeats(occupied[1] ? [occupied[1]] : [2]);
    } else if (mode === '2v2') {
      setCustomRedSeats([1, 2]);
      setCustomBlueSeats([3, 4]);
    } else if (mode === '3v3') {
      setCustomRedSeats([1, 2, 5]);
      setCustomBlueSeats([3, 4, 7]);
    } else if (mode === '4v4') {
      setCustomRedSeats([1, 2, 5, 6]);
      setCustomBlueSeats([3, 4, 7, 8]);
    }
  };

  const handleStartCustomBattle = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const activePreset = PENALTY_PRESETS.find(p => p.id === selectedPenalty);
      const penaltyFinal =
        selectedPenalty === 'none'
          ? ''
          : selectedPenalty === 'custom'
          ? customPenaltyText
          : activePreset
          ? `${activePreset.ku} / ${activePreset.en}`
          : selectedPenalty;

      const options: StartPkBattleOptions = {
        mode: selectedMode,
        durationSeconds: selectedDuration,
        redSeats: customRedSeats,
        blueSeats: customBlueSeats,
        penalty: penaltyFinal,
      };

      await startPkBattle(roomId, currentUser.username, options);
      setShowSetupModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to start PK battle');
    } finally {
      setIsStarting(false);
    }
  };

  const handleQuickStart5Min = async () => {
    try {
      await startPkBattle(roomId, currentUser.username, {
        mode: '4v4',
        durationSeconds: 300,
        redSeats: [1, 2, 5, 6],
        blueSeats: [3, 4, 7, 8],
        penalty: '🎤 گۆرانی گوتن / 🎤 Sing a song',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to start 4v4 battle');
    }
  };

  const handleRematch = async () => {
    if (!pkBattle) return;
    try {
      await startPkBattle(roomId, currentUser.username, {
        mode: pkBattle.mode || '4v4',
        durationSeconds: pkBattle.durationSeconds || 300,
        redSeats: pkBattle.redSeats,
        blueSeats: pkBattle.blueSeats,
        penalty: pkBattle.penalty || undefined,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to restart battle');
    }
  };

  const handleEnd = async () => {
    try {
      await endPkBattle(roomId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    try {
      await resetPkBattle(roomId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSupportTeam = (team: PkTeam) => {
    const targetSeatNos = team === 'red' ? redSeatsList : blueSeatsList;
    const targetSeat = seats.find((s) => targetSeatNos.includes(s.seatNo) && s.userId);
    if (targetSeat && targetSeat.userId && onOpenGiftStore) {
      onOpenGiftStore(targetSeat.userId, targetSeat.username || undefined);
    } else if (onOpenGiftStore) {
      onOpenGiftStore();
    }
  };

  // Toggle seat for custom mode setup
  const toggleCustomSeat = (seatNo: number, team: PkTeam) => {
    if (team === 'red') {
      if (customRedSeats.includes(seatNo)) {
        setCustomRedSeats(customRedSeats.filter((n) => n !== seatNo));
      } else {
        setCustomBlueSeats(customBlueSeats.filter((n) => n !== seatNo));
        setCustomRedSeats([...customRedSeats, seatNo]);
      }
    } else {
      if (customBlueSeats.includes(seatNo)) {
        setCustomBlueSeats(customBlueSeats.filter((n) => n !== seatNo));
      } else {
        setCustomRedSeats(customRedSeats.filter((n) => n !== seatNo));
        setCustomBlueSeats([...customBlueSeats, seatNo]);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: IDLE STATE (Host Launcher)
  // ─────────────────────────────────────────────────────────────
  if (!pkBattle || pkBattle.status === 'idle') {
    if (!isHost) return null;

    return (
      <div className="mb-2 px-1">
        <div className="flex items-center gap-2">
          {/* Main Quick Start Button */}
          <button
            onClick={handleQuickStart5Min}
            className="group flex flex-1 items-center justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-600/25 via-surface-800 to-blue-600/25 px-3 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/10 transition-all hover:border-rose-400/50 hover:from-rose-600/35 active:scale-98"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/40">
                <Swords className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="block font-black text-white text-xs tracking-wide">
                  {tr('جەنگی خێرای ٤ بە ٤ (PK)', 'Quick 4v4 PK Battle')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {tr('٥ خولەک • ڕکابەری بەخشین', '5 Min • Real-Time Gifting')}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-300 group-hover:underline">
              {tr('دەستپێکردن ←', 'Start →')}
            </span>
          </button>

          {/* Setup / Custom Battle Button */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="flex h-11 items-center gap-1.5 rounded-2xl border border-white/10 bg-surface-800/80 px-3 text-xs font-bold text-slate-200 shadow hover:border-amber-400/50 hover:bg-white/10 hover:text-amber-300 transition active:scale-95"
            title="PK Battle Settings & Modes"
          >
            <Settings2 className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">{tr('ڕێکخستن و مۆدەکان', 'Custom Mode')}</span>
          </button>
        </div>

        {/* ── PK SETUP MODAL ── */}
        <AnimatePresence>
          {showSetupModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900 via-surface-900 to-slate-950 p-4 shadow-2xl"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow">
                      <Swords className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        {tr('ڕێکخستنی جەنگی PK', 'PK Battle Setup')}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {tr('مۆد، کات و سزای دۆڕاو دیاری بکە', 'Configure mode, time & punishment')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSetupModal(false)}
                    className="rounded-full bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3.5 py-3 text-xs">
                  {/* Step 1: Mode Selection */}
                  <div>
                    <label className="mb-1.5 block font-bold text-slate-300">
                      {tr('١. شێوازی جەنگ (Mode)', '1. Battle Mode')}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['1v1', '2v2', '3v3', '4v4'] as PkMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleModeChange(mode)}
                          className={`rounded-xl border py-2 font-black transition ${
                            selectedMode === mode
                              ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-md shadow-rose-500/20'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs uppercase">{mode}</div>
                          <div className="text-[9px] font-normal text-slate-400">
                            {mode === '1v1'
                              ? tr('١ بە ١', '1 vs 1')
                              : mode === '2v2'
                              ? tr('٢ بە ٢', '2 vs 2')
                              : mode === '3v3'
                              ? tr('٣ بە ٣', '3 vs 3')
                              : tr('٤ بە ٤', '4 vs 4')}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Custom Mode Toggle Button */}
                    <button
                      onClick={() => setSelectedMode(selectedMode === 'custom' ? '4v4' : 'custom')}
                      className={`mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[11px] font-bold transition ${
                        selectedMode === 'custom'
                          ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>{tr('دەستنیشانکردنی کورسییەکان بە دڵی خۆت (Custom Seats)', 'Custom Seat Assignment')}</span>
                    </button>
                  </div>

                  {/* Seat Assignment Preview for Custom or Selected Mode */}
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-rose-400">
                        {tr('سوور: کورسی', 'Red: Seat')} {customRedSeats.join('، ') || 'هیچ'}
                      </span>
                      <span className="font-bold text-sky-400">
                        {tr('شین: کورسی', 'Blue: Seat')} {customBlueSeats.join('، ') || 'هیچ'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {seats.map((seat) => {
                        const isRed = customRedSeats.includes(seat.seatNo);
                        const isBlue = customBlueSeats.includes(seat.seatNo);
                        return (
                          <div
                            key={`assign-${seat.seatNo}`}
                            className={`flex flex-col items-center rounded-xl border p-1 text-[10px] transition ${
                              isRed
                                ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                                : isBlue
                                ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                                : 'border-white/5 bg-white/[0.02] text-slate-500'
                            }`}
                          >
                            <span className="font-bold">#{seat.seatNo}</span>
                            <span className="truncate max-w-[60px] text-[8px] text-slate-300">
                              {seat.username || tr('بەتاڵ', 'Empty')}
                            </span>
                            {selectedMode === 'custom' && (
                              <div className="mt-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleCustomSeat(seat.seatNo, 'red')}
                                  className={`h-4 w-4 rounded text-[8px] font-black ${
                                    isRed ? 'bg-rose-600 text-white' : 'bg-white/10 text-rose-400'
                                  }`}
                                >
                                  R
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleCustomSeat(seat.seatNo, 'blue')}
                                  className={`h-4 w-4 rounded text-[8px] font-black ${
                                    isBlue ? 'bg-sky-600 text-white' : 'bg-white/10 text-sky-400'
                                  }`}
                                >
                                  B
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Duration Selection */}
                  <div>
                    <label className="mb-1.5 block font-bold text-slate-300">
                      {tr('٢. ماوەی جەنگ (Duration)', '2. Battle Duration')}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { sec: 60, label: '١ خولەک', en: '1 Min' },
                        { sec: 180, label: '٣ خولەک', en: '3 Min' },
                        { sec: 300, label: '٥ خولەک', en: '5 Min' },
                        { sec: 600, label: '١٠ خولەک', en: '10 Min' },
                      ].map((dur) => (
                        <button
                          key={dur.sec}
                          onClick={() => setSelectedDuration(dur.sec)}
                          className={`rounded-xl border py-2 text-center font-black transition ${
                            selectedDuration === dur.sec
                              ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-md shadow-amber-400/20'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs">{tr(dur.label, dur.en)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Penalty Selection */}
                  <div>
                    <label className="mb-1.5 block font-bold text-slate-300">
                      {tr('٣. سزای دۆڕاو (Punishment)', '3. Loser Punishment')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PENALTY_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPenalty(p.id)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                            selectedPenalty === p.id
                              ? 'border-rose-400 bg-rose-500/20 text-rose-300'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {tr(p.ku, p.en)}
                        </button>
                      ))}
                      <button
                        onClick={() => setSelectedPenalty('custom')}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                          selectedPenalty === 'custom'
                            ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        ✍️ {tr('سزای تایبەت', 'Custom text')}
                      </button>
                    </div>

                    {selectedPenalty === 'custom' && (
                      <input
                        type="text"
                        value={customPenaltyText}
                        onChange={(e) => setCustomPenaltyText(e.target.value)}
                        placeholder={tr('سزا دیاری بکە (نموونە: خواردنی لیمۆ)', 'Enter punishment...')}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Submit Launch Button */}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <button
                    disabled={isStarting || customRedSeats.length === 0 || customBlueSeats.length === 0}
                    onClick={handleStartCustomBattle}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-600/30 transition hover:brightness-110 active:scale-98 disabled:opacity-50"
                  >
                    <Swords className="h-4 w-4" />
                    <span>{tr('دەستپێکردنی جەنگی PK ⚔️', 'Start PK Battle ⚔️')}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: ACTIVE OR FINISHED PK BATTLE VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="mb-3 px-1">
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900/95 via-surface-900/90 to-slate-950 p-2.5 shadow-2xl backdrop-blur-xl">
        {/* Top Header: Team Names, Mode Tag, Timer & Host Controls */}
        <div className="flex items-center justify-between gap-1 pb-1.5">
          {/* Red Team Label & Score */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-display text-xs font-black text-rose-400 uppercase tracking-wider truncate">
                  {tr('سوور', 'RED')}
                </span>
                {myTeam === 'red' && (
                  <span className="rounded bg-rose-500/20 px-1 text-[8px] font-bold text-rose-300">
                    {tr('تۆ', 'YOU')}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs font-black text-white">
                {redScore.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Center Timer, Mode & VS Emblem */}
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-xs font-black">
              {pkBattle.status === 'active' ? (
                <>
                  <Clock
                    className="h-3 w-3 text-amber-400 animate-spin"
                    style={{ animationDuration: '4s' }}
                  />
                  <span className="text-amber-300 font-mono tracking-wider font-black">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="rounded bg-rose-500/30 px-1 text-[8px] font-black text-rose-300 uppercase">
                    {pkBattle.mode || '4v4'}
                  </span>
                </>
              ) : (
                <span className="text-rose-400 uppercase tracking-widest text-[10px] font-black">
                  {tr('تەواوبوو', 'FINISHED')}
                </span>
              )}
            </div>
          </div>

          {/* Blue Team Label & Score + Host End Button */}
          <div className="flex items-center gap-1.5 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1">
                {myTeam === 'blue' && (
                  <span className="rounded bg-sky-500/20 px-1 text-[8px] font-bold text-sky-300">
                    {tr('تۆ', 'YOU')}
                  </span>
                )}
                <span className="font-display text-xs font-black text-sky-400 uppercase tracking-wider truncate">
                  {tr('شین', 'BLUE')}
                </span>
              </div>
              <span className="font-mono text-xs font-black text-white">
                {blueScore.toLocaleString()}
              </span>
            </div>
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse shrink-0" />

            {isHost && pkBattle.status === 'active' && (
              <button
                onClick={handleEnd}
                className="ml-1 rounded-lg border border-white/10 bg-white/5 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title={tr('کۆتاییهێنان بە جەنگ', 'End Battle')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tug-of-War Real-Time Score Bar */}
        <div className="relative my-1">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-950 border border-white/10 shadow-inner">
            {/* Red Team Bar */}
            <motion.div
              style={{ width: `${redPercentage}%` }}
              className="relative flex items-center justify-start pl-2 bg-gradient-to-r from-rose-700 via-rose-500 to-pink-500 transition-all duration-500"
            >
              <span className="font-mono text-[9px] font-black text-white drop-shadow">
                {redPercentage}%
              </span>
            </motion.div>

            {/* Blue Team Bar */}
            <motion.div
              style={{ width: `${bluePercentage}%` }}
              className="relative flex items-center justify-end pr-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 transition-all duration-500"
            >
              <span className="font-mono text-[9px] font-black text-white drop-shadow">
                {bluePercentage}%
              </span>
            </motion.div>
          </div>

          {/* Glowing Center VS Emblem */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border-2 border-amber-400 font-black text-[9px] text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]">
            VS
          </div>
        </div>

        {/* Penalty Task Banner (If set) */}
        {pkBattle.penalty && (
          <div className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="font-bold">{tr('سزای دۆڕاو:', 'Loser Penalty:')}</span>
            <span className="truncate">{pkBattle.penalty}</span>
          </div>
        )}

        {/* Support Buttons & Top Contributors Bar */}
        <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
          {/* Red Team Quick Support / MVP info */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => handleSupportTeam('red')}
              className="flex items-center gap-1 rounded-lg bg-rose-600/20 border border-rose-500/40 px-2 py-0.5 text-rose-300 hover:bg-rose-600/30 transition"
              title="Support Red Team with Gift"
            >
              <Gift className="h-3 w-3" />
              <span className="font-bold">{tr('پشتگیری سوور', 'Boost Red')}</span>
            </button>
            {topRedContributors[0] && (
              <div
                className="hidden sm:flex items-center gap-1 text-[9px] text-slate-400 truncate"
                title={`Top Gifter: ${topRedContributors[0].username} (${topRedContributors[0].points} pts)`}
              >
                <Crown className="h-2.5 w-2.5 text-amber-400" />
                <span className="truncate max-w-[70px] text-white">
                  {topRedContributors[0].username}
                </span>
              </div>
            )}
          </div>

          {/* Toggle Contributors Details */}
          <button
            onClick={() => setShowContributors(!showContributors)}
            className="flex items-center gap-0.5 text-[9px] text-slate-400 hover:text-amber-300 transition"
          >
            <span>{tr('بەخشەرانی پێشەنگ', 'Top MVP')}</span>
            {showContributors ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {/* Blue Team Quick Support / MVP info */}
          <div className="flex items-center gap-1 min-w-0 justify-end">
            {topBlueContributors[0] && (
              <div
                className="hidden sm:flex items-center gap-1 text-[9px] text-slate-400 truncate"
                title={`Top Gifter: ${topBlueContributors[0].username} (${topBlueContributors[0].points} pts)`}
              >
                <span className="truncate max-w-[70px] text-white">
                  {topBlueContributors[0].username}
                </span>
                <Crown className="h-2.5 w-2.5 text-amber-400" />
              </div>
            )}
            <button
              onClick={() => handleSupportTeam('blue')}
              className="flex items-center gap-1 rounded-lg bg-sky-600/20 border border-sky-500/40 px-2 py-0.5 text-sky-300 hover:bg-sky-600/30 transition"
              title="Support Blue Team with Gift"
            >
              <Gift className="h-3 w-3" />
              <span className="font-bold">{tr('پشتگیری شین', 'Boost Blue')}</span>
            </button>
          </div>
        </div>

        {/* ── EXPANDABLE TOP CONTRIBUTORS LIST (MVP SECTION) ── */}
        <AnimatePresence>
          {showContributors && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 overflow-hidden border-t border-white/10 pt-2"
            >
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {/* Red Contributors */}
                <div className="rounded-xl bg-rose-950/20 border border-rose-500/20 p-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-500/20 font-bold text-rose-400">
                    <span>{tr('بەخشەرانی سوور', 'Red Supporters')}</span>
                    <span className="text-[9px]">{topRedContributors.length}</span>
                  </div>
                  {topRedContributors.length === 0 ? (
                    <p className="py-2 text-center text-[9px] text-slate-500">
                      {tr('هێشتا دیاری نەبەخشراوە', 'No gifts yet')}
                    </p>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {topRedContributors.slice(0, 3).map((c, i) => (
                        <div
                          key={`rc-${c.uid}`}
                          className="flex items-center justify-between text-[9px]"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-black text-amber-400">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                            </span>
                            <span className="truncate max-w-[70px] text-slate-200">
                              {c.username}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-rose-300">
                            {c.points.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blue Contributors */}
                <div className="rounded-xl bg-sky-950/20 border border-sky-500/20 p-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-sky-500/20 font-bold text-sky-400">
                    <span>{tr('بەخشەرانی شین', 'Blue Supporters')}</span>
                    <span className="text-[9px]">{topBlueContributors.length}</span>
                  </div>
                  {topBlueContributors.length === 0 ? (
                    <p className="py-2 text-center text-[9px] text-slate-500">
                      {tr('هێشتا دیاری نەبەخشراوە', 'No gifts yet')}
                    </p>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {topBlueContributors.slice(0, 3).map((c, i) => (
                        <div
                          key={`bc-${c.uid}`}
                          className="flex items-center justify-between text-[9px]"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-black text-amber-400">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                            </span>
                            <span className="truncate max-w-[70px] text-slate-200">
                              {c.username}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-sky-300">
                            {c.points.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FINISHED STATE: VICTORY BANNER, MVP & REMATCH CONTROLS ── */}
        {pkBattle.status !== 'active' && (
          <div className="mt-2.5 rounded-xl border border-white/10 bg-black/40 p-2 pt-2 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-400 animate-bounce shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase text-white">
                    {pkBattle.winner === 'red'
                      ? tr('🏆 تیمی سوور سەرکەوت!', '🏆 RED Team Victory!')
                      : pkBattle.winner === 'blue'
                      ? tr('🏆 تیمی شین سەرکەوت!', '🏆 BLUE Team Victory!')
                      : tr('🤝 یەکسانبوون!', '🤝 Draw / Tie!')}
                  </p>
                  <p className="text-[10px] text-amber-300">
                    {tr('سوور:', 'Red:')} {redScore.toLocaleString()} pts &bull;{' '}
                    {tr('شین:', 'Blue:')} {blueScore.toLocaleString()} pts
                  </p>
                </div>
              </div>

              {/* Host Rematch & Reset */}
              {isHost && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleRematch}
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:brightness-110 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{tr('دووبارەکردنەوە', 'Rematch')}</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white"
                    title={tr('داخستنی جەنگ', 'Close Battle')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Overall Battle MVP Badge */}
            {battleMvp && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 px-2.5 py-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-bold text-amber-300">
                    {tr('ئەستێرەی جەنگ (MVP):', 'Battle MVP:')}
                  </span>
                  <span className="font-black text-white">{battleMvp.username}</span>
                </div>
                <span className="font-mono font-bold text-amber-300">
                  {battleMvp.points.toLocaleString()} pts
                </span>
              </div>
            )}

            {/* Loser Punishment Reminder */}
            {pkBattle.penalty && pkBattle.winner && pkBattle.winner !== 'draw' && (
              <div className="mt-1.5 text-[10px] text-slate-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5">
                <span className="font-bold text-rose-400">
                  {tr('سزای سەر دۆڕاو:', 'Loser Penalty:')}
                </span>{' '}
                <span>{pkBattle.penalty}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
