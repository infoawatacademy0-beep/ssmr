export interface RoomInvite {
  id: string;
  roomId: string;
  roomName: string;
  hostUid: string;
  hostName: string;
  inviteeUid: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  timestamp: number;
  expiresAt: number;
}
