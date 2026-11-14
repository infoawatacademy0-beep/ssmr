import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  RemoteTrackPublication,
  RemoteAudioTrack,
  ConnectionState,
  LocalTrackPublication,
} from 'livekit-client';
import { LIVEKIT_CONFIG } from '../config/livekit';
import { fetchLiveKitToken } from '../services/livekitToken';
import {
  detectScreenShareDeviceType,
  startRoomScreenShare,
  stopRoomScreenShare,
  publishScreenShareFrame,
} from '../services/screenShareService';
import type { User, Seat } from '../types';

/* ─────────────────────────────────────────────────────────────
   useVoiceRoom Hook — WebRTC LiveKit Voice & Screen Streaming
   Connects client to LiveKit Room, syncs microphone state
   with Firebase seat state, handles audio streaming, and
   provides direct Mobile / PC / Laptop Screen Sharing with
   instant Firebase live-frame fallback.
   ───────────────────────────────────────────────────────────── */

export interface ActiveScreenShareStream {
  videoTrack: Track | null;
  mediaStream: MediaStream | null;
  participantUid: string;
  participantName: string;
  isLocal: boolean;
  hasAudio: boolean;
  streamKey?: string;
}

interface UseVoiceRoomProps {
  roomId: string;
  currentUser: User | null;
  mySeat: Seat | null;
  allSeats?: Seat[];
}

/**
 * Extracts the base Firebase UID from a per-tab LiveKit identity (`uid__tabId` -> `uid`).
 */
