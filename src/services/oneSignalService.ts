import { ref, get, set, remove } from 'firebase/database';
import { database } from '../config/firebase';

/* ─────────────────────────────────────────────────────────────
   OneSignal Web Push Notification Service
   App ID: b93b7d97-85fb-4b90-9639-94800375ba63

   Works even when the browser/web app is completely closed!
   Implements:
   1. Rule 1 (Room Entry): Broadcasts push notification to ALL members
      for ANY room (including rooms owned by other users), with the
      entering user's name + the room's title.
   2. Rule 2 (Direct/Private Chat): Sends push notification ONLY to
      Member B (recipient) with Member A's name + message preview.
   3. Profile Visit Notification: Sends push notification ONLY to the
      profile owner when someone visits their profile.
   4. Rule 3 (Notification Dismissal/Clearance): Automatically clears
      and dismisses the notification from Member B's device tray and
      OneSignal queue as soon as Member B opens/reads the chat.
   ───────────────────────────────────────────────────────────── */

export const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || 'b93b7d97-85fb-4b90-9639-94800375ba63';
export const ONESIGNAL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIAePpAesCmbZIJ1i7b505etLNN+q
m575890tN1jcPTPCXRVrmBwXhaesv5BrGqPd1UsGir7mgpuM4ZBLJ1JPjA==
-----END PUBLIC KEY-----`;
const ONESIGNAL_REST_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY || '';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void | Promise<void>>;
    OneSignal?: any;
  }
}

let isOneSignalInitialized = false;
let permissionListenerAttached = false;

/**
 * Direct OneSignal REST API helper (used as automatic fallback when hosted on static SPA hosting
 * where `/api/onesignal/*` backend routes are not running).
 */
