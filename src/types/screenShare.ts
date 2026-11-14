export type ScreenShareDeviceType = 'mobile' | 'pc' | 'laptop';

export interface RoomScreenShareState {
  streamId: string;
  isActive: boolean;
  presenterUid: string;
  presenterName: string;
  presenterAvatar?: string | null;
  deviceType: ScreenShareDeviceType;
  hasSystemAudio?: boolean;
  startedAt: number;
  updatedAt?: number;
}
