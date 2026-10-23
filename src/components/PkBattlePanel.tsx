import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, Clock, X, RotateCcw } from 'lucide-react';
import type { PkBattleState, PkTeam, User, Seat } from '../types';
import { startPkBattle, endPkBattle, resetPkBattle } from '../services';

interface PkBattlePanelProps {
  roomId: string;
  currentUser: User;
  isHost: boolean;
  seats: Seat[];
  pkBattle: PkBattleState | null;
}

export default function PkBattlePanel({
  roomId,
  currentUser,
  isHost,
  seats,
  pkBattle,
}: PkBattlePanelProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

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

  // Identify which team the current user belongs to (if seated)
  // Seats 1, 2, 5, 6 = Red Team; Seats 3, 4, 7, 8 = Blue Team
  const mySeat = seats.find((s) => s.userId === currentUser.uid);
  const myTeam: PkTeam | null = mySeat
    ? [1, 2, 5, 6].includes(mySeat.seatNo)
      ? 'red'
      : 'blue'
    : null;

  const handleStart5MinBattle = async () => {
    try {
      await startPkBattle(roomId, currentUser.username, 300); // 5 minutes (300 sec)
    } catch (err: any) {
      alert(err.message || 'Failed to start 4v4 battle');
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

  // If battle is idle, show host launch pill
  if (!pkBattle || pkBattle.status === 'idle') {
    return isHost ? (
      <div className="mb-2 px-1">
        <button
          onClick={handleStart5MinBattle}
          className="group flex w-full items-center justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-600/20 via-surface-800 to-blue-600/20 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/10 transition-all hover:border-rose-400/50 hover:from-rose-600/30 active:scale-98"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500 text-white shadow">
              <Swords className="h-3.5 w-3.5" />
            </div>
            <span className="tracking-wide">دەستپێکردنی جەنگی ٤ بە ٤ (PK)</span>
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black text-rose-300 uppercase">
              ٥ خولەک
            </span>
          </div>
          <span className="text-[10px] text-amber-300 font-semibold group-hover:underline">
            دەستپێکردن ئێستا ←
          </span>
        </button>
      </div>
    ) : null;
  }

  // Active or Finished PK Battle View
  return (
    <div className="mb-3 px-1">
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900/95 via-surface-900/90 to-slate-950 p-2.5 shadow-2xl backdrop-blur-xl">
        {/* Top Header: Team Names, Timer & Close */}
        <div className="flex items-center justify-between gap-1 pb-2">
          {/* Red Team Label */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-display text-xs font-black text-rose-400 uppercase tracking-wider truncate">
              سوور
            </span>
          </div>

          {/* Center Timer & VS Icon */}
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-xs font-black">
            {pkBattle.status === 'active' ? (
              <>
                <Clock className="h-3 w-3 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-amber-300 font-mono tracking-wider">{formatTime(timeLeft)}</span>
              </>
            ) : (
              <span className="text-rose-400 uppercase tracking-widest text-[10px]">تەواوبوو</span>
            )}
          </div>

          {/* Blue Team Label + Host End */}
          <div className="flex items-center gap-1.5 min-w-0 justify-end">
            <span className="font-display text-xs font-black text-sky-400 uppercase tracking-wider truncate">
              شین
            </span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" />
            {isHost && pkBattle.status === 'active' && (
              <button
                onClick={handleEnd}
                className="ml-1 rounded-lg border border-white/10 bg-white/5 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="End Battle"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tug-of-War Score Bar */}
        <div className="relative my-1">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-950 border border-white/10 shadow-inner">
            {/* Red Team Bar */}
            <motion.div
              style={{ width: `${redPercentage}%` }}
              className="relative flex items-center justify-start pl-2 bg-gradient-to-r from-rose-700 via-rose-500 to-pink-500 transition-all duration-500"
            >
              <span className="font-mono text-[10px] font-black text-white drop-shadow">
                {redScore.toLocaleString()}
              </span>
            </motion.div>

            {/* Blue Team Bar */}
            <motion.div
              style={{ width: `${bluePercentage}%` }}
              className="relative flex items-center justify-end pr-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 transition-all duration-500"
            >
              <span className="font-mono text-[10px] font-black text-white drop-shadow">
                {blueScore.toLocaleString()}
              </span>
            </motion.div>
          </div>

          {/* Glowing Center VS Emblem */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border-2 border-amber-400 font-black text-[9px] text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]">
            VS
          </div>
        </div>

        {/* Finished State: Victory Banner */}
        {pkBattle.status !== 'active' && (
          <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400 animate-bounce" />
              <div className="text-left">
                <p className="text-xs font-black uppercase text-white">
                  {pkBattle.winner === 'red'
                    ? '🏆 تیمی سوور سەرکەوت!'
                    : pkBattle.winner === 'blue'
                    ? '🏆 تیمی شین سەرکەوت!'
                    : '🤝 یەکسانبوون!'}
                </p>
                <p className="text-[10px] text-amber-300">
                  Red: {redScore} pts &bull; Blue: {blueScore} pts
                </p>
              </div>
            </div>

            {isHost && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleStart5MinBattle}
                  className="rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow"
                >
                  دووبارەکردنەوە (٥ خولەک)
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white"
                  title="Close Battle"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
