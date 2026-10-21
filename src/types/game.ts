/**
 * Dice Battle player state
 */
export interface DicePlayer {
  uid: string;
  username: string;
  avatar?: string;
  rollResult: number | null;
}

export type GameStatus = 'waiting' | 'playing' | 'revealing';

/**
 * Synchronized Coin betting Mini-Game state stored at:
 * `/rooms/{roomId}/miniGame`
 */
export interface DiceGame {
  gameId: string;
  status: GameStatus;
  betAmount: number;
  player1: DicePlayer;
  player2: DicePlayer | null;
  potSize: number;
  winnerId: string | null;
  winnerUsername?: string | null;
  isTie?: boolean;
  createdAt: number;
  updatedAt?: number;
}
