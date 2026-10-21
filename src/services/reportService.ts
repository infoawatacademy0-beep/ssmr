import { ref, push, set } from 'firebase/database';
import { database } from '../config/firebase';
import type { ReportItem, ReportTargetType } from '../types';

/**
 * Submits a moderation report to `/reports/{reportId}` in Firebase Realtime Database.
 */
export async function submitReport(
  reporterUid: string,
  targetId: string,
  type: ReportTargetType,
  reason: string,
  details?: string,
  reporterName?: string,
): Promise<string> {
  if (!reporterUid || !targetId) {
    throw new Error('Reporter UID and Target ID are required.');
  }

  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error('Please select or specify a reason for the report.');
  }

  const reportsRef = ref(database, 'reports');
  const newReportRef = push(reportsRef);
  const reportId = newReportRef.key;

  if (!reportId) {
    throw new Error('Failed to generate report identifier.');
  }

  const reportPayload: ReportItem = {
    id: reportId,
    reporterUid,
    reporterName: reporterName || 'Anonymous',
    targetId,
    targetType: type,
    reason: cleanReason,
    details: details?.trim() || '',
    timestamp: Date.now(),
    status: 'pending',
  };

  await set(newReportRef, reportPayload);
  return reportId;
}
