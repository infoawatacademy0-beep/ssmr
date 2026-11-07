import { ref, get, set, remove } from 'firebase/database';
import { database } from '../config/firebase';

/* ─────────────────────────────────────────────────────────────
   OneSignal Web Push Notification Service
   App ID: b93b7d97-85fb-4b90-9639-94800375ba63

   Implements:
   1. Rule 1 (Room Entry): Broadcasts push notification to ALL members
      with the entering user's name + the room's title.
   2. Rule 2 (Direct/Private Chat): Sends push notification ONLY to
      Member B (recipient) with Member A's name + message preview.
   3. Rule 3 (Notification Dismissal/Clearance): Automatically clears
      and dismisses the notification from Member B's device tray and
      OneSignal queue as soon as Member B opens/reads the chat.
   ───────────────────────────────────────────────────────────── */

export const ONESIGNAL_APP_ID = 'b93b7d97-85fb-4b90-9639-94800375ba63';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void | Promise<void>>;
    OneSignal?: any;
  }
}

let isOneSignalInitialized = false;

/**
 * Initializes the OneSignal Web SDK v16 and binds the authenticated user's UID
 * as the `external_id` so targeted notifications (Rule 2) and tag management (Rule 3) work.
 */
export function initOneSignalForUser(uid: string, username: string): void {
  if (typeof window === 'undefined' || !uid) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (!isOneSignalInitialized) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          notifyButton: {
            enable: false,
          },
        });
        isOneSignalInitialized = true;
      }

      // Bind Firebase UID as OneSignal external_id so Backend can target Member B directly
      await OneSignal.login(uid);

      // Set user tags for filtering (e.g. excluding sender on Room Entry broadcast & tag clearance)
      await OneSignal.User.addTags({
        uid,
        username,
        role: 'member',
      });

      // Request push permission if not yet granted
      if (OneSignal.Notifications && !OneSignal.Notifications.permission) {
        await OneSignal.Notifications.requestPermission();
      }
    } catch (err) {
      console.warn('OneSignal initialization warning:', err);
    }
  });
}

/**
 * Logs out the current user from OneSignal when they sign out.
 */
export function logoutOneSignalUser(): void {
  if (typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (isOneSignalInitialized) {
        await OneSignal.logout();
      }
    } catch {}
  });
}

/**
 * RULE 1: Room Entry Notification
 * Triggered when a user enters a specific voice room.
 * Sends a push notification to ALL members with the user's name and the room's title.
 */
export async function triggerRoomEntryPushNotification(params: {
  userId: string;
  username: string;
  roomId: string;
  roomName: string;
}): Promise<void> {
  const { userId, username, roomId, roomName } = params;
  if (!username || !roomName || !roomId) return;

  // Throttle duplicate room entry broadcasts for the same user + room within 60 seconds
  const throttleKey = `ssmr_onesignal_room_${roomId}_${userId}`;
  const lastSent = Number(sessionStorage.getItem(throttleKey) || 0);
  if (Date.now() - lastSent < 60_000) return;
  sessionStorage.setItem(throttleKey, String(Date.now()));

  try {
    await fetch('/api/onesignal/room-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        username,
        roomId,
        roomName,
        siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });
  } catch (err) {
    console.warn('Room entry push trigger warning:', err);
  }
}

/**
 * RULE 2: Direct / Private Chat Message Notification
 * Triggered when Member A sends a private message to Member B.
 * Sends a push notification ONLY to Member B with Member A's name and message preview.
 */
export async function triggerPrivateMessagePushNotification(params: {
  threadId: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string | null;
  recipientUid: string;
  messagePreview: string;
}): Promise<void> {
  const { threadId, senderUid, senderName, senderAvatar, recipientUid, messagePreview } = params;
  if (!recipientUid || !senderUid || recipientUid === senderUid) return;

  try {
    const response = await fetch('/api/onesignal/private-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        senderUid,
        senderName,
        senderAvatar: senderAvatar || '',
        recipientUid,
        messagePreview,
        siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });

    const data = await response.json().catch(() => null);
    const notificationId = data?.notificationId;

    // Store the OneSignal notificationId in Firebase under this thread + recipient
    // so Rule 3 can cancel/dismiss it via REST API when Member B reads the chat
    if (notificationId) {
      const pushIdRef = ref(
        database,
        `chats/${threadId}/activePushIds/${recipientUid}/${notificationId}`,
      );
      await set(pushIdRef, {
        notificationId,
        senderUid,
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    console.warn('Private message push trigger warning:', err);
  }
}

/**
 * RULE 3: Notification Dismissal / Clearance
 * Triggered when Member B opens or reads the private chat from Member A.
 * 1. Immediately closes matching notifications from the browser/device notification tray via ServiceWorker.
 * 2. Updates OneSignal user tags to mark the thread as read/cleared.
 * 3. Calls Backend `/api/onesignal/dismiss-chat` to delete/cancel any active OneSignal notifications.
 */
export async function clearPrivateChatNotifications(params: {
  recipientUid: string;
  senderUid: string;
  threadId: string;
}): Promise<void> {
  const { recipientUid, senderUid, threadId } = params;
  if (!recipientUid || !threadId) return;

  // 1. Clear from device/browser notification tray via Service Worker API
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.getNotifications) {
          const activeNotifs = await reg.getNotifications();
          for (const notif of activeNotifs) {
            const notifData = (notif as any).data || {};
            const notifTag = notif.tag || '';
            if (
              notifTag.includes(threadId) ||
              notifTag.includes(senderUid) ||
              notifData.threadId === threadId ||
              notifData.senderUid === senderUid
            ) {
              notif.close();
            }
          }
        }
        if (reg.active) {
          reg.active.postMessage({
            type: 'CLEAR_CHAT_NOTIFICATIONS',
            threadId,
            senderUid,
          });
        }
      }
    } catch (swErr) {
      console.warn('ServiceWorker notification close warning:', swErr);
    }
  }

  // 2. Update OneSignal user tags to reflect read status
  if (typeof window !== 'undefined' && window.OneSignalDeferred) {
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.User.addTags({
          last_read_thread: threadId,
          [`unread_${senderUid}`]: '0',
        });
      } catch {}
    });
  }

  // 3. Fetch stored OneSignal notification IDs for this thread and cancel them on the backend
  try {
    const pushIdsRef = ref(database, `chats/${threadId}/activePushIds/${recipientUid}`);
    const snap = await get(pushIdsRef);
    const notificationIds: string[] = [];

    if (snap.exists()) {
      const val = snap.val() as Record<string, any>;
      Object.keys(val).forEach((id) => notificationIds.push(id));
      await remove(pushIdsRef);
    }

    if (notificationIds.length > 0) {
      await fetch('/api/onesignal/dismiss-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUid,
          senderUid,
          threadId,
          notificationIds,
        }),
      });
    }
  } catch (err) {
    console.warn('Backend notification dismissal warning:', err);
  }
}
