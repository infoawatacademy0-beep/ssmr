import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Coins,
  Users,
  Sparkles,
  Flame,
  Play,
  ArrowLeftRight,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import {
  JACKAROO_COLOR_META,
  formatCoinsK,
  type JackarooGame,
  type JackarooCard,
  type User,
} from '../types';
import {
  createJackarooGame,
  joinJackarooGame,
  startJackarooGameNow,
  playJackarooCardMove,
  playJackSwapMove,
  burnJackarooCard,
  closeJackarooGame,
  getGlobalTrackIndex,
  canMoveMarbleWithCard,
} from '../services';

interface JackarooGamePanelProps {
  roomId: string;
  currentUser: User;
  activeGame: JackarooGame | null;
  isRoomHost?: boolean;
  onClose: () => void;
}

const BET_OPTIONS = [0, 50, 100, 250, 500, 1000];

const CARD_POWER_HINT: Record<string, string> = {
  A: 'چوونە دەرەوە لە بنکە یان ١ / ١١ هەنگاو بۆ پێشەوە',
  K: 'چوونە دەرەوە لە بنکە یان ١٣ هەنگاو بۆ پێشەوە',
  Q: '١٢ هەنگاو بۆ پێشەوە',
  J: 'گۆڕینەوەی مۆرە لەگەڵ بەرامبەر یان ١١ هەنگاو',
  '4': '٤ هەنگاو بۆ دواوە (-4)',
  '10': '١٠ هەنگاو بۆ پێشەوە',
  '7': '٧ هەنگاو بۆ پێشەوە',
  '5': '٥ هەنگاو بۆ پێشەوە',
};

