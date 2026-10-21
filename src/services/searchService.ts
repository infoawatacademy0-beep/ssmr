import {
  ref,
  query,
  orderByChild,
  startAt,
  endAt,
  limitToFirst,
  get,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { User } from '../types';

/**
 * Searches users by username prefix using Firebase orderByChild query.
 * Returns up to `limit` matching user profiles.
 */
export async function searchUsersByUsername(
  searchTerm: string,
  limit = 20,
): Promise<User[]> {
  if (!searchTerm.trim()) return [];

  const normalized = searchTerm.trim().toLowerCase();
  const usersRef = ref(database, 'users');

  const searchQuery = query(
    usersRef,
    orderByChild('usernameLower'),
    startAt(normalized),
    endAt(normalized + '\uf8ff'),
    limitToFirst(limit),
  );

  const snapshot = await get(searchQuery);
  if (!snapshot.exists()) return [];

  const results: User[] = [];
  snapshot.forEach((child) => {
    const data = child.val();
    if (data && data.uid) {
      results.push(data as User);
    }
  });

  return results;
}

/**
 * Subscribes to a live search result stream.
 */
export function subscribeToUserSearch(
  searchTerm: string,
  callback: (users: User[]) => void,
  limit = 20,
): Unsubscribe {
  if (!searchTerm.trim()) {
    callback([]);
    return () => {};
  }

  const normalized = searchTerm.trim().toLowerCase();
  const usersRef = ref(database, 'users');

  const searchQuery = query(
    usersRef,
    orderByChild('usernameLower'),
    startAt(normalized),
    endAt(normalized + '\uf8ff'),
    limitToFirst(limit),
  );

  return onValue(searchQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const results: User[] = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data && data.uid) {
        results.push(data as User);
      }
    });

    callback(results);
  });
}
