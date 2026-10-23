export type LudoColor = 'red' | 'blue' | 'green' | 'yellow';

export interface LudoPlayer {
  uid: string;
  username: string;
  avatar?: string;
  color: LudoColor;
  position: number; // 0 (start) to 25 (goal)
  hasReachedGoal: boolean;
}

export type LudoGameStatus = 'waiting' | 'playing' | 'ended';

/**
 * 4-Player Synchronized Ludo / Double-Coin Betting Game State
 * Stored under `/rooms/{roomId}/ludoGame`
 */
export interface LudoGame {
  gameId: string;
  status: LudoGameStatus;
  betAmount: number;
  totalPot: number;
  hostUid: string;
  players: LudoPlayer[]; // 2 to 4 players
  currentTurnIndex: number; // 0, 1, 2, or 3
  lastDiceRoll: number | null;
  winner: LudoPlayer | null;
  createdAt: number;
  updatedAt?: number;
}

export const LUDO_COLORS: LudoColor[] = ['red', 'blue', 'green', 'yellow'];

export const LUDO_COLOR_MAP: Record<LudoColor, { bg: string; text: string; border: string; glow: string; name: string }> = {
  red: {
    bg: 'bg-rose-500',
    text: 'text-rose-400',
    border: 'border-rose-500',
    glow: 'shadow-rose-500/40',
    name: 'سوور',
  },
  blue: {
    bg: 'bg-cyan-500',
    text: 'text-cyan-400',
    border: 'border-cyan-500',
    glow: 'shadow-cyan-500/40',
    name: 'شین',
  },
  green: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
    glow: 'shadow-emerald-500/40',
    name: 'سەوز',
  },
  yellow: {
    bg: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-400',
    glow: 'shadow-amber-400/40',
    name: 'زەرد',
  },
};
