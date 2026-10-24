export type PkTeam = 'red' | 'blue';

export type PkMode = '1v1' | '2v2' | '3v3' | '4v4' | 'custom';

export interface PkContributor {
  uid: string;
  username: string;
  avatar?: string | null;
  points: number;
}

export interface PkBattleState {
  id: string;
  status: 'idle' | 'active' | 'finished';
  mode: PkMode;
  startTime: number;
  durationSeconds: number; // 60, 180, 300, 600
  endTime: number;
  redScore: number;
  blueScore: number;
  redSeats: number[];
  blueSeats: number[];
  redContributors?: Record<string, PkContributor>;
  blueContributors?: Record<string, PkContributor>;
  penalty?: string | null;
  winner: 'red' | 'blue' | 'draw' | null;
  lastUpdated: number;
}

export interface StartPkBattleOptions {
  mode?: PkMode;
  durationSeconds?: number;
  redSeats?: number[];
  blueSeats?: number[];
  penalty?: string;
}
