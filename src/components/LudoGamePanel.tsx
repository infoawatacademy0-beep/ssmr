import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Coins,
  Trophy,
  Swords,
  X,
  Sparkles,
  Users,
  Play,
  RotateCcw,
  ShieldAlert,
  Flame,
  Crown,
} from 'lucide-react';
import type { LudoGame, User, Seat } from '../types';
import { LUDO_COLOR_MAP } from '../types';
import {
  createLudoGame,
  joinLudoGame,
  startLudoGame,
  rollLudoDice,
  resetLudoGame,
  cancelLudoGame,
} from '../services';

interface LudoGamePanelProps {
  roomId: string;
  currentUser: User;
  activeLudoGame: LudoGame | null;
  seats: Seat[];
  onClose: () => void;
}

const LUDO_BET_PRESETS = [100, 250, 500, 1000, 2500];
const GOAL_POSITION = 25;

/* ─────────────────────────────────────────────────────────────
   Animated Mini Die for Ludo
   ───────────────────────────────────────────────────────────── */
function LudoDiceView({
  value,
  isRolling,
}: {
  value: number | null;
  isRolling: boolean;
}) {
  const dotPositions: Record<number, number[][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [25, 75], [75, 25], [75, 75]],
    5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
  };

  const dots = value ? dotPositions[value] || [] : [];

  return (
    <motion.div
      animate={
        isRolling
          ? {
              rotate: [0, 180, 360, 540, 720],
              scale: [1, 1.2, 0.9, 1],
            }
          : { rotate: 0, scale: 1 }
      }
      transition={
        isRolling
          ? { duration: 0.6, repeat: Infinity, ease: 'linear' }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
      className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-400 bg-surface-700 p-2 shadow-lg shadow-amber-500/20"
    >
      {value === null ? (
        <span className="font-display text-xl font-black text-amber-400/70">?</span>
      ) : (
        <svg className="h-full w-full" viewBox="0 0 100 100">
          {dots.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={12}
              className="fill-amber-400 drop-shadow-[0_0_3px_rgba(245,158,11,0.9)]"
            />
          ))}
        </svg>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main 4-Player Ludo Board Game Panel
   ───────────────────────────────────────────────────────────── */
export default function LudoGamePanel({
  roomId,
  currentUser,
  activeLudoGame,
  seats,
  onClose,
}: LudoGamePanelProps) {
  const [selectedBet, setSelectedBet] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRollingLocal, setIsRollingLocal] = useState(false);
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);

  // Check if current user is sitting on one of the 8 seats
  const isUserSeated = seats.some((s) => s.userId === currentUser.uid);

  // Game participation status
  const isHost = activeLudoGame?.hostUid === currentUser.uid;
  const isParticipant = Boolean(
    activeLudoGame?.players.some((p) => p.uid === currentUser.uid),
  );

  const activePlayer =
    activeLudoGame && activeLudoGame.players[activeLudoGame.currentTurnIndex];
  const isMyTurn =
    activeLudoGame?.status === 'playing' && activePlayer?.uid === currentUser.uid;

  // Auto-reset timer when game ends
  useEffect(() => {
    if (activeLudoGame?.status === 'ended') {
      setResetCountdown(5);
      const timer = setInterval(() => {
        setResetCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            if (isHost) {
              resetLudoGame(roomId).catch(console.error);
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setResetCountdown(null);
    }
  }, [activeLudoGame?.status, isHost, roomId]);

  /* ─────────────────────────────────────────────────────────────
     Action Handlers
     ───────────────────────────────────────────────────────────── */
  const handleCreateGame = async () => {
    if (!isUserSeated) {
      alert('You must take a microphone seat on stage before starting a Ludo Board.');
      return;
    }
    if (currentUser.coins < selectedBet) {
      alert(`Insufficient coins! You need ${selectedBet} coins.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await createLudoGame(
        roomId,
        {
          uid: currentUser.uid,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        selectedBet,
      );
    } catch (err: any) {
      alert(err.message || 'Failed to initialize Ludo board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGame = async () => {
    if (!activeLudoGame) return;
    if (!isUserSeated) {
      alert('You must take a microphone seat on stage to join this board.');
      return;
    }
    if (currentUser.coins < activeLudoGame.betAmount) {
      alert(`Insufficient coins! You need ${activeLudoGame.betAmount} coins.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await joinLudoGame(roomId, {
        uid: currentUser.uid,
        username: currentUser.username,
        avatar: currentUser.avatar,
      });
    } catch (err: any) {
      alert(err.message || 'Could not join board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartGame = async () => {
    if (!activeLudoGame) return;
    setIsSubmitting(true);
    try {
      await startLudoGame(roomId, currentUser.uid);
    } catch (err: any) {
      alert(err.message || 'Failed to start game.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollDice = async () => {
    if (!activeLudoGame || !isMyTurn || isRollingLocal) return;

    setIsRollingLocal(true);
    try {
      await new Promise((res) => setTimeout(res, 600));
      await rollLudoDice(roomId, currentUser.uid);
    } catch (err: any) {
      alert(err.message || 'Error rolling die.');
    } finally {
      setIsRollingLocal(false);
    }
  };

  const handleCancelGame = async () => {
    try {
      await cancelLudoGame(roomId, currentUser.uid);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-violet-500/30 bg-surface-800 p-6 shadow-2xl"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                4-PLAYER LUDO BATTLE
              </h2>
              <p className="text-[10px] font-medium tracking-wider text-violet-400 uppercase">
                High-Stakes Coin Escrow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{(currentUser.coins ?? 0).toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── STATE 1: NO ACTIVE LUDO GAME (Create Game) ── */}
        {!activeLudoGame && (
          <div className="mt-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-300 font-medium">Select Entry Fee (Per Player)</p>
              <p className="text-[11px] text-slate-500">
                Up to 4 players · Winner claims 100% of the total pot + 500 XP
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-5 gap-2">
              {LUDO_BET_PRESETS.map((amt) => {
                const isSelected = selectedBet === amt;
                const canAfford = currentUser.coins >= amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => setSelectedBet(amt)}
                    className={`
                      flex flex-col items-center justify-center rounded-2xl py-3 transition-all
                      ${
                        isSelected
                          ? 'border-2 border-violet-400 bg-violet-500/20 text-violet-300 shadow-md shadow-violet-500/20'
                          : 'border border-white/[0.06] bg-white/[0.03] text-slate-300 hover:border-violet-400/40 hover:bg-white/[0.06]'
                      }
                      ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}
                    `}
                  >
                    <span className="text-xs font-bold">{amt}</span>
                    <span className="text-[9px] text-slate-500">Coins</span>
                  </button>
                );
              })}
            </div>

            {/* Seated status alert */}
            {!isUserSeated && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Take any mic seat on stage to host or join a 4-player board.</span>
              </div>
            )}

            {/* Launch Board Button */}
            <button
              onClick={handleCreateGame}
              disabled={isSubmitting || !isUserSeated || currentUser.coins < selectedBet}
              className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Swords className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? 'Initializing Board…'
                  : `Launch 4-Player Board (${selectedBet} Coins Entry)`}
              </span>
            </button>
          </div>
        )}

        {/* ── STATE 2: WAITING FOR PLAYERS (Lobby) ── */}
        {activeLudoGame && activeLudoGame.status === 'waiting' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-violet-500/10 border border-violet-500/20 p-3">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Total Prize Pot
                </span>
                <p className="text-base font-black text-amber-300 flex items-center gap-1">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span>{activeLudoGame.totalPot} Coins</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Entry Fee
                </span>
                <p className="text-xs font-bold text-white">{activeLudoGame.betAmount} Coins</p>
              </div>
            </div>

            {/* 4 Player Slots */}
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Board Seats ({activeLudoGame.players.length} / 4)
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((index) => {
                  const player = activeLudoGame.players[index];
                  const colorKey = player?.color || (['red', 'blue', 'green', 'yellow'][index] as any);
                  const colorConfig = LUDO_COLOR_MAP[colorKey as keyof typeof LUDO_COLOR_MAP];

                  return (
                    <div
                      key={index}
                      className={`
                        flex items-center gap-2.5 rounded-2xl border p-3 transition-all
                        ${
                          player
                            ? `${colorConfig.border} bg-white/[0.04]`
                            : 'border-dashed border-white/10 bg-white/[0.02]'
                        }
                      `}
                    >
                      <div
                        className={`
                          flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow
                          ${player ? colorConfig.bg : 'bg-white/10 text-slate-500'}
                        `}
                      >
                        {player ? player.username.charAt(0).toUpperCase() : `${index + 1}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">
                          {player ? player.username : 'Empty Slot'}
                        </p>
                        <p className={`text-[10px] font-semibold ${player ? colorConfig.text : 'text-slate-500'}`}>
                          {player ? colorConfig.name : 'Waiting…'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions: Join or Start Match */}
            <div className="pt-2 space-y-2">
              {!isParticipant && activeLudoGame.players.length < 4 && (
                <button
                  onClick={handleJoinGame}
                  disabled={isSubmitting || !isUserSeated || currentUser.coins < activeLudoGame.betAmount}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-bold text-black shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Flame className="h-4 w-4" />
                  <span>Join Board ({activeLudoGame.betAmount} Coins)</span>
                </button>
              )}

              {isHost ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleStartGame}
                    disabled={isSubmitting || activeLudoGame.players.length < 2}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Match ({activeLudoGame.players.length}/4 Players)</span>
                  </button>
                  <button
                    onClick={handleCancelGame}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                isParticipant && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                    Waiting for the host to launch the battle…
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ── STATE 3: PLAYING (Active 4-Player Board Race) ── */}
        {activeLudoGame && activeLudoGame.status === 'playing' && (
          <div className="mt-4 space-y-4">
            {/* Header Status & Turn Banner */}
            <div className="flex items-center justify-between rounded-2xl bg-surface-700/60 border border-white/[0.08] p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Prize Pot
                  </span>
                  <p className="text-xs font-bold text-amber-300">{activeLudoGame.totalPot} Coins</p>
                </div>
              </div>

              {activePlayer && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Active Turn
                  </span>
                  <p className="text-xs font-bold text-white flex items-center gap-1">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        LUDO_COLOR_MAP[activePlayer.color]?.bg || 'bg-violet-400'
                      } animate-ping`}
                    />
                    <span>{activePlayer.username}</span>
                  </p>
                </div>
              )}
            </div>

            {/* ── Visual 4-Player Track (Linear Race to Step 25) ── */}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-900/60 p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-3">
                <span>Start Zone (0)</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> Goal (25)
                </span>
              </div>

              <div className="space-y-3">
                {activeLudoGame.players.map((p) => {
                  const colorConfig = LUDO_COLOR_MAP[p.color];
                  const percentage = Math.min(100, (p.position / GOAL_POSITION) * 100);

                  return (
                    <div key={p.uid} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${colorConfig.bg}`} />
                          {p.username}
                        </span>
                        <span className={`${colorConfig.text} font-semibold`}>
                          Step {p.position} / {GOAL_POSITION}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <motion.div
                          className={`h-full rounded-full ${colorConfig.bg}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Dice Roll Controls ── */}
            <div className="flex items-center justify-center gap-4 py-1">
              <LudoDiceView
                value={activeLudoGame.lastDiceRoll}
                isRolling={isRollingLocal}
              />
              <div className="flex-1">
                {isMyTurn ? (
                  <button
                    onClick={handleRollDice}
                    disabled={isRollingLocal}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>{isRollingLocal ? 'Rolling…' : 'YOUR TURN — ROLL DICE!'}</span>
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                    Waiting for {activePlayer?.username} to roll…
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STATE 4: VICTORY / REVEAL SCREEN ── */}
        {activeLudoGame && activeLudoGame.status === 'ended' && activeLudoGame.winner && (
          <div className="mt-5 space-y-4 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 250, damping: 20 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-black shadow-2xl shadow-amber-500/40"
            >
              <Crown className="h-10 w-10 animate-bounce" />
            </motion.div>

            <div>
              <h3 className="font-display text-lg font-black text-white">
                {activeLudoGame.winner.username.toUpperCase()} CONQUERED THE BOARD!
              </h3>
              <p className="mt-1 text-xs text-amber-300 font-semibold">
                Won the entire {activeLudoGame.totalPot} Coins Pot + 500 XP!
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Resetting board in {resetCountdown ?? 0}s…</span>
            </div>

            <button
              onClick={() => resetLudoGame(roomId)}
              className="w-full rounded-2xl bg-white/[0.08] py-3 text-xs font-semibold text-white hover:bg-white/[0.14] active:scale-95"
            >
              Play Another Match
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