export default function JackarooGamePanel({
  roomId,
  currentUser,
  activeGame,
  isRoomHost = false,
  onClose,
}: JackarooGamePanelProps) {
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<2 | 3 | 4>(4);
  const [selectedBet, setSelectedBet] = useState<number>(100);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [useAceEleven, setUseAceEleven] = useState(false);
  const [jackSwapMode, setJackSwapMode] = useState(false);
  const [selectedMyMarbleForSwap, setSelectedMyMarbleForSwap] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  const myPlayerIndex =
    activeGame?.players.findIndex((p) => p.uid === currentUser.uid) ?? -1;
  const myPlayer = myPlayerIndex >= 0 ? activeGame?.players[myPlayerIndex] : null;
  const isMyTurn =
    activeGame?.status === 'playing' && activeGame.currentTurnIndex === myPlayerIndex;
  const canManageGame = Boolean(
    isRoomHost ||
      currentUser.isAdmin ||
      (activeGame && activeGame.hostUid === currentUser.uid),
  );

  // Auto-select first card in hand when it becomes my turn
  useEffect(() => {
    if (myPlayer && myPlayer.hand.length > 0) {
      if (!selectedCardId || !myPlayer.hand.some((c) => c.id === selectedCardId)) {
        setSelectedCardId(myPlayer.hand[0].id);
        setUseAceEleven(false);
        setJackSwapMode(false);
        setSelectedMyMarbleForSwap(null);
      }
    } else {
      setSelectedCardId(null);
    }
  }, [myPlayer?.hand, isMyTurn]);

  const selectedCard: JackarooCard | null =
    myPlayer?.hand.find((c) => c.id === selectedCardId) ?? null;

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3200);
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createJackarooGame(
        roomId,
        {
          uid: currentUser.uid,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        selectedMaxPlayers,
        selectedBet,
      );
    } catch (err: any) {
      showError(err.message || 'نەتوانرا یاری دروست بکرێت');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await joinJackarooGame(roomId, {
        uid: currentUser.uid,
        username: currentUser.username,
        avatar: currentUser.avatar,
      });
    } catch (err: any) {
      showError(err.message || 'نەتوانرا بەشداری بکەیت');
    } finally {
      setBusy(false);
    }
  };

  const handleStartEarly = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startJackarooGameNow(roomId, currentUser.uid);
    } catch (err: any) {
      showError(err.message || 'نەتوانرا دەست پێبکرێت');
    } finally {
      setBusy(false);
    }
  };

  const handleMyMarbleClick = async (marbleIndex: number) => {
    if (!activeGame || !isMyTurn || !selectedCard || busy) return;

    if (selectedCard.rank === 'J' && jackSwapMode) {
      const mPos = myPlayer?.marbles[marbleIndex] ?? -1;
      if (mPos < 0 || mPos >= 48) {
        showError('تەنها مۆرەی سەر ڕێڕەو هەڵبژێرە بۆ گۆڕینەوە');
        return;
      }
      setSelectedMyMarbleForSwap(marbleIndex);
      return;
    }

    setBusy(true);
    try {
      await playJackarooCardMove(
        roomId,
        currentUser.uid,
        selectedCard.id,
        marbleIndex,
        useAceEleven,
      );
      setUseAceEleven(false);
      setJackSwapMode(false);
    } catch (err: any) {
      showError(err.message || 'ئەم جووڵەیە دروست نییە');
    } finally {
      setBusy(false);
    }
  };

  const handleOpponentMarbleSwap = async (targetPlayerIndex: number, targetMarbleIndex: number) => {
    if (
      !activeGame ||
      !isMyTurn ||
      !selectedCard ||
      selectedCard.rank !== 'J' ||
      !jackSwapMode ||
      selectedMyMarbleForSwap === null ||
      busy
    ) {
      return;
    }

    setBusy(true);
    try {
      await playJackSwapMove(
        roomId,
        currentUser.uid,
        selectedCard.id,
        selectedMyMarbleForSwap,
        targetPlayerIndex,
        targetMarbleIndex,
      );
      setJackSwapMode(false);
      setSelectedMyMarbleForSwap(null);
    } catch (err: any) {
      showError(err.message || 'نەتوانرا مۆرەکان بگۆڕدرێنەوە');
    } finally {
      setBusy(false);
    }
  };

  const handleBurnCard = async () => {
    if (!activeGame || !isMyTurn || !selectedCard || busy) return;
    setBusy(true);
    try {
      await burnJackarooCard(roomId, currentUser.uid, selectedCard.id);
      setJackSwapMode(false);
      setSelectedMyMarbleForSwap(null);
    } catch (err: any) {
      showError(err.message || 'نەتوانرا کارت بسووتێنرێت');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseTable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await closeJackarooGame(roomId);
      onClose();
    } catch (err: any) {
      showError(err.message || 'نەتوانرا دابخرێت');
    } finally {
      setBusy(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Board Coordinate Helpers (300x300 SVG Coordinate Space)
     Center = (150, 150), Outer Track Radius = 114
     ───────────────────────────────────────────────────────────── */
  const getTrackCoords = (globalIndex: number) => {
    // Angle: slot 0 starts at bottom-left/bottom (-90deg + offset)
    const angleDeg = (globalIndex / 48) * 360 - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const r = 114;
    return {
      x: 150 + r * Math.cos(rad),
      y: 150 + r * Math.sin(rad),
    };
  };

  const getHomeCoords = (slotIndex: number, homeStep: number) => {
    // homeStep is 0..3 (for relative pos 48..51)
    const angleDeg = ((slotIndex * 12) / 48) * 360 - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const r = 88 - homeStep * 15;
    return {
      x: 150 + r * Math.cos(rad),
      y: 150 + r * Math.sin(rad),
    };
  };

  const getBaseCornerCoords = (slotIndex: number, marbleIdx: number) => {
    // 4 corners of the 300x300 board
    const corners = [
      { cx: 42, cy: 42 },   // Slot 0 (Top-Left)
      { cx: 258, cy: 42 },  // Slot 1 (Top-Right)
      { cx: 258, cy: 258 }, // Slot 2 (Bottom-Right)
      { cx: 42, cy: 258 },  // Slot 3 (Bottom-Left)
    ];
    const base = corners[slotIndex % 4];
    const offsets = [
      { dx: -11, dy: -11 },
      { dx: 11, dy: -11 },
      { dx: -11, dy: 11 },
      { dx: 11, dy: 11 },
    ];
    return {
      x: base.cx + offsets[marbleIdx].dx,
      y: base.cy + offsets[marbleIdx].dy,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md select-none">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="relative flex max-h-[96dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#171324] via-[#110e1b] to-[#0b0914] text-white shadow-[0_0_50px_rgba(245,158,11,0.18)]"
      >
        {/* ── HEADER ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/30 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-black shadow-lg shadow-amber-500/25 font-black text-sm">
              🃏
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black tracking-wide text-amber-300">
                  VIP JACKAROO · جاکۆرۆ
                </h2>
                {activeGame && (
                  <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2 py-0.2 text-[9px] font-bold text-amber-300">
                    {activeGame.maxPlayers} کەسی
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                یاری ئەسڵی جاکۆرۆ بە تەختە و کارتی تایبەت (٢ یان ٣ یان ٤ یاریزان)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeGame && canManageGame && (
              <button
                onClick={handleCloseTable}
                disabled={busy}
                className="flex h-8 items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/15 px-2.5 text-[10px] font-black text-rose-300 hover:bg-rose-500/25 active:scale-95"
                title="هەڵوەشاندنەوەی یاری (Cancel Game)"
              >
                <span>داخستنی یاری</span>
              </button>
            )}
            <button
              onClick={() => setShowRules((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-300 hover:bg-white/10"
              title="یاساکانی جاکۆرۆ"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── OPTIONAL RULES POPOVER ── */}
        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-amber-500/20 bg-amber-950/30 px-4 py-2.5 text-[11px] leading-relaxed text-amber-100"
            >
              <p className="font-bold text-amber-300 mb-1">🃏 یاساکانی کارتەکانی جاکۆرۆ:</p>
              <ul className="space-y-0.5 text-[10px] text-slate-200">
                <li>• <strong>A (ئەس)</strong>: هێنانە دەرەوەی مۆرە لە بنکە، یان ١ یان ١١ هەنگاو.</li>
                <li>• <strong>K (شا)</strong>: هێنانە دەرەوەی مۆرە لە بنکە، یان ١٣ هەنگاو.</li>
                <li>• <strong>J (جاک)</strong>: گۆڕینەوەی مۆرەیەک لەگەڵ مۆرەی بەرامبەر، یان ١١ هەنگاو.</li>
                <li>• <strong>4 (چوار)</strong>: گەڕانەوە بۆ دواوە بە ٤ هەنگاو (-4) بۆ نزیکبوونەوە لە ماڵ!</li>
                <li>• <strong>Q (١٢ هەنگاو)</strong> · <strong>10 (١٠ هەنگاو)</strong> · <strong>7 (٧ هەنگاو)</strong> · <strong>5 (٥ هەنگاو)</strong>.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ERROR TOAST ── */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-4 mt-2 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-center text-xs font-bold text-rose-200"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BODY CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* STATE 1: NO ACTIVE GAME → CREATE TABLE (2, 3, OR 4 PLAYERS) */}
          {!activeGame && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-violet-500/5 to-transparent p-4 text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-2xl shadow-lg shadow-amber-500/30">
                  🃏
                </div>
                <h3 className="text-base font-black text-white">مێزی نوێی جاکۆرۆ دروست بکە</h3>
                <p className="mt-1 text-xs text-slate-400">
                  ژمارەی یاریزانەکان هەڵبژێرە (٢ کەس، ٣ کەس، یان ٤ کەس) و دەست بە یاری بکە!
                </p>
              </div>

              {/* Player Count Selector: 2, 3, or 4 Players */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-300">
                  ژمارەی یاریزانەکان هەڵبژێرە:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {([2, 3, 4] as const).map((cnt) => {
                    const active = selectedMaxPlayers === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setSelectedMaxPlayers(cnt)}
                        className={`flex flex-col items-center justify-center rounded-2xl border py-3 transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/15 scale-[1.02]'
                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <Users className="h-5 w-5 mb-1" />
                        <span className="text-sm font-black">{cnt} کەس</span>
                        <span className="text-[10px] opacity-75">{cnt} یاریزان</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coin Wager Selector */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-300">
                  بڕی گرەوی کۆین (بۆ هەر یاریزانێک):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BET_OPTIONS.map((bet) => {
                    const active = selectedBet === bet;
                    return (
                      <button
                        key={bet}
                        type="button"
                        onClick={() => setSelectedBet(bet)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                        <span>{bet === 0 ? 'بێبەرامبەر (0)' : bet.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 py-3.5 text-sm font-black text-black shadow-xl shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>کردنەوەی مێزی جاکۆرۆ ({selectedMaxPlayers} کەسی)</span>
              </button>
            </div>
          )}

          {/* STATE 2: WAITING FOR PLAYERS (2, 3, OR 4) */}
          {activeGame && activeGame.status === 'waiting' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <div>
                  <p className="text-xs font-black text-amber-300">
                    چاوەڕوانی یاریزانەکان ({activeGame.players.length} / {activeGame.maxPlayers})
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    خەڵاتی گشتی: <strong className="text-amber-400">{activeGame.totalPot} کۆین</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-black/40 px-3 py-1.5 text-xs font-bold text-amber-300">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span>گرەو: {activeGame.betAmount}</span>
                </div>
              </div>

              {/* Player Slots */}
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: activeGame.maxPlayers }).map((_, idx) => {
                  const p = activeGame.players[idx];
                  const slotIdx = activeGame.maxPlayers === 2 && idx === 1 ? 2 : idx;
                  const meta = JACKAROO_COLOR_META[
                    (['red', 'blue', 'emerald', 'amber'] as const)[slotIdx % 4]
                  ];
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 rounded-2xl border p-3 ${
                        p
                          ? `${meta.border}/50 bg-white/[0.05]`
                          : 'border-dashed border-white/15 bg-white/[0.02]'
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-sm text-white ${
                          p ? meta.bg : 'bg-white/10 text-slate-500'
                        }`}
                      >
                        {p ? p.username.charAt(0).toUpperCase() : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {p ? p.username : 'بەتاڵە...'}
                        </p>
                        <p className={`text-[10px] font-semibold ${meta.text}`}>
                          ڕەنگی {meta.kurdishName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Join / Start Early / Cancel Buttons */}
              <div className="space-y-2 pt-1">
                {myPlayerIndex === -1 &&
                  activeGame.players.length < activeGame.maxPlayers && (
                    <button
                      onClick={handleJoin}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-black shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4 fill-black" />
                      <span>بەشداریکردن لە یاری ({activeGame.betAmount} کۆین)</span>
                    </button>
                  )}

                {activeGame.hostUid === currentUser.uid &&
                  activeGame.players.length >= 2 && (
                    <button
                      onClick={handleStartEarly}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-xs font-black text-black shadow-lg active:scale-95"
                    >
                      <Flame className="h-4 w-4" />
                      <span>
                        دەستپێکردن ئێستا بە {activeGame.players.length} یاریزان
                      </span>
                    </button>
                  )}

                {canManageGame && (
                  <button
                    onClick={handleCloseTable}
                    disabled={busy}
                    className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                  >
                    هەڵوەشاندنەوەی مێز و گەڕاندنەوەی کۆین
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STATE 3: ACTIVE OR COMPLETED JACKAROO BOARD + CARDS */}
          {activeGame &&
            (activeGame.status === 'playing' || activeGame.status === 'completed') && (
              <div className="space-y-2.5">
                {/* Status Banner */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-amber-300">
                      {activeGame.lastActionText}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>گەڕی #{activeGame.roundNumber}</span>
                      <span>·</span>
                      <span className="text-amber-400 font-bold">
                        خەڵات: {activeGame.totalPot} کۆین
                      </span>
                    </div>
                  </div>

                  {/* Last Played Card Mini Preview */}
                  {activeGame.lastPlayedCard && (
                    <div className="ml-2 flex h-9 w-7 shrink-0 flex-col items-center justify-center rounded-lg border border-amber-400/50 bg-white text-[10px] font-black shadow">
                      <span
                        className={
                          activeGame.lastPlayedCard.suit === '♥' ||
                          activeGame.lastPlayedCard.suit === '♦'
                            ? 'text-rose-600'
                            : 'text-slate-900'
                        }
                      >
                        {activeGame.lastPlayedCard.rank}
                        {activeGame.lastPlayedCard.suit}
                      </span>
                    </div>
                  )}
                </div>

                {/* Players Turn Strip */}
                <div className="grid grid-cols-4 gap-1.5">
                  {activeGame.players.map((p, idx) => {
                    const isTurn =
                      activeGame.status === 'playing' &&
                      activeGame.currentTurnIndex === idx;
                    const meta = JACKAROO_COLOR_META[p.color];
                    const homeCount = p.marbles.filter((m) => m >= 48).length;
                    return (
                      <div
                        key={p.uid}
                        className={`flex flex-col items-center rounded-xl border px-1.5 py-1.5 transition-all ${
                          isTurn
                            ? `${meta.border} bg-white/10 shadow-md scale-[1.03]`
                            : 'border-white/10 bg-white/[0.02] opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-1 max-w-full">
                          <span className={`h-2 w-2 rounded-full ${meta.bg}`} />
                          <span className="truncate text-[10px] font-bold text-white">
                            {p.username}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400">
                          ماڵ: {homeCount}/4 · کارت: {p.hand.length}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ── LUXURY CIRCULAR WOOD & GOLD JACKAROO BOARD ── */}
                <div className="relative mx-auto flex items-center justify-center">
                  <svg
                    viewBox="0 0 300 300"
                    className="h-[285px] w-[285px] sm:h-[310px] sm:w-[310px] rounded-3xl border-2 border-amber-500/40 bg-[radial-gradient(circle_at_center,#2d1f14_0%,#181009_72%,#0d0906_100%)] shadow-[inset_0_0_35px_rgba(0,0,0,0.85)]"
                  >
                    {/* Decorative Wood & Gold Rings */}
                    <circle
                      cx="150"
                      cy="150"
                      r="126"
                      fill="none"
                      stroke="rgba(251,191,36,0.22)"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="150"
                      cy="150"
                      r="114"
                      fill="none"
                      stroke="rgba(251,191,36,0.35)"
                      strokeWidth="14"
                    />
                    <circle
                      cx="150"
                      cy="150"
                      r="34"
                      fill="rgba(251,191,36,0.08)"
                      stroke="rgba(251,191,36,0.35)"
                      strokeWidth="1.5"
                    />
                    <text
                      x="150"
                      y="153"
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="9"
                      fontWeight="900"
                      letterSpacing="1"
                    >
                      JACKAROO
                    </text>

                    {/* 48 Outer Track Holes */}
                    {Array.from({ length: 48 }).map((_, gIdx) => {
                      const { x, y } = getTrackCoords(gIdx);
                      const isStartTile = gIdx % 12 === 0;
                      const startSlot = gIdx / 12;
                      const startColorHex = isStartTile
                        ? JACKAROO_COLOR_META[
                            (['red', 'blue', 'emerald', 'amber'] as const)[startSlot % 4]
                          ].hex
                        : '#334155';

                      return (
                        <circle
                          key={`hole-${gIdx}`}
                          cx={x}
                          cy={y}
                          r={isStartTile ? 5.2 : 3.4}
                          fill="#0f172a"
                          stroke={isStartTile ? startColorHex : 'rgba(255,255,255,0.22)'}
                          strokeWidth={isStartTile ? 2 : 1}
                        />
                      );
                    })}

                    {/* 4 Safe Home Zones (4 slots per quadrant) */}
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const colorKey = (['red', 'blue', 'emerald', 'amber'] as const)[
                        slotIdx % 4
                      ];
                      const hex = JACKAROO_COLOR_META[colorKey].hex;
                      return [0, 1, 2, 3].map((hStep) => {
                        const { x, y } = getHomeCoords(slotIdx, hStep);
                        return (
                          <circle
                            key={`home-${slotIdx}-${hStep}`}
                            cx={x}
                            cy={y}
                            r={4.2}
                            fill="rgba(15,23,42,0.9)"
                            stroke={hex}
                            strokeWidth="1.6"
                          />
                        );
                      });
                    })}

                    {/* 4 Corner Bases */}
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const corners = [
                        { cx: 42, cy: 42 },
                        { cx: 258, cy: 42 },
                        { cx: 258, cy: 258 },
                        { cx: 42, cy: 258 },
                      ];
                      const c = corners[slotIdx];
                      const colorKey = (['red', 'blue', 'emerald', 'amber'] as const)[
                        slotIdx % 4
                      ];
                      const hex = JACKAROO_COLOR_META[colorKey].hex;
                      return (
                        <g key={`base-box-${slotIdx}`}>
                          <rect
                            x={c.cx - 24}
                            y={c.cy - 24}
                            width="48"
                            height="48"
                            rx="12"
                            fill="rgba(15,23,42,0.75)"
                            stroke={hex}
                            strokeWidth="1.8"
                          />
                          {[0, 1, 2, 3].map((mIdx) => {
                            const pt = getBaseCornerCoords(slotIdx, mIdx);
                            return (
                              <circle
                                key={`base-hole-${slotIdx}-${mIdx}`}
                                cx={pt.x}
                                cy={pt.y}
                                r={5}
                                fill="#090d16"
                                stroke={hex}
                                strokeWidth="1"
                                opacity="0.5"
                              />
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Render All Players' 4 Marbles */}
                    {activeGame.players.map((p, pIdx) => {
                      const meta = JACKAROO_COLOR_META[p.color];
                      const isMe = pIdx === myPlayerIndex;

                      return p.marbles.map((relPos, mIdx) => {
                        let coords = { x: 0, y: 0 };
                        if (relPos === -1) {
                          coords = getBaseCornerCoords(p.slotIndex, mIdx);
                        } else if (relPos >= 48) {
                          coords = getHomeCoords(p.slotIndex, relPos - 48);
                        } else {
                          const gIdx = getGlobalTrackIndex(p.slotIndex, relPos);
                          coords = getTrackCoords(gIdx);
                        }

                        // Check if this marble is currently clickable by the active user
                        let canClick = false;
                        if (isMyTurn && selectedCard) {
                          if (isMe) {
                            if (selectedCard.rank === 'J' && jackSwapMode) {
                              canClick = relPos >= 0 && relPos < 48;
                            } else {
                              canClick = canMoveMarbleWithCard(
                                activeGame,
                                pIdx,
                                mIdx,
                                selectedCard,
                                useAceEleven,
                              ).valid;
                            }
                          } else if (
                            !isMe &&
                            selectedCard.rank === 'J' &&
                            jackSwapMode &&
                            selectedMyMarbleForSwap !== null
                          ) {
                            // Opponent marble is swappable if on outer track and not protected at 0
                            canClick = relPos > 0 && relPos < 48;
                          }
                        }

                        const isSelectedForSwap =
                          isMe && jackSwapMode && selectedMyMarbleForSwap === mIdx;

                        return (
                          <g
                            key={`marble-${p.uid}-${mIdx}`}
                            onClick={() => {
                              if (!canClick) return;
                              if (isMe) {
                                handleMyMarbleClick(mIdx);
                              } else {
                                handleOpponentMarbleSwap(pIdx, mIdx);
                              }
                            }}
                            style={{ cursor: canClick ? 'pointer' : 'default' }}
                          >
                            {/* Highlight Halo if Movable */}
                            {canClick && (
                              <circle
                                cx={coords.x}
                                cy={coords.y}
                                r={9.5}
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="2"
                                strokeDasharray="3 2"
                              >
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  from={`0 ${coords.x} ${coords.y}`}
                                  to={`360 ${coords.x} ${coords.y}`}
                                  dur="2s"
                                  repeatCount="indefinite"
                                />
                              </circle>
                            )}

                            {/* Marble Sphere */}
                            <circle
                              cx={coords.x}
                              cy={coords.y}
                              r={isSelectedForSwap ? 7.5 : 6.2}
                              fill={meta.hex}
                              stroke={canClick ? '#ffffff' : '#000000'}
                              strokeWidth={canClick ? 2 : 1.2}
                            />
                            {/* Specular Shine */}
                            <circle
                              cx={coords.x - 1.8}
                              cy={coords.y - 1.8}
                              r={1.8}
                              fill="#ffffff"
                              opacity="0.75"
                            />
                          </g>
                        );
                      });
                    })}
                  </svg>
                </div>

                {/* ── COMPLETED WINNER BANNER ── */}
                {activeGame.status === 'completed' && (
                  <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 p-4 text-center">
                    <Trophy className="mx-auto h-8 w-8 text-amber-400 mb-1" />
                    <h4 className="text-sm font-black text-white">
                      🏆 {activeGame.winnerUsername} یاری جاکۆرۆی بردەوە!
                    </h4>
                    <p className="text-xs text-amber-300 mt-0.5">
                      خەڵاتی وەرگیراو: {activeGame.totalPot} کۆین
                    </p>
                    <button
                      onClick={handleCloseTable}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-black"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>یاری نوێ</span>
                    </button>
                  </div>
                )}

                {/* ── MY HAND & SPECIAL CARD CONTROLS ── */}
                {activeGame.status === 'playing' && myPlayer && (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">
                        {isMyTurn ? (
                          <span className="text-emerald-400 animate-pulse">
                            🟢 نۆرەی تۆیە! کارتێک هەڵبژێرە و کرتە لە مۆرەکەت بکە
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            چاوەڕوانی نۆرەی{' '}
                            {activeGame.players[activeGame.currentTurnIndex]?.username}...
                          </span>
                        )}
                      </span>

                      {isMyTurn && selectedCard && (
                        <button
                          onClick={handleBurnCard}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/25 active:scale-95"
                        >
                          <Flame className="h-3 w-3 text-rose-400" />
                          <span>سووتاندنی کارت</span>
                        </button>
                      )}
                    </div>

                    {/* Special Mode Toggles for Ace (1 vs 11) and Jack (11 vs Swap) */}
                    {isMyTurn && selectedCard?.rank === 'A' && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 p-1.5">
                        <button
                          type="button"
                          onClick={() => setUseAceEleven(false)}
                          className={`flex-1 rounded-lg py-1 text-[11px] font-bold transition ${
                            !useAceEleven
                              ? 'bg-amber-400 text-black'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          چوونە دەرەوە / +1 هەنگاو
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseAceEleven(true)}
                          className={`flex-1 rounded-lg py-1 text-[11px] font-bold transition ${
                            useAceEleven
                              ? 'bg-amber-400 text-black'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          +11 هەنگاو بۆ پێشەوە
                        </button>
                      </div>
                    )}

                    {isMyTurn && selectedCard?.rank === 'J' && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setJackSwapMode(false);
                            setSelectedMyMarbleForSwap(null);
                          }}
                          className={`flex-1 rounded-lg py-1 text-[11px] font-bold transition ${
                            !jackSwapMode
                              ? 'bg-amber-400 text-black'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          +11 هەنگاو بۆ پێشەوە
                        </button>
                        <button
                          type="button"
                          onClick={() => setJackSwapMode(true)}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-bold transition ${
                            jackSwapMode
                              ? 'bg-violet-500 text-white'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                          <span>گۆڕینەوەی مۆرە (Swap)</span>
                        </button>
                      </div>
                    )}

                    {jackSwapMode && isMyTurn && (
                      <p className="text-center text-[10px] font-semibold text-violet-300">
                        {selectedMyMarbleForSwap === null
                          ? '١) سەرەتا کرتە لە مۆرەی خۆت لەسەر ڕێڕەوەکە بکە'
                          : '٢) ئێستا کرتە لە مۆرەی بەرامبەر بکە بۆ گۆڕینەوە!'}
                      </p>
                    )}

                    {/* 4 Playing Cards Hand */}
                    <div className="flex items-center justify-center gap-2.5 pt-1">
                      {myPlayer.hand.map((card) => {
                        const isSelected = selectedCardId === card.id;
                        const isRedSuit = card.suit === '♥' || card.suit === '♦';
                        return (
                          <motion.button
                            key={card.id}
                            type="button"
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedCardId(card.id);
                              setUseAceEleven(false);
                              setJackSwapMode(false);
                              setSelectedMyMarbleForSwap(null);
                            }}
                            className={`relative flex h-20 w-14 flex-col justify-between rounded-xl border-2 bg-gradient-to-b from-white to-slate-100 p-1.5 shadow-lg transition-all ${
                              isSelected
                                ? 'border-amber-400 -translate-y-2 ring-2 ring-amber-400/60 shadow-amber-500/30'
                                : 'border-slate-300 opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div
                              className={`text-left text-xs font-black leading-none ${
                                isRedSuit ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              <div>{card.rank}</div>
                              <div className="text-[10px]">{card.suit}</div>
                            </div>
                            <div
                              className={`self-center text-lg leading-none ${
                                isRedSuit ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {card.suit}
                            </div>
                            <div
                              className={`text-right text-[9px] font-bold leading-none ${
                                isRedSuit ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {card.rank}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {selectedCard && (
                      <p className="text-center text-[10px] text-amber-300/90">
                        {CARD_POWER_HINT[selectedCard.rank] ||
                          `${selectedCard.rank} هەنگاو بۆ پێشەوە`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
