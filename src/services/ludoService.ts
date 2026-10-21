import {
  ref,
  set,
  get,
  onValue,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { LudoGame, LudoPlayer, User } from '../types';
import { LUDO_COLORS } from '../types';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   Firebase 4-Player Ludo Board & Double-Betting Escrow Service
   Handles 4-way coin escrow, turn-based state synchronization,
   token positioning, collision knockback, and prize payouts.
   ───────────────────────────────────────────────────────────── */

export interface LudoParticipant {
  uid: string;
  username: string;
  avatar?: string;
}

/**
 * Deducts coins atomically from a user profile.
 */
async function deductUserCoins(uid: string, amount: number): Promise<void> {
  const userRef = ref(database, `users/${uid}`);

  await runTransaction(userRef, (userData: User | null) => {
    if (!userData) throw new Error('User profile not found.');
    const currentCoins = userData.coins ?? 0;
    if (currentCoins < amount) {
      throw new Error(`Insufficient coins! You need ${amount} coins to join this board.`);
    }

    userData.coins = currentCoins - amount;
    return userData;
  });
}

/**
 * Credits total pot to the winner and awards +500 XP.
 */
async function awardLudoWinner(uid: string, totalPot: number, xpReward = 500): Promise<void> {
  const userRef = ref(database, `users/${uid}`);

  await runTransaction(userRef, (userData: User | null) => {
    if (!userData) return userData;

    const currentCoins = userData.coins ?? 0;
    const currentXp = userData.xp ?? 0;
    const newXp = currentXp + xpReward;

    userData.coins = currentCoins + totalPot;
    userData.xp = newXp;
    userData.level = Math.max(userData.level ?? 1, Math.floor(newXp / 500) + 1);

    return userData;
  });
}

/**
 * Refunds bet amount to a player.
 */
async function refundUserCoins(uid: string, amount: number): Promise<void> {
  const userRef = ref(database, `users/${uid}`);

  await runTransaction(userRef, (userData: User | null) => {
    if (!userData) return userData;
    userData.coins = (userData.coins ?? 0) + amount;
    return userData;
  });
}

/**
 * 1. Creates a 4-Player Ludo Game under `/rooms/{roomId}/ludoGame`.
 * Deducts `betAmount` from host user into escrow.
 */
export async function createLudoGame(
  roomId: string,
  hostUser: LudoParticipant,
  betAmount: number,
): Promise<void> {
  if (betAmount <= 0) throw new Error('Entry fee must be greater than zero.');

  // Deduct host entry fee into escrow
  await deductUserCoins(hostUser.uid, betAmount);

  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);

  const initialGame: LudoGame = {
    gameId: `ludo_${Date.now()}`,
    status: 'waiting',
    betAmount,
    totalPot: betAmount,
    hostUid: hostUser.uid,
    players: [
      {
        uid: hostUser.uid,
        username: hostUser.username,
        avatar: hostUser.avatar || '',
        color: 'red',
        position: 0,
        hasReachedGoal: false,
      },
    ],
    currentTurnIndex: 0,
    lastDiceRoll: null,
    winner: null,
    createdAt: Date.now(),
  };

  await set(gameRef, initialGame);

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Board Battle] ${hostUser.username} opened a 4-Player Board Battle (${betAmount} Coins entry)! Tap 'Join Board' to take a color.`,
  );
}

/**
 * 2. Opponent joins the 4-Player Board.
 * Deducts `betAmount`, assigns the next color (Blue, Green, Yellow), and pools into `totalPot`.
 */
export async function joinLudoGame(
  roomId: string,
  participant: LudoParticipant,
): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('No active Ludo match found.');
  }

  const existingGame = snapshot.val() as LudoGame;
  if (existingGame.status !== 'waiting') {
    throw new Error('This game is already in progress.');
  }
  if (existingGame.players.length >= 4) {
    throw new Error('The board is full (maximum 4 players).');
  }
  if (existingGame.players.some((p) => p.uid === participant.uid)) {
    throw new Error('You have already joined this board.');
  }

  // Deduct entry fee
  await deductUserCoins(participant.uid, existingGame.betAmount);

  let newPlayerCount = 0;
  let newTotalPot = 0;

  await runTransaction(gameRef, (currentGame: LudoGame | null) => {
    if (!currentGame || currentGame.status !== 'waiting') return currentGame;

    const assignedColor = LUDO_COLORS[currentGame.players.length] || 'yellow';
    const newPlayer: LudoPlayer = {
      uid: participant.uid,
      username: participant.username,
      avatar: participant.avatar || '',
      color: assignedColor,
      position: 0,
      hasReachedGoal: false,
    };

    currentGame.players.push(newPlayer);
    currentGame.totalPot = currentGame.betAmount * currentGame.players.length;
    currentGame.updatedAt = Date.now();

    newPlayerCount = currentGame.players.length;
    newTotalPot = currentGame.totalPot;

    return currentGame;
  });

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Board Joined] ${participant.username} joined the Board Battle (${newPlayerCount}/4)! Total Pot: ${newTotalPot} Coins.`,
  );
}

