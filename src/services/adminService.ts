import { ref, update, remove, get, query, orderByChild, onValue, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { ReportItem, User } from '../types';

/**
 * Fetches all pending moderation reports.
 */
export async function fetchPendingReports(): Promise<ReportItem[]> {
  const snapshot = await get(ref(database, 'reports'));
  if (!snapshot.exists()) return [];
  const items: ReportItem[] = [];
  snapshot.forEach((child) => {
    const data = child.val() as ReportItem;
    if (data && data.id && data.status === 'pending') {
      items.push(data);
    }
  });
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Subscribes to live moderation report stream (all statuses).
 */
export function subscribeToAllReports(
  callback: (reports: ReportItem[]) => void,
): Unsubscribe {
  return onValue(ref(database, 'reports'), (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const items: ReportItem[] = [];
    snapshot.forEach((child) => {
      const data = child.val() as ReportItem;
      if (data && data.id) items.push(data);
    });
    callback(items.sort((a, b) => b.timestamp - a.timestamp));
  });
}

/**
 * Updates the status of a report ('resolved' or 'dismissed').
 */
export async function resolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  adminNote?: string,
): Promise<void> {
  const reportRef = ref(database, `reports/${reportId}`);
  await update(reportRef, {
    status,
    adminNote: adminNote || '',
    resolvedAt: Date.now(),
  });
}

/**
 * Deletes a report permanently (admin only).
 */
export async function deleteReport(reportId: string): Promise<void> {
  await remove(ref(database, `reports/${reportId}`));
}

/**
 * Fetches all registered users for admin view.
 */
export async function fetchAllUsers(): Promise<User[]> {
  const snapshot = await get(ref(database, 'users'));
  if (!snapshot.exists()) return [];
  const users: User[] = [];
  snapshot.forEach((child) => {
    const data = child.val() as User;
    if (data && data.uid) users.push(data);
  });
  return users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Bans a user by setting a banned flag.
 */
export async function banUser(uid: string, reason: string): Promise<void> {
  await update(ref(database, `users/${uid}`), {
    isBanned: true,
    banReason: reason,
    bannedAt: Date.now(),
  });
}

/**
 * Lifts a ban from a user.
 */
export async function unbanUser(uid: string): Promise<void> {
  await update(ref(database, `users/${uid}`), {
    isBanned: false,
    banReason: null,
    bannedAt: null,
  });
}

/**
 * Grants administrator role to a user profile in Firebase.
 */
export async function grantAdminRole(uid: string): Promise<void> {
  await update(ref(database, `users/${uid}`), {
    isAdmin: true,
  });
}
