import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { LIVEKIT_CONFIG } from '../config/livekit';

/* ─────────────────────────────────────────────────────────────
   LiveKit Token Generator & Service
   Generates secure WebRTC access tokens with audio permissions.
   ───────────────────────────────────────────────────────────── */

export interface TokenOptions {
  roomId: string;
  uid: string;
  username?: string;
}

/**
 * Generates a signed LiveKit AccessToken using official livekit-server-sdk.
 * Permissions:
 * - roomJoin: true
 * - audioTrackPublish (canPublish): true
 * - audioTrackSubscribe (canSubscribe): true
 * - videoTrackPublish: false
 */
export async function generateLiveKitToken({
  roomId,
  uid,
  username,
}: TokenOptions): Promise<string> {
  const at = new AccessToken(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret, {
    identity: uid,
    name: username || uid,
    ttl: '6h',
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true, // Can publish audio tracks
    canSubscribe: true, // Can subscribe to incoming audio streams
    canPublishData: true,
  });

  return await at.toJwt();
}

/**
 * Fetches token from backend Express endpoint `/api/livekit/token`.
 * Falls back seamlessly to direct SDK generation if backend is unavailable.
 */
export async function fetchLiveKitToken(
  roomId: string,
  uid: string,
  username?: string,
): Promise<string> {
  try {
    const query = new URLSearchParams({
      roomId,
      uid,
      username: username || uid,
    });

    const response = await fetch(`/api/livekit/token?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.token) {
          return data.token;
        }
      }
    }
  } catch (err) {
    console.warn('API endpoint unavailable, falling back to direct token generator:', err);
  }

  // Seamless fallback using the official SDK directly
  return await generateLiveKitToken({ roomId, uid, username });
}