/**
 * 3. Host starts the match once at least 2 players have joined.
 */
export async function startLudoGame(roomId: string, hostUid: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);

  let firstPlayerName = '';

  await runTransaction(gameRef, (currentGame: LudoGame | null) => {
    if (!currentGame) throw new Error('Game not found.');
    if (currentGame.hostUid !== hostUid) throw new Error('Only the host can start the match.');
    if (currentGame.players.length < 2) throw new Error('At least 2 players are needed to start.');
    if (currentGame.status !== 'waiting') throw new Error('Game is already running.');

    currentGame.status = 'playing';
    currentGame.currentTurnIndex = 0;
    currentGame.updatedAt = Date.now();

    firstPlayerName = currentGame.players[0].username;

    return currentGame;
  });

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Match Started] The 4-Player Board Battle has started! First turn: ${firstPlayerName}. Roll your die!`,
  );
}

/**
 * 4. Active player rolls the die (1-6) on their turn.
 * Advances their token, handles collisions (knockbacks), and settles victory when reaching step 25.
 */
export async function rollLudoDice(roomId: string, playerUid: string): Promise<number> {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);
  const rollValue = Math.floor(Math.random() * 6) + 1;

  let gameWon = false;
  let winnerPlayer: LudoPlayer | null = null;
  let totalPot = 0;
  let nextPlayerName = '';

  await runTransaction(gameRef, (currentGame: LudoGame | null) => {
    if (!currentGame) throw new Error('Game not found.');
    if (currentGame.status !== 'playing') throw new Error('Game is not in playing state.');

    const activePlayer = currentGame.players[currentGame.currentTurnIndex];
    if (!activePlayer || activePlayer.uid !== playerUid) {
      throw new Error("It's not your turn!");
    }

    currentGame.lastDiceRoll = rollValue;
    const oldPos = activePlayer.position;
    const targetPos = Math.min(25, oldPos + rollValue);

    // Collision Check: If landing on an opponent's step (and not at goal), send them back 5 steps!
    if (targetPos < 25) {
      for (const other of currentGame.players) {
        if (other.uid !== playerUid && other.position === targetPos && other.position > 0) {
          other.position = Math.max(0, other.position - 5);
        }
      }
    }

    activePlayer.position = targetPos;

    // Victory Check: Step 25 is the Home Goal
    if (targetPos >= 25) {
      activePlayer.hasReachedGoal = true;
      currentGame.winner = { ...activePlayer };
      currentGame.status = 'ended';
      gameWon = true;
      winnerPlayer = { ...activePlayer };
      totalPot = currentGame.totalPot;
    } else {
      // Pass turn to the next player
      currentGame.currentTurnIndex = (currentGame.currentTurnIndex + 1) % currentGame.players.length;
      nextPlayerName = currentGame.players[currentGame.currentTurnIndex].username;
    }

    currentGame.updatedAt = Date.now();
    return currentGame;
  });

  if (gameWon && winnerPlayer) {
    // Settle grand prize + 500 XP
    await awardLudoWinner((winnerPlayer as LudoPlayer).uid, totalPot, 500);
    await sendRoomMessage(
      roomId,
      'system',
      'System',
      `[Champion] ${(winnerPlayer as LudoPlayer).username} reached the final goal and won the entire ${totalPot} Coins Pot (+500 XP)!`,
    );
  }

  return rollValue;
}

/**
 * 5. Clears the Ludo game node.
 */
export async function resetLudoGame(roomId: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);
  await set(gameRef, null);
}

/**
 * 6. Cancels pending game and refunds all joined players.
 */
export async function cancelLudoGame(roomId: string, hostUid: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;

  const game = snapshot.val() as LudoGame;
  if (game.status === 'waiting' && game.hostUid === hostUid) {
    for (const player of game.players) {
      await refundUserCoins(player.uid, game.betAmount);
    }
    await set(gameRef, null);
    await sendRoomMessage(
      roomId,
      'system',
      'System',
      `[Cancelled] 4-Player Board challenge was cancelled. All bets refunded.`,
    );
  }
}

/**
 * Subscribes to real-time updates of the Ludo game.
 */
export function subscribeToLudoGame(
  roomId: string,
  onUpdate: (game: LudoGame | null) => void,
): Unsubscribe {
  const gameRef = ref(database, `rooms/${roomId}/ludoGame`);
  return onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as LudoGame);
    } else {
      onUpdate(null);
    }
  });
}
