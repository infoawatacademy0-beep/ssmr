import {
  ref,
  push,
  set,
  update,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { DirectMessage, DirectMessageType, ChatThreadMeta } from '../types';

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
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  type?: DirectMessageType;
}): Promise<string> {
  const { threadId, senderUid, senderName, senderAvatar, text, imageUrl, audioUrl } = params;

  if (!threadId || !senderUid) {
    throw new Error('Thread ID and Sender UID are required.');
  }

  const determinedType: DirectMessageType =
    params.type || (audioUrl ? 'voice' : imageUrl ? 'image' : 'text');

  if (determinedType === 'text' && (!text || !text.trim())) {
    throw new Error('Message text cannot be empty.');
  }

  const messagesRef = ref(database, `chats/${threadId}/messages`);
  const newMessageRef = push(messagesRef);
  const messageId = newMessageRef.key;

  if (!messageId) {
    throw new Error('Failed to generate message key.');
  }

  const now = Date.now();
  const messageData: DirectMessage = {
    id: messageId,
    threadId,
    senderUid,
    senderName,
    senderAvatar: senderAvatar || null,
    text: text ? text.trim() : undefined,
    imageUrl: imageUrl ? imageUrl.trim() : undefined,
    audioUrl: audioUrl || undefined,
    type: determinedType,
    timestamp: now,
  };

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
