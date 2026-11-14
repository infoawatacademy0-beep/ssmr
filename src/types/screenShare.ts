export type ScreenShareDeviceType = 'mobile' | 'pc' | 'laptop';

export interface RoomScreenShareState {
  isActive: boolean;
  presenterUid: string;
  presenterName: string;
  presenterAvatar?: string | null;
  deviceType: ScreenShareDeviceType;
  hasSystemAudio?: boolean;
  startedAt: number;
}