async function callOneSignalRestDirectly(
  endpoint: string,
  method: 'POST' | 'DELETE' = 'POST',
  payload?: Record<string, any>,
): Promise<any> {
  const response = await fetch(`https://api.onesignal.com${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Key ${ONESIGNAL_REST_KEY}`,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return await response.json().catch(() => ({}));
}

/**
 * Sends a notification to a single target user (tries tag `uid` first, then `external_id` alias).
 */
async function sendDirectToSingleUser(
  targetUid: string,
  basePayload: Record<string, any>,
): Promise<any> {
  const tagPayload = {
    ...basePayload,
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push',
    filters: [{ field: 'tag', key: 'uid', relation: '=', value: String(targetUid) }],
  };
  const tagRes = await callOneSignalRestDirectly('/notifications', 'POST', tagPayload);
  if (tagRes?.id) {
    return tagRes;
  }

  const aliasPayload = {
    ...basePayload,
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push',
    include_aliases: {
      external_id: [String(targetUid)],
    },
  };
  return await callOneSignalRestDirectly('/notifications', 'POST', aliasPayload);
}

/**
 * Initializes the OneSignal Web SDK v16, requests browser Push permission,
 * opts in the Service Worker push subscription, and binds the user's UID
 * so background push notifications arrive even when the website is closed.
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
          serviceWorkerParam: { scope: '/' },
          notifyButton: {
            enable: false,
          },
        });
        isOneSignalInitialized = true;
      }

      // 1. Bind Firebase UID as OneSignal external_id
      try {
        await OneSignal.login(uid);
      } catch {}

      // 2. Add user tags (`uid` and `username`) so tag-based targeting works immediately
      try {
        await OneSignal.User.addTags({
          uid: String(uid),
          username: String(username || 'User'),
          role: 'member',
        });
      } catch {}

      // 3. Ensure Push Subscription is opted-in and permission is granted
      const ensureSubscribed = async () => {
        try {
          if (OneSignal.Notifications) {
            const hasPerm = OneSignal.Notifications.permission;
            if (!hasPerm) {
              await OneSignal.Notifications.requestPermission();
            }
          }
          if (OneSignal.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
          }
        } catch {}
      };

      await ensureSubscribed();

      // If browser blocked auto-prompt before user gesture, prompt on first click/tap
      if (!permissionListenerAttached && typeof document !== 'undefined') {
        permissionListenerAttached = true;
        const onFirstGesture = () => {
          ensureSubscribed();
          document.removeEventListener('click', onFirstGesture);
          document.removeEventListener('touchstart', onFirstGesture);
        };
        document.addEventListener('click', onFirstGesture, { once: true });
        document.addEventListener('touchstart', onFirstGesture, { once: true });
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
 * Triggered when ANY user enters ANY voice room (whether their own room or someone else's room).
 * Broadcasts a push notification to ALL subscribed members with the user's name and room title.
 */
export async function triggerRoomEntryPushNotification(params: {
  userId: string;
  username: string;
  roomId: string;
  roomName: string;
}): Promise<void> {
  const { userId, username, roomId, roomName } = params;
  if (!username || !roomName || !roomId) return;

  // Short 8-second debounce per room+user only to prevent React StrictMode double-fire
  const throttleKey = `ssmr_onesignal_room_${roomId}_${userId}`;
  const lastSent = Number(sessionStorage.getItem(throttleKey) || 0);
  if (Date.now() - lastSent < 8_000) return;
  sessionStorage.setItem(throttleKey, String(Date.now()));

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const roomUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/room/${roomId}` : undefined;

  try {
    const res = await fetch('/api/onesignal/room-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        username,
        roomId,
        roomName,
        siteUrl,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (json?.result?.data?.id) return;
    }
  } catch {}

  // Direct fallback so it works on static hosting / Vercel SPA rewrites too
  try {
    await callOneSignalRestDirectly('/notifications', 'POST', {
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      included_segments: ['Total Subscriptions'],
      headings: {
        en: `🎙️ ${username} entered ${roomName}`,
        ckb: `🎙️ ${username} چووە ناو ژووری ${roomName}`,
      },
      contents: {
        en: `${username} just entered the room "${roomName}". Tap to join the voice chat!`,
        ckb: `${username} چووە ناو ژووری «${roomName}». کلیک بکە بۆ بەشداریکردن!`,
      },
      web_push_topic: `room_entry_${roomId}_${Date.now()}`,
      url: roomUrl,
      data: {
        type: 'room_entry',
        userId,
        username,
        roomId,
        roomName,
      },
    });
  } catch (err) {
    console.warn('Room entry direct push warning:', err);
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

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const topicTag = `dm_${threadId}`;
  let notificationId: string | null = null;

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
        siteUrl,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json().catch(() => null);
      notificationId = data?.notificationId || null;
    }
  } catch {}

  // Direct fallback if backend route wasn't hit
  if (!notificationId) {
    try {
      const directRes = await sendDirectToSingleUser(recipientUid, {
        headings: {
          en: `💬 ${senderName}`,
          ckb: `💬 نامەی نوێ لەلایەن ${senderName}`,
        },
        contents: {
          en: `${senderName}: ${messagePreview}`,
          ckb: `${senderName}: ${messagePreview}`,
        },
        collapse_id: topicTag,
        web_push_topic: topicTag,
        chrome_web_icon: senderAvatar || undefined,
        url: siteUrl || undefined,
        data: {
          type: 'private_message',
          threadId,
          senderUid,
          senderName,
          recipientUid,
        },
      });
      notificationId = directRes?.id || null;
    } catch (err) {
      console.warn('Private message direct push warning:', err);
    }
  }

  // Store the OneSignal notificationId in Firebase under this thread + recipient
  // so Rule 3 can cancel/dismiss it when Member B opens/reads the chat
  if (notificationId) {
    try {
      const pushIdRef = ref(
        database,
        `chats/${threadId}/activePushIds/${recipientUid}/${notificationId}`,
      );
      await set(pushIdRef, {
        notificationId,
        senderUid,
        timestamp: Date.now(),
      });
    } catch {}
  }
}

/**
 * Profile Visit Push Notification
 * Triggered when someone visits a user's profile (`viewUserProfile`).
 * Sends a push notification ONLY to the profile owner (`targetUid`) even when their browser is closed.
 */
export async function triggerProfileVisitPushNotification(params: {
  visitorUid: string;
  visitorName: string;
  visitorAvatar?: string | null;
  targetUid: string;
}): Promise<void> {
  const { visitorUid, visitorName, visitorAvatar, targetUid } = params;
  if (!targetUid || !visitorUid || targetUid === visitorUid) return;

  // Throttle repeated visits by the same user within 30 seconds
  const throttleKey = `ssmr_onesignal_visit_${targetUid}_${visitorUid}`;
  const lastSent = Number(sessionStorage.getItem(throttleKey) || 0);
  if (Date.now() - lastSent < 30_000) return;
  sessionStorage.setItem(throttleKey, String(Date.now()));

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const topicTag = `visit_${targetUid}_${visitorUid}`;

  try {
    const response = await fetch('/api/onesignal/profile-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUid,
        visitorName,
        visitorAvatar: visitorAvatar || '',
        targetUid,
        siteUrl,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json().catch(() => null);
      if (data?.notificationId) return;
    }
  } catch {}

  // Direct fallback
  try {
    await sendDirectToSingleUser(targetUid, {
      headings: {
        en: `👁️ Profile Visitor: ${visitorName}`,
        ckb: `👁️ سەردانی پڕۆفایل لەلایەن ${visitorName}`,
      },
      contents: {
        en: `${visitorName} just visited your profile!`,
        ckb: `${visitorName} سەردانی پڕۆفایلەکەتی کرد!`,
      },
      collapse_id: topicTag,
      web_push_topic: topicTag,
      chrome_web_icon: visitorAvatar || undefined,
      url: siteUrl || undefined,
      data: {
        type: 'profile_visit',
        visitorUid,
        visitorName,
        targetUid,
      },
    });
  } catch (err) {
    console.warn('Profile visit push warning:', err);
  }
}

/**
 * RULE 3: Notification Dismissal / Clearance
 * Triggered when Member B opens or reads the private chat from Member A.
 * 1. Immediately closes matching notifications from the browser/device notification tray via ServiceWorker.
 * 2. Updates OneSignal user tags to mark the thread as read/cleared.
 * 3. Cancels/deletes any active OneSignal notifications via REST API.
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

  // 3. Fetch stored OneSignal notification IDs for this thread and cancel them
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
      let handledByBackend = false;
      try {
        const res = await fetch('/api/onesignal/dismiss-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientUid,
            senderUid,
            threadId,
            notificationIds,
          }),
        });
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          handledByBackend = true;
        }
      } catch {}

      if (!handledByBackend) {
        for (const notifId of notificationIds) {
          await callOneSignalRestDirectly(
            `/notifications/${encodeURIComponent(notifId)}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`,
            'DELETE',
          );
        }
      }
    }
  } catch (err) {
    console.warn('Backend notification dismissal warning:', err);
  }
}
