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
  setCinemaVideoUrl,
  updateCinemaPlayback,
  updateCinemaDuration,
  updateCinemaSeatCount,
  subscribeToCinemaFolders,
  playCinemaEpisodeInRoom,
  sendRoomMessage,
} from '../services';
import { useLanguage } from '../contexts';
import { renderTextWithLinks } from '../utils/linkify';
import EpisodeVideoThumbnail from './EpisodeVideoThumbnail';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  resolveYouTubeDirectStreamUrl,
} from '../utils/youtube';

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
  const isRemoteActionRef = useRef<boolean>(false);
  const remoteActionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownYtTimeRef = useRef<number>(cinemaState.currentTime || 0);
  const cinemaStateRef = useRef<RoomCinemaState>(cinemaState);
  cinemaStateRef.current = cinemaState;

  const markRemoteAction = useCallback(() => {
    isRemoteActionRef.current = true;
    if (remoteActionTimerRef.current) clearTimeout(remoteActionTimerRef.current);
    remoteActionTimerRef.current = setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 1200);
  }, []);

  // Global Admin Cinema Folders & Episodes + YouTube Link State
  const [isPlaylistDrawerOpen, setIsPlaylistDrawerOpen] = useState(false);
  const [cinemaFolders, setCinemaFolders] = useState<CinemaFolder[]>([]);
  const [selectedDrawerFolderId, setSelectedDrawerFolderId] = useState<string | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerYtUrl, setDrawerYtUrl] = useState('');
  const [drawerYtTitle, setDrawerYtTitle] = useState('');
  const [playlistToast, setPlaylistToast] = useState<string | null>(null);

  // YouTube IFrame Player API reference & Direct Stream Fallback (for restricted YouTube videos)
  const ytPlayerRef = useRef<any>(null);
  const ytContainerId = `yt-cinema-player-${roomId}`;
  const rawYoutubeVideoId = extractYouTubeVideoId(cinemaState.videoUrl);
  const [ytFallbackStreamUrl, setYtFallbackStreamUrl] = useState<string | null>(null);
  const [isResolvingYtFallback, setIsResolvingYtFallback] = useState<boolean>(false);
  const youtubeVideoId = ytFallbackStreamUrl ? null : rawYoutubeVideoId;
  const activeMediaUrl = ytFallbackStreamUrl || cinemaState.videoUrl;

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

  const handlePlayYouTubeFromDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = extractYouTubeVideoId(drawerYtUrl);
    if (!ytId) {
      setPlaylistToast(
        tr('تکایە لینکێکی دروستی ڤیدیۆی یوتیوب دابنێ', 'Please enter a valid YouTube link'),
      );
      setTimeout(() => setPlaylistToast(null), 3000);
      return;
    }

    try {
      const canonicalYtUrl = `https://www.youtube.com/watch?v=${ytId}`;
      const finalTitle =
        drawerYtTitle.trim() ||
        tr('ڤیدیۆی یوتیوب · سەیرکردنی ڕاستەوخۆ', 'YouTube Live Watch Party');

      await setCinemaVideoUrl(
        roomId,
        canonicalYtUrl,
        finalTitle,
        { uid: currentUser.uid, username: currentUser.username },
        cinemaState?.seatCount || 5,
      );

      try {
        await sendRoomMessage(
          roomId,
          'system',
          'YouTube',
          `▶️ ${currentUser.username} ڤیدیۆیەکی یوتیوبی خستە سەر شاشە: ${finalTitle}`,
        );
      } catch {}

      setDrawerYtUrl('');
      setDrawerYtTitle('');
      setIsPlaylistDrawerOpen(false);
    } catch (err) {
      console.warn('Failed to play YouTube video from drawer:', err);
    }
  };

  // Broadcast toast notification whenever someone pauses playback
  useEffect(() => {
    if (!cinemaState.isPlaying) {
      const pauser = cinemaState.pausedByName || cinemaState.updatedByName;
      if (pauser && prevIsPlayingRef.current) {
        setPauseToastUser(pauser);
        const timer = setTimeout(() => {
          setPauseToastUser(null);
        }, 4500);
        prevIsPlayingRef.current = cinemaState.isPlaying;
        return () => clearTimeout(timer);
      }
      if (pauser && pauseToastUser && pauseToastUser !== pauser) {
        setPauseToastUser(pauser);
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
    setYtFallbackStreamUrl(null);
    setIsResolvingYtFallback(false);
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

  // Synchronize video playback with Firebase Realtime Database (Both HTML5 Video & YouTube IFrame API)
  useEffect(() => {
    const isNewExplicitAction =
      cinemaState.seekSeq !== undefined &&
      lastHandledSeekSeqRef.current !== cinemaState.seekSeq;

    if (youtubeVideoId) {
      const ytPlayer = ytPlayerRef.current;
      if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;

      try {
        if (isNewExplicitAction) {
          lastHandledSeekSeqRef.current = cinemaState.seekSeq || 0;
          if (cinemaState.syncType === 'movie_change') {
            markRemoteAction();
            lastKnownYtTimeRef.current = 0;
            ytPlayer.seekTo?.(0, true);
            setCurrentTime(0);
          } else if (cinemaState.syncType === 'seek' || cinemaState.syncType === 'play_pause') {
            const targetSec =
              cinemaState.syncType === 'seek'
                ? getExpectedLiveTime()
                : cinemaState.currentTime || 0;
            const curYt = Number(ytPlayer.getCurrentTime?.()) || 0;
            if (cinemaState.syncType === 'seek' || Math.abs(curYt - targetSec) > 1.8) {
              markRemoteAction();
              lastKnownYtTimeRef.current = targetSec;
              ytPlayer.seekTo?.(targetSec, true);
              setCurrentTime(targetSec);
            }
          }
        }

        const playerState = ytPlayer.getPlayerState(); // 1 = playing, 2 = paused, 3 = buffering
        if (cinemaState.isPlaying && playerState !== 1 && playerState !== 3) {
          markRemoteAction();
          ytPlayer.playVideo?.();
          setIsLocalPaused(false);
        } else if (!cinemaState.isPlaying && (playerState === 1 || playerState === 3)) {
          markRemoteAction();
          ytPlayer.pauseVideo?.();
          setIsLocalPaused(true);
        }
      } catch {}
      return;
    }

    const video = videoRef.current;
    if (!video || !cinemaState.videoUrl) return;

    // 1. EXPLICIT ACTIONS BY ANY ROOM MEMBER (Seek, Play/Pause, or Movie Change)
    if (isNewExplicitAction) {
      lastHandledSeekSeqRef.current = cinemaState.seekSeq || 0;

      if (cinemaState.syncType === 'movie_change') {
        hasSyncedInitialRef.current = false;
        try {
          sessionStorage.removeItem(`ssmr_cinema_pos_${roomId}`);
        } catch {}
        video.currentTime = 0;
        setCurrentTime(0);
      } else if (cinemaState.syncType === 'seek') {
        const targetSec = getExpectedLiveTime();
        if (Number.isFinite(targetSec) && targetSec >= 0) {
          video.currentTime = targetSec;
          setCurrentTime(targetSec);
          try {
            sessionStorage.setItem(`ssmr_cinema_pos_${roomId}`, String(targetSec));
          } catch {}
        }
      } else if (cinemaState.syncType === 'play_pause') {
        const targetSec = cinemaState.currentTime || 0;
        if (Number.isFinite(targetSec) && targetSec >= 0 && Math.abs(video.currentTime - targetSec) > 1.8) {
          video.currentTime = targetSec;
          setCurrentTime(targetSec);
        }
      }
    }

    // 2. Play / Pause Synchronization Across All Room Members
    if (cinemaState.isPlaying && video.paused) {
      handleUserGestureAudioUnlock();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsLocalPaused(false);
          })
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsLocalPaused(false);
                setAudioBlockedNotice(true);
              })
              .catch(() => {
                setAudioBlockedNotice(true);
              });
          });
      }
    } else if (!cinemaState.isPlaying && !video.paused) {
      video.pause();
      setIsLocalPaused(true);
    }

    // 3. NO AUTOMATIC HEARTBEAT SEEKING FOR SLOW CONNECTIONS:
    // If syncType === 'heartbeat', we NEVER force-seek a member's video!
    // Slow internet users buffer/recover smoothly from their own position without jittering,
    // while fast internet users continue playing smoothly without waiting for slow users.
  }, [
    cinemaState.isPlaying,
    cinemaState.syncType,
    cinemaState.seekSeq,
    cinemaState.currentTime,
    cinemaState.videoUrl,
    youtubeVideoId,
    roomId,
    getExpectedLiveTime,
    markRemoteAction,
  ]);

  // Periodic Ground-Truth Sync from Host (Every 25 seconds)
  useEffect(() => {
    if (!isHost || !cinemaState.isPlaying || !cinemaState.videoUrl) return;

    const interval = setInterval(() => {
      if (youtubeVideoId && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const st = ytPlayerRef.current.getPlayerState?.();
          const cur = Number(ytPlayerRef.current.getCurrentTime()) || 0;
          if (st === 1 && cur > 0) {
            updateCinemaPlayback(
              roomId,
              true,
              cur,
              { uid: currentUser.uid, username: currentUser.username },
              effectiveDuration,
              null,
              'heartbeat',
            ).catch(() => {});
          }
        } catch {}
        return;
      }

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
  }, [isHost, cinemaState.isPlaying, cinemaState.videoUrl, youtubeVideoId, roomId, currentUser, effectiveDuration]);

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

  // Initialize & Sync YouTube IFrame API Player when youtubeVideoId is active
  useEffect(() => {
    if (!youtubeVideoId) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy?.();
        } catch {}
        ytPlayerRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    let timeTrackerInterval: any = null;
    let apiPollInterval: any = null;

    const triggerDirectStreamFallback = async () => {
      if (isCancelled || !youtubeVideoId) return;
      setIsResolvingYtFallback(true);
      try {
        const directUrl = await resolveYouTubeDirectStreamUrl(youtubeVideoId);
        if (!isCancelled && directUrl) {
          if (ytPlayerRef.current) {
            try {
              ytPlayerRef.current.destroy?.();
            } catch {}
            ytPlayerRef.current = null;
          }
          setVideoError(false);
          setYtFallbackStreamUrl(directUrl);
        }
      } catch {}
      if (!isCancelled) {
        setIsResolvingYtFallback(false);
      }
    };

    const createYtPlayer = () => {
      if (isCancelled) return;
      const YT = (window as any).YT;
      if (!YT || !YT.Player) return;
      if (apiPollInterval) {
        clearInterval(apiPollInterval);
        apiPollInterval = null;
      }

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        try {
          const iframe = ytPlayerRef.current.getIframe?.();
          if (iframe && document.body.contains(iframe)) {
            ytPlayerRef.current.loadVideoById({
              videoId: youtubeVideoId,
              startSeconds: Math.max(0, Math.floor(getExpectedLiveTime())),
            });
            return;
          }
        } catch {}
        try {
          ytPlayerRef.current.destroy?.();
        } catch {}
        ytPlayerRef.current = null;
      }

      const targetEl = document.getElementById(ytContainerId);
      if (!targetEl) return;

      ytPlayerRef.current = new YT.Player(ytContainerId, {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          start: Math.max(0, Math.floor(getExpectedLiveTime())),
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            setVideoError(false);
            const player = event.target;
            const dur = Number(player?.getDuration?.()) || 0;
            if (dur > 0) {
              setDuration(dur);
              if (isHost) {
                updateCinemaDuration(roomId, dur).catch(() => {});
              }
            }
            const startPos = getExpectedLiveTime();
            if (startPos > 1) {
              try {
                markRemoteAction();
                lastKnownYtTimeRef.current = startPos;
                player.seekTo(startPos, true);
                setCurrentTime(startPos);
              } catch {}
            }
            if (cinemaStateRef.current.isPlaying) {
              try {
                markRemoteAction();
                player.playVideo();
                // Mobile browsers sometimes block unmuted IFrame autoplay:
                // verify after 600ms and auto-mute+play if still unstarted
                setTimeout(() => {
                  if (isCancelled || !cinemaStateRef.current.isPlaying) return;
                  try {
                    const st = player.getPlayerState?.();
                    if (st !== 1 && st !== 3) {
                      player.mute?.();
                      setIsMuted(true);
                      setAudioBlockedNotice(true);
                      player.playVideo?.();
                    }
                  } catch {}
                }, 600);
              } catch {}
            } else {
              try {
                markRemoteAction();
                player.pauseVideo();
              } catch {}
            }
          },
          onError: (event: any) => {
            if (isCancelled) return;
            // Error codes: 100 (not found), 101 / 150 (embed blocked by owner), 2 / 5 (player error)
            console.warn('YouTube IFrame Error:', event?.data, '-> Resolving direct stream fallback...');
            triggerDirectStreamFallback();
          },
          onStateChange: (event: any) => {
            if (isCancelled) return;
            const player = event.target;
            const state = event.data; // 1 = playing, 2 = paused, 3 = buffering
            const dur = Number(player?.getDuration?.()) || 0;
            if (dur > 0 && !duration) {
              setDuration(dur);
              if (isHost) {
                updateCinemaDuration(roomId, dur).catch(() => {});
              }
            }

            if (state === 1) {
              setIsLocalPaused(false);
              // Enforce room pause state if local YouTube player tried to auto-play while room is paused
              if (!cinemaStateRef.current.isPlaying && !isRemoteActionRef.current) {
                try {
                  player.pauseVideo?.();
                  setIsLocalPaused(true);
                } catch {}
              }
            } else if (state === 2) {
              setIsLocalPaused(true);
            }
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      createYtPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        createYtPlayer();
      };
      // Fast 100ms poll in case script finished loading right as component mounted
      apiPollInterval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          createYtPlayer();
        }
      }, 100);
    }

    timeTrackerInterval = setInterval(() => {
      const p = ytPlayerRef.current;
      if (p && typeof p.getCurrentTime === 'function' && !isSeeking) {
        try {
          const cur = Number(p.getCurrentTime()) || 0;
          if (cur >= 0) {
            lastKnownYtTimeRef.current = cur;
            setCurrentTime(cur);
          }
          const dur = Number(p.getDuration?.()) || 0;
          if (dur > 0 && dur !== duration) setDuration(dur);
        } catch {}
      }
    }, 1000);

    return () => {
      isCancelled = true;
      if (apiPollInterval) clearInterval(apiPollInterval);
      if (timeTrackerInterval) clearInterval(timeTrackerInterval);
    };
  }, [youtubeVideoId, ytContainerId]);

  // Handle master play / pause toggle (Synchronized across ALL room members)
  const handleTogglePlayPause = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleUserGestureAudioUnlock();

    const nextPlaying = !cinemaStateRef.current.isPlaying;

    if (youtubeVideoId) {
      const p = ytPlayerRef.current;
      const curSec = Number(p?.getCurrentTime?.()) || currentTime || cinemaStateRef.current.currentTime || 0;

      markRemoteAction();
      lastKnownYtTimeRef.current = curSec;
      try {
        if (nextPlaying) {
          p?.playVideo?.();
          setIsLocalPaused(false);
        } else {
          p?.pauseVideo?.();
          setIsLocalPaused(true);
        }
      } catch {}

      try {
        await updateCinemaPlayback(
          roomId,
          nextPlaying,
          curSec,
          { uid: currentUser.uid, username: currentUser.username },
          effectiveDuration,
          !nextPlaying ? currentUser.username : null,
          'play_pause',
        );
      } catch {}
      return;
    }

    const video = videoRef.current;
    const safeBaseTime =
      video && video.currentTime > 0
        ? video.currentTime
        : cinemaStateRef.current.currentTime || currentTime || 0;

    if (video) {
      try {
        if (nextPlaying) {
          video.play().catch(() => {});
          setIsLocalPaused(false);
        } else {
          video.pause();
          setIsLocalPaused(true);
        }
      } catch {}
    }

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

  // Fast forward / Rewind relative seek (e.g. +10s / -10s) - Synchronized for ALL members
  const handleSeekRelative = async (deltaSeconds: number) => {
    handleUserGestureAudioUnlock();

    if (youtubeVideoId && ytPlayerRef.current) {
      const p = ytPlayerRef.current;
      const baseTime = Number(p.getCurrentTime?.()) || currentTime || 0;
      const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
      const targetTime = Math.max(0, Math.min(maxDur, baseTime + deltaSeconds));
      markRemoteAction();
      lastKnownYtTimeRef.current = targetTime;
      try {
        p.seekTo?.(targetTime, true);
      } catch {}
      setCurrentTime(targetTime);

      try {
        await updateCinemaPlayback(
          roomId,
          cinemaState.isPlaying,
          targetTime,
          { uid: currentUser.uid, username: currentUser.username },
          effectiveDuration,
          !cinemaState.isPlaying ? (cinemaState.pausedByName || currentUser.username) : null,
          'seek',
        );
      } catch {}
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const baseTime = video.currentTime || currentTime;
    const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
    const targetTime = Math.max(0, Math.min(maxDur, baseTime + deltaSeconds));

    video.currentTime = targetTime;
    setCurrentTime(targetTime);

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
  };

  // Jump to specific point from timeline slider - Synchronized for ALL members
  const handleSeekTo = async (newTime: number) => {
    handleUserGestureAudioUnlock();
    setIsSeeking(false);

    if (youtubeVideoId && ytPlayerRef.current) {
      const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
      const targetTime = Math.max(0, Math.min(maxDur, newTime));
      markRemoteAction();
      lastKnownYtTimeRef.current = targetTime;
      try {
        ytPlayerRef.current.seekTo?.(targetTime, true);
      } catch {}
      setCurrentTime(targetTime);

      try {
        await updateCinemaPlayback(
          roomId,
          cinemaState.isPlaying,
          targetTime,
          { uid: currentUser.uid, username: currentUser.username },
          effectiveDuration,
          !cinemaState.isPlaying ? (cinemaState.pausedByName || currentUser.username) : null,
          'seek',
        );
      } catch {}
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const maxDur = effectiveDuration > 0 ? effectiveDuration : 36000;
    const targetTime = Math.max(0, Math.min(maxDur, newTime));

    video.currentTime = targetTime;
    setCurrentTime(targetTime);

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
  };

  // Handle personal volume change (does not affect other users)
  const handleVolumeChange = (newVol: number) => {
    handleUserGestureAudioUnlock();
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (youtubeVideoId && ytPlayerRef.current) {
      try {
        if (newVol === 0) ytPlayerRef.current.mute?.();
        else {
          ytPlayerRef.current.unMute?.();
          ytPlayerRef.current.setVolume?.(Math.round(newVol * 100));
        }
      } catch {}
    }
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
      if (youtubeVideoId && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.unMute?.();
          ytPlayerRef.current.setVolume?.(Math.round((volume || 0.8) * 100));
        } catch {}
      }
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = volume || 0.8;
      }
    } else {
      setIsMuted(true);
      if (youtubeVideoId && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.mute?.();
        } catch {}
      }
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
                    if (youtubeVideoId && ytPlayerRef.current && Number.isFinite(expectedTime) && expectedTime >= 0) {
                      markRemoteAction();
                      lastKnownYtTimeRef.current = expectedTime;
                      try {
                        ytPlayerRef.current.seekTo?.(expectedTime, true);
                      } catch {}
                      setCurrentTime(expectedTime);
                    } else if (videoRef.current && Number.isFinite(expectedTime) && expectedTime >= 0) {
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
      {/* ─────────────────────────────────────────────────────────────
          1. CINEMA SCREEN WIDESCREEN VIDEO PLAYER
          ───────────────────────────────────────────────────────────── */}
      <div
        onClick={(e) => {
          setShowControls(true);
          handleTogglePlayPause(e);
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        className={`relative overflow-hidden bg-black select-none transition-all duration-300 ${
          isFullscreen
            ? 'h-full w-full flex items-center justify-center cursor-pointer'
            : 'w-full aspect-video rounded-2xl sm:rounded-3xl border-[3px] border-amber-500/45 ring-2 ring-rose-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.95),0_0_38px_rgba(225,29,72,0.32),0_0_15px_rgba(245,158,11,0.2)] group cursor-pointer'
        }`}
      >
        {/* Top Golden Theater Proscenium Arch Trim */}
        {!isFullscreen && (
          <div className="pointer-events-none absolute top-0 inset-x-0 z-20 h-[3px] bg-gradient-to-r from-rose-700/60 via-amber-300 to-rose-700/60 shadow-[0_2px_12px_rgba(251,191,36,0.75)]" />
        )}
        {/* Cinema Screen Backlight / Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none z-10" />

        {/* Video Element OR Synchronized YouTube IFrame Player */}
        {youtubeVideoId ? (
          <div className="relative h-full w-full bg-black flex items-center justify-center">
            <div id={ytContainerId} className="h-full w-full pointer-events-none" />
            {isResolvingYtFallback && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-xs font-bold text-amber-300">
                  {tr('کردنەوەی ڤیدیۆی یوتیوب بە شێوازی ڕاستەوخۆ...', 'Opening direct YouTube stream...')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <video
            key={activeMediaUrl}
            ref={videoRef}
            src={activeMediaUrl}
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
            <source src={activeMediaUrl} type="video/mp4" />
            <source src={activeMediaUrl} />
          </video>
        )}

        {/* Always-visible slim glowing progress bar at the bottom edge */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60 z-20 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 transition-all duration-150"
            style={{
              width: `${effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0}%`,
            }}
          />
        </div>

        {/* Center Resume Play Button Overlay when movie is Paused (Allows anyone including the pauser to 1-tap Play) */}
        {!cinemaState.isPlaying && (
          <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-3xl bg-black/75 border-2 border-amber-400/80 px-5 py-3.5 text-white shadow-[0_0_35px_rgba(245,158,11,0.5)] backdrop-blur-md hover:scale-105 active:scale-95 transition"
              title={tr('لێدانەوەی فیلم بۆ هەمووان', 'Resume movie for everyone')}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-lg">
                <Play className="h-6 w-6 fill-black ml-0.5" />
              </div>
              <span className="text-[11px] font-black text-amber-300">
                {tr('رتە بکە بۆ دەستپێکردنەوە', 'Tap to Play')}
              </span>
            </button>
          </div>
        )}

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
                    title={cinemaState.isPlaying ? tr('وەستاندن', 'Pause') : tr('لێدان', 'Play')}
                  >
                    {cinemaState.isPlaying ? (
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
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2.5 inset-x-3 z-20 flex items-center justify-between pointer-events-auto"
            >
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
                    title={cinemaState.isPlaying ? tr('وەستاندن', 'Pause') : tr('لێدان', 'Play')}
                  >
                    {cinemaState.isPlaying ? (
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
            <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 mb-1.5">
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

            {/* Luxury 3D Cinema Auditorium Seating Deck */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#380613] via-[#1e030a] to-[#0a0104] px-2.5 pt-3.5 pb-3 shadow-[0_18px_45px_rgba(0,0,0,0.92),inset_0_2px_22px_rgba(225,29,72,0.25)]">
              {/* Curved Golden Theater Stage Lip & Footlight Glow */}
              <div className="pointer-events-none absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent shadow-[0_2px_12px_rgba(251,191,36,0.75)]" />
              <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-3/4 rounded-full bg-rose-500/20 blur-2xl" />
              {/* Theater Carpet Subtle Pattern & Aisle Step-Light Glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.22) 0%, transparent 65%), repeating-linear-gradient(90deg, rgba(244,63,94,0.06) 0px, rgba(244,63,94,0.06) 2px, transparent 2px, transparent 14px)',
                }}
              />
              <div className="pointer-events-none absolute bottom-0 inset-x-6 h-[2px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />

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
                    ? 'grid-cols-4 gap-2.5'
                    : targetSeatCount === 5
                    ? 'grid-cols-5 gap-1.5'
                    : targetSeatCount === 6
                    ? 'grid-cols-3 gap-2.5 max-w-[320px] mx-auto'
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
                        'border border-dashed border-amber-300/45 bg-black/55 hover:border-amber-300 hover:bg-black/75 shadow-inner';
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
                            'border-2 border-amber-400/85 shadow-md shadow-amber-500/30';
                        }
                      }

                      // 3D Velvet Upholstery Theme per Seat Type
                      const chairBackrestTheme = seat.isPlatinum
                        ? 'from-[#0e4f63] via-[#082c38] to-[#04151d] border-cyan-400/50 shadow-[inset_0_2px_12px_rgba(34,211,238,0.28)]'
                        : seat.isIron
                        ? 'from-[#475569] via-[#27303f] to-[#11161f] border-slate-300/45 shadow-[inset_0_2px_12px_rgba(226,232,240,0.25)]'
                        : seat.isVip
                        ? 'from-[#78350f] via-[#451a03] to-[#230c01] border-amber-400/60 shadow-[inset_0_2px_14px_rgba(251,191,36,0.3)]'
                        : 'from-[#881337] via-[#4c0519] to-[#23020b] border-rose-400/35 shadow-[inset_0_2px_12px_rgba(251,113,133,0.25)]';

                      const chairHeadrestTheme = seat.isPlatinum
                        ? 'from-cyan-500/40 via-[#0d3b49] to-[#082630] border-t-2 border-cyan-300/80'
                        : seat.isIron
                        ? 'from-slate-300/40 via-[#334155] to-[#1e293b] border-t-2 border-slate-200/80'
                        : seat.isVip
                        ? 'from-amber-400/45 via-[#6b2e0a] to-[#3b1604] border-t-2 border-amber-300/90'
                        : 'from-rose-500/40 via-[#6b0e28] to-[#3d0615] border-t-2 border-amber-400/75';

                      const chairArmrestTheme = seat.isPlatinum
                        ? 'from-[#0e4f63] via-[#062430] to-[#021017] border-cyan-400/40'
                        : seat.isIron
                        ? 'from-[#475569] via-[#1e293b] to-[#0f172a] border-slate-300/40'
                        : seat.isVip
                        ? 'from-[#78350f] via-[#3b1604] to-[#1c0901] border-amber-400/50'
                        : 'from-[#6b0e28] via-[#3b0614] to-[#1a0208] border-rose-400/30';

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
                          className="group relative flex cursor-pointer flex-col items-center min-w-0 pt-1 pb-0.5 transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
                        >
                          {/* ── 1. REALISTIC 3D CURVED VELVET HEADREST (Top Arch of Cinema Chair) ── */}
                          <div
                            className={`relative z-10 w-[76%] h-2.5 rounded-t-[14px] bg-gradient-to-b ${chairHeadrestTheme} shadow-[0_-2px_8px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden`}
                          >
                            {/* Golden Crown Piping & Center Brass Stud */}
                            <div className="w-1/2 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-amber-300/90 to-transparent" />
                          </div>

                          {/* ── 2. MAIN 3D VELVET ARMCHAIR BACKREST & SEAT CUSHION ── */}
                          <div className="relative flex flex-col items-center justify-center w-full px-1.5">
                            {/* Left 3D Sculpted Padded Armrest with Gold Cupholder Cap */}
                            <div
                              className={`pointer-events-none absolute -left-0.5 bottom-1.5 top-2 z-20 w-2 sm:w-2.5 rounded-t-md rounded-b-lg border bg-gradient-to-b ${chairArmrestTheme} shadow-[2px_4px_8px_rgba(0,0,0,0.85)] flex flex-col items-center pt-0.5`}
                            >
                              <span className="h-1 w-1 rounded-full bg-amber-300/80 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                              <span className="mt-1 w-[1px] flex-1 bg-white/10 rounded-full" />
                            </div>

                            {/* Right 3D Sculpted Padded Armrest with Gold Cupholder Cap */}
                            <div
                              className={`pointer-events-none absolute -right-0.5 bottom-1.5 top-2 z-20 w-2 sm:w-2.5 rounded-t-md rounded-b-lg border bg-gradient-to-b ${chairArmrestTheme} shadow-[-2px_4px_8px_rgba(0,0,0,0.85)] flex flex-col items-center pt-0.5`}
                            >
                              <span className="h-1 w-1 rounded-full bg-amber-300/80 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                              <span className="mt-1 w-[1px] flex-1 bg-white/10 rounded-full" />
                            </div>

                            {/* Tufted Velvet Backrest Body + 3D Bottom Seat Cushion Lip */}
                            <div
                              className={`relative flex flex-col items-center justify-center w-full pt-2 pb-1.5 px-1 rounded-t-xl rounded-b-2xl bg-gradient-to-b ${chairBackrestTheme} border border-b-[5px] border-b-[#140106] group-hover:border-amber-400/65 transition-all overflow-hidden`}
                            >
                              {/* Quilted Velvet Vertical Stitching Seams */}
                              <div className="pointer-events-none absolute inset-y-1 left-1/4 w-[1px] bg-black/30 shadow-[1px_0_0_rgba(255,255,255,0.06)]" />
                              <div className="pointer-events-none absolute inset-y-1 left-1/2 w-[1px] bg-black/25 shadow-[1px_0_0_rgba(255,255,255,0.05)]" />
                              <div className="pointer-events-none absolute inset-y-1 right-1/4 w-[1px] bg-black/30 shadow-[1px_0_0_rgba(255,255,255,0.06)]" />
                              {/* Plush Seat Cushion Horizontal Crease */}
                              <div className="pointer-events-none absolute bottom-5 inset-x-2 h-[1.5px] bg-gradient-to-r from-transparent via-black/55 to-transparent shadow-[0_1px_0_rgba(255,255,255,0.1)]" />

                              {/* Avatar Circle Container */}
                              <div className="relative z-10 flex items-center justify-center">
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
                                    <div className="flex flex-col items-center justify-center text-amber-200/80 group-hover:text-amber-300 transition">
                                      <Plus className="h-3.5 w-3.5 group-hover:scale-110 transition drop-shadow" />
                                      <span className="text-[8px] font-black text-amber-300/90">
                                        {seat.seatNo}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ── 3. FRONT SEAT CUSHION APRON: Golden Brass Number Plaque + Username ── */}
                              <div className="relative z-10 mt-1.5 flex items-center justify-center gap-1 max-w-full px-1 py-0.5 rounded-md bg-black/45 border border-amber-400/20 shadow-inner">
                                <span className="shrink-0 rounded bg-gradient-to-b from-amber-300 to-amber-600 px-1 py-0 text-[7px] font-black text-black shadow-sm leading-tight">
                                  {seat.seatNo}
                                </span>
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
                                      : 'text-amber-100/85 font-semibold'
                                  }`}
                                >
                                  {isOccupied
                                    ? seat.username
                                    : seat.vipAssignedName
                                    ? seat.vipAssignedName
                                    : seat.isPlatinum
                                    ? 'PLAT'
                                    : seat.isIron
                                    ? 'IRON'
                                    : seat.isVip
                                    ? 'VIP'
                                    : tr('کورسی', 'Seat')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ── 4. 3D FLOOR SHADOW & UNDER-SEAT AISLE GLOW ── */}
                          <div
                            className={`mt-0.5 h-1.5 w-4/5 rounded-full blur-[2px] transition-all ${
                              isSpeaking
                                ? 'bg-emerald-400/70 shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                                : isOccupied
                                ? 'bg-amber-400/45'
                                : 'bg-black/80'
                            }`}
                          />
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

            {/* Right side in audience strip: kept clean without Movie Folders or Watch Party text */}
            <div className="flex items-center gap-2">
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
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3.5 overscroll-contain min-h-0">
                {/* ── YOUTUBE VIDEO LINK BAR (OPEN TO ROOM HOST & ALL USERS) ── */}
                <form
                  onSubmit={handlePlayYouTubeFromDrawer}
                  className="rounded-2xl border border-red-500/35 bg-gradient-to-r from-red-950/40 via-black/60 to-rose-950/30 p-3 space-y-2 shadow-inner"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-600 text-white shadow-sm">
                        <Play className="h-3 w-3 fill-current" />
                      </span>
                      <span className="text-xs font-black text-white">
                        {tr('پەخشکردنی ڤیدیۆی یوتیوب (YouTube)', 'Watch YouTube Video Together')}
                      </span>
                    </div>
                    <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[8px] font-bold text-red-300">
                      {tr('بۆ خاوەن ژوور و بەکارهێنەران', 'Host & Users')}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      required
                      value={drawerYtUrl}
                      onChange={(e) => setDrawerYtUrl(e.target.value)}
                      placeholder={tr('لینکی ڤیدیۆی یوتیوب دابنێ (https://youtu.be/...)', 'Paste YouTube link (https://youtu.be/...)')}
                      dir="ltr"
                      className="flex-1 rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 font-mono"
                    />
                    <input
                      type="text"
                      maxLength={50}
                      value={drawerYtTitle}
                      onChange={(e) => setDrawerYtTitle(e.target.value)}
                      placeholder={tr('ناوی ڤیدیۆ (ئارەزوومەندانە)', 'Title (optional)')}
                      className="sm:w-36 rounded-xl border border-white/15 bg-black/75 px-2.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={!drawerYtUrl.trim()}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-95 transition disabled:opacity-40 shrink-0"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{tr('پەخشکردن', 'Play')}</span>
                    </button>
                  </div>

                  {getYouTubeThumbnailUrl(drawerYtUrl) && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-black/60 p-1.5">
                      <img
                        src={getYouTubeThumbnailUrl(drawerYtUrl)!}
                        alt="YouTube Preview"
                        className="h-10 w-16 rounded-lg object-cover border border-white/15 shrink-0"
                      />
                      <span className="text-[10px] font-bold text-emerald-400 truncate">
                        {tr('ڤیدیۆی یوتیوب ئامادەیە بۆ سەیرکردن', 'YouTube video ready to watch')}
                      </span>
                    </div>
                  )}
                </form>

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
                                    <EpisodeVideoThumbnail
                                      videoUrl={ep.videoUrl}
                                      fallbackPosterUrl={ep.posterUrl || activeDrawerFolder.posterUrl}
                                      episodeNumber={ep.episodeNumber}
                                      title={ep.title}
                                      className="h-14 w-24"
                                    />

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
