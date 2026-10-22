import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  RemoteTrackPublication,
  RemoteAudioTrack,
  LocalAudioTrack,
  ConnectionState,
} from 'livekit-client';
import { LIVEKIT_CONFIG } from '../config/livekit';
import { fetchLiveKitToken } from '../services/livekitToken';
import { VoiceChangerProcessor } from '../services/voiceChanger';
import type { User, Seat, VoiceEffectMode } from '../types';

/* ─────────────────────────────────────────────────────────────
   useVoiceRoom Hook — WebRTC LiveKit Audio Integration
   Connects client to LiveKit Room, syncs microphone state
   with Firebase seat state, applies real-time VIP Voice Changer
   (Normal / Child / Venom), and exposes speaking indicators.
   ───────────────────────────────────────────────────────────── */

interface UseVoiceRoomProps {
  roomId: string;
  currentUser: User | null;
  mySeat: Seat | null;
  allSeats: Seat[];
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
  // Real-time VIP Voice Changer WebAudio processor
  const voiceProcessorRef = useRef<VoiceChangerProcessor | null>(null);
  // Original raw microphone MediaStreamTrack before WebAudio processing
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);

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
      audioCaptureDefaults: {
        autoGainControl: isNoiseSuppEnabled,
        echoCancellation: isNoiseSuppEnabled,
        noiseSuppression: isNoiseSuppEnabled,
        channelCount: 1,
        sampleRate: 48000,
      },
      publishDefaults: {
        dtx: true,
        red: true,
      },
    });

    roomRef.current = room;
    voiceProcessorRef.current = new VoiceChangerProcessor();
    setIsConnecting(true);
    setConnectionError(null);

    // Create a hidden container for remote audio elements if not present
    let container = document.getElementById('livekit-audio-container') as HTMLDivElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'livekit-audio-container';
      container.style.display = 'none';
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
      if (voiceProcessorRef.current) {
        voiceProcessorRef.current.stop();
        voiceProcessorRef.current = null;
      }
      rawMicTrackRef.current = null;
      setIsSelfMonitoring(false);
      // Disconnect cleanly and unpublish any published tracks
      room.disconnect();
      if (audioContainerRef.current) {
        audioContainerRef.current.innerHTML = '';
      }
      roomRef.current = null;
    };
  }, [roomId, currentUser?.uid]);

  /* ─────────────────────────────────────────────────────────────
     2. Mute/Unmute & VIP Voice Changer Synchronization
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    async function syncMicrophoneAndVoiceEffect() {
      try {
        if (mySeat && !mySeat.isMuted) {
          // User is seated on stage and unmuted → Enable microphone in LiveKit
          await room!.localParticipant.setMicrophoneEnabled(true);

          // Apply VIP Voice Changer effect ('normal' | 'child' | 'venom')
          const pub = room!.localParticipant.getTrackPublication(Track.Source.Microphone);
          const localAudioTrack = pub?.audioTrack as LocalAudioTrack | undefined;

          if (localAudioTrack && localAudioTrack.mediaStreamTrack) {
            // Save original raw track reference if not saved or if device changed
            if (
              !rawMicTrackRef.current ||
              rawMicTrackRef.current.readyState === 'ended'
            ) {
              rawMicTrackRef.current = localAudioTrack.mediaStreamTrack;
            }

            const effectMode: VoiceEffectMode =
              (mySeat.voiceEffect && mySeat.voiceEffect !== 'normal'
                ? mySeat.voiceEffect
                : currentUser?.forcedVoiceEffect) || 'normal';
            const processor = voiceProcessorRef.current;

            if (processor && rawMicTrackRef.current) {
              const processedTrack = processor.start(rawMicTrackRef.current, effectMode);
              const sender = (localAudioTrack as unknown as { sender?: RTCRtpSender }).sender;

              if (sender && typeof sender.replaceTrack === 'function') {
                await sender.replaceTrack(processedTrack);
              }
            }
          }
        } else {
          // User is muted or spectator → Strictly disable microphone in LiveKit
          await room!.localParticipant.setMicrophoneEnabled(false);
          if (voiceProcessorRef.current) {
            voiceProcessorRef.current.setSelfMonitor(false);
            setIsSelfMonitoring(false);
          }
        }
      } catch (err) {
        console.error('Error synchronizing LiveKit microphone with seat state:', err);
      }
    }

    syncMicrophoneAndVoiceEffect();

    const handleSettingsChange = () => {
      const enabled = localStorage.getItem('ssmr_noise_suppression') !== 'false';
      if (rawMicTrackRef.current && typeof rawMicTrackRef.current.applyConstraints === 'function') {
        rawMicTrackRef.current
          .applyConstraints({
            noiseSuppression: enabled,
            echoCancellation: enabled,
            autoGainControl: enabled,
          })
          .catch(() => {});
      }
      if (voiceProcessorRef.current) {
        voiceProcessorRef.current.refreshNoiseSuppression();
      }
    };

    window.addEventListener('ssmr-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('ssmr-settings-changed', handleSettingsChange);
    };
  }, [mySeat?.seatNo, mySeat?.isMuted, mySeat?.voiceEffect, currentUser?.forcedVoiceEffect, isConnected]);

  /* ─────────────────────────────────────────────────────────────
     3. Toggle Local Voice Self-Monitor (for VIP testing)
     ───────────────────────────────────────────────────────────── */
  const toggleSelfMonitor = useCallback(() => {
    const processor = voiceProcessorRef.current;
    if (!processor) return;
    setIsSelfMonitoring((prev) => {
      const next = !prev;
      processor.setSelfMonitor(next);
      return next;
    });
  }, []);

  /* ─────────────────────────────────────────────────────────────
     4. Helper: User Gesture to Resume Blocked Audio
     ───────────────────────────────────────────────────────────── */
  const unlockAudioAutoplay = useCallback(() => {
    if (audioContainerRef.current) {
      const audioElements = audioContainerRef.current.querySelectorAll('audio');
      audioElements.forEach((el) => {
        el.play().catch(console.error);
      });
      setAudioAutoplayBlocked(false);
    }
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
