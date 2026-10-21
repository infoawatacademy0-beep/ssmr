export type NotificationType =
  | 'follow'
  | 'gift_received'
  | 'dm_received'
  | 'game_invite'
  | 'room_invite'
  | 'leaderboard_rank'
  | 'system';

export interface AppNotification {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  roomId?: string;
  isRead: boolean;
  timestamp: number;
}
