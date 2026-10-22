import {
  ref,
  set,
  get,
  remove,
  onValue,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import {
  JACKAROO_COLORS,
  type JackarooGame,
  type JackarooPlayer,
  type JackarooCard,
  type CardRank,
  type CardSuit,
} from '../types';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   Jackaroo (جاکۆرۆ) Real-Time Board & Card Game Service
   Supports 2, 3, or 4 Players, Escrow Coin Bets, Full Deck
   Dealing, Base Exit (A/K), Backwards 4, Jack Swap, and Eating!
   ───────────────────────────────────────────────────────────── */

const SUITS: CardSuit[] = ['♠', '♥', '♦', '♣'];
const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function buildShuffledDeck(): JackarooCard[] {
  const deck: JackarooCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}${suit}_${Math.random().toString(36).slice(2, 7)}`,
        rank,
        suit,
      });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

/**
 * Converts a player's relative marble position (0..47) to the global board track index (0..47).
 */
export function getGlobalTrackIndex(slotIndex: number, relativePos: number): number {
  if (relativePos < 0 || relativePos >= 48) return -1;
  return (slotIndex * 12 + relativePos) % 48;
}

/**
 * Normalizes a JackarooGame object retrieved from Firebase RTDB
 * (since Firebase strips empty arrays like `hand: []`).
 */
function normalizeJackarooGame(raw: any): JackarooGame | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawPlayers = Array.isArray(raw.players)
    ? raw.players
    : raw.players && typeof raw.players === 'object'
      ? Object.values(raw.players)
      : [];

  const players: JackarooPlayer[] = rawPlayers.filter(Boolean).map((p: any, idx: number) => ({
    uid: p.uid || '',
    username: p.username || 'Player',
    avatar: p.avatar || '',
    color: p.color || JACKAROO_COLORS[idx % 4],
    slotIndex: typeof p.slotIndex === 'number' ? p.slotIndex : idx,
    marbles: Array.isArray(p.marbles) && p.marbles.length === 4 ? p.marbles.map(Number) : [-1, -1, -1, -1],
    hand: Array.isArray(p.hand)
      ? p.hand.filter(Boolean)
      : p.hand && typeof p.hand === 'object'
        ? Object.values(p.hand)
        : [],
  }));

  const rawDeck = Array.isArray(raw.deck)
    ? raw.deck.filter(Boolean)
    : raw.deck && typeof raw.deck === 'object'
      ? Object.values(raw.deck)
      : [];

  return {
    id: raw.id || 'jackaroo',
    roomId: raw.roomId || '',
    hostUid: raw.hostUid || '',
    maxPlayers: (raw.maxPlayers === 2 || raw.maxPlayers === 3 || raw.maxPlayers === 4) ? raw.maxPlayers : 4,
    betAmount: Number(raw.betAmount || 0),
    totalPot: Number(raw.totalPot || 0),
    status: raw.status || 'waiting',
    players,
    currentTurnIndex: Number(raw.currentTurnIndex || 0),
    deck: rawDeck,
    lastActionText: raw.lastActionText || '',
    lastPlayedCard: raw.lastPlayedCard || null,
    winnerUid: raw.winnerUid || null,
    winnerUsername: raw.winnerUsername || null,
    roundNumber: Number(raw.roundNumber || 1),
    createdAt: Number(raw.createdAt || Date.now()),
  };
}

async function deductCoins(uid: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const coinsRef = ref(database, `users/${uid}/coins`);
  let deducted = false;
  await runTransaction(coinsRef, (current) => {
    const balance = Number(current ?? 0);
    if (balance < amount) {
      return; // Abort
    }
    deducted = true;
    return balance - amount;
  });
  if (!deducted) {
    throw new Error(`کۆینی پێویستت نییە! پێویستت بە ${amount} کۆینە.`);
  }
}

async function creditCoins(uid: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const coinsRef = ref(database, `users/${uid}/coins`);
  await runTransaction(coinsRef, (current) => Number(current ?? 0) + amount);
}

/**
 * Creates a new Jackaroo table in the room for 2, 3, or 4 players.
 */
export async function createJackarooGame(
  roomId: string,
  host: { uid: string; username: string; avatar?: string },
  maxPlayers: 2 | 3 | 4,
  betAmount: number,
): Promise<void> {
  await deductCoins(host.uid, betAmount);

  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const newGame: JackarooGame = {
    id: `jkr_${Date.now()}`,
    roomId,
    hostUid: host.uid,
    maxPlayers,
    betAmount,
    totalPot: betAmount,
    status: 'waiting',
    players: [
      {
        uid: host.uid,
        username: host.username,
        avatar: host.avatar || '',
        color: 'red',
        slotIndex: 0,
        marbles: [-1, -1, -1, -1],
        hand: [],
      },
    ],
    currentTurnIndex: 0,
    deck: [],
    lastActionText: `${host.username} مێزی جاکۆرۆی دروست کرد (${maxPlayers} یاریزان)`,
    lastPlayedCard: null,
    winnerUid: null,
    winnerUsername: null,
    roundNumber: 1,
    createdAt: Date.now(),
  };

  await set(gameRef, newGame);
  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `🃏 ${host.username} مێزی جاکۆرۆی (${maxPlayers} کەسی) کردەوە بە گرەوی ${betAmount} کۆین!`,
  );
}

/**
 * Joins an existing waiting Jackaroo table. Auto-starts if maxPlayers is reached.
 */
export async function joinJackarooGame(
  roomId: string,
  user: { uid: string; username: string; avatar?: string },
): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const current = normalizeJackarooGame(snap.val());

  if (!current || current.status !== 'waiting') {
    throw new Error('ئەم یارییە بەردەست نییە بۆ بەشداریکردن.');
  }
  if (current.players.some((p) => p.uid === user.uid)) {
    throw new Error('تۆ پێشتر بەشداریت کردووە!');
  }
  if (current.players.length >= current.maxPlayers) {
    throw new Error('مێزی یارییەکە پڕ بووە.');
  }

  await deductCoins(user.uid, current.betAmount);

  const nextIdx = current.players.length;
  // For 2 players, place them opposite each other (slots 0 and 2) for balanced board distance!
  const slotIndex =
    current.maxPlayers === 2 && nextIdx === 1 ? 2 : nextIdx;

  const newPlayer: JackarooPlayer = {
    uid: user.uid,
    username: user.username,
    avatar: user.avatar || '',
    color: JACKAROO_COLORS[slotIndex % 4],
    slotIndex,
    marbles: [-1, -1, -1, -1],
    hand: [],
  };

  const updatedPlayers = [...current.players, newPlayer];
  const updatedPot = current.totalPot + current.betAmount;

  if (updatedPlayers.length === current.maxPlayers) {
    // Auto-start and deal 4 cards to each player
    let deck = buildShuffledDeck();
    const dealtPlayers = updatedPlayers.map((p) => {
      const hand = deck.slice(0, 4);
      deck = deck.slice(4);
      return { ...p, hand };
    });

    const startedGame: JackarooGame = {
      ...current,
      players: dealtPlayers,
      totalPot: updatedPot,
      status: 'playing',
      currentTurnIndex: 0,
      deck,
      lastActionText: `یاری جاکۆرۆ دەستی پێکرد! نۆرەی ${dealtPlayers[0].username} یە`,
    };
    await set(gameRef, startedGame);
  } else {
    const waitingGame: JackarooGame = {
      ...current,
      players: updatedPlayers,
      totalPot: updatedPot,
      lastActionText: `${user.username} هاتە ناو یارییەکە (${updatedPlayers.length}/${current.maxPlayers})`,
    };
    await set(gameRef, waitingGame);
  }
}

/**
 * Allows the host to start the game manually once at least 2 players have joined.
 */
export async function startJackarooGameNow(roomId: string, callerUid: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const current = normalizeJackarooGame(snap.val());

  if (!current || current.status !== 'waiting') return;
  if (current.hostUid !== callerUid) {
    throw new Error('تەنها خاوەنی مێزەکە دەتوانێت یارییەکە دەست پێبکات.');
  }
  if (current.players.length < 2) {
    throw new Error('لانیکەم ٢ یاریزان پێویستە بۆ دەستپێکردن.');
  }

  let deck = buildShuffledDeck();
  const dealtPlayers = current.players.map((p, idx) => {
    const slotIndex = current.players.length === 2 && idx === 1 ? 2 : idx;
    const hand = deck.slice(0, 4);
    deck = deck.slice(4);
    return {
      ...p,
      slotIndex,
      color: JACKAROO_COLORS[slotIndex % 4],
      hand,
    };
  });

  const startedGame: JackarooGame = {
    ...current,
    players: dealtPlayers,
    status: 'playing',
    currentTurnIndex: 0,
    deck,
    lastActionText: `یاری جاکۆرۆ دەستی پێکرد! نۆرەی ${dealtPlayers[0].username} یە`,
  };

  await set(gameRef, startedGame);
}

/**
 * Helper: gets numeric forward steps for a card rank.
 */
export function getCardStepValue(rank: CardRank): number {
  switch (rank) {
    case 'A':
      return 1; // Can also exit base or move 11
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return -4; // Moves backwards 4 steps!
    case '5':
      return 5;
    case '6':
      return 6;
    case '7':
      return 7;
    case '8':
      return 8;
    case '9':
      return 9;
    case '10':
      return 10;
    case 'J':
      return 11; // Can also swap with opponent marble
    case 'Q':
      return 12;
    case 'K':
      return 13; // Can also exit base
  }
}

/**
 * Checks if a specific marble of `player` can legally move with `card`.
 */
export function canMoveMarbleWithCard(
  game: JackarooGame,
  playerIndex: number,
  marbleIndex: number,
  card: JackarooCard,
  useAceEleven: boolean = false,
): { valid: boolean; targetPos: number; reason?: string } {
  const player = game.players[playerIndex];
  if (!player) return { valid: false, targetPos: -1 };
  const currentPos = player.marbles[marbleIndex];

  // Case 1: Marble is in Base (-1)
  if (currentPos === -1) {
    if (card.rank !== 'A' && card.rank !== 'K') {
      return { valid: false, targetPos: -1, reason: 'تەنها کارتی A یان K دەتوانێت مۆرە لە بنکە دەربهێنێت' };
    }
    // Check if player already has their own marble on their start tile (0)
    if (player.marbles.includes(0)) {
      return { valid: false, targetPos: -1, reason: 'شوێنی دەستپێک بە مۆرەی خۆت گیراوە' };
    }
    return { valid: true, targetPos: 0 };
  }

  // Case 2: Marble is on track (0..47) or inside Home (48..51)
  const steps =
    card.rank === 'A' && useAceEleven ? 11 : getCardStepValue(card.rank);

  // Backward movement with '4' (-4 steps)
  if (steps < 0) {
    if (currentPos >= 48) {
      // Cannot move backwards inside safe Home zone
      return { valid: false, targetPos: -1, reason: 'لە ناو ماڵی سەلامەت ناتوانیت بگەڕێیتەوە دواوە' };
    }
    // Wrap around track (e.g. from 0 - 4 = 44, right before home entrance!)
    const targetPos = (currentPos + steps + 48) % 48;
    if (player.marbles.includes(targetPos)) {
      return { valid: false, targetPos: -1, reason: 'مۆرەی خۆت لەو خانەیەدایە' };
    }
    // Check if landing on a protected opponent start tile
    const targetGlobal = getGlobalTrackIndex(player.slotIndex, targetPos);
    const blockedByProtected = game.players.some(
      (other, idx) =>
        idx !== playerIndex &&
        other.marbles.some((m) => m === 0 && getGlobalTrackIndex(other.slotIndex, 0) === targetGlobal),
    );
    if (blockedByProtected) {
      return { valid: false, targetPos: -1, reason: 'ئەو خانەیە پارێزراوە' };
    }
    return { valid: true, targetPos };
  }

  // Forward movement
  const targetPos = currentPos + steps;
  if (targetPos > 51) {
    return { valid: false, targetPos: -1, reason: 'ژمارەی هەنگاوەکان لە خانەی کۆتایی زیاترە' };
  }
  if (player.marbles.includes(targetPos)) {
    return { valid: false, targetPos: -1, reason: 'مۆرەی خۆت لەو خانەیەدایە' };
  }

  // Check if passing or landing on a protected start tile on outer track
  if (targetPos < 48) {
    const targetGlobal = getGlobalTrackIndex(player.slotIndex, targetPos);
    const blockedByProtected = game.players.some(
      (other, idx) =>
        idx !== playerIndex &&
        other.marbles.some((m) => m === 0 && getGlobalTrackIndex(other.slotIndex, 0) === targetGlobal),
    );
    if (blockedByProtected) {
      return { valid: false, targetPos: -1, reason: 'مۆرەی پارێزراو لەسەر خانەی سەرەتایە' };
    }
  }

  return { valid: true, targetPos };
}

/**
 * Advances to the next player's turn and deals a new round of 4 cards if all hands are empty.
 */
function advanceTurnAndDealIfNeeded(
  players: JackarooPlayer[],
  currentTurnIndex: number,
  deck: JackarooCard[],
  roundNumber: number,
  actionPrefix: string,
): {
  players: JackarooPlayer[];
  nextTurnIndex: number;
  deck: JackarooCard[];
  roundNumber: number;
  actionText: string;
} {
  const nextTurnIndex = (currentTurnIndex + 1) % players.length;
  const allHandsEmpty = players.every((p) => p.hand.length === 0);

  if (!allHandsEmpty) {
    return {
      players,
      nextTurnIndex,
      deck,
      roundNumber,
      actionText: `${actionPrefix} · نۆرەی ${players[nextTurnIndex].username}`,
    };
  }

  // Deal 4 new cards to each player
  let nextDeck = [...deck];
  let nextRound = roundNumber + 1;
  if (nextDeck.length < players.length * 4) {
    nextDeck = buildShuffledDeck();
  }

  const dealtPlayers = players.map((p) => {
    const hand = nextDeck.slice(0, 4);
    nextDeck = nextDeck.slice(4);
    return { ...p, hand };
  });

  return {
    players: dealtPlayers,
    nextTurnIndex,
    deck: nextDeck,
    roundNumber: nextRound,
    actionText: `${actionPrefix} · دابەشکردنی کارتی نوێ (گەڕی ${nextRound})`,
  };
}

/**
 * Executes a marble move (or base exit) using a card from the current player's hand.
 */
export async function playJackarooCardMove(
  roomId: string,
  playerUid: string,
  cardId: string,
  marbleIndex: number,
  useAceEleven: boolean = false,
): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const game = normalizeJackarooGame(snap.val());

  if (!game || game.status !== 'playing') return;

  const pIdx = game.currentTurnIndex;
  const player = game.players[pIdx];
  if (!player || player.uid !== playerUid) {
    throw new Error('نۆرەی تۆ نییە!');
  }

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error('ئەم کارتە لە دەستتدا نەماوە.');
  }
  const card = player.hand[cardIndex];

  const moveCheck = canMoveMarbleWithCard(game, pIdx, marbleIndex, card, useAceEleven);
  if (!moveCheck.valid) {
    throw new Error(moveCheck.reason || 'ئەم جووڵەیە دروست نییە.');
  }

  const updatedPlayers = game.players.map((p) => ({
    ...p,
    marbles: [...p.marbles],
    hand: [...p.hand],
  }));

  const activePlayer = updatedPlayers[pIdx];
  const wasInBase = activePlayer.marbles[marbleIndex] === -1;
  activePlayer.marbles[marbleIndex] = moveCheck.targetPos;
  activePlayer.hand.splice(cardIndex, 1);

  let eatenInfo = '';

  // Check if landed on an opponent marble on the outer track (0..47)
  if (moveCheck.targetPos >= 0 && moveCheck.targetPos < 48) {
    const landingGlobal = getGlobalTrackIndex(activePlayer.slotIndex, moveCheck.targetPos);
    for (let i = 0; i < updatedPlayers.length; i++) {
      if (i === pIdx) continue;
      const opp = updatedPlayers[i];
      for (let m = 0; m < 4; m++) {
        const oppRel = opp.marbles[m];
        if (oppRel >= 0 && oppRel < 48) {
          const oppGlobal = getGlobalTrackIndex(opp.slotIndex, oppRel);
          if (oppGlobal === landingGlobal) {
            opp.marbles[m] = -1; // Send back to Base!
            eatenInfo = ` و مۆرەی ${opp.username}ی خوارد! 🔥`;
          }
        }
      }
    }
  }

  // Check win condition: all 4 marbles in safe Home zone (48..51)
  const hasWon = activePlayer.marbles.every((m) => m >= 48);
  if (hasWon) {
    if (game.totalPot > 0) {
      await creditCoins(activePlayer.uid, game.totalPot);
    }
    const completedGame: JackarooGame = {
      ...game,
      players: updatedPlayers,
      status: 'completed',
      lastPlayedCard: card,
      winnerUid: activePlayer.uid,
      winnerUsername: activePlayer.username,
      lastActionText: `🏆 ${activePlayer.username} یاری جاکۆرۆی بردەوە و ${game.totalPot} کۆینی وەرگرت!`,
    };
    await set(gameRef, completedGame);
    await sendRoomMessage(
      roomId,
      'system',
      'System',
      `🏆 پیرۆزە! ${activePlayer.username} یاری جاکۆرۆی بردەوە (${game.totalPot} کۆین)!`,
    );
    return;
  }

  const moveDesc = wasInBase
    ? `${activePlayer.username} بە کارتی ${card.rank}${card.suit} مۆرەی هێنایە دەرەوە${eatenInfo}`
    : `${activePlayer.username} کارتی ${card.rank}${card.suit}ی یاری کرد${eatenInfo}`;

  const nextState = advanceTurnAndDealIfNeeded(
    updatedPlayers,
    pIdx,
    game.deck,
    game.roundNumber,
    moveDesc,
  );

  await set(gameRef, {
    ...game,
    players: nextState.players,
    currentTurnIndex: nextState.nextTurnIndex,
    deck: nextState.deck,
    roundNumber: nextState.roundNumber,
    lastPlayedCard: card,
    lastActionText: nextState.actionText,
  });
}

/**
 * Executes a Jack ('J') swap between one of the current player's track marbles
 * and an unprotected opponent track marble.
 */
export async function playJackSwapMove(
  roomId: string,
  playerUid: string,
  cardId: string,
  myMarbleIndex: number,
  targetPlayerIndex: number,
  targetMarbleIndex: number,
): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const game = normalizeJackarooGame(snap.val());

  if (!game || game.status !== 'playing') return;

  const pIdx = game.currentTurnIndex;
  const player = game.players[pIdx];
  if (!player || player.uid !== playerUid) {
    throw new Error('نۆرەی تۆ نییە!');
  }

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1 || player.hand[cardIndex].rank !== 'J') {
    throw new Error('تەنها کارتی جاک (J) دەتوانێت مۆرە بگۆڕێتەوە.');
  }

  const card = player.hand[cardIndex];
  const myRel = player.marbles[myMarbleIndex];
  const oppPlayer = game.players[targetPlayerIndex];
  if (!oppPlayer || targetPlayerIndex === pIdx) {
    throw new Error('مۆرەی بەرامبەر هەڵبژێرە.');
  }
  const oppRel = oppPlayer.marbles[targetMarbleIndex];

  if (myRel < 0 || myRel >= 48 || oppRel <= 0 || oppRel >= 48) {
    throw new Error('تەنها مۆرەی سەر ڕێڕەو کە لە خانەی پارێزراو نەبێت دەگۆڕدرێتەوە.');
  }

  const myGlobal = getGlobalTrackIndex(player.slotIndex, myRel);
  const oppGlobal = getGlobalTrackIndex(oppPlayer.slotIndex, oppRel);

  const newMyRel = (oppGlobal - player.slotIndex * 12 + 48) % 48;
  const newOppRel = (myGlobal - oppPlayer.slotIndex * 12 + 48) % 48;

  const updatedPlayers = game.players.map((p) => ({
    ...p,
    marbles: [...p.marbles],
    hand: [...p.hand],
  }));

  updatedPlayers[pIdx].marbles[myMarbleIndex] = newMyRel;
  updatedPlayers[targetPlayerIndex].marbles[targetMarbleIndex] = newOppRel;
  updatedPlayers[pIdx].hand.splice(cardIndex, 1);

  const nextState = advanceTurnAndDealIfNeeded(
    updatedPlayers,
    pIdx,
    game.deck,
    game.roundNumber,
    `🔄 ${player.username} بە کارتی J مۆرەکەی لەگەڵ ${oppPlayer.username} گۆڕییەوە!`,
  );

  await set(gameRef, {
    ...game,
    players: nextState.players,
    currentTurnIndex: nextState.nextTurnIndex,
    deck: nextState.deck,
    roundNumber: nextState.roundNumber,
    lastPlayedCard: card,
    lastActionText: nextState.actionText,
  });
}

/**
 * Burns (discards) a selected card when the player has no move or chooses to pass.
 */
export async function burnJackarooCard(
  roomId: string,
  playerUid: string,
  cardId: string,
): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const game = normalizeJackarooGame(snap.val());

  if (!game || game.status !== 'playing') return;

  const pIdx = game.currentTurnIndex;
  const player = game.players[pIdx];
  if (!player || player.uid !== playerUid) {
    throw new Error('نۆرەی تۆ نییە!');
  }

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return;

  const card = player.hand[cardIndex];
  const updatedPlayers = game.players.map((p) => ({
    ...p,
    marbles: [...p.marbles],
    hand: [...p.hand],
  }));

  updatedPlayers[pIdx].hand.splice(cardIndex, 1);

  const nextState = advanceTurnAndDealIfNeeded(
    updatedPlayers,
    pIdx,
    game.deck,
    game.roundNumber,
    `🔥 ${player.username} کارتی ${card.rank}${card.suit}ی سووتاند`,
  );

  await set(gameRef, {
    ...game,
    players: nextState.players,
    currentTurnIndex: nextState.nextTurnIndex,
    deck: nextState.deck,
    roundNumber: nextState.roundNumber,
    lastPlayedCard: card,
    lastActionText: nextState.actionText,
  });
}

/**
 * Cancels / closes the Jackaroo table and refunds players if still waiting.
 */
export async function closeJackarooGame(roomId: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  const snap = await get(gameRef);
  const game = normalizeJackarooGame(snap.val());

  if (game && game.status === 'waiting' && game.betAmount > 0) {
    for (const p of game.players) {
      await creditCoins(p.uid, game.betAmount);
    }
  }
  await remove(gameRef);
}

/**
 * Subscribes to the room's active Jackaroo game in real-time.
 */
export function subscribeToJackarooGame(
  roomId: string,
  callback: (game: JackarooGame | null) => void,
): Unsubscribe {
  const gameRef = ref(database, `rooms/${roomId}/jackarooGame`);
  return onValue(gameRef, (snapshot) => {
    callback(normalizeJackarooGame(snapshot.val()));
  });
}
