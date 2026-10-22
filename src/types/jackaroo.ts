export type JackarooColor = 'red' | 'blue' | 'emerald' | 'amber';
export type CardSuit = '♠' | '♥' | '♦' | '♣';
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface JackarooCard {
  id: string;
  rank: CardRank;
  suit: CardSuit;
}

export interface JackarooPlayer {
  uid: string;
  username: string;
  avatar?: string;
  color: JackarooColor;
  slotIndex: number; // 0, 1, 2, 3 (determines board quadrant: start at slotIndex * 12)
  /**
   * 4 marbles per player:
   * -1 = in Base (ماڵەوە)
   * 0..47 = relative steps traveled from player's start tile (0 is start tile, 47 is right before Home)
   * 48..51 = inside safe Home zone (48, 49, 50, 51)
   */
  marbles: number[];
  hand: JackarooCard[];
}

export type JackarooStatus = 'waiting' | 'playing' | 'completed';

export interface JackarooGame {
  id: string;
  roomId: string;
  hostUid: string;
  maxPlayers: 2 | 3 | 4;
  betAmount: number;
  totalPot: number;
  status: JackarooStatus;
  players: JackarooPlayer[];
  currentTurnIndex: number;
  deck: JackarooCard[];
  lastActionText: string;
  lastPlayedCard: JackarooCard | null;
  winnerUid: string | null;
  winnerUsername: string | null;
  roundNumber: number;
  createdAt: number;
}

export const JACKAROO_COLORS: JackarooColor[] = ['red', 'blue', 'emerald', 'amber'];

export const JACKAROO_COLOR_META: Record<
  JackarooColor,
  {
    name: string;
    kurdishName: string;
    bg: string;
    border: string;
    text: string;
    glow: string;
    hex: string;
  }
> = {
  red: {
    name: 'Ruby Red',
    kurdishName: 'سوور',
    bg: 'bg-rose-500',
    border: 'border-rose-400',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.8)]',
    hex: '#f43f5e',
  },
  blue: {
    name: 'Sapphire Blue',
    kurdishName: 'شین',
    bg: 'bg-sky-500',
    border: 'border-sky-400',
    text: 'text-sky-400',
    glow: 'shadow-[0_0_12px_rgba(14,165,233,0.8)]',
    hex: '#0ea5e9',
  },
  emerald: {
    name: 'Emerald Green',
    kurdishName: 'سەوز',
    bg: 'bg-emerald-500',
    border: 'border-emerald-400',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.8)]',
    hex: '#10b981',
  },
  amber: {
    name: 'Royal Gold',
    kurdishName: 'ئاڵتوونی',
    bg: 'bg-amber-400',
    border: 'border-amber-300',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.8)]',
    hex: '#fbbf24',
  },
};
