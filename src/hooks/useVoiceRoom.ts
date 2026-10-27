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
  allSeats = [],
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
  const allSeatsRef = useRef<Seat[]>(allSeats);
  allSeatsRef.current = allSeats;

  // Check if a participant identity is permitted to speak (must occupy an active unmuted seat)
  const isParticipantAllowedToSpeak = useCallback((identity: string): boolean => {
    if (!identity) return false;
    const currentSeats = allSeatsRef.current || [];
    const seat = currentSeats.find((s) => s.userId === identity);
    // If not seated (audience) or seat is muted in Firebase -> silent
    if (!seat || seat.isMuted) return false;
    return true;
  }, []);

  // Helper to strictly disable mic, stop hardware tracks, and unpublish all audio
  const stopAndUnpublishLocalAudio = async (targetRoom: Room) => {
    try {
      if (targetRoom.localParticipant.isMicrophoneEnabled) {
        await targetRoom.localParticipant.setMicrophoneEnabled(false);
      }
      const publications = Array.from(targetRoom.localParticipant.audioTrackPublications.values());
      for (const publication of publications) {
        const track = publication.track;
        if (track) {
          try {
            track.stop();
            if (track.mediaStreamTrack) {
              track.mediaStreamTrack.enabled = false;
              track.mediaStreamTrack.stop();
            }
            await targetRoom.localParticipant.unpublishTrack(track, true);
          } catch (err) {
            console.warn('Error stopping/unpublishing track:', err);
          }
        }
      }
    } catch (e) {
      console.warn('Error in stopAndUnpublishLocalAudio:', e);
    }
  };

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
      stopLocalTrackOnUnpublish: true, // Hardware mic stops immediately when unpublished
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
        if (speaker.identity && isParticipantAllowedToSpeak(speaker.identity)) {
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
          audioElement.setAttribute('data-participant-uid', participant.identity);
          audioElement.setAttribute('playsinline', 'true');
          audioElement.setAttribute('webkit-playsinline', 'true');

          const isAllowed = isParticipantAllowedToSpeak(participant.identity);
          const isGlobalSpeakerMuted = document.body.getAttribute('data-speaker-muted') === 'true';

          if (!isAllowed || isGlobalSpeakerMuted) {
            audioElement.muted = true;
            audioElement.volume = 0;
            audioElement.pause();
          } else {
            audioElement.muted = false;
            audioElement.volume = 1;
          }

          audioContainerRef.current.appendChild(audioElement);

          // Handle browser autoplay policy only if allowed to play
          if (isAllowed && !isGlobalSpeakerMuted) {
            audioElement.play().catch((err) => {
              console.warn('Autoplay restricted by browser, user interaction required:', err);
              setAudioAutoplayBlocked(true);
            });
          }
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

          // Strict initial mic check: If user is audience or seat is muted, ensure mic is stopped
          const isMicOpenOnJoin = Boolean(mySeatRef.current && !mySeatRef.current.isMuted);
          if (!isMicOpenOnJoin) {
            await stopAndUnpublishLocalAudio(room);
          }

          // Check if audio can be played
          if (!room.canPlaybackAudio) {
            setAudioAutoplayBlocked(true);
          }
        }
      } catch (err: any) {
        console.error('Failed to connect to LiveKit voice room:', err);
        if (isMounted) {
          const rawErr = String(err?.message || err || '');
          if (rawErr.includes('429') || rawErr.includes('signal connection') || rawErr.includes('websocket error')) {
            setConnectionError(
              'کێشەی سێرڤەری دەنگ (LiveKit 429 Quota Exceeded): کۆتای بەکارهێنانی سێرڤەری LiveKit گەیشتووەتە ئەوپەڕی سنوور. پێویستە کلیلەکانی LiveKit لە cloud.livekit.io نوێ بکرێنەوە.',
            );
          } else {
            setConnectionError(err.message || 'WebRTC Voice connection failed.');
          }
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
      stopAndUnpublishLocalAudio(room).finally(() => {
        room.disconnect();
      });
      if (audioContainerRef.current) {
        audioContainerRef.current.innerHTML = '';
      }
      roomRef.current = null;
    };
  }, [roomId, currentUser?.uid, isParticipantAllowedToSpeak]);

  /* ─────────────────────────────────────────────────────────────
     2. Mute/Unmute Synchronization with Seat State (Sender)
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const isMicOpen = Boolean(mySeat && !mySeat.isMuted);

    async function syncMicrophoneState() {
      try {
        if (isMicOpen) {
          const hasTrack = Array.from(room!.localParticipant.audioTrackPublications.values()).some(
            (pub) => Boolean(pub.track)
          );
          if (!room!.localParticipant.isMicrophoneEnabled || !hasTrack) {
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
          if (wakeLockRef.current) {
            wakeLockRef.current.release?.().catch(() => {});
            wakeLockRef.current = null;
          }

          // Mute microphone in LiveKit
          if (room!.localParticipant.isMicrophoneEnabled) {
            await room!.localParticipant.setMicrophoneEnabled(false);
          }

          // If audience (not on any seat), completely stop hardware track and unpublish
          if (!mySeat) {
            await stopAndUnpublishLocalAudio(room!);
          }
        }
      } catch (err) {
        console.error('Error synchronizing LiveKit microphone with seat state:', err);
      }
    }

    syncMicrophoneState();
  }, [mySeat?.seatNo, mySeat?.isMuted, mySeat?.userId, isConnected]);

  /* ─────────────────────────────────────────────────────────────
     3. Synchronize Remote Audio Elements with Seat State (Receiver)
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContainerRef.current) return;
    const isGlobalSpeakerMuted = document.body.getAttribute('data-speaker-muted') === 'true';
    const audioElements = audioContainerRef.current.querySelectorAll<HTMLAudioElement>('audio[data-participant-uid]');

    audioElements.forEach((audioEl) => {
      const uid = audioEl.getAttribute('data-participant-uid');
      if (!uid) return;
      const isAllowed = isParticipantAllowedToSpeak(uid);

      if (!isAllowed || isGlobalSpeakerMuted) {
        audioEl.muted = true;
        audioEl.volume = 0;
        audioEl.pause();
      } else {
        audioEl.muted = false;
        audioEl.volume = 1;
        audioEl.play().catch(() => {});
      }
    });

    // Clean up speaking indicators for users who are no longer allowed to speak
    setSpeakingUids((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (isParticipantAllowedToSpeak(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allSeats, isParticipantAllowedToSpeak]);

  /* ─────────────────────────────────────────────────────────────
     4. Helper: User Gesture to Resume Blocked Audio
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
      const isGlobalSpeakerMuted = document.body.getAttribute('data-speaker-muted') === 'true';
      const audioElements = audioContainerRef.current.querySelectorAll<HTMLAudioElement>('audio');
      audioElements.forEach((el) => {
        const uid = el.getAttribute('data-participant-uid');
        const isAllowed = uid ? isParticipantAllowedToSpeak(uid) : true;
        if (!isAllowed || isGlobalSpeakerMuted) {
          el.muted = true;
          el.volume = 0;
          el.pause();
        } else {
          el.muted = false;
          el.volume = 1;
          el.play().catch(() => {});
        }
      });
    }
    setAudioAutoplayBlocked(false);
  }, [isParticipantAllowedToSpeak]);

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