function extractUid(identity: string): string {
  if (!identity) return '';
  return identity.split('__')[0];
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

  // Live Screen Share state (Local or Remote)
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState<ActiveScreenShareStream | null>(null);

  // Unique per-tab suffix so a user opening the room on both PC and Mobile never triggers DUPLICATE_IDENTITY kicks
  const tabSessionIdRef = useRef<string>(
    Math.random().toString(36).substring(2, 7),
  );

  // Reference to persistent LiveKit room instance
  const roomRef = useRef<Room | null>(null);
  // Container for remote audio elements attached to the DOM
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const mySeatRef = useRef<Seat | null>(mySeat);
  mySeatRef.current = mySeat;
  const allSeatsRef = useRef<Seat[]>(allSeats);
  allSeatsRef.current = allSeats;

  // Refs for local screen share tracks & live frame broadcaster cleanup
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const localScreenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const frameBroadcasterStopRef = useRef<(() => void) | null>(null);
  const isLocalScreenSharingRef = useRef<boolean>(false);

  // Check if a participant identity is permitted to speak (must occupy an active unmuted seat)
  const isParticipantAllowedToSpeak = useCallback((identity: string): boolean => {
    const cleanUid = extractUid(identity);
    if (!cleanUid) return false;
    const currentSeats = allSeatsRef.current || [];
    const seat = currentSeats.find((s) => s.userId === cleanUid);
    // If not seated (audience) or seat is muted in Firebase -> silent
    if (!seat || seat.isMuted) return false;
    return true;
  }, []);

  // Helper to strictly disable mic, stop hardware microphone tracks, and unpublish mic audio
  // (Preserves ScreenShareAudio tracks so screen sharing with audio is unaffected by mic mute)
  const stopAndUnpublishLocalAudio = async (targetRoom: Room) => {
    try {
      if (targetRoom.localParticipant.isMicrophoneEnabled) {
        await targetRoom.localParticipant.setMicrophoneEnabled(false);
      }
      const publications = Array.from(targetRoom.localParticipant.audioTrackPublications.values());
      for (const publication of publications) {
        if (publication.source === Track.Source.ScreenShareAudio) {
          continue;
        }
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

  // Helper to scan remote participants for any active screen share video tracks
  const syncRemoteScreenShare = useCallback((targetRoom: Room | null) => {
    if (!targetRoom) return;
    if (isLocalScreenSharingRef.current) return;

    for (const participant of targetRoom.remoteParticipants.values()) {
      const pubs = Array.from(participant.trackPublications.values());
      for (const pub of pubs) {
        const isVideo =
          pub.kind === Track.Kind.Video ||
          pub.source === Track.Source.ScreenShare ||
          pub.source === Track.Source.Camera;

        if (!isVideo) continue;

        // Ensure remote video publication is explicitly subscribed
        if (!pub.isSubscribed) {
          try {
            pub.setSubscribed(true);
          } catch {}
        }

        if (pub.track && pub.track.kind === Track.Kind.Video) {
          const mediaStream = pub.track.mediaStreamTrack
            ? new MediaStream([pub.track.mediaStreamTrack])
            : null;
          const hasScreenAudio = Array.from(participant.audioTrackPublications.values()).some(
            (aPub) => aPub.source === Track.Source.ScreenShareAudio && aPub.isSubscribed,
          );
          const cleanUid = extractUid(participant.identity);
          const streamKey = `${participant.identity}_${pub.trackSid}_${hasScreenAudio}`;

          setActiveScreenShare((prev) => {
            if (prev && !prev.isLocal && prev.streamKey === streamKey && prev.videoTrack === pub.track) {
              return prev;
            }
            return {
              videoTrack: pub.track!,
              mediaStream,
              participantUid: cleanUid,
              participantName: participant.name || cleanUid || 'User',
              isLocal: false,
              hasAudio: hasScreenAudio,
              streamKey,
            };
          });
          return;
        }
      }
    }

    setActiveScreenShare((prev) => (prev && !prev.isLocal ? null : prev));
  }, []);

  // Starts a lightweight offscreen canvas broadcaster that sends compressed JPEG frames
  // of the shared screen to Firebase so all members see the screen immediately.
  const startFrameBroadcaster = useCallback(
    (stream: MediaStream, targetRoomId: string, presenterUid: string) => {
      if (frameBroadcasterStopRef.current) {
        frameBroadcasterStopRef.current();
        frameBroadcasterStopRef.current = null;
      }

      let isStopped = false;
      let isUploading = false;
      const hiddenVideo = document.createElement('video');
      hiddenVideo.muted = true;
      hiddenVideo.playsInline = true;
      hiddenVideo.autoplay = true;
      hiddenVideo.setAttribute('playsinline', 'true');
      hiddenVideo.setAttribute('webkit-playsinline', 'true');
      hiddenVideo.srcObject = stream;
      hiddenVideo.play().catch(() => {});

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const captureAndSend = async () => {
        if (isStopped || isUploading || !isLocalScreenSharingRef.current) return;
        const vw = hiddenVideo.videoWidth;
        const vh = hiddenVideo.videoHeight;
        if (!vw || !vh || !ctx) return;

        isUploading = true;
        try {
          const maxDim = 854;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const cw = Math.max(2, Math.round(vw * scale));
          const ch = Math.max(2, Math.round(vh * scale));
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          ctx.drawImage(hiddenVideo, 0, 0, cw, ch);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
          if (dataUrl && dataUrl.length > 100 && !isStopped) {
            await publishScreenShareFrame(targetRoomId, dataUrl, presenterUid);
          }
        } catch {
          // Ignore transient frame capture errors
        } finally {
          isUploading = false;
        }
      };

      // Capture first frame quickly once video dimensions are ready
      hiddenVideo.onloadeddata = () => {
        captureAndSend();
      };

      const intervalId = setInterval(captureAndSend, 450);

      frameBroadcasterStopRef.current = () => {
        isStopped = true;
        clearInterval(intervalId);
        try {
          hiddenVideo.pause();
          hiddenVideo.srcObject = null;
        } catch {}
      };
    },
    [],
  );

  // Stop local screen sharing and unpublish tracks
  const stopScreenShare = useCallback(async () => {
    isLocalScreenSharingRef.current = false;
    setIsScreenSharing(false);

    if (frameBroadcasterStopRef.current) {
      frameBroadcasterStopRef.current();
      frameBroadcasterStopRef.current = null;
    }

    // Stop local media stream tracks
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => {
        try {
          t.onended = null;
          t.stop();
        } catch {}
      });
      localScreenStreamRef.current = null;
    }

    // Cleanup hidden video element if sharing a local video file
    if (localScreenVideoElRef.current) {
      try {
        localScreenVideoElRef.current.pause();
        if (localScreenVideoElRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(localScreenVideoElRef.current.src);
        }
        localScreenVideoElRef.current.removeAttribute('src');
        localScreenVideoElRef.current.load();
      } catch {}
      localScreenVideoElRef.current = null;
    }

    // Unpublish screen share tracks from LiveKit
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected) {
      try {
        await room.localParticipant.setScreenShareEnabled(false).catch(() => {});
      } catch {}

      try {
        const videoPubs = Array.from(room.localParticipant.videoTrackPublications.values());
        for (const pub of videoPubs) {
          if (pub.track) {
            try {
              pub.track.stop();
              await room.localParticipant.unpublishTrack(pub.track, true);
            } catch {}
          }
        }
        const audioPubs = Array.from(room.localParticipant.audioTrackPublications.values());
        for (const pub of audioPubs) {
          if (pub.source === Track.Source.ScreenShareAudio && pub.track) {
            try {
              pub.track.stop();
              await room.localParticipant.unpublishTrack(pub.track, true);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Error unpublishing screen share tracks:', err);
      }
    }

    setActiveScreenShare(null);

    // Clear Firebase screen share state
    if (roomId) {
      await stopRoomScreenShare(roomId).catch(console.error);
    }

    // Check if any remote participant is sharing
    syncRemoteScreenShare(roomRef.current);
  }, [roomId, syncRemoteScreenShare]);

  // Publish an acquired MediaStream as a LiveKit Screen Share + Instant Frame Stream
  const publishScreenMediaStream = useCallback(
    async (stream: MediaStream) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in screen stream.');
      }
      const audioTrack = stream.getAudioTracks()[0] || null;

      // Stop any previous local screen share stream without clearing Firebase yet
      if (localScreenStreamRef.current && localScreenStreamRef.current !== stream) {
        localScreenStreamRef.current.getTracks().forEach((t) => {
          try {
            t.onended = null;
            t.stop();
          } catch {}
        });
      }

      localScreenStreamRef.current = stream;
      isLocalScreenSharingRef.current = true;
      setIsScreenSharing(true);

      // Hint for crisp text/screen detail
      try {
        if ('contentHint' in videoTrack && !videoTrack.contentHint) {
          videoTrack.contentHint = 'detail';
        }
      } catch {}

      // Listen for native browser "Stop sharing" button
      videoTrack.onended = () => {
        stopScreenShare();
      };

      // Update local preview immediately
      setActiveScreenShare({
        videoTrack: null,
        mediaStream: stream,
        participantUid: currentUser?.uid || 'local',
        participantName: currentUser?.username || 'You',
        isLocal: true,
        hasAudio: Boolean(audioTrack),
        streamKey: `local_${Date.now()}`,
      });

      // Broadcast screen share metadata & start live frame broadcaster in Firebase immediately
      if (roomId && currentUser) {
        await startRoomScreenShare(roomId, {
          presenterUid: currentUser.uid,
          presenterName: currentUser.username,
          presenterAvatar: currentUser.avatar || currentUser.profileImage || null,
          deviceType: detectScreenShareDeviceType(),
          hasSystemAudio: Boolean(audioTrack),
        });
        startFrameBroadcaster(stream, roomId, currentUser.uid);
      }

      // Ensure LiveKit room is connected, reconnecting if needed, then publish WebRTC tracks
      const room = roomRef.current;
      if (room && currentUser && roomId) {
        try {
          if (room.state === ConnectionState.Connecting) {
            // Wait up to 3.5s for ongoing connection
            await new Promise<void>((resolve) => {
              let elapsed = 0;
              const check = setInterval(() => {
                elapsed += 150;
                if (room.state === ConnectionState.Connected || elapsed >= 3500) {
                  clearInterval(check);
                  resolve();
                }
              }, 150);
            });
          } else if (room.state === ConnectionState.Disconnected) {
            const lkIdentity = `${currentUser.uid}__${tabSessionIdRef.current}`;
            const token = await fetchLiveKitToken(roomId, lkIdentity, currentUser.username);
            await room.connect(LIVEKIT_CONFIG.url, token);
          }

          if (room.state === ConnectionState.Connected) {
            // Unpublish any old video tracks first
            for (const pub of Array.from(room.localParticipant.videoTrackPublications.values())) {
              if (pub.track && pub.track.mediaStreamTrack !== videoTrack) {
                await room.localParticipant.unpublishTrack(pub.track, false).catch(() => {});
              }
            }

            const publishedVideoPub: LocalTrackPublication =
              await room.localParticipant.publishTrack(videoTrack, {
                name: 'screen_share',
                source: Track.Source.ScreenShare,
                simulcast: false,
              });

            if (audioTrack) {
              await room.localParticipant
                .publishTrack(audioTrack, {
                  name: 'screen_share_audio',
                  source: Track.Source.ScreenShareAudio,
                })
                .catch((err) => {
                  console.warn('Could not publish screen share audio track:', err);
                });
            }

            if (publishedVideoPub?.track) {
              setActiveScreenShare({
                videoTrack: publishedVideoPub.track,
                mediaStream: stream,
                participantUid: currentUser.uid,
                participantName: currentUser.username || 'You',
                isLocal: true,
                hasAudio: Boolean(audioTrack),
                streamKey: `local_${publishedVideoPub.trackSid || Date.now()}`,
              });
            }
          }
        } catch (lkErr) {
          console.warn('LiveKit screen track publish warning (Firebase frame stream active):', lkErr);
        }
      }
    },
    [roomId, currentUser, stopScreenShare, startFrameBroadcaster],
  );

  /**
   * Starts direct screen sharing on Mobile, PC, or Laptop.
   * Must be invoked directly from a user click handler so mobile browsers preserve user gesture activation.
   */
  const startScreenShare = useCallback(async (): Promise<{
    success: boolean;
    reason?: 'cancelled' | 'unsupported' | 'error';
    message?: string;
  }> => {
    try {
      const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
      if (!mediaDevices || typeof mediaDevices.getDisplayMedia !== 'function') {
        return {
          success: false,
          reason: 'unsupported',
          message: 'Direct display capture is not supported by this mobile browser.',
        };
      }

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      let stream: MediaStream;
      if (isMobile) {
        // Mobile browsers (Android Chrome / iOS Safari) require simple { video: true } on the initial user gesture
        stream = await mediaDevices.getDisplayMedia({
          video: true,
        });
      } else {
        // Desktop / Laptop browsers support 1080p @ 30fps + system/tab audio capture
        try {
          stream = await mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            },
            audio: true,
          } as DisplayMediaStreamOptions);
        } catch (firstErr: any) {
          const errName = String(firstErr?.name || '');
          // If the user explicitly clicked Cancel in the picker, do not re-prompt
          if (errName === 'NotAllowedError' || errName === 'AbortError') {
            return { success: false, reason: 'cancelled' };
          }
          stream = await mediaDevices.getDisplayMedia({ video: true });
        }
      }

      await publishScreenMediaStream(stream);
      return { success: true };
    } catch (err: any) {
      const errName = String(err?.name || '');
      const errMsg = String(err?.message || '');
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'AbortError' ||
        errMsg.toLowerCase().includes('permission denied') ||
        errMsg.toLowerCase().includes('cancel')
      ) {
        return { success: false, reason: 'cancelled' };
      }
      if (
        errName === 'NotSupportedError' ||
        errName === 'TypeError' ||
        errMsg.toLowerCase().includes('not supported') ||
        errMsg.toLowerCase().includes('getdisplaymedia')
      ) {
        return {
          success: false,
          reason: 'unsupported',
          message: errMsg,
        };
      }
      console.error('Error starting screen share:', err);
      return {
        success: false,
        reason: 'error',
        message: errMsg || 'Could not start screen sharing.',
      };
    }
  }, [publishScreenMediaStream]);

  /**
   * Mobile Fallback 1: Share live camera feed onto the room Screen Share stage
   */
  const startCameraScreenShare = useCallback(
    async (facingMode: 'environment' | 'user' = 'environment'): Promise<boolean> => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available on this device.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        await publishScreenMediaStream(stream);
        return true;
      } catch (err) {
        console.error('Failed to start camera screen share:', err);
        return false;
      }
    },
    [publishScreenMediaStream],
  );

  /**
   * Mobile / PC Fallback 2: Stream a local video / screen-recording file from device directly as a Live Screen Share
   */
  const startVideoFileScreenShare = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        const videoEl = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        videoEl.src = objectUrl;
        videoEl.playsInline = true;
        videoEl.loop = false;
        videoEl.muted = false;
        videoEl.volume = 1;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');

        await videoEl.play();
        localScreenVideoElRef.current = videoEl;

        const captureFn =
          (videoEl as any).captureStream?.bind(videoEl) ||
          (videoEl as any).mozCaptureStream?.bind(videoEl);

        if (!captureFn) {
          URL.revokeObjectURL(objectUrl);
          throw new Error('Video stream capture is not supported on this browser.');
        }

        const stream: MediaStream = captureFn();
        videoEl.onended = () => {
          stopScreenShare();
        };

        await publishScreenMediaStream(stream);
        return true;
      } catch (err) {
        console.error('Failed to stream video file as screen share:', err);
        return false;
      }
    },
    [publishScreenMediaStream, stopScreenShare],
  );

  /* ─────────────────────────────────────────────────────────────
     1. Initialize & Connect to LiveKit Room
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!roomId || !currentUser) return;

    let isMounted = true;
    const isNoiseSuppEnabled =
      typeof window === 'undefined' ||
      localStorage.getItem('ssmr_noise_suppression') !== 'false';

    // adaptiveStream & dynacast disabled so screen share video frames stream immediately to all mobile/PC viewers
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      disconnectOnPageLeave: false,
      stopLocalTrackOnUnpublish: true,
      audioCaptureDefaults: {
        autoGainControl: isNoiseSuppEnabled,
        echoCancellation: isNoiseSuppEnabled,
        noiseSuppression: isNoiseSuppEnabled,
      },
      publishDefaults: {
        dtx: true,
        red: true,
        simulcast: false,
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
        const cleanUid = extractUid(speaker.identity);
        if (cleanUid && isParticipantAllowedToSpeak(cleanUid)) {
          activeIds.add(cleanUid);
        }
      }
      setSpeakingUids(activeIds);
    });

    // Ensure any newly published remote video track is immediately subscribed
    room.on(
      RoomEvent.TrackPublished,
      (publication: RemoteTrackPublication) => {
        if (!isMounted) return;
        if (
          publication.kind === Track.Kind.Video ||
          publication.source === Track.Source.ScreenShare ||
          publication.source === Track.Source.ScreenShareAudio
        ) {
          try {
            publication.setSubscribed(true);
          } catch {}
          syncRemoteScreenShare(room);
        }
      },
    );

    room.on(RoomEvent.ParticipantConnected, () => {
      if (isMounted) {
        syncRemoteScreenShare(room);
      }
    });

    // Handle remote participant audio & screen share video playback
    room.on(
      RoomEvent.TrackSubscribed,
      (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (!isMounted) return;

        // 1. Remote Screen Share Video Track
        if (track.kind === Track.Kind.Video) {
          syncRemoteScreenShare(room);
          return;
        }

        // 2. Remote Audio Track (Voice Mic or Screen Share Audio)
        if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
          const cleanUid = extractUid(participant.identity);
          const isScreenAudio = publication.source === Track.Source.ScreenShareAudio;
          const audioElement = (track as RemoteAudioTrack).attach();
          audioElement.id = `audio-${participant.identity}-${publication.trackSid}`;
          audioElement.setAttribute('data-participant-uid', cleanUid);
          if (isScreenAudio) {
            audioElement.setAttribute('data-screen-audio', 'true');
          }
          audioElement.setAttribute('playsinline', 'true');
          audioElement.setAttribute('webkit-playsinline', 'true');

          const isAllowed = isScreenAudio || isParticipantAllowedToSpeak(cleanUid);
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

          if (isScreenAudio) {
            syncRemoteScreenShare(room);
          }

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

    // Cleanup audio & video elements when tracks are unsubscribed
    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: Track, publication: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => el.remove());
          if (publication.source === Track.Source.ScreenShareAudio && isMounted) {
            syncRemoteScreenShare(room);
          }
        } else if (track.kind === Track.Kind.Video) {
          track.detach();
          if (isMounted) {
            syncRemoteScreenShare(room);
          }
        }
      },
    );

    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (isMounted) {
        syncRemoteScreenShare(room);
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      if (
        isMounted &&
        (publication.source === Track.Source.ScreenShare ||
          publication.track?.kind === Track.Kind.Video)
      ) {
        // Only clean up if the local screen stream itself has ended
        const activeVideoTrack = localScreenStreamRef.current?.getVideoTracks()[0];
        if (!activeVideoTrack || activeVideoTrack.readyState === 'ended') {
          if (isLocalScreenSharingRef.current) {
            isLocalScreenSharingRef.current = false;
            setIsScreenSharing(false);
            if (frameBroadcasterStopRef.current) {
              frameBroadcasterStopRef.current();
              frameBroadcasterStopRef.current = null;
            }
            stopRoomScreenShare(roomId).catch(() => {});
            syncRemoteScreenShare(room);
          }
        }
      }
    });

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
      if (state === ConnectionState.Connected) {
        syncRemoteScreenShare(room);
      }
    });

    // Connect with generated token (using per-tab identity so multiple tabs/devices never collide)
    async function connectToLiveKit() {
      try {
        const lkIdentity = `${currentUser!.uid}__${tabSessionIdRef.current}`;
        const token = await fetchLiveKitToken(
          roomId,
          lkIdentity,
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

          // Check if any remote participant is already sharing screen
          syncRemoteScreenShare(room);

          // If user started local screen share while LiveKit was still connecting, publish it now
          if (isLocalScreenSharingRef.current && localScreenStreamRef.current) {
            const vTrack = localScreenStreamRef.current.getVideoTracks()[0];
            const aTrack = localScreenStreamRef.current.getAudioTracks()[0];
            if (vTrack) {
              await room.localParticipant
                .publishTrack(vTrack, {
                  name: 'screen_share',
                  source: Track.Source.ScreenShare,
                  simulcast: false,
                })
                .catch(console.warn);
            }
            if (aTrack) {
              await room.localParticipant
                .publishTrack(aTrack, {
                  name: 'screen_share_audio',
                  source: Track.Source.ScreenShareAudio,
                })
                .catch(console.warn);
            }
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

    // Periodic check to ensure remote screen share video tracks are subscribed and synced
    const syncTimer = setInterval(() => {
      if (isMounted && room.state === ConnectionState.Connected) {
        syncRemoteScreenShare(room);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(syncTimer);
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
      if (frameBroadcasterStopRef.current) {
        frameBroadcasterStopRef.current();
        frameBroadcasterStopRef.current = null;
      }
      if (isLocalScreenSharingRef.current) {
        isLocalScreenSharingRef.current = false;
        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach((t) => {
            try {
              t.onended = null;
              t.stop();
            } catch {}
          });
          localScreenStreamRef.current = null;
        }
        stopRoomScreenShare(roomId).catch(() => {});
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
  }, [roomId, currentUser?.uid, isParticipantAllowedToSpeak, syncRemoteScreenShare]);

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
          const hasMicTrack = Array.from(room!.localParticipant.audioTrackPublications.values()).some(
            (pub) => pub.source !== Track.Source.ScreenShareAudio && Boolean(pub.track)
          );
          if (!room!.localParticipant.isMicrophoneEnabled || !hasMicTrack) {
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

          // If audience (not on any seat), completely stop hardware mic track and unpublish
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
      const isScreenAudio = audioEl.getAttribute('data-screen-audio') === 'true';
      const isAllowed = isScreenAudio || isParticipantAllowedToSpeak(uid);

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
        const isScreenAudio = el.getAttribute('data-screen-audio') === 'true';
        const isAllowed = isScreenAudio || (uid ? isParticipantAllowedToSpeak(uid) : true);
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
    isScreenSharing,
    activeScreenShare,
    startScreenShare,
    startCameraScreenShare,
    startVideoFileScreenShare,
    stopScreenShare,
    room: roomRef.current,
  };
}
