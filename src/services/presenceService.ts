import {
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { AudienceMember, Badge } from '../types';

/* ─────────────────────────────────────────────────────────────
   Firebase Presence & Audience Tracking Service
   Handles real-time room listener counting and automatic cleanup
   via Firebase onDisconnect() when users leave or disconnect.
   ───────────────────────────────────────────────────────────── */

export interface AudienceParticipant {
  uid: string;
  username: string;
  level: number;
  avatar?: string;
  isVerified?: boolean;
  badges?: Badge[];
}

/**
 * Registers a user's presence inside `/rooms/{roomId}/audience/{uid}`.
 * Sets up an automatic onDisconnect() hook to remove the user when connection drops.
 * Returns an unregister cleanup function.
 */
export function registerAudiencePresence(
  roomId: string,
  user: AudienceParticipant,
): () => void {
  const connectedRef = ref(database, '.info/connected');
  const userAudienceRef = ref(database, `rooms/${roomId}/audience/${user.uid}`);

  const unsubscribe = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      const audienceData: AudienceMember = {
        uid: user.uid,
        username: user.username,
        level: user.level,
        avatar: user.avatar || '',
        isVerified: Boolean(user.isVerified),
        badges: user.badges || [],
        enteredAt: Date.now(),
      };

      // Set user presence
      set(userAudienceRef, audienceData);

      // On disconnect (tab closed, internet lost), remove node automatically
      onDisconnect(userAudienceRef).remove();
    }
  });

  return () => {
    unsubscribe();
    remove(userAudienceRef).catch(console.error);
  };
}

/**
 * Subscribes in real-time to the audience list of a voice room.
 */
export function subscribeToAudience(
  roomId: string,
  onUpdate: (audience: AudienceMember[]) => void,
): Unsubscribe {
  const audienceRef = ref(database, `rooms/${roomId}/audience`);

  return onValue(audienceRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const rawData = snapshot.val() as Record<string, AudienceMember>;
    const audienceList: AudienceMember[] = Object.values(rawData).sort(
      (a, b) => (b.enteredAt || 0) - (a.enteredAt || 0),
    );

    onUpdate(audienceList);
  });
}
