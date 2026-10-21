export type DirectMessageType = 'text' | 'image' | 'voice';

export interface DirectMessage {
  id: string;
  threadId: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string | null;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  type: DirectMessageType;
  timestamp: number;
}

export interface ChatThreadMeta {
  threadId: string;
  participants: string[];
  lastMessageText: string;
  lastMessageTimestamp: number;
  lastSenderUid: string;
}
