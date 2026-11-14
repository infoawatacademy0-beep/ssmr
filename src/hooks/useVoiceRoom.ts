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
import {
  startUsbVideoDeviceStream,
  connectUsbPhoneViaWebUsb,
} from '../utils/usbScreenShare';
import type { User, Seat, ScreenShareDeviceType } from '../types';

/* ─────────────────────────────────────────────────────────────
   useVoiceRoom Hook — WebRTC LiveKit Voice & Multi-Screen Streaming
   Connects client to LiveKit Room, syncs microphone state
   with Firebase seat state, handles audio streaming, and
   provides direct Mobile / PC / Laptop Screen Sharing with
   simultaneous Dual-Screen (PC + Mobile together) support
   and instant Firebase live-frame fallback.
   ───────────────────────────────────────────────────────────── */

export interface ActiveScreenShareStream {
  streamId: string;
  videoTrack: Track | null;
  mediaStream: MediaStream | null;
  participantUid: string;
  participantName: string;
  deviceType?: ScreenShareDeviceType;
  isLocal: boolean;
  hasAudio: boolean;
  streamKey?: string;
}

export interface ScreenShareStartOptions {
  addSecondScreen?: boolean;
  deviceTypeOverride?: ScreenShareDeviceType;
}

interface LocalScreenSlot {
  streamId: string;
  slotIndex: number;
  deviceType: ScreenShareDeviceType;
  stream: MediaStream;
  videoEl: HTMLVideoElement | null;
  stopBroadcaster: () => void;
  videoTrack: Track | null;
  hasAudio: boolean;
  startedAt: number;
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

/**
 * Parses slot index and deviceType from a published LiveKit video track name (`screen_share__1__pc`).
 */
function parseScreenTrackName(trackName?: string): {
  slotIndex: number;
  deviceType?: ScreenShareDeviceType;
} {
  if (!trackName) return { slotIndex: 1 };
  const match = trackName.match(/^screen_share__(\d+)__(mobile|pc|laptop)$/);
  if (match) {
    return {
      slotIndex: Number(match[1]) || 1,
      deviceType: match[2] as ScreenShareDeviceType,
    };
  }
  return { slotIndex: 1 };
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

  // Live Screen Share state (Supports 1 or 2+ simultaneous local & remote streams, e.g., PC + Mobile together)
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenShares, setActiveScreenShares] = useState<ActiveScreenShareStream[]>([]);
  const [localScreenStreamIds, setLocalScreenStreamIds] = useState<string[]>([]);

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

  // Map of active local screen share slots on this device (keyed by streamId)
  const localScreenSlotsRef = useRef<Map<string, LocalScreenSlot>>(new Map());

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

