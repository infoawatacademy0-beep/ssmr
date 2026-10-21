import {
  ref,
  get,
  query,
  orderByChild,
  limitToLast,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { User } from '../types';

export interface LeaderboardEntry {
  uid: string;
  username: string;
  avatar?: string | null;
  level: number;
  coins: number;
  xp: number;
  rank: number;
}

/**
 * Fetches top N users by coins (one-shot).
 */
export async function fetchTopByCoins(limit = 50): Promise<LeaderboardEntry[]> {
  const usersQuery = query(
    ref(database, 'users'),
    orderByChild('coins'),
    limitToLast(limit),
  );
  const snapshot = await get(usersQuery);
  return buildLeaderboard(snapshot, 'coins');
}

/**
 * Fetches top N users by XP (one-shot).
 */
export async function fetchTopByXP(limit = 50): Promise<LeaderboardEntry[]> {
  const usersQuery = query(
    ref(database, 'users'),
    orderByChild('xp'),
    limitToLast(limit),
  );
  const snapshot = await get(usersQuery);
  return buildLeaderboard(snapshot, 'xp');
}

/**
 * Subscribes to live top users by coins.
 */
export function subscribeToLeaderboardByCoins(
  limit: number,
  callback: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const usersQuery = query(
    ref(database, 'users'),
    orderByChild('coins'),
    limitToLast(limit),
  );
  return onValue(usersQuery, (snapshot) => {
    callback(buildLeaderboard(snapshot, 'coins'));
  });
}

/**
 * Subscribes to live top users by XP.
 */
export function subscribeToLeaderboardByXP(
  limit: number,
  callback: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const usersQuery = query(
    ref(database, 'users'),
    orderByChild('xp'),
    limitToLast(limit),
  );
  return onValue(usersQuery, (snapshot) => {
    callback(buildLeaderboard(snapshot, 'xp'));
  });
}

function buildLeaderboard(
  snapshot: ReturnType<typeof get> extends Promise<infer S> ? S : never,
  sortKey: 'coins' | 'xp',
): LeaderboardEntry[] {
  if (!snapshot.exists()) return [];

  const entries: LeaderboardEntry[] = [];
  snapshot.forEach((child: any) => {
    const data = child.val() as User;
    if (!data || !data.uid) return;
    entries.push({
      uid: data.uid,
      username: data.username,
      avatar: data.avatar || data.profileImage || null,
      level: data.level || 1,
      coins: data.coins || 0,
      xp: data.xp || 0,
      rank: 0,
    });
  });

  entries.sort((a, b) => b[sortKey] - a[sortKey]);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}
