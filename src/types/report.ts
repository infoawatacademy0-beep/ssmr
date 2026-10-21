export type ReportTargetType = 'room' | 'user';

export interface ReportItem {
  id: string;
  reporterUid: string;
  reporterName?: string;
  reporterUsername?: string;
  targetId: string;
  targetUserId?: string;
  targetUsername?: string;
  roomId?: string;
  targetType: ReportTargetType;
  reason: string;
  details?: string;
  timestamp: number;
  status: 'pending' | 'resolved' | 'dismissed';
  resolutionNotes?: string;
}
