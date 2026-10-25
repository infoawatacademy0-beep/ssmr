import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dices,
  Coins,
  Trophy,
  Swords,
  X,
  Sparkles,
  RotateCcw,
  ShieldAlert,
  Flame,
  Award,
} from 'lucide-react';
import type { DiceGame, User, Seat } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import {
  createDiceGame,
  joinDiceGame,
  rollDice,
  cancelDiceGame,
  resetGame,
} from '../services';

interface DiceGamePanelProps {
  roomId: string;
  currentUser: User;
  activeGame: DiceGame | null;
  seats: Seat[];
  onClose: () => void;
}

const BET_PRESETS = [50, 100, 250, 500, 1000];

/* ─────────────────────────────────────────────────────────────
   Animated 3D Dice Face Component
   ───────────────────────────────────────────────────────────── */
function DiceFace({
  value,
  isRolling,
  label,
}: {
  value: number | null;
  isRolling: boolean;
  label?: string;
}) {
  // Dot coordinates for values 1 through 6
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
    <div className="flex flex-col items-center">
      <motion.div
        animate={
          isRolling
            ? {
                rotateX: [0, 360, 720, 1080],
                rotateY: [0, 360, 720, 1080],
                scale: [1, 1.15, 0.9, 1],
              }
            : { rotateX: 0, rotateY: 0, scale: 1 }
        }
        transition={
          isRolling
            ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
            : { type: 'spring', stiffness: 300, damping: 20 }
        }
        className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-surface-700 via-surface-600 to-surface-800 p-2 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
      >
        {value === null ? (
          <span className="font-display text-2xl font-black text-amber-400/60">?</span>
        ) : (
          <svg className="h-full w-full" viewBox="0 0 100 100">
            {dots.map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={10}
                className="fill-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.8)]"
              />
            ))}
          </svg>
        )}
      </motion.div>
      {label && <span className="mt-2 text-[11px] font-semibold text-slate-400">{label}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Dice Game Panel Component
   ───────────────────────────────────────────────────────────── */
export default function DiceGamePanel({
  roomId,
  currentUser,
  activeGame,
  seats,
  onClose,
}: DiceGamePanelProps) {
  const { tr } = useLanguage();
  const [selectedBet, setSelectedBet] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLocalRolling, setIsLocalRolling] = useState<boolean>(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);

  // Check if current user is sitting on one of the 8 seats
  const isUserSeated = seats.some((s) => s.userId === currentUser.uid);

  // Determine game roles
  const isPlayer1 = activeGame?.player1.uid === currentUser.uid;
  const isPlayer2 = activeGame?.player2?.uid === currentUser.uid;
  const isParticipant = isPlayer1 || isPlayer2;

  // Local roll state
  const myRoll = isPlayer1
    ? activeGame?.player1.rollResult
    : isPlayer2
    ? activeGame?.player2?.rollResult
    : null;

  // Auto-reset countdown when game reaches 'revealing'
  useEffect(() => {
    if (activeGame?.status === 'revealing') {
      setAutoResetSeconds(5);
      const timer = setInterval(() => {
        setAutoResetSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            // Host or system triggers reset
            if (isPlayer1) {
              resetGame(roomId).catch(console.error);
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setAutoResetSeconds(null);
    }
  }, [activeGame?.status, isPlayer1, roomId]);

  /* ─────────────────────────────────────────────────────────────
     Action: Create Game
     ───────────────────────────────────────────────────────────── */
  const handleCreateGame = async () => {
    if (!isUserSeated) {
      alert('You must take a microphone seat on stage before starting a game.');
      return;
    }
    if (currentUser.coins < selectedBet) {
      alert(`Insufficient coins! You have ${currentUser.coins} coins.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await createDiceGame(
        roomId,
        {
          uid: currentUser.uid,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        selectedBet,
      );
    } catch (err: any) {
      alert(err.message || 'Failed to start game challenge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Action: Accept Challenge
     ───────────────────────────────────────────────────────────── */
  const handleJoinGame = async () => {
    if (!activeGame) return;
    if (!isUserSeated) {
      alert('You must take a microphone seat on stage to join this match.');
      return;
    }
    if (currentUser.coins < activeGame.betAmount) {
      alert(`Insufficient coins! You need ${activeGame.betAmount} coins.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await joinDiceGame(
        roomId,
        {
          uid: currentUser.uid,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        activeGame.betAmount,
      );
    } catch (err: any) {
      alert(err.message || 'Failed to join match.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Action: Roll Dice
     ───────────────────────────────────────────────────────────── */
  const handleRoll = async () => {
    if (!activeGame || isLocalRolling) return;

    setIsLocalRolling(true);
    try {
      // Simulate brief thrilling roll delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      await rollDice(roomId, currentUser.uid);
    } catch (err: any) {
      alert(err.message || 'Error rolling die.');
    } finally {
      setIsLocalRolling(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Action: Cancel Game
     ───────────────────────────────────────────────────────────── */
  const handleCancelGame = async () => {
    try {
      await cancelDiceGame(roomId, currentUser.uid);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/30 bg-surface-800 p-6 shadow-2xl shadow-amber-500/10"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/25">
              <Dices className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                {tr('جەنگی زاری ١ بە ١', '1v1 Dice Battle')}
              </h2>
              <p className="text-[10px] font-medium tracking-wider text-amber-400 uppercase">
                {tr('گرەوی کۆینی پارێزراو', 'Secure Coin Wager')}
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

        {/* ── STATE 1: NO ACTIVE GAME (Create Challenge) ── */}
        {!activeGame && (
          <div className="mt-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-300 font-medium">{tr('بڕی گرەوی کۆین هەڵبژێرە', 'Select Coin Bet Amount')}</p>
              <p className="text-[11px] text-slate-500">{tr('سەرکەوتوو هەموو کۆینەکان دەباتەوە + ٢٠٠ XP', 'Winner takes entire pot + 200 XP')}</p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-5 gap-2">
              {BET_PRESETS.map((amt) => {
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
                          ? 'border-2 border-amber-400 bg-amber-400/15 text-amber-300 shadow-md shadow-amber-500/20'
                          : 'border border-white/[0.06] bg-white/[0.03] text-slate-300 hover:border-amber-400/40 hover:bg-white/[0.06]'
                      }
                      ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}
                    `}
                  >
                    <span className="text-xs font-bold">{amt}</span>
                    <span className="text-[9px] text-slate-500">{tr('کۆین', 'Coins')}</span>
                  </button>
                );
              })}
            </div>

            {/* Seated status alert if spectator */}
            {!isUserSeated && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{tr('سەرەتا لەسەر کورسییەکی مایک دابنیشە بۆ دەستپێکردن یان بەشداری لە یاری.', 'Take a mic seat first to create or join the battle.')}</span>
              </div>
            )}

            {/* Launch Challenge Button */}
            <button
              onClick={handleCreateGame}
              disabled={isSubmitting || !isUserSeated || currentUser.coins < selectedBet}
              className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3.5 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Swords className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? tr('خەریکی دانانی گرەوە…', 'Placing bet…')
                  : tr(`دەستپێکردنی یاری (${selectedBet} کۆین)`, `Start Game (${selectedBet} Coins)`)}
              </span>
            </button>
          </div>
        )}

        {/* ── STATE 2: WAITING FOR OPPONENT ── */}
        {activeGame && activeGame.status === 'waiting' && (
          <div className="mt-6 flex flex-col items-center text-center">
            {/* Animated Pulsing Challenge Shield */}
            <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border-2 border-amber-400"
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 shadow-lg">
                <Swords className="h-8 w-8 animate-pulse" />
              </div>
            </div>

            <h3 className="text-sm font-bold text-white">{tr('ئاڵنگاری نوێ کرایەوە!', 'New Challenge Created!')}</h3>
            <p className="mt-1 text-xs text-slate-400">
              <span className="font-semibold text-amber-400">{activeGame.player1.username}</span>{' '}
              {tr('گرەوی کرد لەسەر', 'Wagered')} <span className="font-bold text-white">{activeGame.betAmount} {tr('کۆین', 'Coins')}</span>
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs">
              <span className="text-slate-400">{tr('خەڵاتی گشتی:', 'Total Pot:')}</span>
              <span className="font-bold text-amber-300">{activeGame.betAmount * 2} {tr('کۆین', 'Coins')}</span>
            </div>

            {/* Actions */}
            <div className="mt-6 w-full space-y-2">
              {isPlayer1 ? (
                <button
                  onClick={handleCancelGame}
                  className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 active:scale-95"
                >
                  {tr(`هەڵوەشاندنەوەی یاری و گەڕاندنەوەی ${activeGame.betAmount} کۆین`, `Cancel game & refund ${activeGame.betAmount} coins`)}
                </button>
              ) : (
                <button
                  onClick={handleJoinGame}
                  disabled={isSubmitting || !isUserSeated || currentUser.coins < activeGame.betAmount}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3.5 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Flame className="h-4 w-4" />
                  <span>
                    {isSubmitting
                      ? tr('خەریکی چوونەژوورەوەیە…', 'Joining game…')
                      : tr(`قبوڵکردنی یاری (${activeGame.betAmount} کۆین)`, `Accept Challenge (${activeGame.betAmount} Coins)`)}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STATE 3: PLAYING (Active Rolling Stage) ── */}
        {activeGame && activeGame.status === 'playing' && (
          <div className="mt-5 space-y-5">
            {/* Pot Size Banner */}
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400/10 border border-amber-400/20 py-2.5 text-center">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300">
                {tr('کۆی خەڵات:', 'Total Pot:')} <strong className="text-white text-sm">{activeGame.potSize} {tr('کۆین', 'Coins')}</strong>
              </span>
            </div>

            {/* Head-to-Head 1v1 Arena */}
            <div className="grid grid-cols-2 gap-4">
              {/* Player 1 Card */}
              <div
                className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-all ${
                  activeGame.player1.rollResult !== null
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow">
                  {activeGame.player1.username.charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-xs font-bold text-white max-w-[120px]">
                  {activeGame.player1.username}
                </span>

                <div className="my-3">
                  <DiceFace
                    value={activeGame.player1.rollResult}
                    isRolling={isLocalRolling && isPlayer1}
                  />
                </div>

                <span className="text-[11px] font-semibold text-slate-400">
                  {activeGame.player1.rollResult !== null ? (
                    <span className="text-emerald-400">{tr('ئەنجامی زار:', 'Dice Roll:')} {activeGame.player1.rollResult}</span>
                  ) : (
                    tr('چاوەڕوانی هەڵدانی زارە…', 'Waiting to roll dice…')
                  )}
                </span>
              </div>

              {/* Player 2 Card */}
              <div
                className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-all ${
                  activeGame.player2?.rollResult !== null
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-sm font-bold text-white shadow">
                  {activeGame.player2?.username.charAt(0).toUpperCase() || 'P2'}
                </div>
                <span className="truncate text-xs font-bold text-white max-w-[120px]">
                  {activeGame.player2?.username || 'Opponent'}
                </span>

                <div className="my-3">
                  <DiceFace
                    value={activeGame.player2?.rollResult ?? null}
                    isRolling={isLocalRolling && isPlayer2}
                  />
                </div>

                <span className="text-[11px] font-semibold text-slate-400">
                  {activeGame.player2?.rollResult !== null ? (
                    <span className="text-emerald-400">{tr('ئەنجامی زار:', 'Dice Roll:')} {activeGame.player2?.rollResult}</span>
                  ) : (
                    tr('چاوەڕوانی هەڵدانی زارە…', 'Waiting to roll dice…')
                  )}
                </span>
              </div>
            </div>

            {/* Player Roll Action Button */}
            {isParticipant && myRoll === null ? (
              <button
                onClick={handleRoll}
                disabled={isLocalRolling}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 disabled:opacity-50"
              >
                <Dices className="h-5 w-5 animate-spin" />
                <span>{isLocalRolling ? tr('خەریکی هەڵدانی زارە…', 'Rolling dice…') : tr('زارەکەت هەڵبدە ئێستا!', 'Roll your dice now!')}</span>
              </button>
            ) : isParticipant && myRoll !== null ? (
              <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                <Dices className="h-4 w-4 text-amber-400" />
                <span>{tr('ئەنجامی زارەکەت', 'Your dice roll was')} <strong className="text-white">{myRoll}</strong> {tr('بوو! چاوەڕوانی یاریزانی بەرامبەر بە…', '! Waiting for opponent…')}</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center text-xs text-slate-400">
                {tr('تەماشاکردنی یاری نێوان', 'Spectating match between')} {activeGame.player1.username} {tr('و', 'and')} {activeGame.player2?.username}…
              </div>
            )}
          </div>
        )}

        {/* ── STATE 4: REVEALING / VICTORY BANNER ── */}
        {activeGame && activeGame.status === 'revealing' && (
          <div className="mt-5 space-y-4 text-center">
            {/* Victory Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-xl shadow-amber-500/30 text-black"
            >
              {activeGame.isTie ? <RotateCcw className="h-10 w-10" /> : <Trophy className="h-10 w-10" />}
            </motion.div>

            <div>
              <h3 className="font-display text-lg font-black text-white">
                {activeGame.isTie
                  ? tr("یەکسانبوون!", "It's a Tie!")
                  : `${activeGame.winnerUsername?.toUpperCase()} ${tr('سەرکەوت!', 'Won!')}`}
              </h3>
              <p className="mt-1 text-xs text-amber-300 font-semibold">
                {activeGame.isTie
                  ? tr('هەردوو یاریزان یەکسان بوون. کۆینەکان گەڕێندرانەوە!', 'Both rolled the same number. Coins refunded!')
                  : tr(`بردنەوەی ${activeGame.potSize} کۆین و ٢٠٠ خاڵی XP!`, `Won ${activeGame.potSize} coins and 200 XP points!`)}
              </p>
            </div>

            {/* Revealed Dice Comparison */}
            <div className="flex items-center justify-center gap-6 py-2">
              <DiceFace
                value={activeGame.player1.rollResult}
                isRolling={false}
                label={activeGame.player1.username}
              />
              <span className="font-display text-xl font-bold text-slate-500">VS</span>
              <DiceFace
                value={activeGame.player2?.rollResult ?? null}
                isRolling={false}
                label={activeGame.player2?.username}
              />
            </div>

            {/* Auto-reset pill */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{tr('گەڕی دواتر ئامادەیە لە', 'Next round ready in')} {autoResetSeconds ?? 0} {tr('چرکەدا…', 'seconds…')}</span>
            </div>

            <button
              onClick={() => resetGame(roomId)}
              className="w-full rounded-2xl bg-white/[0.08] py-3 text-xs font-semibold text-white hover:bg-white/[0.14] active:scale-95"
            >
              {tr('یارییەکی تر بکە', 'Play Again')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
