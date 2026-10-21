import {
  ref,
  set,
  get,
  onValue,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { DiceGame, DicePlayer, User } from '../types';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   Firebase Game Escrow Service — Synchronized Dice Battle
   Handles escrow deductions, atomic betting pot management,
   synchronized rolls, and real-time winner payouts.
   ───────────────────────────────────────────────────────────── */

export interface GameParticipant {
  uid: string;
  username: string;
  avatar?: string;
}

/**
 * Deducts coins atomically from a user profile.
 * Throws if the user does not have sufficient balance.
 */
async function deductUserCoins(uid: string, amount: number): Promise<void> {
  const userRef = ref(database, `users/${uid}`);

  await runTransaction(userRef, (userData: User | null) => {
    if (!userData) {
      throw new Error('User profile not found.');
    }
    const currentCoins = userData.coins ?? 0;
    if (currentCoins < amount) {
      throw new Error(`Insufficient coins! You need ${amount} coins to play.`);
    }

    userData.coins = currentCoins - amount;
    return userData;
  });
}

/**
 * Credits coins and awards XP atomically to the winning player.
 */
async function awardWinnerPrize(uid: string, potAmount: number, xpReward = 200): Promise<void> {
  const userRef = ref(database, `users/${uid}`);

  await runTransaction(userRef, (userData: User | null) => {
    if (!userData) return userData;

    const currentCoins = userData.coins ?? 0;
    const currentXp = userData.xp ?? 0;
    const newXp = currentXp + xpReward;

    userData.coins = currentCoins + potAmount;
    userData.xp = newXp;
    // Calculate level progression (every 500 XP = +1 level)
    userData.level = Math.max(userData.level ?? 1, Math.floor(newXp / 500) + 1);

    return userData;
  });
}

/**
 * Refunds bet amount to a player in case of tie or game cancellation.
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
 * 1. Creates a new Dice Game challenge under `/rooms/{roomId}/miniGame`.
 * Deducts `betAmount` from host user's profile escrow.
 */
export async function createDiceGame(
  roomId: string,
  hostUser: GameParticipant,
  betAmount: number,
): Promise<void> {
  if (betAmount <= 0) {
    throw new Error('Bet amount must be greater than zero.');
  }

  // Deduct bet from host first (atomic escrow)
  await deductUserCoins(hostUser.uid, betAmount);

  const gameRef = ref(database, `rooms/${roomId}/miniGame`);

  const initialGame: DiceGame = {
    gameId: `dice_${Date.now()}`,
    status: 'waiting',
    betAmount,
    potSize: betAmount,
    player1: {
      uid: hostUser.uid,
      username: hostUser.username,
      avatar: hostUser.avatar || '',
      rollResult: null,
    },
    player2: null,
    winnerId: null,
    createdAt: Date.now(),
  };

  await set(gameRef, initialGame);

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Dice Battle] ${hostUser.username} started a Dice Battle for ${betAmount} Coins! Who dares to challenge?`,
  );
}

/**
 * 2. Opponent joins the Dice Game.
 * Deducts `betAmount` from opponent, adds it to `potSize`, and sets status to 'playing'.
 */
export async function joinDiceGame(
  roomId: string,
  opponentUser: GameParticipant,
  betAmount: number,
): Promise<void> {
  // Deduct bet from opponent first
  await deductUserCoins(opponentUser.uid, betAmount);

  const gameRef = ref(database, `rooms/${roomId}/miniGame`);

  let hostUsername = 'Challenger';

  await runTransaction(gameRef, (currentGame: DiceGame | null) => {
    if (!currentGame) {
      throw new Error('The game is no longer active.');
    }
    if (currentGame.status !== 'waiting') {
      throw new Error('This game has already started or concluded.');
    }
    if (currentGame.player1.uid === opponentUser.uid) {
      throw new Error('You cannot challenge yourself.');
    }

    hostUsername = currentGame.player1.username;

    currentGame.player2 = {
      uid: opponentUser.uid,
      username: opponentUser.username,
      avatar: opponentUser.avatar || '',
      rollResult: null,
    };
    currentGame.potSize = currentGame.betAmount * 2;
    currentGame.status = 'playing';
    currentGame.updatedAt = Date.now();

    return currentGame;
  });

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `[Match Accepted] ${opponentUser.username} accepted ${hostUsername}'s challenge! Total Pot: ${betAmount * 2} Coins. Roll your dice!`,
  );
}