  // Synchronizes ALL active local screen share slots + ALL remote participant screen share tracks
  // so both PC and Mobile screens can be viewed simultaneously by the presenter and all room members.
  const syncAllScreenShares = useCallback(
    (targetRoom: Room | null) => {
      const combined: ActiveScreenShareStream[] = [];
      const seenStreamIds = new Set<string>();

      // 1. Add all active local screen share slots from this device
      for (const slot of localScreenSlotsRef.current.values()) {
        seenStreamIds.add(slot.streamId);
        combined.push({
          streamId: slot.streamId,
          videoTrack: slot.videoTrack,
          mediaStream: slot.stream,
          participantUid: currentUser?.uid || 'local',
          participantName: currentUser?.username || 'You',
          deviceType: slot.deviceType,
          isLocal: true,
          hasAudio: slot.hasAudio,
          streamKey: `local_${slot.streamId}_${slot.videoTrack?.sid || slot.startedAt}`,
        });
      }

      // 2. Add all active remote screen share video tracks from other devices / members
      if (targetRoom) {
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
              const parsed = parseScreenTrackName(pub.trackName);
              const slotIdx =
                parsed.slotIndex ||
                (pub.source === Track.Source.Camera ? 2 : 1);
              const remoteStreamId = `${participant.identity}__${slotIdx}`;

              if (seenStreamIds.has(remoteStreamId)) continue;
              seenStreamIds.add(remoteStreamId);

              const mediaStream = pub.track.mediaStreamTrack
                ? new MediaStream([pub.track.mediaStreamTrack])
                : null;
              const hasScreenAudio = Array.from(
                participant.audioTrackPublications.values(),
              ).some(
                (aPub) =>
                  aPub.source === Track.Source.ScreenShareAudio &&
                  aPub.isSubscribed,
              );
              const cleanUid = extractUid(participant.identity);
              const streamKey = `${remoteStreamId}_${pub.trackSid}_${hasScreenAudio}`;

              combined.push({
                streamId: remoteStreamId,
                videoTrack: pub.track,
                mediaStream,
                participantUid: cleanUid,
                participantName: participant.name || cleanUid || 'User',
                deviceType: parsed.deviceType,
                isLocal: false,
                hasAudio: hasScreenAudio,
                streamKey,
              });
            }
          }
        }
      }

      setActiveScreenShares((prev) => {
        if (
          prev.length === combined.length &&
          prev.every(
            (item, idx) =>
              item.streamKey === combined[idx].streamKey &&
              item.videoTrack === combined[idx].videoTrack &&
              item.mediaStream === combined[idx].mediaStream,
          )
        ) {
          return prev;
        }
        return combined;
      });
    },
    [currentUser?.uid, currentUser?.username],
  );

  // Starts a lightweight offscreen canvas broadcaster that sends compressed JPEG frames
  // of a shared screen to Firebase so all members see every screen (PC + Mobile) immediately.
  const createFrameBroadcaster = useCallback(
    (
      stream: MediaStream,
      targetRoomId: string,
      presenterUid: string,
      streamId: string,
    ): (() => void) => {
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
        if (
          isStopped ||
          isUploading ||
          !localScreenSlotsRef.current.has(streamId)
        ) {
          return;
        }
        const vw = hiddenVideo.videoWidth;
        const vh = hiddenVideo.videoHeight;
        if (!vw || !vh || !ctx) return;

        isUploading = true;
        try {
          const maxDim = localScreenSlotsRef.current.size > 1 ? 720 : 854;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const cw = Math.max(2, Math.round(vw * scale));
          const ch = Math.max(2, Math.round(vh * scale));
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          ctx.drawImage(hiddenVideo, 0, 0, cw, ch);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.54);
          if (dataUrl && dataUrl.length > 100 && !isStopped) {
            await publishScreenShareFrame(
              targetRoomId,
              dataUrl,
              presenterUid,
              streamId,
            );
          }
        } catch {
          // Ignore transient frame capture errors
        } finally {
          isUploading = false;
        }
      };

      hiddenVideo.onloadeddata = () => {
        captureAndSend();
      };

      const intervalId = setInterval(captureAndSend, 480);

      return () => {
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

  // Stop a specific local screen share stream (if targetStreamId is provided) or all local screen share streams
  const stopScreenShare = useCallback(
    async (targetStreamId?: string) => {
      const slotsToStop: LocalScreenSlot[] = [];

      if (targetStreamId) {
        const slot = localScreenSlotsRef.current.get(targetStreamId);
        if (slot) {
          slotsToStop.push(slot);
          localScreenSlotsRef.current.delete(targetStreamId);
        } else {
          // Remote stream stop requested (e.g. presenter on PC stopping their Mobile stream, or Host/Admin stopping a stream)
          if (roomId) {
            await stopRoomScreenShare(roomId, targetStreamId).catch(console.error);
          }
          syncAllScreenShares(roomRef.current);
          return;
        }
      } else {
        for (const slot of localScreenSlotsRef.current.values()) {
          slotsToStop.push(slot);
        }
        localScreenSlotsRef.current.clear();
      }

      const remainingIds = Array.from(localScreenSlotsRef.current.keys());
      setLocalScreenStreamIds(remainingIds);
      setIsScreenSharing(remainingIds.length > 0);

      const room = roomRef.current;

      for (const slot of slotsToStop) {
        try {
          slot.stopBroadcaster();
        } catch {}

        // Stop local media stream tracks
        const mediaTracks = slot.stream.getTracks();
        mediaTracks.forEach((t) => {
          try {
            t.onended = null;
            t.stop();
          } catch {}
        });

        // Cleanup hidden video element if sharing a local video file
        if (slot.videoEl) {
          try {
            slot.videoEl.pause();
            if (slot.videoEl.src.startsWith('blob:')) {
              URL.revokeObjectURL(slot.videoEl.src);
            }
            slot.videoEl.removeAttribute('src');
            slot.videoEl.load();
          } catch {}
        }

        // Unpublish matching tracks from LiveKit
        if (room && room.state === ConnectionState.Connected) {
          try {
            const videoPubs = Array.from(
              room.localParticipant.videoTrackPublications.values(),
            );
            for (const pub of videoPubs) {
              if (
                pub.track &&
                (pub.track === slot.videoTrack ||
                  mediaTracks.includes(pub.track.mediaStreamTrack))
              ) {
                try {
                  pub.track.stop();
                  await room.localParticipant.unpublishTrack(pub.track, true);
                } catch {}
              }
            }

            if (localScreenSlotsRef.current.size === 0) {
              const audioPubs = Array.from(
                room.localParticipant.audioTrackPublications.values(),
              );
              for (const pub of audioPubs) {
                if (pub.source === Track.Source.ScreenShareAudio && pub.track) {
                  try {
                    pub.track.stop();
                    await room.localParticipant.unpublishTrack(pub.track, true);
                  } catch {}
                }
              }
            }
          } catch (err) {
            console.warn('Error unpublishing screen share slot tracks:', err);
          }
        }

        // Remove only this specific stream from Firebase so any other active screen (e.g. Mobile or PC) stays live
        if (roomId) {
          await stopRoomScreenShare(roomId, slot.streamId).catch(console.error);
        }
      }

      syncAllScreenShares(roomRef.current);
    },
    [roomId, syncAllScreenShares],
  );

  // Publish an acquired MediaStream as a LiveKit Screen Share + Instant Frame Stream
  const publishScreenMediaStream = useCallback(
    async (
      stream: MediaStream,
      options?: ScreenShareStartOptions,
      hiddenVideoEl: HTMLVideoElement | null = null,
    ) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in screen stream.');
      }
      const audioTrack = stream.getAudioTracks()[0] || null;

      const uid = currentUser?.uid || 'local';
      const tabId = tabSessionIdRef.current;
      const slot1Id = `${uid}__${tabId}__1`;

      let slotIndex = 1;
      if (options?.addSecondScreen) {
        if (!localScreenSlotsRef.current.has(slot1Id)) {
          slotIndex = 1;
        } else {
          slotIndex = 2;
        }
      } else {
        slotIndex = 1;
      }

      const streamId = `${uid}__${tabId}__${slotIndex}`;
      const deviceType: ScreenShareDeviceType =
        options?.deviceTypeOverride || detectScreenShareDeviceType();

      // If replacing the same slot on this device, clean up the old stream in that slot first
      const existingSlot = localScreenSlotsRef.current.get(streamId);
      if (existingSlot && existingSlot.stream !== stream) {
        try {
          existingSlot.stopBroadcaster();
        } catch {}
        existingSlot.stream.getTracks().forEach((t) => {
          try {
            t.onended = null;
            t.stop();
          } catch {}
        });
        if (existingSlot.videoEl) {
          try {
            existingSlot.videoEl.pause();
            if (existingSlot.videoEl.src.startsWith('blob:')) {
              URL.revokeObjectURL(existingSlot.videoEl.src);
            }
          } catch {}
        }
      }

      // Hint for crisp text/screen detail
      try {
        if ('contentHint' in videoTrack && !videoTrack.contentHint) {
          videoTrack.contentHint = 'detail';
        }
      } catch {}

      const stopBroadcaster =
        roomId && currentUser
          ? createFrameBroadcaster(stream, roomId, currentUser.uid, streamId)
          : () => {};

      const newSlot: LocalScreenSlot = {
        streamId,
        slotIndex,
        deviceType,
        stream,
        videoEl: hiddenVideoEl,
        stopBroadcaster,
        videoTrack: null,
        hasAudio: Boolean(audioTrack),
        startedAt: Date.now(),
      };

      localScreenSlotsRef.current.set(streamId, newSlot);
      const currentIds = Array.from(localScreenSlotsRef.current.keys());
      setLocalScreenStreamIds(currentIds);
      setIsScreenSharing(true);

      // Listen for native browser "Stop sharing" button on this specific stream
      videoTrack.onended = () => {
        stopScreenShare(streamId);
      };

      // Update local preview immediately
      syncAllScreenShares(roomRef.current);

      // Broadcast screen share metadata in Firebase under its unique streamId
      if (roomId && currentUser) {
        await startRoomScreenShare(roomId, {
          streamId,
          presenterUid: currentUser.uid,
          presenterName: currentUser.username,
          presenterAvatar:
            currentUser.avatar || currentUser.profileImage || null,
          deviceType,
          hasSystemAudio: Boolean(audioTrack),
        });
      }

      // Ensure LiveKit room is connected, reconnecting if needed, then publish WebRTC tracks
      const room = roomRef.current;
      if (room && currentUser && roomId) {
        try {
          if (room.state === ConnectionState.Connecting) {
            await new Promise<void>((resolve) => {
              let elapsed = 0;
              const check = setInterval(() => {
                elapsed += 150;
                if (
                  room.state === ConnectionState.Connected ||
                  elapsed >= 3500
                ) {
                  clearInterval(check);
                  resolve();
                }
              }, 150);
            });
          } else if (room.state === ConnectionState.Disconnected) {
            const lkIdentity = `${currentUser.uid}__${tabSessionIdRef.current}`;
            const token = await fetchLiveKitToken(
              roomId,
              lkIdentity,
              currentUser.username,
            );
            await room.connect(LIVEKIT_CONFIG.url, token);
          }

          if (room.state === ConnectionState.Connected) {
            const trackSource =
              slotIndex === 2 ? Track.Source.Camera : Track.Source.ScreenShare;
            const trackName = `screen_share__${slotIndex}__${deviceType}`;

            // Unpublish any old video track occupying the same source on this tab
            for (const pub of Array.from(
              room.localParticipant.videoTrackPublications.values(),
            )) {
              if (
                pub.source === trackSource &&
                pub.track &&
                pub.track.mediaStreamTrack !== videoTrack
              ) {
                await room.localParticipant
                  .unpublishTrack(pub.track, false)
                  .catch(() => {});
              }
            }

            const publishedVideoPub: LocalTrackPublication =
              await room.localParticipant.publishTrack(videoTrack, {
                name: trackName,
                source: trackSource,
                simulcast: false,
              });

            if (audioTrack) {
              await room.localParticipant
                .publishTrack(audioTrack, {
                  name: `screen_share_audio__${slotIndex}`,
                  source: Track.Source.ScreenShareAudio,
                })
                .catch((err) => {
                  console.warn('Could not publish screen share audio track:', err);
                });
            }

            if (publishedVideoPub?.track) {
              const activeSlot = localScreenSlotsRef.current.get(streamId);
              if (activeSlot) {
                activeSlot.videoTrack = publishedVideoPub.track;
              }
              syncAllScreenShares(room);
            }
          }
        } catch (lkErr) {
          console.warn(
            'LiveKit screen track publish warning (Firebase frame stream active):',
            lkErr,
          );
        }
      }
    },
    [
      roomId,
      currentUser,
      stopScreenShare,
      createFrameBroadcaster,
      syncAllScreenShares,
    ],
  );

  /**
   * Starts direct screen sharing on Mobile, PC, or Laptop.
   * Supports adding a second simultaneous screen (`options.addSecondScreen = true`).
   */
  const startScreenShare = useCallback(
    async (
      options?: ScreenShareStartOptions,
    ): Promise<{
      success: boolean;
      reason?: 'cancelled' | 'unsupported' | 'error';
      message?: string;
    }> => {
      try {
        const mediaDevices =
          typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
        if (
          !mediaDevices ||
          typeof mediaDevices.getDisplayMedia !== 'function'
        ) {
          return {
            success: false,
            reason: 'unsupported',
            message:
              'Direct display capture is not supported by this mobile browser.',
          };
        }

        const isMobile =
          typeof navigator !== 'undefined' &&
          /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(
            navigator.userAgent || '',
          );

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
            if (errName === 'NotAllowedError' || errName === 'AbortError') {
              return { success: false, reason: 'cancelled' };
            }
            stream = await mediaDevices.getDisplayMedia({ video: true });
          }
        }

        await publishScreenMediaStream(stream, options);
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
    },
    [publishScreenMediaStream],
  );

  /**
   * Mobile / PC Camera Share onto the room Screen Share stage (Supports Dual Screen mode too!)
   */
  const startCameraScreenShare = useCallback(
    async (
      facingMode: 'environment' | 'user' = 'environment',
      options?: ScreenShareStartOptions,
    ): Promise<boolean> => {
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
        await publishScreenMediaStream(stream, options);
        return true;
      } catch (err) {
        console.error('Failed to start camera screen share:', err);
        return false;
      }
    },
    [publishScreenMediaStream],
  );

  /**
   * USB Video Device Share (Streams a USB-connected mobile phone video source / UVC / DroidCam / Camo / Capture device)
   */
  const startUsbDeviceScreenShare = useCallback(
    async (
      deviceId: string,
      options?: ScreenShareStartOptions,
    ): Promise<boolean> => {
      try {
        const stream = await startUsbVideoDeviceStream(deviceId);
        await publishScreenMediaStream(stream, {
          ...options,
          deviceTypeOverride: 'mobile',
        });
        return true;
      } catch (err) {
        console.error('Failed to start USB device screen share:', err);
        return false;
      }
    },
    [publishScreenMediaStream],
  );

  /**
   * Direct WebUSB Cable Screen Share (Connects to an Android phone over USB cable via WebUSB ADB)
   */
  const startWebUsbScreenShare = useCallback(
    async (
      options?: ScreenShareStartOptions,
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const { stream } = await connectUsbPhoneViaWebUsb();
        await publishScreenMediaStream(stream, {
          ...options,
          deviceTypeOverride: 'mobile',
        });
        return { success: true };
      } catch (err: any) {
        console.warn('WebUSB screen share info:', err);
        return {
          success: false,
          message: err?.message || 'Could not connect via WebUSB.',
        };
      }
    },
    [publishScreenMediaStream],
  );

  /**
   * Mobile / PC Video File Share directly onto the room Screen Share stage (Supports Dual Screen mode too!)
   */
  const startVideoFileScreenShare = useCallback(
    async (file: File, options?: ScreenShareStartOptions): Promise<boolean> => {
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

        const captureFn =
          (videoEl as any).captureStream?.bind(videoEl) ||
          (videoEl as any).mozCaptureStream?.bind(videoEl);

        if (!captureFn) {
          URL.revokeObjectURL(objectUrl);
          throw new Error('Video stream capture is not supported on this browser.');
        }

        const stream: MediaStream = captureFn();
        await publishScreenMediaStream(stream, options, videoEl);

        const uid = currentUser?.uid || 'local';
        const tabId = tabSessionIdRef.current;
        const targetSlotIndex =
          options?.addSecondScreen &&
          localScreenSlotsRef.current.has(`${uid}__${tabId}__1`)
            ? 2
            : 1;
        const createdStreamId = `${uid}__${tabId}__${targetSlotIndex}`;

        videoEl.onended = () => {
          stopScreenShare(createdStreamId);
        };

        return true;
      } catch (err) {
        console.error('Failed to stream video file as screen share:', err);
        return false;
      }
    },
    [publishScreenMediaStream, stopScreenShare, currentUser?.uid],
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
          publication.source === Track.Source.Camera ||
          publication.source === Track.Source.ScreenShareAudio
        ) {
          try {
            publication.setSubscribed(true);
          } catch {}
          syncAllScreenShares(room);
        }
      },
    );

    room.on(RoomEvent.ParticipantConnected, () => {
      if (isMounted) {
        syncAllScreenShares(room);
      }
    });

    // Handle remote participant audio & screen share video playback
    room.on(
      RoomEvent.TrackSubscribed,
      (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (!isMounted) return;

        // 1. Remote Screen Share Video Track
        if (track.kind === Track.Kind.Video) {
          syncAllScreenShares(room);
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
            syncAllScreenShares(room);
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
            syncAllScreenShares(room);
          }
        } else if (track.kind === Track.Kind.Video) {
          track.detach();
          if (isMounted) {
            syncAllScreenShares(room);
          }
        }
      },
    );

    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (isMounted) {
        syncAllScreenShares(room);
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      if (
        isMounted &&
        (publication.source === Track.Source.ScreenShare ||
          publication.source === Track.Source.Camera ||
          publication.track?.kind === Track.Kind.Video)
      ) {
        for (const [sId, slot] of Array.from(localScreenSlotsRef.current.entries())) {
          const activeVideoTrack = slot.stream.getVideoTracks()[0];
          if (!activeVideoTrack || activeVideoTrack.readyState === 'ended') {
            try {
              slot.stopBroadcaster();
            } catch {}
            localScreenSlotsRef.current.delete(sId);
            stopRoomScreenShare(roomId, sId).catch(() => {});
          }
        }
        const remIds = Array.from(localScreenSlotsRef.current.keys());
        setLocalScreenStreamIds(remIds);
        setIsScreenSharing(remIds.length > 0);
        syncAllScreenShares(room);
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
        syncAllScreenShares(room);
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
          syncAllScreenShares(room);

          // If user started local screen share while LiveKit was still connecting, publish it now
          for (const slot of localScreenSlotsRef.current.values()) {
            const vTrack = slot.stream.getVideoTracks()[0];
            const aTrack = slot.stream.getAudioTracks()[0];
            const trackSource =
              slot.slotIndex === 2 ? Track.Source.Camera : Track.Source.ScreenShare;
            const trackName = `screen_share__${slot.slotIndex}__${slot.deviceType}`;
            if (vTrack) {
              await room.localParticipant
                .publishTrack(vTrack, {
                  name: trackName,
                  source: trackSource,
                  simulcast: false,
                })
                .then((pub) => {
                  if (pub?.track) {
                    slot.videoTrack = pub.track;
                  }
                })
                .catch(console.warn);
            }
            if (aTrack) {
              await room.localParticipant
                .publishTrack(aTrack, {
                  name: `screen_share_audio__${slot.slotIndex}`,
                  source: Track.Source.ScreenShareAudio,
                })
                .catch(console.warn);
            }
          }
          syncAllScreenShares(room);

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
        syncAllScreenShares(room);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(syncTimer);
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
      for (const [sId, slot] of Array.from(localScreenSlotsRef.current.entries())) {
        try {
          slot.stopBroadcaster();
        } catch {}
        slot.stream.getTracks().forEach((t) => {
          try {
            t.onended = null;
            t.stop();
          } catch {}
        });
        stopRoomScreenShare(roomId, sId).catch(() => {});
      }
      localScreenSlotsRef.current.clear();
      setIsSelfMonitoring(false);
      stopAndUnpublishLocalAudio(room).finally(() => {
        room.disconnect();
      });
      if (audioContainerRef.current) {
        audioContainerRef.current.innerHTML = '';
      }
      roomRef.current = null;
    };
  }, [roomId, currentUser?.uid, isParticipantAllowedToSpeak, syncAllScreenShares]);

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
    activeScreenShare: activeScreenShares[0] || null,
    activeScreenShares,
    localScreenStreamIds,
    startScreenShare,
    startCameraScreenShare,
    startUsbDeviceScreenShare,
    startWebUsbScreenShare,
    startVideoFileScreenShare,
    stopScreenShare,
    room: roomRef.current,
  };
}
