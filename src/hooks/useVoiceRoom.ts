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
   (Normal / Child / Venom), and keeps microphone & room audio
   active in the background when switching to other mobile apps
   (e.g., Snapchat) until the user manually mutes their mic.
   ───────────────────────────────────────────────────────────── */

/**
 * Generates a tiny valid 1-second silent stereo WAV Data URI.
 * Playing this in a looped <audio playsInline> element combined with
 * navigator.mediaSession prevents mobile browsers (iOS Safari / Android Chrome)
 * from suspending the tab or cutting off WebRTC microphone/audio in background apps.
 */
function createSilentWavDataUri(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Sub-audible 1-LSB pulse prevents OS silent-stream killer from pausing the audio session
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

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
  // Background keep-alive audio element & WakeLock sentinel
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
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
      // CRITICAL for mobile background apps (Snapchat, Instagram, Home screen):
      // Prevent LiveKit from disconnecting when switching apps or locking screen
      disconnectOnPageLeave: false,
      stopLocalTrackOnUnpublish: false,
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
        stopMicTrackOnMute: false,
      },
    });

    roomRef.current = room;
    voiceProcessorRef.current = new VoiceChangerProcessor();
    setIsConnecting(true);
    setConnectionError(null);

    // Create a container for remote audio elements if not present.
    // NOTE: Must NOT use display: none because mobile browsers (iOS Safari & Android Chrome)
    // suspend media elements that are not in the layout render tree when HTML5 <video> plays!
    let container = document.getElementById('livekit-audio-container') as HTMLDivElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'livekit-audio-container';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    } else {
      container.style.display = '';
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
    }
    audioContainerRef.current = container;

    // Configure iOS / Android audioSession to play-and-record so duplex VoIP audio is never interrupted by video playback
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'play-and-record';
      } catch {}
    }

    // Create persistent background keep-alive <audio> element so iOS/Android
    // treats the browser tab as an active VoIP call even when Snapchat or another app is opened
    let keepAliveAudio = document.getElementById('ssmr-voip-keepalive') as HTMLAudioElement | null;
    if (!keepAliveAudio) {
      keepAliveAudio = document.createElement('audio');
      keepAliveAudio.id = 'ssmr-voip-keepalive';
      keepAliveAudio.src = createSilentWavDataUri();
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01;
      keepAliveAudio.setAttribute('playsinline', 'true');
      keepAliveAudio.setAttribute('webkit-playsinline', 'true');
      container.appendChild(keepAliveAudio);
    }
    keepAliveAudioRef.current = keepAliveAudio;

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
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
      if (keepAliveAudioRef.current) {
        keepAliveAudioRef.current.pause();
        keepAliveAudioRef.current = null;
      }
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
     2. Mute/Unmute, VIP Voice Changer & Background App Keep-Alive
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const isMicOpen = Boolean(mySeat && !mySeat.isMuted);
    const effectMode: VoiceEffectMode =
      (mySeat?.voiceEffect && mySeat.voiceEffect !== 'normal'
        ? mySeat.voiceEffect
        : currentUser?.forcedVoiceEffect) || 'normal';

    async function syncMicrophoneAndVoiceEffect() {
      try {
        if (isMicOpen) {
          // 1. Start silent VoIP keep-alive loop & MediaSession so iOS/Android keeps mic alive in Snapchat/background
          if (keepAliveAudioRef.current && keepAliveAudioRef.current.paused) {
            keepAliveAudioRef.current.play().catch(() => {});
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            try {
              const isEnLang = typeof localStorage !== 'undefined' && localStorage.getItem('ssmr_language') === 'en';
              navigator.mediaSession.metadata = new MediaMetadata({
                title: isEnLang ? 'Mic Active — Live Voice Room' : 'مایک کراوەیە — ژووری دەنگی ڕاستەوخۆ',
                artist: currentUser?.username || 'SSMR Live',
                album: 'SSMR Voice Arena',
              });
              navigator.mediaSession.playbackState = 'playing';
              navigator.mediaSession.setActionHandler('play', () => {
                keepAliveAudioRef.current?.play().catch(() => {});
              });
              navigator.mediaSession.setActionHandler('pause', () => {
                // Keep playing while mic is open so OS does not suspend background VoIP
                if (mySeatRef.current && !mySeatRef.current.isMuted) {
                  keepAliveAudioRef.current?.play().catch(() => {});
                }
              });
            } catch {
              // Ignore unsupported MediaSession actions
            }
          }
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

          // 2. Enable microphone in LiveKit
          await room!.localParticipant.setMicrophoneEnabled(true);

          const pub = room!.localParticipant.getTrackPublication(Track.Source.Microphone);
          const localAudioTrack = pub?.audioTrack as LocalAudioTrack | undefined;

          if (localAudioTrack && localAudioTrack.mediaStreamTrack) {
            if (
              !rawMicTrackRef.current ||
              rawMicTrackRef.current.readyState === 'ended'
            ) {
              rawMicTrackRef.current = localAudioTrack.mediaStreamTrack;
            }

            // Ensure hardware microphone track stays enabled even in background apps
            rawMicTrackRef.current.enabled = true;
            if ('contentHint' in rawMicTrackRef.current) {
              try {
                rawMicTrackRef.current.contentHint = 'speech';
              } catch {
                // Ignore
              }
            }

            const processor = voiceProcessorRef.current;
            const sender = (localAudioTrack as unknown as { sender?: RTCRtpSender }).sender;
            const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

            // CRITICAL FOR MOBILE BACKGROUND APPS (Snapchat, Instagram, etc.):
            // Mobile browsers suspend WebAudio AudioContext in background tabs.
            // Therefore, when effectMode === 'normal' (and not self-monitoring) OR when the tab is hidden in the background,
            // feed rawMicTrackRef.current DIRECTLY to WebRTC RTCRtpSender so the mic NEVER cuts out!
            if (sender && typeof sender.replaceTrack === 'function' && rawMicTrackRef.current) {
              if ((effectMode === 'normal' && !isSelfMonitoring) || isTabHidden) {
                if (processor && isSelfMonitoring) {
                  processor.start(rawMicTrackRef.current, effectMode);
                }
                if (sender.track !== rawMicTrackRef.current) {
                  await sender.replaceTrack(rawMicTrackRef.current);
                }
              } else if (processor) {
                const processedTrack = processor.start(rawMicTrackRef.current, effectMode);
                await processor.resume();
                if (sender.track !== processedTrack) {
                  await sender.replaceTrack(processedTrack);
                }
              }
            }
          }
        } else {
          // User explicitly muted or left seat → Strictly disable microphone in LiveKit
          await room!.localParticipant.setMicrophoneEnabled(false);
          if (voiceProcessorRef.current) {
            voiceProcessorRef.current.setSelfMonitor(false);
            setIsSelfMonitoring(false);
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'none';
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.error('Error synchronizing LiveKit microphone with seat state:', err);
      }
    }

    syncMicrophoneAndVoiceEffect();

    // Watchdog: ensures remote participant voices and local microphone stay alive and are not muted by video playback
    const ensureBackgroundAudioAndMicAlive = async () => {
      const currentRoom = roomRef.current;
      if (!currentRoom || currentRoom.state !== ConnectionState.Connected) return;

      // Keep iOS / Android audio session in play-and-record duplex mode
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          if ((navigator as any).audioSession.type !== 'play-and-record') {
            (navigator as any).audioSession.type = 'play-and-record';
          }
        } catch {}
      }

      // Always keep remote room audio elements playing so cinema video does not pause incoming voices
      if (audioContainerRef.current) {
        const audioEls = audioContainerRef.current.querySelectorAll('audio');
        audioEls.forEach((el) => {
          if (el.id !== 'ssmr-voip-keepalive' && el.paused) {
            el.play().catch(() => {});
          }
        });
      }

      const activeSeat = mySeatRef.current;
      if (!activeSeat || activeSeat.isMuted) return;

      // Ensure silent VoIP keep-alive audio stays playing
      if (keepAliveAudioRef.current && keepAliveAudioRef.current.paused) {
        keepAliveAudioRef.current.play().catch(() => {});
      }

      const pub = currentRoom.localParticipant.getTrackPublication(Track.Source.Microphone);
      const localAudioTrack = pub?.audioTrack as LocalAudioTrack | undefined;
      const rawTrack = rawMicTrackRef.current;

      // If another app or video briefly interrupted the mic or ended the track, automatically re-acquire it
      if (!pub || pub.isMuted || !localAudioTrack || !rawTrack || rawTrack.readyState === 'ended') {
        try {
          await currentRoom.localParticipant.setMicrophoneEnabled(true);
          const refreshedPub = currentRoom.localParticipant.getTrackPublication(Track.Source.Microphone);
          const refreshedTrack = (refreshedPub?.audioTrack as LocalAudioTrack | undefined)?.mediaStreamTrack;
          if (refreshedTrack && refreshedTrack.readyState === 'live') {
            rawMicTrackRef.current = refreshedTrack;
            refreshedTrack.enabled = true;
          }
        } catch {
          // Will retry on next watchdog tick
        }
      } else {
        rawTrack.enabled = true;
      }

      // When backgrounded or normal voice, ensure sender uses native rawMicTrackRef directly
      const sender = (localAudioTrack as unknown as { sender?: RTCRtpSender } | undefined)?.sender;
      if (sender && typeof sender.replaceTrack === 'function' && rawMicTrackRef.current) {
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (hidden || (effectMode === 'normal' && !isSelfMonitoring)) {
          if (sender.track !== rawMicTrackRef.current) {
            sender.replaceTrack(rawMicTrackRef.current).catch(() => {});
          }
        } else if (voiceProcessorRef.current) {
          await voiceProcessorRef.current.resume();
          const processedTrack = voiceProcessorRef.current.start(rawMicTrackRef.current, effectMode);
          if (sender.track !== processedTrack) {
            sender.replaceTrack(processedTrack).catch(() => {});
          }
        }
      }
    };

    // Watchdog runs continuously every 1500ms so both listeners and speakers have persistent uninterrupted voice audio
    const watchdogTimer = window.setInterval(ensureBackgroundAudioAndMicAlive, 1500);

    const handleVisibilityOrFocusChange = () => {
      ensureBackgroundAudioAndMicAlive();
    };

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

    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('pagehide', handleVisibilityOrFocusChange);
    window.addEventListener('pageshow', handleVisibilityOrFocusChange);
    window.addEventListener('blur', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleVisibilityOrFocusChange);
    window.addEventListener('ssmr-settings-changed', handleSettingsChange);

    return () => {
      if (watchdogTimer) window.clearInterval(watchdogTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
      window.removeEventListener('pagehide', handleVisibilityOrFocusChange);
      window.removeEventListener('pageshow', handleVisibilityOrFocusChange);
      window.removeEventListener('blur', handleVisibilityOrFocusChange);
      window.removeEventListener('focus', handleVisibilityOrFocusChange);
      window.removeEventListener('ssmr-settings-changed', handleSettingsChange);
    };
  }, [
    mySeat?.seatNo,
    mySeat?.isMuted,
    mySeat?.voiceEffect,
    currentUser?.forcedVoiceEffect,
    currentUser?.username,
    isConnected,
    isSelfMonitoring,
  ]);

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
  const unlockAudioAutoplay = useCallback(async () => {
    try {
      if (roomRef.current && typeof (roomRef.current as any).startAudio === 'function') {
        await (roomRef.current as any).startAudio();
      }
    } catch {}

    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'play-and-record';
      } catch {}
    }

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
