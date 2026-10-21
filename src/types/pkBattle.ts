export type PkTeam = 'red' | 'blue';

export interface PkBattleState {
  id: string;
  status: 'idle' | 'active' | 'finished';
  startTime: number;
  durationSeconds: number; // 300 for 5 minutes
  endTime: number;
  redScore: number;
  blueScore: number;
  redSeats: number[]; // [1, 2, 3, 4]
  blueSeats: number[]; // [5, 6, 7, 8]
  winner: 'red' | 'blue' | 'draw' | null;
  lastUpdated: number;
}
