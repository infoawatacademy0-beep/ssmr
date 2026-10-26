import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  RemoteTrackPublication,
  RemoteAudioTrack,
  ConnectionState,
} from 'livekit-client';
import { LIVEKIT_CONFIG } from '../config/livekit';
import { fetchLiveKitToken } from '../services/livekitToken';
import type { User, Seat, VoiceEffectMode } from '../types';

/* ─────────────────────────────────────────────────────────────
   useVoiceRoom Hook — WebRTC LiveKit Voice Streaming
   Connects client to LiveKit Room, syncs microphone state
   with Firebase seat state, and handles audio streaming.
   ───────────────────────────────────────────────────────────── */

interface UseVoiceRoomProps {
  roomId: string;
  currentUser: User | null;
  mySeat: Seat | null;
  allSeats?: Seat[];
}

export function useVoiceRoom({
  roomId,
  currentUser,
  mySeat,
}: UseVoiceRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [speakingUids, setSpeakingUids] = useState<Set<string>>(new Set());
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [isSelfMonitoring, setIsSelfMonitoring] = useState(false);

  // Reference to persistent LiveKit room instance
  const roomRef = useRef<Room | null>(null);
  // Container for remote audio elements attached to the DOM
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const mySeatRef = useRef<Seat | null>(mySeat);
  mySeatRef.current = mySeat;

  /* ─────────────────────────────────────────────────────────────
     1. Initialize & Connect to LiveKit Room
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!roomId || !currentUser) return;

    let isMounted = true;
    const isNoiseSuppEnabled =
      typeof window === 'undefined' ||
      localStorage.getItem('ssmr_noise_suppression') !== 'false';

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false,
      stopLocalTrackOnUnpublish: false,
      audioCaptureDefaults: {
        autoGainControl: isNoiseSuppEnabled,
        echoCancellation: isNoiseSuppEnabled,
        noiseSuppression: isNoiseSuppEnabled,
      },
      publishDefaults: {
        dtx: true,
        red: true,
      },
    });

    roomRef.current = room;
    setIsConnecting(true);
    setConnectionError(null);

    // Create a persistent container for remote audio elements
    let container = document.getElementById('livekit-audio-container') as HTMLDivElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'livekit-audio-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0.01';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-1';
      document.body.appendChild(container);
    }
    audioContainerRef.current = container;

    // Attach active speakers listener (real-time voice activity detection)
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (!isMounted) return;
      const activeIds = new Set<string>();
      for (const speaker of speakers) {
        if (speaker.identity) {
          activeIds.add(speaker.identity);
        }
      }
      setSpeakingUids(activeIds);
    });

    // Handle remote participant audio playback
    room.on(
      RoomEvent.TrackSubscribed,
      (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
          const audioElement = (track as RemoteAudioTrack).attach();
          audioElement.id = `audio-${participant.identity}-${publication.trackSid}`;
          audioElement.setAttribute('playsinline', 'true');
          audioElement.setAttribute('webkit-playsinline', 'true');
          audioContainerRef.current.appendChild(audioElement);

          // Handle browser autoplay policy
          audioElement.play().catch((err) => {
            console.warn('Autoplay restricted by browser, user interaction required:', err);
            setAudioAutoplayBlocked(true);
          });
        }
      },
    );

    // Cleanup audio elements when tracks are unsubscribed
    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: Track) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => el.remove());
        }
      },
    );

    // Monitor audio playback blocked status
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!isMounted) return;
      setAudioAutoplayBlocked(!room.canPlaybackAudio);
    });

    // Monitor connection states
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (!isMounted) return;
      setIsConnected(state === ConnectionState.Connected);
      setIsConnecting(state === ConnectionState.Connecting);
    });

    // Connect with generated token
    async function connectToLiveKit() {
      try {
        const token = await fetchLiveKitToken(
          roomId,
          currentUser!.uid,
          currentUser!.username,
        );

        if (!isMounted) return;

        await room.connect(LIVEKIT_CONFIG.url, token);

        if (isMounted) {
          setIsConnected(true);
          setIsConnecting(false);

          // Check if audio can be played
          if (!room.canPlaybackAudio) {
            setAudioAutoplayBlocked(true);
          }
        }
      } catch (err: any) {
        console.error('Failed to connect to LiveKit voice room:', err);
        if (isMounted) {
          setConnectionError(err.message || 'WebRTC Voice connection failed.');
          setIsConnecting(false);
        }
      }
    }

    connectToLiveKit();

    return () => {
      isMounted = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
      setIsSelfMonitoring(false);
      room.disconnect();
      if (audioContainerRef.current) {
        audioContainerRef.current.innerHTML = '';
      }
      roomRef.current = null;
    };
  }, [roomId, currentUser?.uid]);

  /* ─────────────────────────────────────────────────────────────
     2. Mute/Unmute Synchronization with Seat State
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const isMicOpen = Boolean(mySeat && !mySeat.isMuted);

    async function syncMicrophoneState() {
      try {
        if (isMicOpen) {
          if (!room!.localParticipant.isMicrophoneEnabled) {
            await room!.localParticipant.setMicrophoneEnabled(true);
          }

          // Request screen wakeLock to prevent screen from sleeping while speaking
          if (
            typeof navigator !== 'undefined' &&
            'wakeLock' in navigator &&
            document.visibilityState === 'visible' &&
            !wakeLockRef.current
          ) {
            (navigator as any).wakeLock
              .request('screen')
              .then((lock: any) => {
                wakeLockRef.current = lock;
                lock.addEventListener?.('release', () => {
                  wakeLockRef.current = null;
                });
              })
              .catch(() => {});
          }
        } else {
          if (room!.localParticipant.isMicrophoneEnabled) {
            await room!.localParticipant.setMicrophoneEnabled(false);
          }
        }
      } catch (err) {
        console.error('Error synchronizing LiveKit microphone with seat state:', err);
      }
    }

    syncMicrophoneState();
  }, [mySeat?.seatNo, mySeat?.isMuted, isConnected]);

  /* ─────────────────────────────────────────────────────────────
     3. Helper: User Gesture to Resume Blocked Audio
     ───────────────────────────────────────────────────────────── */
  const unlockAudioAutoplay = useCallback(async () => {
    try {
      if (roomRef.current) {
        await roomRef.current.startAudio();
      }
    } catch (e) {
      console.warn('LiveKit startAudio error:', e);
    }

    if (audioContainerRef.current) {
      const audioElements = audioContainerRef.current.querySelectorAll('audio');
      audioElements.forEach((el) => {
        el.play().catch(() => {});
      });
    }
    setAudioAutoplayBlocked(false);
  }, []);

  const toggleSelfMonitor = useCallback(() => {
    setIsSelfMonitoring((prev) => !prev);
  }, []);

  return {
    isConnected,
    isConnecting,
    connectionError,
    speakingUids,
    audioAutoplayBlocked,
    unlockAudioAutoplay,
    isSelfMonitoring,
    toggleSelfMonitor,
    room: roomRef.current,
  };
}
