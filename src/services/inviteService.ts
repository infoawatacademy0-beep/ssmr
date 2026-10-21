import { ref, push, set, update, get, onValue, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { RoomInvite } from '../types';
import { sendNotification } from './notificationService';

/**
 * Sends a room invite to a target user.
 * Writes to `/invites/{inviteeUid}/{inviteId}` and triggers a notification.
 */
export async function sendRoomInvite(params: {
  roomId: string;
  roomName: string;
  hostUid: string;
  hostName: string;
  inviteeUid: string;
}): Promise<string> {
  const { roomId, roomName, hostUid, hostName, inviteeUid } = params;

  const invitesRef = ref(database, `invites/${inviteeUid}`);
  const newRef = push(invitesRef);
  const id = newRef.key!;
  const now = Date.now();

  const invite: RoomInvite = {
    id,
    roomId,
    roomName,
    hostUid,
    hostName,
    inviteeUid,
    status: 'pending',
    timestamp: now,
    expiresAt: now + 1000 * 60 * 15, // 15 minutes expiry
  };

  await set(newRef, invite);

  // Send in-app notification
  await sendNotification({
    recipientUid: inviteeUid,
    senderUid: hostUid,
    senderName: hostName,
    type: 'room_invite',
    title: 'Room Invite',
    body: `${hostName} invited you to join "${roomName}"`,
    roomId,
    actionUrl: `/room/${roomId}`,
  });

  return id;
}

/**
 * Accept or decline a room invite.
 */
export async function respondToInvite(
  inviteeUid: string,
  inviteId: string,
  response: 'accepted' | 'declined',
): Promise<void> {
  const inviteRef = ref(database, `invites/${inviteeUid}/${inviteId}`);
  await update(inviteRef, { status: response });
}

/**
 * Subscribes to live pending room invites for a user.
 */
export function subscribeToInvites(
  uid: string,
  callback: (invites: RoomInvite[]) => void,
): Unsubscribe {
  const invitesRef = ref(database, `invites/${uid}`);
  return onValue(invitesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const now = Date.now();
    const list: RoomInvite[] = [];
    snapshot.forEach((child) => {
      const data = child.val() as RoomInvite;
      if (data && data.status === 'pending' && data.expiresAt > now) {
        list.push(data);
      }
    });
    callback(list.sort((a, b) => b.timestamp - a.timestamp));
  });
}
