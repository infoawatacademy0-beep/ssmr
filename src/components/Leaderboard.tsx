import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  X,
  Coins,
  Sparkles,
  Crown,
  Award,
  Medal,
  ChevronRight,
} from 'lucide-react';
import type { LeaderboardEntry } from '../services';
import { useLanguage } from '../contexts';
import {
  subscribeToLeaderboardByCoins,
  subscribeToLeaderboardByXP,
} from '../services';

interface LeaderboardProps {
  onClose: () => void;
  onOpenProfile?: (uid: string) => void;
}

export default function Leaderboard({ onClose, onOpenProfile }: LeaderboardProps) {
  const { tr } = useLanguage();
  const [activeTab, setActiveTab] = useState<'coins' | 'xp'>('coins');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let unsub: () => void;

    if (activeTab === 'coins') {
      unsub = subscribeToLeaderboardByCoins(25, (data) => {
        setEntries(data);
        setLoading(false);
      });
    } else {
      unsub = subscribeToLeaderboardByXP(25, (data) => {
        setEntries(data);
        setLoading(false);
      });
    }

    return () => unsub();
  }, [activeTab]);

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                {tr("ڕیزبەندی پاڵەوانانی گۆڕەپان", "Hall of Fame Leaderboard")}
              </h3>
              <p className="text-[10px] text-slate-400">{tr("ڕیزبەندی گشتی و ڕاستەوخۆ", "Live & Global Rankings")}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('coins')}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition ${
                activeTab === 'coins'
                  ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-md shadow-amber-500/10'
                  : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Coins className="h-4 w-4 text-amber-400" />
              <span>{tr("سامان و دیاری", "Wealth & Coins")}</span>
            </button>

            <button
              onClick={() => setActiveTab('xp')}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition ${
                activeTab === 'xp'
                  ? 'border border-purple-400/40 bg-purple-400/15 text-purple-300 shadow-md shadow-purple-500/10'
                  : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>{tr("ئاست و ئەزموون (XP)", "Level & XP")}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top 3 Podium */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 pt-4 pb-2 items-end">
              {/* Rank 2 (Silver) */}
              <div
                onClick={() => onOpenProfile && onOpenProfile(topThree[1].uid)}
                className="group flex flex-col items-center cursor-pointer"
              >
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-sm font-bold text-slate-900 shadow-md">
                    {topThree[1].avatar ? (
                      <img src={topThree[1].avatar} alt={topThree[1].username} className="h-full w-full object-cover" />
                    ) : (
                      topThree[1].username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-950 font-bold text-[10px] shadow">
                    2
                  </div>
                </div>
                <span className="truncate max-w-[85px] text-[11px] font-bold text-white group-hover:text-amber-300">
                  {topThree[1].username}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {activeTab === 'coins'
                    ? `${topThree[1].coins.toLocaleString()} C`
                    : `${topThree[1].xp.toLocaleString()} XP`}
                </span>
                <div className="mt-2 h-16 w-full rounded-t-2xl bg-slate-800/80 border-t border-slate-600 flex items-center justify-center">
                  <Medal className="h-5 w-5 text-slate-300" />
                </div>
              </div>

              {/* Rank 1 (Gold / Champion) */}
              <div
                onClick={() => onOpenProfile && onOpenProfile(topThree[0].uid)}
                className="group flex flex-col items-center cursor-pointer -mt-4"
              >
                <div className="relative mb-2">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-600 text-base font-black text-slate-950 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400">
                    {topThree[0].avatar ? (
                      <img src={topThree[0].avatar} alt={topThree[0].username} className="h-full w-full object-cover" />
                    ) : (
                      topThree[0].username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow-md">
                    <Crown className="h-3.5 w-3.5" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black font-black text-[10px] shadow">
                    1
                  </div>
                </div>
                <span className="truncate max-w-[95px] text-xs font-bold text-white group-hover:text-amber-300">
                  {topThree[0].username}
                </span>
                <span className="text-[11px] font-mono font-black text-amber-300">
                  {activeTab === 'coins'
                    ? `${topThree[0].coins.toLocaleString()} C`
                    : `${topThree[0].xp.toLocaleString()} XP`}
                </span>
                <div className="mt-2 h-24 w-full rounded-t-2xl bg-gradient-to-t from-amber-500/20 to-amber-500/40 border-t-2 border-amber-400 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-amber-300" />
                </div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div
                onClick={() => onOpenProfile && onOpenProfile(topThree[2].uid)}
                className="group flex flex-col items-center cursor-pointer"
              >
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-900 text-sm font-bold text-amber-200 shadow-md">
                    {topThree[2].avatar ? (
                      <img src={topThree[2].avatar} alt={topThree[2].username} className="h-full w-full object-cover" />
                    ) : (
                      topThree[2].username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-700 text-amber-100 font-bold text-[10px] shadow">
                    3
                  </div>
                </div>
                <span className="truncate max-w-[85px] text-[11px] font-bold text-white group-hover:text-amber-300">
                  {topThree[2].username}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {activeTab === 'coins'
                    ? `${topThree[2].coins.toLocaleString()} C`
                    : `${topThree[2].xp.toLocaleString()} XP`}
                </span>
                <div className="mt-2 h-12 w-full rounded-t-2xl bg-slate-800/60 border-t border-amber-800 flex items-center justify-center">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>
          )}

          {/* Ranks 4+ List */}
          <div className="space-y-1.5 pt-2">
            {remaining.map((entry) => (
              <div
                key={entry.uid}
                onClick={() => onOpenProfile && onOpenProfile(entry.uid)}
                className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 transition hover:border-slate-700 hover:bg-slate-950 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-500 w-5 text-center">
                    #{entry.rank}
                  </span>

                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt={entry.username} className="h-full w-full object-cover" />
                    ) : (
                      entry.username.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">{entry.username}</h4>
                    <span className="text-[10px] text-purple-300 font-medium">
                      {tr("ئاستی", "Level")} {entry.level}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {activeTab === 'coins'
                      ? entry.coins.toLocaleString()
                      : entry.xp.toLocaleString()}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
