import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { DirectMessage, DirectMessageType, ChatThreadMeta, UserInboxItem } from '../types';

/**
 * Derives a deterministic lexicographical thread ID from two user UIDs.
 */
export function getThreadId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Normalizes raw direct messages snapshot into a chronologically sorted DirectMessage array.
 */
export function normalizeDirectMessages(rawMessages: unknown): DirectMessage[] {
  if (!rawMessages) return [];

  let list: unknown[] = [];
  if (Array.isArray(rawMessages)) {
    list = rawMessages;
  } else if (typeof rawMessages === 'object') {
    list = Object.values(rawMessages as Record<string, unknown>);
  }

  return list
    .filter((m): m is DirectMessage => Boolean(m && typeof m === 'object' && 'id' in m))
    .map((m) => ({
      id: String(m.id),
      threadId: String(m.threadId),
      senderUid: String(m.senderUid),
      senderName: String(m.senderName || 'Anonymous'),
      senderAvatar: m.senderAvatar ? String(m.senderAvatar) : null,
      text: m.text ? String(m.text) : undefined,
      imageUrl: m.imageUrl ? String(m.imageUrl) : undefined,
      audioUrl: m.audioUrl ? String(m.audioUrl) : undefined,
      duration: m.duration ? Number(m.duration) : undefined,
      type: (m.type as DirectMessageType) || 'text',
      timestamp: Number(m.timestamp) || Date.now(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Sends a private direct message (text, image link, or voice memo string).
 */
export async function sendDirectMessage(params: {
  threadId: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string | null;
  recipientUid?: string;
  recipientName?: string;
  recipientAvatar?: string | null;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  type?: DirectMessageType;
}): Promise<string> {
  const { threadId, senderUid, senderName, senderAvatar, text, imageUrl, audioUrl, duration } = params;

  if (!threadId || !senderUid) {
    throw new Error('Thread ID and Sender UID are required.');
  }

  const determinedType: DirectMessageType =
    params.type || (audioUrl ? 'voice' : imageUrl ? 'image' : 'text');

  if (determinedType === 'text' && (!text || !text.trim())) {
    throw new Error('Message text cannot be empty.');
  }

  const [p1, p2] = threadId.split('_');
  const targetUid = params.recipientUid || (senderUid === p1 ? p2 : p1);

  // Enforce recipient's "Allow Direct Messages" privacy setting
  if (targetUid && targetUid !== senderUid) {
    try {
      const dmSnap = await get(ref(database, `users/${targetUid}/allowDirectMessages`));
      if (dmSnap.exists() && dmSnap.val() === false) {
        throw new Error(
          'ئەم بەکارهێنەرە وەرگرتنی نامەی تایبەتی (Direct Messages)ـی لە ڕێکخستنەکان داخستووە.',
        );
      }
    } catch (err: any) {
      if (err?.message?.includes('Direct Messages')) {
        throw err;
      }
    }
  }

  const messagesRef = ref(database, `chats/${threadId}/messages`);
  const newMessageRef = push(messagesRef);
  const messageId = newMessageRef.key;

  if (!messageId) {
    throw new Error('Failed to generate message key.');
  }

  const now = Date.now();

  // Clean payload: Firebase RTDB strictly rejects any `undefined` value
  const messageData: Record<string, any> = {
    id: messageId,
    threadId,
    senderUid,
    senderName,
    senderAvatar: senderAvatar || null,
    type: determinedType,
    timestamp: now,
  };

  if (text && text.trim()) {
    messageData.text = text.trim();
  }
  if (imageUrl && imageUrl.trim()) {
    messageData.imageUrl = imageUrl.trim();
  }
  if (audioUrl) {
    messageData.audioUrl = audioUrl;
  }
  if (duration !== undefined && !isNaN(duration)) {
    messageData.duration = Math.round(Number(duration));
  }

  // 1. Write the message node
  await set(newMessageRef, messageData);

  // 2. Update thread metadata
  const metaRef = ref(database, `chats/${threadId}/meta`);
  const previewText =
    determinedType === 'text'
      ? text!.trim().slice(0, 50)
      : determinedType === 'image'
      ? '[Image Attachment]'
      : '[Voice Memo]';

  const metaUpdate: ChatThreadMeta = {
    threadId,
    participants: threadId.split('_'),
    lastMessageText: previewText,
    lastMessageTimestamp: now,
    lastSenderUid: senderUid,
  };

  await update(metaRef, metaUpdate);

  // 3. Update both participants' inboxes for real-time list
  if (targetUid) {
    try {
      const senderInboxRef = ref(database, `userInboxes/${senderUid}/${targetUid}`);
      const recipientInboxRef = ref(database, `userInboxes/${targetUid}/${senderUid}`);

      await set(senderInboxRef, {
        recipientUid: targetUid,
        recipientName: params.recipientName || 'User',
        recipientAvatar: params.recipientAvatar || null,
        lastMessage: previewText,
        lastMessageTimestamp: now,
        lastSenderUid: senderUid,
        threadId,
      });

      await set(recipientInboxRef, {
        recipientUid: senderUid,
        recipientName: senderName,
        recipientAvatar: senderAvatar || null,
        lastMessage: previewText,
        lastMessageTimestamp: now,
        lastSenderUid: senderUid,
        threadId,
      });
    } catch (inboxErr) {
      console.warn('Inbox metadata update non-critical warning:', inboxErr);
    }
  }

  return messageId;
}

/**
 * Subscribes to real-time messages within a direct message thread.
 */
export function subscribeToDirectMessages(
  threadId: string,
  onUpdate: (messages: DirectMessage[]) => void,
): Unsubscribe {
  const messagesRef = ref(database, `chats/${threadId}/messages`);

  return onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
    } else {
      onUpdate(normalizeDirectMessages(snapshot.val()));
    }
  });
}

/**
 * Subscribes to all active chat conversations for a given user.
 */
export function subscribeToUserInbox(
  uid: string,
  onUpdate: (threads: UserInboxItem[]) => void,
): Unsubscribe {
  const inboxRef = ref(database, `userInboxes/${uid}`);

  return onValue(inboxRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const val = snapshot.val();
    const list: UserInboxItem[] = Object.values(val);
    list.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    onUpdate(list);
  });
}
