import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  Crown,
  Diamond,
  Shield,
  Mic,
  MicOff,
  Film,
  Users,
  Flame,
  Tv,
  RotateCw,
  RotateCcw,
  Smartphone,
  ArrowLeft,
  LogOut,
  MessageSquare,
  Clock,
  FastForward,
  X,
  ListVideo,
  Trash2,
  Zap,
  MoreVertical,
  Wifi,
  FolderOpen,
  Layers,
  Check,
  Search,
} from 'lucide-react';
import type {
  RoomCinemaState,
  Seat,
  User,
  AudienceMember,
  ChatMessage,
  CinemaFolder,
  CinemaEpisode,
} from '../types';
import { getVipAvatarClass } from '../types';
import { AvatarFrameOverlay } from './AvatarFrameOverlay';
import {
  updateCinemaPlayback,
  updateCinemaDuration,
  updateCinemaSeatCount,
  subscribeToCinemaFolders,
  playCinemaEpisodeInRoom,
} from '../services';
import { useLanguage } from '../contexts';
import { renderTextWithLinks } from '../utils/linkify';

interface CinemaPlayerPanelProps {
  roomId: string;
  roomName: string;
  cinemaState: RoomCinemaState;
  seats: Seat[];
  currentUser: User;
  isHost: boolean;
  speakingUids: Set<string>;
  vipUsersMap: Record<string, boolean>;
  vipFramesMap: Record<string, string>;
  usersAvatarMap: Record<string, string>;
  usersLevelMap?: Record<string, number>;
  usersLevelFrameMap?: Record<string, string>;
  audience: AudienceMember[];
  mySeat: Seat | null;
  chatMessages?: ChatMessage[];
  onToggleMyMute: () => void;
  onLeaveMySeat?: (seatNo?: number) => void;
  audioAutoplayBlocked?: boolean;
  onUnlockAudio?: () => void;
  isSpeakerMuted?: boolean;
  onToggleSpeakerMute?: () => void;
  onSeatClick: (seat: Seat) => void;
  onOpenConfigModal: () => void;
  onOpenGiftStore?: (targetUserId?: string, targetUsername?: string) => void;
  onOpenProfile?: (uid: string) => void;
}

const SEAT_NAME_COLORS = [
  'text-emerald-400',
  'text-cyan-400',
  'text-pink-400',
  'text-amber-400',
  'text-violet-400',
  'text-blue-400',
  'text-teal-400',
  'text-rose-400',
  'text-yellow-400',
  'text-indigo-400',
  'text-orange-400',
  'text-purple-400',
];

