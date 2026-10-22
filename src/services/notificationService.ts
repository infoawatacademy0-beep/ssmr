import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  query,
  orderByChild,
  limitToLast,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { AppNotification, NotificationType } from '../types';

/**
 * Pushes a notification to a recipient's inbox at `/notifications/{uid}/{notifId}`.
 */
export async function sendNotification(params: {
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  roomId?: string;
  actionUrl?: string;
}): Promise<string> {
  // Respect recipient's "Activity Notifications" setting in SettingsModal
  try {
    const prefSnap = await get(ref(database, `users/${params.recipientUid}/activityNotifications`));
    if (prefSnap.exists() && prefSnap.val() === false) {
      return '';
    }
  } catch {
    // Proceed if read fails
  }

  const notifRef = ref(database, `notifications/${params.recipientUid}`);
  const newRef = push(notifRef);
  const id = newRef.key!;

  const payload: AppNotification = {
    id,
    recipientUid: params.recipientUid,
    senderUid: params.senderUid,
    senderName: params.senderName,
    senderAvatar: params.senderAvatar || null,
    type: params.type,
    title: params.title,
    body: params.body,
    roomId: params.roomId,
    actionUrl: params.actionUrl,
    isRead: false,
    timestamp: Date.now(),
  };

  await set(newRef, payload);
  return id;
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(
  uid: string,
  notifId: string,
): Promise<void> {
  const notifRef = ref(database, `notifications/${uid}/${notifId}`);
  await update(notifRef, { isRead: true });
}

/**
 * Marks ALL notifications as read for a user.
 */
export async function markAllNotificationsRead(uid: string): Promise<void> {
  const notifRef = ref(database, `notifications/${uid}`);
  const snapshot = await import('firebase/database').then(({ get }) => get(notifRef));
  if (!snapshot.exists()) return;

  const updates: Record<string, boolean> = {};
  snapshot.forEach((child) => {
    updates[`notifications/${uid}/${child.key}/isRead`] = true;
  });

  await update(ref(database), updates);
}

/**
 * Subscribes to real-time notifications for a user (last 40).
 */
export function subscribeToNotifications(
  uid: string,
  callback: (notifications: AppNotification[]) => void,
): Unsubscribe {
  const notifQuery = query(
    ref(database, `notifications/${uid}`),
    orderByChild('timestamp'),
    limitToLast(40),
  );

  return onValue(notifQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const items: AppNotification[] = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data && data.id) items.push(data as AppNotification);
    });

    callback(items.reverse()); // newest first
  });
}

/**
 * Returns the unread notification count (live subscriber).
 */
export function subscribeToUnreadCount(
  uid: string,
  callback: (count: number) => void,
): Unsubscribe {
  return subscribeToNotifications(uid, (notifications) => {
    callback(notifications.filter((n) => !n.isRead).length);
  });
}