/**
 * 3. Player rolls their die (1-6).
 * Once both players have rolled:
 * - Calculates the winner
 * - Transfers pot to winner & awards +200 XP
 * - Sets status to 'revealing'
 */
export async function rollDice(
  roomId: string,
  playerUid: string,
): Promise<number> {
  const gameRef = ref(database, `rooms/${roomId}/miniGame`);
  const rollValue = Math.floor(Math.random() * 6) + 1; // 1 to 6

  let gameFinished = false;
  let winner: any = null;
  let isTie = false;
  let potSize = 0;
  let betAmount = 0;
  let p1: any = null;
  let p2: any = null;

  await runTransaction(gameRef, (currentGame: DiceGame | null) => {
    if (!currentGame) {
      throw new Error('No active game found.');
    }
    if (currentGame.status !== 'playing') {
      throw new Error('Game is not in a rolling state.');
    }

    const { player1, player2 } = currentGame;
    if (!player2) {
      throw new Error('Waiting for opponent to join.');
    }

    // Assign roll to the matching player
    if (player1.uid === playerUid) {
      if (player1.rollResult !== null) {
        throw new Error('You have already rolled your die!');
      }
      player1.rollResult = rollValue;
    } else if (player2.uid === playerUid) {
      if (player2.rollResult !== null) {
        throw new Error('You have already rolled your die!');
      }
      player2.rollResult = rollValue;
    } else {
      throw new Error('You are not a participant in this match.');
    }

    // Check if both players have rolled
    if (player1.rollResult !== null && player2.rollResult !== null) {
      gameFinished = true;
      potSize = currentGame.potSize;
      betAmount = currentGame.betAmount;
      p1 = { ...player1 };
      p2 = { ...player2 };

      currentGame.status = 'revealing';
      currentGame.updatedAt = Date.now();

      if (player1.rollResult > player2.rollResult) {
        winner = player1;
        currentGame.winnerId = player1.uid;
        currentGame.winnerUsername = player1.username;
        currentGame.isTie = false;
      } else if (player2.rollResult > player1.rollResult) {
        winner = player2;
        currentGame.winnerId = player2.uid;
        currentGame.winnerUsername = player2.username;
        currentGame.isTie = false;
      } else {
        // Tie
        isTie = true;
        currentGame.winnerId = null;
        currentGame.winnerUsername = null;
        currentGame.isTie = true;
      }
    }

    return currentGame;
  });

  // Execute payout outside transaction
  if (gameFinished) {
    if (winner && !isTie) {
      await awardWinnerPrize(winner.uid, potSize, 200);
      await sendRoomMessage(
        roomId,
        'system',
        'System',
        `[Victory] ${winner.username} won ${potSize} Coins (+200 XP) with a roll of ${
          winner.rollResult
        } vs ${winner.uid === p1?.uid ? p2?.rollResult : p1?.rollResult}!`,
      );
    } else if (isTie && p1 && p2) {
      // Refund bets on draw
      await refundUserCoins(p1.uid, betAmount);
      await refundUserCoins(p2.uid, betAmount);
      await sendRoomMessage(
        roomId,
        'system',
        'System',
        `[Draw] Both rolled ${p1.rollResult}. Bets of ${betAmount} Coins have been refunded!`,
      );
    }
  }

  return rollValue;
}

/**
 * 4. Clears the mini-game node so a new round can begin.
 */
export async function resetGame(roomId: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/miniGame`);
  await set(gameRef, null);
}

/**
 * Cancels a pending challenge and refunds the host's bet.
 */
export async function cancelDiceGame(roomId: string, hostUid: string): Promise<void> {
  const gameRef = ref(database, `rooms/${roomId}/miniGame`);

  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;

  const game = snapshot.val() as DiceGame;
  if (game.status === 'waiting' && game.player1.uid === hostUid) {
    await refundUserCoins(hostUid, game.betAmount);
    await set(gameRef, null);
    await sendRoomMessage(
      roomId,
      'system',
      'System',
      `[Cancelled] ${game.player1.username} cancelled the Dice Battle challenge.`,
    );
  }
}

/**
 * Subscribes to real-time updates of the room's miniGame node.
 */
export function subscribeToDiceGame(
  roomId: string,
  onUpdate: (game: DiceGame | null) => void,
): Unsubscribe {
  const gameRef = ref(database, `rooms/${roomId}/miniGame`);
  return onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as DiceGame);
    } else {
      onUpdate(null);
    }
  });
}