export default function CinemaPlayerPanel({
  roomId,
  roomName,
  cinemaState,
  seats,
  currentUser,
  isHost,
  speakingUids,
  vipUsersMap,
  vipFramesMap,
  usersAvatarMap,
  usersLevelMap = {},
  usersLevelFrameMap = {},
  audience,
  mySeat,
  chatMessages,
  onToggleMyMute,
  onLeaveMySeat,
  audioAutoplayBlocked,
  onUnlockAudio,
  isSpeakerMuted,
  onToggleSpeakerMute,
  onSeatClick,
  onOpenConfigModal,
  onOpenProfile,
}: CinemaPlayerPanelProps) {
  const { tr, isRTL } = useLanguage();

  // Fullscreen Live Chat Notification Toast
  const [activeChatToast, setActiveChatToast] = useState<ChatMessage | null>(null);
  const [isChatToastEnabled, setIsChatToastEnabled] = useState(true);
  const lastSeenMsgIdRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedChatRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotatedLandscape, setIsRotatedLandscape] = useState(false);
  const [isObjectCover, setIsObjectCover] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [audioBlockedNotice, setAudioBlockedNotice] = useState(false);
  const [isLocalPaused, setIsLocalPaused] = useState<boolean>(!cinemaState.isPlaying);
  const autoEnteredRef = useRef(false);

  // Playback Timeline and Duration Tracking
  const [currentTime, setCurrentTime] = useState<number>(cinemaState.currentTime || 0);
  const [duration, setDuration] = useState<number>(cinemaState.duration || 0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [pauseToastUser, setPauseToastUser] = useState<string | null>(null);
  const prevIsPlayingRef = useRef<boolean>(cinemaState.isPlaying);
  const hasSyncedInitialRef = useRef<boolean>(false);
  const lastHandledSeekSeqRef = useRef<number>(cinemaState.seekSeq || 0);

  // Global Admin Cinema Folders & Episodes State
  const [isPlaylistDrawerOpen, setIsPlaylistDrawerOpen] = useState(false);
  const [cinemaFolders, setCinemaFolders] = useState<CinemaFolder[]>([]);
  const [selectedDrawerFolderId, setSelectedDrawerFolderId] = useState<string | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [playlistToast, setPlaylistToast] = useState<string | null>(null);

  // Top Section Menu & Network MS (Ping) State
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [pingMs, setPingMs] = useState<number>(38);

  // Measure real-time network latency (Ping in ms)
  useEffect(() => {
    let isMounted = true;
    const measurePing = async () => {
      try {
        const start = performance.now();
        await fetch(`${window.location.origin}/favicon.ico?_p=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (!isMounted) return;
        const latency = Math.round(performance.now() - start);
        setPingMs(Math.max(12, Math.min(999, latency)));
      } catch {
        if (!isMounted) return;
        const nav = navigator as any;
        if (nav.connection?.rtt) {
          setPingMs(nav.connection.rtt);
        } else {
          setPingMs(45);
        }
      }
    };

    measurePing();
    const interval = setInterval(measurePing, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Subscribe to global Admin-managed Cinema Folders
  useEffect(() => {
    const unsub = subscribeToCinemaFolders((folders) => {
      setCinemaFolders(folders);
    });
    return () => unsub();
  }, []);

  const handlePlayEpisodeFromDrawer = async (
    folder: CinemaFolder,
    episode: CinemaEpisode,
  ) => {
    try {
      await playCinemaEpisodeInRoom(
        roomId,
        folder,
        episode,
        {
          uid: currentUser.uid,
          username: currentUser.username,
        },
        true,
        cinemaState?.seatCount || 5,
      );
      setPlaylistToast(
        tr(
          `فیلمەکە گۆڕدرا بۆ: ${folder.title} - ${episode.title}`,
          `Switched to: ${folder.title} - ${episode.title}`,
        ),
      );
      setTimeout(() => setPlaylistToast(null), 3000);
      setIsPlaylistDrawerOpen(false);
    } catch (err: any) {
      console.warn('Failed to play episode:', err);
    }
  };

  // Broadcast toast notification whenever someone pauses playback
  useEffect(() => {
    if (prevIsPlayingRef.current && !cinemaState.isPlaying) {
      const pauser = cinemaState.pausedByName || cinemaState.updatedByName;
      if (pauser) {
        setPauseToastUser(pauser);
        const timer = setTimeout(() => {
          setPauseToastUser(null);
        }, 4500);
        return () => clearTimeout(timer);
      }
    } else if (cinemaState.isPlaying) {
      setPauseToastUser(null);
    }
    prevIsPlayingRef.current = cinemaState.isPlaying;
  }, [cinemaState.isPlaying, cinemaState.pausedByName, cinemaState.updatedByName]);

  // Sync duration from Firebase state if available
  useEffect(() => {
    if (cinemaState.duration && cinemaState.duration > 0 && !duration) {
      setDuration(cinemaState.duration);
    }
  }, [cinemaState.duration]);

  const effectiveDuration = duration || cinemaState.duration || 0;

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
      return '00:00';
    }
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Kurdish minute progress summary (e.g., "خولەکی ١٢ لە ٩٥")
  const getMinutesSummary = (current: number, total: number): string => {
    const currMin = Math.floor(current / 60);
    const totalMin = Math.floor(total / 60);
    if (totalMin > 0) {
      return tr(`خولەکی ${currMin} لە ${totalMin}`, `Min ${currMin} of ${totalMin}`);
    }
    return tr(`خولەکی ${currMin}`, `Min ${currMin}`);
  };

  // Monitor incoming chat messages for subtle fullscreen notification toasts
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) return;

    // First time initializing: remember the latest message ID without toasting old history
    if (!hasInitializedChatRef.current) {
      hasInitializedChatRef.current = true;
      lastSeenMsgIdRef.current = chatMessages[chatMessages.length - 1]?.id || null;
      return;
    }

    const latestMsg = chatMessages[chatMessages.length - 1];
    if (!latestMsg) return;

    if (latestMsg.id !== lastSeenMsgIdRef.current) {
      lastSeenMsgIdRef.current = latestMsg.id;

      // Only toast when user is in fullscreen and message is from another member
      if (
        isFullscreen &&
        isChatToastEnabled &&
        latestMsg.senderId !== currentUser.uid &&
        latestMsg.senderId !== 'system' &&
        latestMsg.text.trim()
      ) {
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        setActiveChatToast(latestMsg);

        // Auto-dismiss after 4 seconds to never annoy the viewer
        toastTimeoutRef.current = setTimeout(() => {
          setActiveChatToast(null);
        }, 4000);
      }
    }
  }, [chatMessages, isFullscreen, isChatToastEnabled, currentUser.uid]);

  // Dismiss toast and clear timer if exiting fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setActiveChatToast(null);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    }
  }, [isFullscreen]);

  // Custom seat count configured by Host in cinemaState (default 5, ranges from 1 to 12)
  const [localSeatCount, setLocalSeatCount] = useState<number>(cinemaState.seatCount || 5);

  useEffect(() => {
    if (cinemaState.seatCount && cinemaState.seatCount !== localSeatCount) {
      setLocalSeatCount(cinemaState.seatCount);
    }
  }, [cinemaState.seatCount]);

  const targetSeatCount = Math.max(1, Math.min(16, localSeatCount || cinemaState.seatCount || 5));
  const cinemaSeats: Seat[] = Array.from({ length: targetSeatCount }, (_, i) => {
    if (seats[i]) return seats[i];
    return {
      seatNo: i + 1,
      userId: null,
      username: null,
      avatar: null,
      isMuted: false,
      isLocked: false,
      role: 'speaker',
      isMicBlocked: false,
    };
  });

  const handleIncreaseCinemaSeats = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isHost) return;
    if (targetSeatCount >= 16) return;
    const nextCount = targetSeatCount + 1;
    setLocalSeatCount(nextCount);
    try {
      await updateCinemaSeatCount(roomId, nextCount, {
        uid: currentUser.uid,
        username: currentUser.username,
      });
    } catch (err) {
      console.error('Failed to increase cinema seats:', err);
      setLocalSeatCount(targetSeatCount);
    }
  };

  const handleDecreaseCinemaSeats = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isHost) return;
    if (targetSeatCount <= 1) return;
    const nextCount = targetSeatCount - 1;
    setLocalSeatCount(nextCount);
    try {
      await updateCinemaSeatCount(roomId, nextCount, {
        uid: currentUser.uid,
        username: currentUser.username,
      });
    } catch (err) {
      console.error('Failed to decrease cinema seats:', err);
      setLocalSeatCount(targetSeatCount);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.setAttribute('x5-playsinline', 'true');
      videoRef.current.setAttribute('x5-video-player-type', 'h5-page');
    }
  }, []);

  const handleUserGestureAudioUnlock = () => {
    onUnlockAudio?.();
  };

  const handleSeatItemClick = (seat: Seat) => {
    handleUserGestureAudioUnlock();
    if (seat.userId === currentUser.uid) {
      // 1-tap direct mic toggle for the user's own seat!
      onToggleMyMute();
    } else {
      onSeatClick(seat);
    }
  };


  // Reset error when videoUrl changes and reload media
  useEffect(() => {
    setVideoError(false);
    setAudioBlockedNotice(false);
    hasSyncedInitialRef.current = false;
    lastHandledSeekSeqRef.current = cinemaState.seekSeq || 0;
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [cinemaState.videoUrl]);

  // ─────────────────────────────────────────────────────────────
  // VIDEO PLAYBACK & JITTER-FREE SYNC HANDLER
  // ─────────────────────────────────────────────────────────────
  const serverOffsetRef = useRef<number>(0);

  // Synchronize system clock with Firebase server time offset
  useEffect(() => {
    const offsetRef = ref(database, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, (snap) => {
      serverOffsetRef.current = Number(snap.val()) || 0;
    });
    return () => unsub();
  }, []);

  // Compute exact expected playback position on initial sync or explicit seek/action
  const getExpectedLiveTime = useCallback((): number => {
    if (!cinemaState.isPlaying) {
      return cinemaState.currentTime || 0;
    }
    const now = Date.now() + serverOffsetRef.current;
    const elapsedSec = Math.max(0, (now - (cinemaState.lastUpdated || now)) / 1000);
    const target = (cinemaState.currentTime || 0) + elapsedSec;
    if (effectiveDuration > 0 && target >= effectiveDuration) {
      return effectiveDuration;
    }
    return target;
  }, [cinemaState.isPlaying, cinemaState.currentTime, cinemaState.lastUpdated, effectiveDuration]);

  // Synchronize video playback with Firebase Realtime Database
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cinemaState.videoUrl) return;

    // 1. Play / Pause Synchronization
    if (cinemaState.isPlaying && video.paused) {
      handleUserGestureAudioUnlock();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => {
            setAudioBlockedNotice(true);
          }).catch(() => {
            setAudioBlockedNotice(true);
          });
        });
      }
    } else if (!cinemaState.isPlaying && !video.paused) {
      video.pause();
    }

    // 2. EXPLICIT MOVIE CHANGE ONLY:
    // When a new movie is set by host, load from start
    if (cinemaState.syncType === 'movie_change') {
      if (lastHandledSeekSeqRef.current !== cinemaState.seekSeq) {
        lastHandledSeekSeqRef.current = cinemaState.seekSeq || 0;
        hasSyncedInitialRef.current = false;
        try {
          sessionStorage.removeItem(`ssmr_cinema_pos_${roomId}`);
        } catch {}
        video.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }

    // 3. COMPLETE PLAYBACK INDEPENDENCE FOR ALL MEMBERS:
    // Each member is 100% independent during movie playback:
    // - Strong internet user continues playing smoothly without stopping.
    // - Slow internet user: if their video pauses/buffers, when network recovers,
    //   it resumes from the EXACT spot where it stopped, NEVER jumping forward (nak bcheta pesh)!
    // No automatic forward seeking, no automatic backward seeking, no buffer dumps.
  }, [
    cinemaState.isPlaying,
    cinemaState.syncType,
    cinemaState.seekSeq,
    cinemaState.videoUrl,
    roomId,
  ]);

  // Periodic Ground-Truth Sync from Host (Every 25 seconds)
  useEffect(() => {
    if (!isHost || !cinemaState.isPlaying || !cinemaState.videoUrl) return;

    const interval = setInterval(() => {
      const vid = videoRef.current;
      if (vid && !vid.paused && vid.currentTime > 0) {
        updateCinemaPlayback(
          roomId,
          true,
          vid.currentTime,
          { uid: currentUser.uid, username: currentUser.username },
          effectiveDuration,
          null,
          'heartbeat',
        ).catch(() => {});
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [isHost, cinemaState.isPlaying, cinemaState.videoUrl, roomId, currentUser, effectiveDuration]);

  // Handle video metadata loaded (safe duration detection without resetting currentTime)
  const handleLoadedMetadata = () => {
    setVideoError(false);
    const vid = videoRef.current;
    if (!vid) return;

    if (Number.isFinite(vid.duration) && vid.duration > 0) {
      setDuration(vid.duration);
      if (isHost && (!cinemaState.duration || Math.abs(cinemaState.duration - vid.duration) > 2)) {
        updateCinemaDuration(roomId, vid.duration).catch(() => {});
      }
    }

    // Perform initial sync once media metadata is available
    if (!hasSyncedInitialRef.current) {
      hasSyncedInitialRef.current = true;
      let targetTime = 0;
      const savedPos = sessionStorage.getItem(`ssmr_cinema_pos_${roomId}`);
      if (savedPos && Number(savedPos) > 2) {
        targetTime = Number(savedPos);
      } else {
        targetTime = getExpectedLiveTime();
      }

      if (Number.isFinite(targetTime) && targetTime > 0.5) {
        vid.currentTime = targetTime;
        setCurrentTime(targetTime);
      }
    }
  };

  const handleCanPlay = () => {
    setVideoError(false);
    if (!hasSyncedInitialRef.current) {
      hasSyncedInitialRef.current = true;
      const vid = videoRef.current;
      if (vid) {
        let targetTime = 0;
        const savedPos = sessionStorage.getItem(`ssmr_cinema_pos_${roomId}`);
        if (savedPos && Number(savedPos) > 2) {
          targetTime = Number(savedPos);
        } else {
          targetTime = getExpectedLiveTime();
        }

        if (Number.isFinite(targetTime) && targetTime > 0.5) {
          vid.currentTime = targetTime;
          setCurrentTime(targetTime);
        }
      }
    }
  };

  // Live video time update listener
  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && !isSeeking) {
      setCurrentTime(vid.currentTime);
      if (Number.isFinite(vid.duration) && vid.duration > 0 && !duration) {
        setDuration(vid.duration);
      }
      if (vid.currentTime > 2) {
        try {
          sessionStorage.setItem(`ssmr_cinema_pos_${roomId}`, String(vid.currentTime));
        } catch {}
      }
    }
  };

  // Handle master play / pause toggle (Host toggles room state, Members toggle their local video)
  const handleTogglePlayPause = async () => {
    handleUserGestureAudioUnlock();
    const video = videoRef.current;
    if (!video) return;

    if (!isHost && !currentUser.isAdmin) {
      // Independent Local Play/Pause for Audience Member
      if (video.paused) {
        video.play().catch(() => {});
        setIsLocalPaused(false);
      } else {
        video.pause();
        setIsLocalPaused(true);
      }
      return;
    }

    // Host / Admin controls room broadcast
    const nextPlaying = !cinemaState.isPlaying;
    const safeBaseTime = video.currentTime > 0 ? video.currentTime : (cinemaState.currentTime || currentTime || 0);

    try {
      await updateCinemaPlayback(
        roomId,
        nextPlaying,
        safeBaseTime,
        {
          uid: currentUser.uid,
          username: currentUser.username,
        },
        effectiveDuration,
        !nextPlaying ? currentUser.username : null,
        'play_pause',
      );
    } catch (err) {
      console.error('Failed to sync cinema playback:', err);
    }
  };

  // Fast forward / Rewind relative seek (e.g. +10s / -10s)
  const handleSeekRelative = async (deltaSeconds: number) => {
    handleUserGestureAudioUnlock();
    const video = videoRef.current;
    if (!video) return;

    const baseTime = video.currentTime || currentTime;
    const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
    const targetTime = Math.max(0, Math.min(maxDur, baseTime + deltaSeconds));

    video.currentTime = targetTime;
    setCurrentTime(targetTime);

    // Only Host / Admin updates the room state
    if (isHost || currentUser.isAdmin) {
      try {
        await updateCinemaPlayback(
          roomId,
          cinemaState.isPlaying,
          targetTime,
          {
            uid: currentUser.uid,
            username: currentUser.username,
          },
          effectiveDuration,
          !cinemaState.isPlaying ? (cinemaState.pausedByName || currentUser.username) : null,
          'seek',
        );
      } catch (err) {
        console.error('Failed to seek video relative:', err);
      }
    }
  };

  // Jump to specific point from timeline slider
  const handleSeekTo = async (newTime: number) => {
    handleUserGestureAudioUnlock();
    setIsSeeking(false);
    const video = videoRef.current;
    if (!video) return;

    const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
    const targetTime = Math.max(0, Math.min(maxDur, newTime));

    video.currentTime = targetTime;
    setCurrentTime(targetTime);

    // Only Host / Admin updates the room state
    if (isHost || currentUser.isAdmin) {
      try {
        await updateCinemaPlayback(
          roomId,
          cinemaState.isPlaying,
          targetTime,
          {
            uid: currentUser.uid,
            username: currentUser.username,
          },
          effectiveDuration,
          !cinemaState.isPlaying ? (cinemaState.pausedByName || currentUser.username) : null,
          'seek',
        );
      } catch (err) {
        console.error('Failed to seek video to time:', err);
      }
    }
  };

  // Handle personal volume change (does not affect other users)
  const handleVolumeChange = (newVol: number) => {
    handleUserGestureAudioUnlock();
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const handleToggleMute = () => {
    handleUserGestureAudioUnlock();
    if (isMuted) {
      setIsMuted(false);
      setAudioBlockedNotice(false);
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = volume || 0.8;
      }
    } else {
      setIsMuted(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }
  };

  // Fullscreen and Landscape Auto-Rotate handlers
  const enterLandscapeFullscreen = async () => {
    setIsFullscreen(true);
    setShowControls(true);

    // If screen is currently portrait (taller than wide), enable rotated landscape CSS
    if (window.innerHeight > window.innerWidth) {
      setIsRotatedLandscape(true);
    } else {
      setIsRotatedLandscape(false);
    }

    const el = containerRef.current;
    if (el && !document.fullscreenElement) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch {
        // Fallback to CSS fullscreen
      }
    }

    // Attempt native Screen Orientation lock to landscape
    try {
      const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
        setIsRotatedLandscape(false);
      } else if ((screen as any).lockOrientation) {
        (screen as any).lockOrientation('landscape');
        setIsRotatedLandscape(false);
      }
    } catch {
      // If native lock fails, isRotatedLandscape handles CSS 90deg rotation seamlessly
    }
  };

  const exitLandscapeFullscreen = async () => {
    setIsFullscreen(false);
    setIsRotatedLandscape(false);

    try {
      if (screen.orientation?.unlock) {
        screen.orientation.unlock();
      } else if ((screen as any).unlockOrientation) {
        (screen as any).unlockOrientation();
      }
    } catch {}

    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch {}
    }
  };

  const handleToggleFullscreen = () => {
    if (isFullscreen) {
      exitLandscapeFullscreen();
    } else {
      enterLandscapeFullscreen();
    }
  };

  // Listen for native fullscreen change & orientation change
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      if (!isFs && isFullscreen) {
        setIsFullscreen(false);
        setIsRotatedLandscape(false);
        try {
          screen.orientation?.unlock?.();
        } catch {}
      }
    };

    const handleResizeOrOrientation = () => {
      if (window.innerWidth > window.innerHeight) {
        setIsRotatedLandscape(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('resize', handleResizeOrOrientation);
    window.addEventListener('orientationchange', handleResizeOrOrientation);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('resize', handleResizeOrOrientation);
      window.removeEventListener('orientationchange', handleResizeOrOrientation);
    };
  }, [isFullscreen]);

  // Auto-hide controls after 3.5s of inactivity in both standard and fullscreen modes
  useEffect(() => {
    if (!showControls) return;
    const hideTimer = setTimeout(() => {
      setShowControls(false);
    }, 3500);
    return () => clearTimeout(hideTimer);
  }, [showControls]);

  // ─────────────────────────────────────────────────────────────
  // SLEEK CONSOLIDATED TOP OPTIONS MENU
  // Unclutters the top header into a single dropdown menu
  // ─────────────────────────────────────────────────────────────
  const renderOptionsMenu = (isFs: boolean) => (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsTopMenuOpen((prev) => !prev);
        }}
        className={`flex ${
          isFs ? 'h-8 w-8 rounded-xl' : 'h-7 w-7 rounded-xl'
        } items-center justify-center border transition shadow backdrop-blur ${
          isTopMenuOpen
            ? 'bg-amber-400 text-black border-amber-300 font-bold scale-105'
            : 'bg-black/75 border-white/20 text-white hover:bg-white/20'
        }`}
        title={tr('مێنیوی سینەما و بژاردەکان', 'Cinema Options Menu')}
      >
        <MoreVertical className={isFs ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </button>

      <AnimatePresence>
        {isTopMenuOpen && (
          <>
            {/* Overlay Backdrop to dismiss on click outside */}
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsTopMenuOpen(false);
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-9 sm:top-10 end-0 z-50 w-64 max-w-[85vw] rounded-2xl bg-slate-900/95 border border-white/20 p-2 shadow-2xl backdrop-blur-2xl text-white select-none pointer-events-auto"
            >
              {/* Header title */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 mb-1">
                <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                  {tr('مێنیوی سینەما', 'Cinema Menu')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTopMenuOpen(false)}
                  className="text-white/40 hover:text-white transition p-0.5"
                  title={tr('داخستن', 'Close')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-0.5">
                {/* 1. Saved Movies Playlist */}
                <button
                  type="button"
                  onClick={() => {
                    setIsTopMenuOpen(false);
                    setIsPlaylistDrawerOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Film className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{tr('فۆڵدەری فیلمەکان', 'Movie Folders')}</span>
                  </div>
                  {cinemaFolders.length > 0 && (
                    <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black">
                      {cinemaFolders.length}
                    </span>
                  )}
                </button>

                {/* 2. Admin Cinema Settings */}
                {(isHost || currentUser.isAdmin) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTopMenuOpen(false);
                      onOpenConfigModal();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{tr('ڕێکخستنی سینەما', 'Cinema Settings')}</span>
                    </div>
                    <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                      ADMIN
                    </span>
                  </button>
                )}

                {/* 3. Room Voices Toggle */}
                {onToggleSpeakerMute && (
                  <button
                    type="button"
                    onClick={() => {
                      handleUserGestureAudioUnlock();
                      onToggleSpeakerMute();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      {isSpeakerMuted ? (
                        <VolumeX className="h-4 w-4 text-rose-400 shrink-0" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      <span>{tr('دەنگی قسەکەرانی ژوور', 'Room Voices')}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSpeakerMuted
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isSpeakerMuted ? tr('بێدەنگ', 'Muted') : tr('کراوە', 'ON')}
                    </span>
                  </button>
                )}

                {/* 4. Movie Audio Toggle */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    {isMuted ? (
                      <VolumeX className="h-4 w-4 text-rose-400 shrink-0" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                    <span>{tr('دەنگی فیلمەکە', 'Movie Sound')}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isMuted
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}
                  >
                    {isMuted ? tr('بێدەنگ', 'Muted') : tr('کراوە', 'ON')}
                  </span>
                </button>

                {/* 5. Aspect Fit / Fill Toggle */}
                <button
                  type="button"
                  onClick={() => setIsObjectCover((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Maximize2 className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{tr('شێوازی قەبارەی شاشە', 'Screen Fit')}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isObjectCover
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-white/10 text-slate-300 border border-white/20'
                    }`}
                  >
                    {isObjectCover ? tr('پڕکردنەوە (Fill)', 'Fill') : tr('گونجاندن (Fit)', 'Fit')}
                  </span>
                </button>

                {/* 6. Sync to Live (Optional Manual Catch-up) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsTopMenuOpen(false);
                    const expectedTime = getExpectedLiveTime();
                    if (videoRef.current && Number.isFinite(expectedTime) && expectedTime > 0) {
                      videoRef.current.currentTime = expectedTime;
                      setCurrentTime(expectedTime);
                    }
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>{tr('هاوکاتبوون لەگەڵ ژوور (Live)', 'Sync to Live')}</span>
                  </div>
                  <span className="rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 text-[9px] font-black">
                    LIVE
                  </span>
                </button>

                {/* 6. Landscape 90° Rotate */}
                <button
                  type="button"
                  onClick={() => setIsRotatedLandscape((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCw className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{tr('سوڕاندنی ٩٠ پلە', 'Rotate 90°')}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isRotatedLandscape
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-white/10 text-slate-300 border border-white/20'
                    }`}
                  >
                    {isRotatedLandscape ? tr('چالاکە', 'ON') : tr('ناچالاکە', 'OFF')}
                  </span>
                </button>

                {/* 7. Chat Notification Toasts */}
                <button
                  type="button"
                  onClick={() => setIsChatToastEnabled((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{tr('ئاگاداری نامەکانی چات', 'Chat Popups')}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isChatToastEnabled
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-white/10 text-slate-400 border border-white/20'
                    }`}
                  >
                    {isChatToastEnabled ? tr('چالاکە', 'ON') : tr('داخراو', 'OFF')}
                  </span>
                </button>

                {/* 8. Leave Seat (if user is currently seated) */}
                {mySeat && onLeaveMySeat && (
                  <div className="pt-1 mt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTopMenuOpen(false);
                        onLeaveMySeat(mySeat.seatNo);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/15 transition active:scale-98"
                    >
                      <div className="flex items-center gap-2.5">
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>{tr('جێهێشتنی کورسی', 'Leave Seat')}</span>
                      </div>
                      <span className="text-[10px] text-rose-400/70">
                        {tr(`کورسی ${mySeat.seatNo}`, `Seat ${mySeat.seatNo}`)}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full transition-all duration-300 ${
        isFullscreen
          ? isRotatedLandscape
            ? 'fixed z-[9999] bg-black overflow-hidden'
            : 'fixed inset-0 z-[9999] bg-black overflow-hidden flex flex-col justify-center items-center'
          : 'p-3 pb-1'
      }`}
      style={
        isFullscreen && isRotatedLandscape
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: '100vh',
              height: '100vw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              zIndex: 9999,
            }
          : undefined
      }
    >
      {/* Mobile Auto-Rotate / Fullscreen Quick Pill (Shown on mobile when not fullscreen) */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-1 mb-2 sm:hidden">
          <button
            onClick={enterLandscapeFullscreen}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-rose-500/25 active:scale-95 transition"
          >
            <Smartphone className="h-3.5 w-3.5 rotate-90" />
            <span>{tr('شاشەی تەواو و ئاسۆیی (Auto Rotate)', 'Full Size & Auto Rotate')}</span>
          </button>
          <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">VIP 5-SEAT</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. CINEMA SCREEN WIDESCREEN VIDEO PLAYER
          ───────────────────────────────────────────────────────────── */}
      <div
        onClick={() => {
          setShowControls((prev) => !prev);
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        className={`relative overflow-hidden bg-black select-none transition-all duration-300 ${
          isFullscreen
            ? 'h-full w-full flex items-center justify-center cursor-pointer'
            : 'w-full aspect-video rounded-2xl sm:rounded-3xl border-2 border-rose-950/80 shadow-[0_10px_35px_rgba(0,0,0,0.9),0_0_25px_rgba(225,29,72,0.2)] group cursor-pointer'
        }`}
      >
        {/* Cinema Screen Backlight / Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none z-10" />

        {/* Video Element */}
        <video
          key={cinemaState.videoUrl}
          ref={videoRef}
          src={cinemaState.videoUrl}
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onError={(e) => {
            const vid = videoRef.current;
            console.warn('Cinema video error:', vid?.error, e);
            setVideoError(true);
          }}
          onLoadedData={() => setVideoError(false)}
          onCanPlay={handleCanPlay}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsLocalPaused(false)}
          onPause={() => setIsLocalPaused(true)}
          onEnded={() => {
            const vid = videoRef.current;
            const isNearEnd = vid && effectiveDuration > 10 && vid.currentTime >= (effectiveDuration - 3);
            if (isHost && isNearEnd) {
              updateCinemaPlayback(
                roomId,
                false,
                effectiveDuration,
                { uid: currentUser.uid, username: currentUser.username },
                effectiveDuration,
                null,
                'play_pause',
              );
            }
          }}
          className={`h-full w-full ${isObjectCover && isFullscreen ? 'object-cover' : 'object-contain'} bg-black`}
        >
          <source src={cinemaState.videoUrl} type="video/mp4" />
          <source src={cinemaState.videoUrl} />
        </video>

        {/* Always-visible slim glowing progress bar at the bottom edge */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60 z-20 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 transition-all duration-150"
            style={{
              width: `${effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0}%`,
            }}
          />
        </div>

        {/* Subtle Pause Status Pill (When controls are hidden) */}
        {!cinemaState.isPlaying && (cinemaState.pausedByName || cinemaState.updatedByName) && !showControls && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 rounded-full bg-black/80 border border-amber-400/50 px-3 py-1 shadow-lg backdrop-blur-md">
              <Pause className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold text-white">
                {tr('وەستێنراوە لەلایەن:', 'Paused by:')} <strong className="text-amber-400">{cinemaState.pausedByName || cinemaState.updatedByName}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Pause Notification Toast Banner */}
        <AnimatePresence>
          {pauseToastUser && (
            <motion.div
              initial={{ opacity: 0, y: -25, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
            >
              <div className="flex items-center gap-2 rounded-2xl bg-black/90 border border-amber-400/80 px-4 py-2 shadow-[0_0_25px_rgba(245,158,11,0.5)] backdrop-blur-md">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400 text-black shrink-0">
                  <Pause className="h-3.5 w-3.5 fill-black" />
                </div>
                <span className="text-xs font-black text-white">
                  <strong className="text-amber-400 font-extrabold">{pauseToastUser}</strong> {tr('فیلمەکەی وەستاند', 'paused the movie')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Browser Audio Autoplay Unblock Banner */}
        {(audioBlockedNotice || audioAutoplayBlocked) && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (audioBlockedNotice) handleToggleMute();
                handleUserGestureAudioUnlock();
              }}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-black px-4 py-1.5 text-xs font-black shadow-xl animate-bounce hover:scale-105 active:scale-95 transition"
            >
              <Volume2 className="h-4 w-4" />
              <span>{tr('دەنگ چالاک بکە (دەنگی فیلم و قسەکردن) 🔊', 'Enable Sound (Movie & Voice Chat) 🔊')}</span>
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            FULLSCREEN NON-INTRUSIVE CHAT TOAST NOTIFICATION
            ════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {isFullscreen && activeChatToast && isChatToastEnabled && (
            <motion.div
              key={activeChatToast.id}
              initial={{ opacity: 0, y: -20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute top-16 start-4 sm:top-18 sm:start-6 z-50 pointer-events-auto max-w-[280px] xs:max-w-xs sm:max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="group relative flex items-start gap-2.5 rounded-2xl border border-white/20 bg-black/80 px-3 py-2.5 shadow-2xl backdrop-blur-xl transition hover:bg-black/95">
                {/* Sender Avatar */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md">
                  {(() => {
                    const avatarUrl =
                      activeChatToast.senderAvatar ||
                      usersAvatarMap[activeChatToast.senderId] ||
                      audience.find((a) => a.uid === activeChatToast.senderId)?.avatar ||
                      null;
                    return avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={activeChatToast.senderName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      activeChatToast.senderName?.charAt(0).toUpperCase() || 'U'
                    );
                  })()}
                </div>

                {/* Sender Info & Message */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-amber-300 truncate">
                      {activeChatToast.senderName}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 bg-white/10 rounded-full px-1.5 py-0.2 shrink-0">
                      {tr('چات', 'Chat')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-white/95 line-clamp-2 leading-snug break-words">
                    {renderTextWithLinks(activeChatToast.text)}
                  </p>
                </div>

                {/* Subtle Dismiss Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveChatToast(null);
                  }}
                  className="text-white/40 hover:text-white transition shrink-0 p-0.5"
                  title={tr('داخستن', 'Dismiss')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════════
            CONTROLS: FULLSCREEN MODE
            ════════════════════════════════════════════════════════════ */}
        {isFullscreen && showControls && (
          <>
            {/* Top Header Overlay in Fullscreen */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 inset-x-4 z-40 flex items-center justify-between pointer-events-auto"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={exitLandscapeFullscreen}
                  className="flex items-center gap-1.5 rounded-full bg-black/75 border border-white/20 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur shadow-lg hover:bg-rose-600 transition"
                >
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  <span>{tr('گەڕانەوە بۆ ژوور', 'Back to Room')}</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full border border-white/10 backdrop-blur">
                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow">
                    CINEMA
                  </span>
                  <span className="font-display text-xs font-black text-white truncate max-w-xs">
                    {cinemaState.title || roomName}
                  </span>
                </div>
              </div>

              {/* Right Action Icons: MS Latency + Mic Pill (if seated) + Options Menu + Exit Fullscreen */}
              <div className="flex items-center gap-2">
                {/* Real-time MS Latency Indicator (Ping) */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-white/20 backdrop-blur text-[11px] font-mono font-bold shadow-lg select-none"
                  title={tr(`خێرایی هێڵی ئینتەرنێت (پینگ): ${pingMs}ms`, `Network Latency (Ping): ${pingMs}ms`)}
                >
                  <Wifi className={`h-3.5 w-3.5 ${pingMs < 80 ? 'text-emerald-400' : pingMs < 180 ? 'text-amber-400' : 'text-rose-400'}`} />
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: pingMs < 80 ? '#34d399' : pingMs < 180 ? '#fbbf24' : '#f43f5e' }}
                  />
                  <span className={pingMs < 80 ? 'text-emerald-400' : pingMs < 180 ? 'text-amber-300' : 'text-rose-400'}>
                    {pingMs}
                    <span className="text-[9px] font-sans text-white/60 ml-0.5">ms</span>
                  </span>
                </div>

                {/* 1-Tap Microphone Pill & Status in Fullscreen */}
                {mySeat && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUserGestureAudioUnlock();
                      onToggleMyMute();
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black shadow-lg transition active:scale-95 ${
                      !mySeat.isMuted
                        ? 'bg-emerald-500 text-black border border-emerald-300 shadow-emerald-500/40 animate-pulse'
                        : 'bg-rose-600/90 text-white border border-rose-400 hover:bg-rose-500'
                    }`}
                    title={!mySeat.isMuted ? tr('بێدەنگکردنی مایک', 'Mute Mic') : tr('کردنەوەی مایک', 'Unmute Mic')}
                  >
                    {!mySeat.isMuted ? (
                      <>
                        <Mic className="h-3.5 w-3.5 stroke-[3]" />
                        <span className="hidden xs:inline">{tr('مایک: کراوە', 'Mic: ON')}</span>
                      </>
                    ) : (
                      <>
                        <MicOff className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span className="hidden xs:inline">{tr('مایک: داخراو', 'Mic: OFF')}</span>
                      </>
                    )}
                  </button>
                )}

                {/* Sleek Consolidated Options Menu Dropdown */}
                {renderOptionsMenu(true)}

                {/* Exit Fullscreen */}
                <button
                  onClick={exitLandscapeFullscreen}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/75 border border-white/20 text-white hover:bg-rose-600 transition shadow"
                  title={tr('دەرچوون لە شاشەی گەورە', 'Exit Fullscreen')}
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Fullscreen Video Progress & Timeline Control Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 sm:bottom-20 inset-x-3 sm:inset-x-8 z-40 flex flex-col gap-2 rounded-2xl bg-black/85 border border-white/20 px-3.5 sm:px-5 py-2.5 backdrop-blur-md shadow-2xl pointer-events-auto"
            >
              {/* Timeline Scrubber */}
              <div className="relative w-full flex items-center group/timeline h-5 cursor-pointer">
                <div className="relative h-2 w-full rounded-full bg-white/20 overflow-hidden group-hover/timeline:h-3 transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 rounded-full transition-all duration-100"
                    style={{
                      width: `${effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0}%`,
                    }}
                  />
                </div>
                {/* Member & Host interactive seek slider */}
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration || 100}
                  step={1}
                  value={currentTime}
                  onMouseDown={() => setIsSeeking(true)}
                  onTouchStart={() => setIsSeeking(true)}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  onMouseUp={(e) => handleSeekTo(parseFloat((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleSeekTo(parseFloat((e.target as HTMLInputElement).value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={tr('بۆ پێشەوە و دواوە بردن (Seek)', 'Seek Forward / Rewind')}
                />
              </div>

              {/* Controls & Time Counter */}
              <div className="flex items-center justify-between gap-2">
                {/* Left: Play/Pause + Rewind + FastForward + Pauser Name */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleTogglePlayPause}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-black hover:bg-amber-300 transition active:scale-95 shadow shrink-0"
                    title={!isLocalPaused ? tr('وەستاندن', 'Pause') : tr('لێدان', 'Play')}
                  >
                    {!isLocalPaused ? (
                      <Pause className="h-4 w-4 fill-black" />
                    ) : (
                      <Play className="h-4 w-4 fill-black ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleSeekRelative(-10)}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white hover:text-amber-300 transition text-xs font-bold active:scale-95 shadow shrink-0"
                    title={tr('١٠ چرکە بۆ دواوە', 'Rewind 10s')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="font-mono text-[11px]">-10s</span>
                  </button>

                  <button
                    onClick={() => handleSeekRelative(10)}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white hover:text-amber-300 transition text-xs font-bold active:scale-95 shadow shrink-0"
                    title={tr('١٠ چرکە بۆ پێشەوە', 'Forward 10s')}
                  >
                    <span className="font-mono text-[11px]">+10s</span>
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>

                  {/* Who paused indicator */}
                  {!cinemaState.isPlaying && (cinemaState.pausedByName || cinemaState.updatedByName) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-xl shadow">
                      <Pause className="h-3 w-3 fill-amber-300 shrink-0" />
                      <span className="text-amber-200/90">{tr('ڕاگیراوە لەلایەن:', 'Paused by:')}</span>
                      <span className="text-white underline font-extrabold">{cinemaState.pausedByName || cinemaState.updatedByName}</span>
                    </div>
                  )}
                </div>

                {/* Center: Live Time Display & Minutes Summary */}
                <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold text-amber-300 bg-white/5 px-3 py-1 rounded-xl border border-white/10 shadow-inner">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-white/40 font-sans">/</span>
                  <span className="text-slate-300">
                    {effectiveDuration > 0 ? formatTime(effectiveDuration) : '--:--'}
                  </span>
                  {effectiveDuration > 0 && (
                    <span className="hidden xs:inline-block text-[11px] text-amber-200/90 font-sans font-bold bg-amber-500/20 px-2 py-0.5 rounded-full mr-1">
                      {getMinutesSummary(currentTime, effectiveDuration)}
                    </span>
                  )}
                </div>

                {/* Right: Sound volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleMute}
                    className="p-1 text-slate-300 hover:text-white transition"
                    title={isMuted ? tr('دەنگ بکەرەوە', 'Unmute') : tr('بێدەنگکردن', 'Mute')}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-28 accent-amber-400 cursor-pointer h-1.5 rounded bg-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Controls in Fullscreen */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 inset-x-4 z-40 flex items-center justify-center pointer-events-auto"
            >
              {/* Floating Custom-Seat Audio Mic Bar */}
              <div className="flex max-w-[94vw] items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar py-1.5 px-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-rose-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
                <span className="shrink-0 text-[9px] font-black text-amber-400 hidden xs:inline uppercase tracking-wider">
                  {targetSeatCount} MICS:
                </span>
                {isHost && (
                  <div className="flex shrink-0 items-center gap-1 mr-1">
                    <button
                      onClick={handleDecreaseCinemaSeats}
                      disabled={targetSeatCount <= 1}
                      title={tr('کەمکردنی کورسی', 'Remove Seat')}
                      className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-rose-600 transition font-black text-xs disabled:opacity-30"
                    >
                      -
                    </button>
                    <button
                      onClick={handleIncreaseCinemaSeats}
                      disabled={targetSeatCount >= 16}
                      title={tr('زیادکردنی کورسی', 'Add Seat')}
                      className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-emerald-600 transition font-black text-xs disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                )}
                {cinemaSeats.map((seat, index) => {
                  const isOccupied = Boolean(seat.userId);
                  const isCurrentUser = seat.userId === currentUser.uid;
                  const isSpeaking =
                    isOccupied &&
                    !seat.isMuted &&
                    seat.userId !== null &&
                    speakingUids.has(seat.userId);

                  const seatAvatarUrl =
                    seat.avatar ||
                    (seat.userId ? usersAvatarMap[seat.userId] : null) ||
                    (isCurrentUser ? currentUser.avatar || currentUser.profileImage : null) ||
                    audience.find((a) => a.uid === seat.userId)?.avatar ||
                    null;

                  return (
                    <div
                      key={`fs-seat-${seat.seatNo}`}
                      onClick={() => handleSeatItemClick(seat)}
                      title={
                        isCurrentUser
                          ? (!seat.isMuted ? tr('بێدەنگکردنی مایکم', 'Mute My Mic') : tr('کردنەوەی مایکم', 'Unmute My Mic'))
                          : seat.username || `${tr('کورسی', 'Seat')} ${seat.seatNo}`
                      }
                      className="group relative flex shrink-0 flex-col items-center cursor-pointer px-0.5"
                    >
                      <div
                        className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 ${
                          isSpeaking
                            ? 'border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] scale-105'
                            : isOccupied
                            ? 'border border-amber-400/80 bg-black shadow-md'
                            : 'border border-dashed border-rose-400/35 bg-black/60 hover:border-amber-400/60'
                        }`}
                      >
                        {isOccupied ? (
                          <>
                            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[10px] font-black text-white">
                              {seatAvatarUrl ? (
                                <img src={seatAvatarUrl} alt={seat.username || ''} className="h-full w-full object-cover" />
                              ) : (
                                (seat.username || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            <AvatarFrameOverlay
                              frameId={
                                (isCurrentUser ? currentUser.avatarFrame : undefined) ||
                                seat.avatarFrame ||
                                (seat.userId ? usersLevelFrameMap[seat.userId] : undefined)
                              }
                              level={
                                (isCurrentUser ? currentUser.level : undefined) ||
                                seat.level ||
                                (seat.userId ? usersLevelMap[seat.userId] : undefined) ||
                                audience.find((a) => a.uid === seat.userId)?.level ||
                                1
                              }
                            />
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 z-30 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black shadow ${
                                seat.isMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                              }`}
                            >
                              {seat.isMuted ? (
                                <MicOff className="h-2 w-2 stroke-[2.5]" />
                              ) : (
                                <Mic className="h-2 w-2 stroke-[2.5]" />
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-[9px] font-black text-rose-300/70">{seat.seatNo}</span>
                        )}
                      </div>
                      <span
                        className={`truncate text-center text-[8px] sm:text-[9px] max-w-[42px] mt-0.5 font-semibold ${
                          isOccupied ? SEAT_NAME_COLORS[index % SEAT_NAME_COLORS.length] : 'text-slate-400'
                        }`}
                      >
                        {isOccupied ? seat.username : `#${seat.seatNo}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            CONTROLS: STANDARD ROOM STAGE MODE (When not fullscreen)
            ════════════════════════════════════════════════════════════ */}
        {!isFullscreen && (
          <>
            {/* Top Header Overlay on Video Screen */}
            <div className="absolute top-2.5 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
              {/* Movie Title & Live Badge */}
              <div className="flex items-center gap-2 max-w-[70%]">
                <span className="flex items-center gap-1 rounded-lg bg-rose-600/90 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-md animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  <span>CINEMA</span>
                </span>

                <h3 className="truncate font-display text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {cinemaState.title || roomName}
                </h3>
              </div>

              {/* Right Header Action Icons: MS Ping + Options Menu + Fullscreen */}
              <div className="flex items-center gap-1.5">
                {/* Real-time MS Ping Latency Indicator */}
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-white/15 backdrop-blur text-[10px] font-mono font-bold shadow-md select-none"
                  title={tr(`خێرایی هێڵی ئینتەرنێت (پینگ): ${pingMs}ms`, `Network Latency (Ping): ${pingMs}ms`)}
                >
                  <Wifi className={`h-2.5 w-2.5 ${pingMs < 80 ? 'text-emerald-400' : pingMs < 180 ? 'text-amber-400' : 'text-rose-400'}`} />
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: pingMs < 80 ? '#34d399' : pingMs < 180 ? '#fbbf24' : '#f43f5e' }}
                  />
                  <span className={pingMs < 80 ? 'text-emerald-400' : pingMs < 180 ? 'text-amber-300' : 'text-rose-400'}>
                    {pingMs}
                    <span className="text-[8px] font-sans text-white/60 ml-0.5">ms</span>
                  </span>
                </div>

                {/* Sleek Consolidated Options Menu */}
                {renderOptionsMenu(false)}

                <button
                  onClick={handleToggleFullscreen}
                  title={isFullscreen ? tr('دەرچوون لە گەورەکردن', 'Exit Fullscreen') : tr('تەواوی شاشە', 'Fullscreen')}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/60 border border-white/20 text-white hover:bg-white/20 transition shadow"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Bottom Playback & Timeline Control Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute bottom-0 inset-x-0 z-30 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-6 pb-1.5 px-2 transition-all duration-300 pointer-events-auto ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              {/* Ultra-slim Timeline Scrubber */}
              <div className="relative w-full flex items-center group/timeline h-2.5 mb-1 cursor-pointer">
                <div className="relative h-1 w-full rounded-full bg-white/20 overflow-hidden group-hover/timeline:h-2 transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 rounded-full transition-all duration-100"
                    style={{
                      width: `${effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0}%`,
                    }}
                  />
                </div>
                {/* Member & Host interactive seek slider */}
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration || 100}
                  step={1}
                  value={currentTime}
                  onMouseDown={() => setIsSeeking(true)}
                  onTouchStart={() => setIsSeeking(true)}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  onMouseUp={(e) => handleSeekTo(parseFloat((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleSeekTo(parseFloat((e.target as HTMLInputElement).value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={tr('بۆ پێشەوە و دواوە بردن (Seek)', 'Seek Forward / Rewind')}
                />
              </div>

              {/* Single Compact Controls Row (Strictly No Wrap) */}
              <div className="flex items-center justify-between gap-1 w-full text-white flex-nowrap">
                {/* Left: Play/Pause + Rewind 10s + Forward 10s */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleTogglePlayPause}
                    className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-400 text-black hover:bg-amber-300 active:scale-90 transition shadow shrink-0"
                    title={!isLocalPaused ? tr('وەستاندن', 'Pause') : tr('لێدان', 'Play')}
                  >
                    {!isLocalPaused ? (
                      <Pause className="h-3 w-3 fill-black" />
                    ) : (
                      <Play className="h-3 w-3 fill-black ml-0.5" />
                    )}
                  </button>

                  {/* Rewind 10s */}
                  <button
                    onClick={() => handleSeekRelative(-10)}
                    className="flex items-center justify-center h-6 px-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white hover:text-amber-300 active:scale-90 transition text-[10px] font-mono shrink-0 shadow-sm"
                    title={tr('١٠ چرکە بۆ دواوە', 'Rewind 10s')}
                  >
                    <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                    <span>-10</span>
                  </button>

                  {/* Forward 10s */}
                  <button
                    onClick={() => handleSeekRelative(10)}
                    className="flex items-center justify-center h-6 px-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white hover:text-amber-300 active:scale-90 transition text-[10px] font-mono shrink-0 shadow-sm"
                    title={tr('١٠ چرکە بۆ پێشەوە', 'Forward 10s')}
                  >
                    <span>+10</span>
                    <RotateCw className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                </div>

                {/* Center: Exact Time Display & Paused Name */}
                <div className="flex items-center gap-1.5 min-w-0 shrink">
                  <div className="flex items-center gap-0.5 font-mono text-[10px] sm:text-xs font-bold text-amber-300 whitespace-nowrap">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-white/40">/</span>
                    <span className="text-slate-300">
                      {effectiveDuration > 0 ? formatTime(effectiveDuration) : '--:--'}
                    </span>
                  </div>

                  {!cinemaState.isPlaying && (cinemaState.pausedByName || cinemaState.updatedByName) && (
                    <span className="hidden sm:inline-block text-[9px] text-amber-200 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                      {cinemaState.pausedByName || cinemaState.updatedByName}
                    </span>
                  )}
                </div>

                {/* Right: Sound volume toggle & Fullscreen toggle */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button
                    onClick={handleToggleMute}
                    className="p-1 text-slate-300 hover:text-white transition"
                    title={isMuted ? tr('دەنگ بکەرەوە', 'Unmute') : tr('بێدەنگکردن', 'Mute')}
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={handleToggleFullscreen}
                    className="p-1 text-slate-300 hover:text-white transition"
                    title={isFullscreen ? tr('دەرچوون', 'Exit') : tr('تەواوی شاشە', 'Fullscreen')}
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Mobile sub-indicator if paused */}
              {!cinemaState.isPlaying && (cinemaState.pausedByName || cinemaState.updatedByName) && (
                <div className="sm:hidden flex items-center justify-center gap-1 mt-0.5 text-[9px] font-bold text-amber-300/90">
                  <Pause className="h-2 w-2 fill-amber-300" />
                  <span>{tr('ڕاگیراوە لەلایەن:', 'Paused by:')}</span>
                  <span className="text-white font-extrabold underline">{cinemaState.pausedByName || cinemaState.updatedByName}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Video Error Overlay */}
        {videoError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
            <Film className="h-8 w-8 text-rose-500 mb-2" />
            <p className="text-xs font-bold text-white">
              {tr('نەتوانرا ڤیدیۆکە لێبدرێت', 'Cannot play this video')}
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-1">
              {tr('تکایە دڵنیابەرەوە لە کارکردنی بەستەری فیلمەکە (MP4) لە فایەربەیس، serv00، یان هەر سێرڤەرێکی تر.', 'Make sure the MP4 video URL is accessible from Firebase, serv00, or any host.')}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoError(false);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-1 text-xs font-bold transition"
              >
                {tr('دووبارە هەوڵبدەرەوە', 'Retry')}
              </button>
              {isHost && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConfigModal();
                  }}
                  className="rounded-xl bg-amber-400 text-black px-3 py-1 text-xs font-bold hover:bg-amber-300 transition"
                >
                  {tr('گۆڕینی بەستەر', 'Change URL')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. THE THEATER VELVET COUCH & AUDIENCE STRIP (Dynamic Custom Seats)
             (Only visible in standard room stage, hidden in full size)
          ───────────────────────────────────────────────────────────── */}
      {!isFullscreen && (
        <>
          <div className="relative mt-2.5 w-full">
            {/* Couch Top Header with Custom Seats Stepper and Quick Mic Controls */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 mb-1.5">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <span>🛋️</span>
                <span>{tr('قەنەفەی شاهانەیی سینەما', 'VIP Theater Couch')}</span>
                <span className="text-[10px] text-rose-300/80">({targetSeatCount} {tr('کورسی', 'Seats')})</span>
              </span>

              {/* Quick User Microphone & Speaker Control Strip */}
              <div className="flex items-center gap-1.5">
                {mySeat ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserGestureAudioUnlock();
                        onToggleMyMute();
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-black shadow-md transition active:scale-95 ${
                        !mySeat.isMuted
                          ? 'bg-emerald-500 text-black border border-emerald-300 shadow-emerald-500/30 animate-pulse'
                          : 'bg-rose-600/90 text-white border border-rose-400 hover:bg-rose-500'
                      }`}
                      title={!mySeat.isMuted ? tr('بێدەنگکردنی مایکی خۆم', 'Mute My Mic') : tr('کردنەوەی مایکی خۆم', 'Unmute My Mic')}
                    >
                      {!mySeat.isMuted ? (
                        <>
                          <Mic className="h-3.5 w-3.5 stroke-[3]" />
                          <span>{tr('مایک: کراوە', 'Mic: ON')}</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>{tr('مایک: داخراو', 'Mic: OFF')}</span>
                        </>
                      )}
                    </button>
                    {onLeaveMySeat && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLeaveMySeat(mySeat.seatNo);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-rose-300 hover:bg-rose-600 hover:text-white transition shadow"
                        title={tr('هەستان لە کورسی', 'Leave Seat')}
                      >
                        <LogOut className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Room Voice (Speaker) Mute Toggle */}
                {onToggleSpeakerMute && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUserGestureAudioUnlock();
                      onToggleSpeakerMute();
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border transition shadow ${
                      isSpeakerMuted
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                        : 'bg-black/60 border-white/10 text-slate-300 hover:text-white'
                    }`}
                    title={isSpeakerMuted ? tr('کردنەوەی دەنگی هاوڕێیان', 'Unmute Room Voices') : tr('بێدەنگکردنی دەنگی هاوڕێیان', 'Mute Room Voices')}
                  >
                    {isSpeakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                )}

                {isHost && (
                  <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-xl px-2 py-0.5 shadow">
                    <span className="text-[9px] text-slate-400 font-bold mr-1">{tr('ژمارەی کورسی:', 'Seats:')}</span>
                    <button
                      onClick={handleDecreaseCinemaSeats}
                      disabled={targetSeatCount <= 1}
                      title={tr('کەمکردنی کورسی', 'Remove Seat')}
                      className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-rose-600 transition font-black text-xs disabled:opacity-30 active:scale-95"
                    >
                      -
                    </button>
                    <span className="px-1.5 text-xs font-black text-amber-400">{targetSeatCount}</span>
                    <button
                      onClick={handleIncreaseCinemaSeats}
                      disabled={targetSeatCount >= 16}
                      title={tr('زیادکردنی کورسی', 'Add Seat')}
                      className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-emerald-600 transition font-black text-xs disabled:opacity-30 active:scale-95"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Luxury TopTop-Style VIP Theater Couch Frame */}
            <div className="relative overflow-hidden rounded-3xl border border-rose-500/35 bg-gradient-to-b from-[#3d0a16] via-[#26060e] to-[#120206] p-2.5 shadow-[0_14px_35px_rgba(0,0,0,0.85),inset_0_1px_18px_rgba(244,63,94,0.2)]">
              {/* Gold & Crimson Ambient Theater Stage Lighting */}
              <div className="pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
              <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-20 w-2/3 rounded-full bg-rose-500/15 blur-2xl" />

              {(() => {
                // Symmetrical TopTop-style grid & avatar sizing for 1 to 16 cinema seats
                const gridColsClass =
                  targetSeatCount === 1
                    ? 'grid-cols-1 max-w-[130px] mx-auto'
                    : targetSeatCount === 2
                    ? 'grid-cols-2 max-w-[230px] mx-auto gap-3'
                    : targetSeatCount === 3
                    ? 'grid-cols-3 max-w-[310px] mx-auto gap-2.5'
                    : targetSeatCount === 4
                    ? 'grid-cols-4 gap-2'
                    : targetSeatCount === 5
                    ? 'grid-cols-5 gap-1.5'
                    : targetSeatCount === 6
                    ? 'grid-cols-3 gap-2 max-w-[320px] mx-auto'
                    : targetSeatCount <= 8
                    ? 'grid-cols-4 gap-2'
                    : targetSeatCount <= 10
                    ? 'grid-cols-5 gap-1.5'
                    : 'grid-cols-4 gap-1.5';

                const seatCircleSizeClass =
                  targetSeatCount <= 4
                    ? 'h-12 w-12 sm:h-14 sm:w-14'
                    : targetSeatCount === 5
                    ? 'h-11 w-11 sm:h-12 sm:w-12'
                    : targetSeatCount <= 8
                    ? 'h-11 w-11 sm:h-12 sm:w-12'
                    : 'h-10 w-10 sm:h-11 sm:w-11';

                const nameMaxWidthClass =
                  targetSeatCount <= 4
                    ? 'max-w-[68px] text-[10px]'
                    : targetSeatCount === 5
                    ? 'max-w-[54px] text-[9.5px]'
                    : targetSeatCount <= 8
                    ? 'max-w-[60px] text-[9.5px]'
                    : 'max-w-[52px] text-[9px]';

                return (
                  <div className={`relative z-10 grid ${gridColsClass}`}>
                    {cinemaSeats.map((seat, index) => {
                      const isOccupied = Boolean(seat.userId);
                      const isCurrentUser = seat.userId === currentUser.uid;
                      const isSeatVip = Boolean(
                        isOccupied &&
                          (seat.isVerified ||
                            (seat.userId && vipUsersMap[seat.userId]) ||
                            (isCurrentUser && currentUser.isVerified)),
                      );
                      const isSpeaking =
                        isOccupied &&
                        !seat.isMuted &&
                        seat.userId !== null &&
                        speakingUids.has(seat.userId);

                      let avatarBorderClass =
                        'border border-dashed border-rose-400/35 bg-black/50 hover:border-amber-400/70 hover:bg-black/70 shadow-inner';
                      if (seat.isPlatinum) {
                        avatarBorderClass =
                          'border-2 border-cyan-300 bg-gradient-to-b from-cyan-500/25 via-blue-950/50 to-black/90 shadow-[0_0_16px_rgba(6,182,212,0.6)] ring-1 ring-cyan-400/50';
                      } else if (seat.isIron) {
                        avatarBorderClass =
                          'border-2 border-slate-300 bg-gradient-to-b from-slate-400/25 via-zinc-800/50 to-black/90 shadow-[0_0_14px_rgba(203,213,225,0.6)] ring-1 ring-slate-400/50';
                      } else if (seat.isVip) {
                        avatarBorderClass =
                          'border-2 border-amber-400/85 bg-gradient-to-b from-amber-500/20 via-amber-950/40 to-black/80 shadow-[0_0_14px_rgba(245,158,11,0.45)]';
                      }
                      if (isOccupied) {
                        if (seat.isPlatinum) {
                          avatarBorderClass =
                            'border-2 border-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.85)] ring-2 ring-cyan-400/50';
                        } else if (seat.isIron) {
                          avatarBorderClass =
                            'border-2 border-slate-300 shadow-[0_0_16px_rgba(203,213,225,0.8)] ring-2 ring-slate-400/50';
                        } else if (isSeatVip) {
                          avatarBorderClass = getVipAvatarClass(
                            true,
                            seat.userId ? vipFramesMap[seat.userId] : undefined,
                          );
                        } else if (isSpeaking) {
                          avatarBorderClass =
                            'border-2 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.75)]';
                        } else {
                          avatarBorderClass =
                            'border-2 border-amber-400/75 shadow-md shadow-amber-500/25';
                        }
                      }

                      const seatAvatarUrl =
                        seat.avatar ||
                        (seat.userId ? usersAvatarMap[seat.userId] : null) ||
                        (isCurrentUser ? currentUser.avatar || currentUser.profileImage : null) ||
                        audience.find((a) => a.uid === seat.userId)?.avatar ||
                        null;

                      const userLvl =
                        (isCurrentUser ? currentUser.level : undefined) ||
                        seat.level ||
                        (seat.userId ? usersLevelMap[seat.userId] : undefined) ||
                        audience.find((a) => a.uid === seat.userId)?.level ||
                        1;

                      return (
                        <div
                          key={`cinema-seat-${seat.seatNo}`}
                          onClick={() => handleSeatItemClick(seat)}
                          title={
                            isCurrentUser
                              ? !seat.isMuted
                                ? tr('بێدەنگکردنی مایکم', 'Mute My Mic')
                                : tr('کردنەوەی مایکم', 'Unmute My Mic')
                              : seat.username || `${tr('کورسی', 'Seat')} ${seat.seatNo}`
                          }
                          className="group relative flex cursor-pointer flex-col items-center min-w-0"
                        >
                          {/* Velvet Theater Armchair Cushion Card */}
                          <div className="relative flex flex-col items-center justify-center w-full py-2 px-1 rounded-2xl bg-gradient-to-b from-[#540d1d]/90 via-[#330711]/95 to-[#1c0309] border border-rose-400/20 shadow-[inset_0_1px_8px_rgba(251,113,133,0.15)] group-hover:border-amber-400/50 transition-all">
                            {/* Velvet Armrest Side Accents */}
                            <div className="pointer-events-none absolute inset-y-2 left-0.5 w-1 rounded-full bg-rose-950/80 border-r border-rose-400/15" />
                            <div className="pointer-events-none absolute inset-y-2 right-0.5 w-1 rounded-full bg-rose-950/80 border-l border-rose-400/15" />

                            {/* Avatar Circle Container */}
                            <div className="relative flex items-center justify-center">
                              {/* Speaking Animated Wave Ring */}
                              {isSpeaking && (
                                <motion.div
                                  animate={{ scale: [1, 1.28, 1], opacity: [0.9, 0, 0.9] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                  className="absolute inset-0 rounded-full border-2 border-emerald-400 pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.85)] z-20"
                                />
                              )}

                              <div
                                className={`relative flex ${seatCircleSizeClass} items-center justify-center rounded-full transition-all duration-300 ${avatarBorderClass}`}
                              >
                                {isOccupied ? (
                                  <>
                                    {/* User Avatar */}
                                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-rose-700 via-purple-600 to-amber-500 text-xs font-black text-white uppercase shadow-inner">
                                      {seatAvatarUrl ? (
                                        <img
                                          src={seatAvatarUrl}
                                          alt={seat.username || 'User'}
                                          className="h-full w-full rounded-full object-cover"
                                        />
                                      ) : (
                                        (seat.username || 'U').charAt(0).toUpperCase()
                                      )}
                                    </div>

                                    {/* Level Ornate Frame Overlay on Cinema Seat */}
                                    <AvatarFrameOverlay
                                      frameId={
                                        (isCurrentUser ? currentUser.avatarFrame : undefined) ||
                                        seat.avatarFrame ||
                                        (seat.userId ? usersLevelFrameMap[seat.userId] : undefined)
                                      }
                                      level={userLvl}
                                    />

                                    {/* VIP / Platinum / Iron Top-Left Badge */}
                                    {seat.isPlatinum ? (
                                      <span className="absolute -top-1 -left-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                                        <Diamond className="h-2.5 w-2.5 text-black fill-black" />
                                      </span>
                                    ) : seat.isIron ? (
                                      <span className="absolute -top-1 -left-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.8)]">
                                        <Shield className="h-2.5 w-2.5 text-black fill-black" />
                                      </span>
                                    ) : isSeatVip ? (
                                      <span className="absolute -top-1 -left-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                                        <Crown className="h-2.5 w-2.5 text-black fill-black" />
                                      </span>
                                    ) : null}

                                    {/* Mic Muted / Open Status Indicator */}
                                    <div
                                      className={`absolute -bottom-0.5 -right-0.5 z-30 flex h-4 w-4 items-center justify-center rounded-full border border-black shadow ${
                                        seat.isMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                                      }`}
                                    >
                                      {seat.isMuted ? (
                                        <MicOff className="h-2.5 w-2.5 stroke-[2.5]" />
                                      ) : (
                                        <Mic className="h-2.5 w-2.5 stroke-[2.5]" />
                                      )}
                                    </div>
                                  </>
                                ) : seat.isPlatinum ? (
                                  <div className="flex flex-col items-center justify-center text-cyan-300 group-hover:scale-105 transition">
                                    <Diamond className="h-4 w-4 fill-cyan-400 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                    <span className="text-[6.5px] font-black text-cyan-300 mt-0.5">
                                      PLATINUM
                                    </span>
                                  </div>
                                ) : seat.isIron ? (
                                  <div className="flex flex-col items-center justify-center text-slate-200 group-hover:scale-105 transition">
                                    <Shield className="h-4 w-4 fill-slate-300 text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.8)]" />
                                    <span className="text-[6.5px] font-black text-slate-200 mt-0.5">
                                      IRON
                                    </span>
                                  </div>
                                ) : seat.isVip ? (
                                  <div className="flex flex-col items-center justify-center text-amber-300 group-hover:scale-105 transition">
                                    <Crown className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_#f59e0b]" />
                                    <span className="text-[6.5px] font-black text-amber-300 mt-0.5">
                                      VIP
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-rose-300/70 group-hover:text-amber-300 transition">
                                    <Plus className="h-3.5 w-3.5 group-hover:scale-110 transition" />
                                    <span className="text-[8px] font-black text-rose-300/80">
                                      {seat.seatNo}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Seat Footer: Compact Number Badge + Username */}
                            <div className="mt-1.5 flex items-center justify-center gap-1 max-w-full px-0.5">
                              {isOccupied && (
                                <span className="shrink-0 rounded bg-amber-400/20 border border-amber-400/40 px-1 py-0 text-[7.5px] font-black text-amber-300 leading-tight">
                                  {seat.seatNo}
                                </span>
                              )}
                              <span
                                className={`truncate text-center leading-tight ${nameMaxWidthClass} ${
                                  isOccupied
                                    ? `font-bold ${SEAT_NAME_COLORS[index % SEAT_NAME_COLORS.length]}`
                                    : seat.isPlatinum
                                    ? 'text-cyan-300 font-black'
                                    : seat.isIron
                                    ? 'text-slate-200 font-black'
                                    : seat.isVip
                                    ? 'text-amber-300 font-black'
                                    : 'text-rose-200/70 font-semibold'
                                }`}
                              >
                                {isOccupied
                                  ? seat.username
                                  : seat.vipAssignedName
                                  ? seat.vipAssignedName
                                  : seat.isPlatinum
                                  ? `Plat #${seat.seatNo}`
                                  : seat.isIron
                                  ? `Iron #${seat.seatNo}`
                                  : seat.isVip
                                  ? `VIP #${seat.seatNo}`
                                  : `${tr('کورسی', 'Seat')} ${seat.seatNo}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. AUDIENCE VIEWERS STRIP (Below the couch, as in screenshot)
              ───────────────────────────────────────────────────────────── */}
          <div className="mt-2 flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-black text-slate-300">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span>{audience.length}</span>
              </div>

              <div className="flex items-center -space-x-1 rtl:-space-x-reverse">
                {audience.slice(0, 5).map((member) => (
                  <div
                    key={member.uid}
                    onClick={() => onOpenProfile?.(member.uid)}
                    className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black bg-slate-800 text-[9px] font-bold text-white hover:scale-110 transition"
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.username} className="h-full w-full object-cover" />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaylistDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition active:scale-95"
              >
                <Film className="h-3 w-3" />
                <span>{tr('فۆڵدەری فیلمەکان', 'Movie Folders')}</span>
                {cinemaFolders.length > 0 && (
                  <span className="rounded-full bg-amber-400/25 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
                    {cinemaFolders.length}
                  </span>
                )}
              </button>

              <span className="text-[10px] text-slate-500 font-semibold">
                {tr('سەیرکردنی هاوبەش', 'Watch Party')}
              </span>
            </div>
          </div>
        </>
      )}

      {/* In-Player Movie Folders & Episodes Overlay (Works seamlessly in Fullscreen & Stage) */}
      <AnimatePresence>
        {isPlaylistDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPlaylistDrawerOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col w-full max-w-xl max-h-[85vh] sm:max-h-[88vh] rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#180e1a] via-[#100a16] to-[#08050c] shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(245,158,11,0.2)] text-white overflow-hidden"
            >
              {/* Glow Bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-purple-600 z-10" />

              {/* Sticky Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-[#180e1a]/95 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-black shadow font-bold">
                    <Film className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-display text-sm font-black text-white truncate">
                        {tr('فۆڵدەری فیلم و زنجیرەکان', 'Cinema Folders & Episodes')}
                      </h3>
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.2 text-[9px] font-black text-amber-300">
                        {cinemaFolders.length} {tr('فۆڵدەر', 'Folders')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate max-w-[230px] sm:max-w-xs mt-0.5">
                      {tr(
                        'فۆڵدەری هەر فیلمێک بکەرەوە بۆ بینینی هەموو ئەڵقەکان و سەیرکردنی',
                        'Open any movie folder to watch all its episodes',
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPlaylistDrawerOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white border border-white/15 transition shadow-md active:scale-90"
                  title={tr('داخستن', 'Close')}
                >
                  <X className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>

              {playlistToast && (
                <div className="mx-4 sm:mx-5 mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                  <span>{playlistToast}</span>
                </div>
              )}

              {/* Scrollable Folder Grid OR Folder Episodes List */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3 overscroll-contain min-h-0">
                {(() => {
                  const activeDrawerFolder =
                    cinemaFolders.find((f) => f.id === selectedDrawerFolderId) || null;

                  if (activeDrawerFolder) {
                    return (
                      <div className="space-y-3">
                        {/* Back to Folders & Movie Header */}
                        <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-amber-500/25 bg-black/50 p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedDrawerFolderId(null)}
                              className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs font-black text-white transition active:scale-95 shrink-0"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span>{tr('گەڕانەوە', 'Back')}</span>
                            </button>

                            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-xl border border-amber-400/30 bg-slate-900">
                              {activeDrawerFolder.posterUrl ? (
                                <img
                                  src={activeDrawerFolder.posterUrl}
                                  alt={activeDrawerFolder.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-purple-950 text-amber-300">
                                  <Film className="h-4 w-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                                {activeDrawerFolder.title}
                              </h4>
                              <p className="text-[10px] text-amber-300 font-semibold mt-0.5">
                                {activeDrawerFolder.episodes.length} {tr('ئەڵقە بەردەستە', 'episodes')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {activeDrawerFolder.episodes.length === 0 ? (
                          <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                            <Film className="h-8 w-8 text-slate-600 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-300">
                              {tr('هیچ ئەڵقەیەک لەم فۆڵدەرەدا نییە', 'No episodes in this folder yet')}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeDrawerFolder.episodes.map((ep) => {
                              const isPlayingThis = Boolean(
                                cinemaState?.isActive &&
                                  cinemaState.videoUrl &&
                                  cinemaState.videoUrl.trim() === ep.videoUrl.trim(),
                              );

                              return (
                                <div
                                  key={ep.id}
                                  onClick={() => handlePlayEpisodeFromDrawer(activeDrawerFolder, ep)}
                                  className={`flex items-center justify-between gap-2.5 rounded-2xl border p-2.5 cursor-pointer transition ${
                                    isPlayingThis
                                      ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/60 to-slate-900/70'
                                      : 'border-white/10 bg-white/[0.04] hover:border-amber-400/50 hover:bg-white/[0.08]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-slate-900">
                                      {ep.posterUrl || activeDrawerFolder.posterUrl ? (
                                        <img
                                          src={ep.posterUrl || activeDrawerFolder.posterUrl}
                                          alt={ep.title}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-amber-500/20 text-amber-300">
                                          <Film className="h-3.5 w-3.5" />
                                        </div>
                                      )}
                                      <span className="absolute bottom-0 inset-x-0 bg-black/80 text-center font-mono text-[8px] font-black text-amber-300">
                                        #{ep.episodeNumber}
                                      </span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-xs font-black text-white truncate">
                                        {ep.title}
                                      </h5>
                                      <p className="text-[9px] text-slate-400 truncate mt-0.5">
                                        {isPlayingThis
                                          ? tr('ئێستا پەخش دەکرێت', 'Playing Now')
                                          : `${tr('ئەڵقەی', 'Ep')} ${ep.episodeNumber}`}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePlayEpisodeFromDrawer(activeDrawerFolder, ep);
                                    }}
                                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-black transition shrink-0 ${
                                      isPlayingThis
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow hover:brightness-110'
                                    }`}
                                  >
                                    <Play className="h-3 w-3 fill-current" />
                                    <span>{isPlayingThis ? tr('چالاکە', 'Active') : tr('پەخشکردن', 'Play')}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const visibleFolders = cinemaFolders.filter((f) => {
                    const q = drawerSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      f.title.toLowerCase().includes(q) ||
                      (f.category || '').toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={drawerSearch}
                          onChange={(e) => setDrawerSearch(e.target.value)}
                          placeholder={tr('گەڕان بۆ ناوی فیلم یان زنجیرە...', 'Search movie folders...')}
                          className="w-full rounded-xl border border-white/10 bg-black/50 pr-8 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400/60"
                        />
                      </div>

                      {visibleFolders.length === 0 ? (
                        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                          <FolderOpen className="h-8 w-8 text-slate-600 mx-auto mb-1.5" />
                          <p className="text-xs font-bold text-slate-300">
                            {tr('هیچ فۆڵدەرێکی فیلم نەدۆزرایەوە', 'No movie folders found')}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {visibleFolders.map((folder) => (
                            <div
                              key={folder.id}
                              onClick={() => setSelectedDrawerFolderId(folder.id)}
                              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:border-amber-400/50 transition-all cursor-pointer"
                            >
                              <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                                {folder.posterUrl ? (
                                  <img
                                    src={folder.posterUrl}
                                    alt={folder.title}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-rose-950 p-2 text-center">
                                    <Film className="h-8 w-8 text-amber-400/60 mb-1" />
                                    <span className="text-[10px] font-black text-white/80 line-clamp-2">
                                      {folder.title}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

                                {folder.category && (
                                  <span className="absolute top-1.5 right-1.5 rounded-md bg-black/75 border border-white/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                                    {folder.category}
                                  </span>
                                )}

                                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-md bg-purple-600/90 px-1.5 py-0.5 text-[8px] font-black text-white">
                                  <Layers className="h-2.5 w-2.5" />
                                  <span>{folder.episodes.length} {tr('ئەڵقە', 'Ep')}</span>
                                </span>

                                <div className="absolute bottom-0 inset-x-0 p-2">
                                  <h4 className="text-xs font-black text-white truncate">
                                    {folder.title}
                                  </h4>
                                  <p className="text-[9px] text-amber-300 font-semibold mt-0.5">
                                    {tr('کردنەوەی هەموو ئەڵقەکان', 'Open all episodes')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
