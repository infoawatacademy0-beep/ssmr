import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Crown,
  Volume2,
  Share2,
  Check,
  Gift,
  Plus,
  Radio,
  X,
  Lock,
  Dices,
  Coins,
  Flame,
  Gamepad2,
  Users,
  Music,
  Diamond,
  Star,
  Sparkles,
  ShieldAlert,
  MessageCircle,
  Shield,
  UserPlus,
  BadgeCheck,
  Trash2,
  User as UserIcon,
  Smile,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts';
import {
  formatCoinsK,
  type Room,
  type Seat,
  type JackarooGame,
  type VoiceEffectMode,
  type RoomEntranceEvent,
  type RoomMusicState,
  type AudienceMember,
  type RoomGiftEvent,
  type PkBattleState,
} from '../types';
import {
  subscribeToRoom,
  joinSeat,
  leaveSeat,
  toggleSeatMute,
  setSeatVoiceEffect,
  sendRoomMessage,
  clearRoomChat,
  closeJackarooGame,
  updateRoomPassword,
  setAdminForcedVoice,
  subscribeToJackarooGame,
  broadcastUserEntrance,
  subscribeToRoomEntrance,
  subscribeToMusicState,
  registerAudiencePresence,
  subscribeToAudience,
  getUserSocialProfile,
  subscribeToRoomGift,
  subscribeToSeatGiftCoins,
  subscribeToPkBattle,
  sendSeatEmoji,
  subscribeToSeatEmojis,
} from '../services';
import { useVoiceRoom } from '../hooks/useVoiceRoom';
import JackarooGamePanel from './JackarooGamePanel';
import GiftStoreModal from './GiftStoreModal';
import AudioStreams from './AudioStreams';
import EntranceAnimation from './EntranceAnimation';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import PkBattlePanel from './PkBattlePanel';
import FloatingHearts from './FloatingHearts';
import MusicPlayerPanel from './MusicPlayerPanel';
import AudienceGrid from './AudienceGrid';
import ReportModal from './ReportModal';
import PrivateChat from './PrivateChat';
import HostControlsPanel from './HostControlsPanel';
import RoomInviteModal from './RoomInviteModal';
import IncomingChatToast from './IncomingChatToast';
import UserProfileManager from './UserProfileManager';
import {
  SeatEmojiOverlay,
  SeatEmojiPickerModal,
  AnimatedEmojiGraphic,
} from './SeatEmojiSystem';

/* ─────────────────────────────────────────────────────────────
   SSMR — Ultra-Premium Gamified Voice Chat Room & Arena
   Real-Time Voice Streaming Powered by LiveKit WebRTC
   Collaborative Music Player, Audience Presence, and TTS
   ───────────────────────────────────────────────────────────── */

const SEAT_NAME_COLORS = [
  'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]',
  'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]',
  'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]',
  'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.35)]',
  'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.35)]',
  'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.35)]',
  'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]',
  'text-lime-300 drop-shadow-[0_0_8px_rgba(190,242,100,0.35)]',
];

export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronized 2/3/4-Player Jackaroo Board & Card Game state
  const [activeJackarooGame, setActiveJackarooGame] = useState<JackarooGame | null>(null);
  const [isJackarooOpen, setIsJackarooOpen] = useState(false);

  // VIP Voice Changer Modal state
  const [isVoiceChangerOpen, setIsVoiceChangerOpen] = useState(false);

  // Host Music Player panel toggle (allows Host to play music in any room)
  const [isMusicPanelVisible, setIsMusicPanelVisible] = useState(false);

  // Preserve user's mute & voice effect state when switching seats
  const lastKnownMuteRef = useRef<boolean>(false);
  const lastKnownVoiceEffectRef = useRef<VoiceEffectMode>('normal');

  // Live User Entrance Animations state
  const [entranceEvent, setEntranceEvent] = useState<RoomEntranceEvent | null>(null);

  // Live TikTok-style Room Gift Broadcast Animation state
  const [roomGiftEvent, setRoomGiftEvent] = useState<RoomGiftEvent | null>(null);

  // 4 VS 4 PK Battle state
  const [pkBattle, setPkBattle] = useState<PkBattleState | null>(null);

  // Gift coins earned by each seated user in this room session
  const [seatGiftCoins, setSeatGiftCoins] = useState<Record<string, number>>({});

  // Collaborative Music Room & Media Queue state
  const [musicState, setMusicState] = useState<RoomMusicState>({
    currentTrackId: null,
    isPlaying: false,
    playbackPosition: 0,
    lastSyncTimestamp: Date.now(),
    queue: [],
  });

  // Real-time Audience Presence state
  const [audience, setAudience] = useState<AudienceMember[]>([]);

  // Interactive Gift Store modal state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<{ uid: string; username: string } | null>(null);

  // Chat message input
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Seat Action Sheet Modal
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Copied link toast
  const [copiedLink, setCopiedLink] = useState(false);

  // Room Report Modal state
  const [isRoomReportOpen, setIsRoomReportOpen] = useState(false);

  // Host Controls Panel modal state
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);

  // Room Invite Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Custom Host Room Background & Verification state
  const [hostRoomBackground, setHostRoomBackground] = useState<string | null>(null);
  const [hostIsVerified, setHostIsVerified] = useState<boolean>(false);

  // Private Chat (DM) state — triggered from seat action sheet, chat, or audience click
  const [activeChatRecipient, setActiveChatRecipient] = useState<{
    uid: string;
    username: string;
    avatar?: string;
  } | null>(null);

  // User Profile Modal state inside room
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);

  // Interactive 3D Animated Seat & Room Emoji state
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeSeatEmojis, setActiveSeatEmojis] = useState<
    Record<number, { id: string; emojiId: string; timestamp: number }>
  >({});

  // Periodically prune expired seat emojis after 4.2s
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveSeatEmojis((prev) => {
        let changed = false;
        const next: Record<number, { id: string; emojiId: string; timestamp: number }> = {};
        for (const [seatNoStr, item] of Object.entries(prev)) {
          if (now - item.timestamp < 4200) {
            next[Number(seatNoStr)] = item;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 600);
    return () => clearInterval(timer);
  }, []);

  // Real-time map of VIP (isVerified) and avatars across all users
  const [vipUsersMap, setVipUsersMap] = useState<Record<string, boolean>>({});
  const [usersAvatarMap, setUsersAvatarMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsub = onValue(usersRef, (snap) => {
      if (!snap.exists()) return;
      const val = snap.val() as Record<string, any>;
      const vMap: Record<string, boolean> = {};
      const aMap: Record<string, string> = {};
      Object.entries(val).forEach(([uid, u]) => {
        if (u?.isVerified) vMap[uid] = true;
        if (u?.avatar || u?.profileImage) aMap[uid] = u.avatar || u.profileImage;
      });
      setVipUsersMap(vMap);
      setUsersAvatarMap(aMap);
    });
    return () => unsub();
  }, []);

  // Identify if current user is seated and on which seat
  const mySeat = room?.seats.find((s) => s.userId === user?.uid) ?? null;
  const isHost = room?.hostId === user?.uid;

  /* ─────────────────────────────────────────────────────────────
     1. Real-time Firebase Listeners (Room, Games, Music, Presence)
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!roomId) {
      setError('Room ID not provided.');
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubRoom = subscribeToRoom(roomId, (updatedRoom) => {
      if (!updatedRoom) {
        setError('This room does not exist or has been closed.');
        setRoom(null);
      } else {
        setRoom(updatedRoom);
        setError(null);
      }
      setLoading(false);
    });

    // Real-time 2/3/4-Player Jackaroo Board & Card Game listener
    const unsubJackaroo = subscribeToJackarooGame(roomId, (jkr) => {
      setActiveJackarooGame(jkr);
    });

    // Real-time User Entrance listener
    const unsubEntrance = subscribeToRoomEntrance(roomId, (entrance) => {
      setEntranceEvent(entrance);
    });

    // Real-time TikTok-Style Room Gift listener
    const unsubGift = subscribeToRoomGift(roomId, (gEvent) => {
      setRoomGiftEvent(gEvent);
    });

    // Real-time 4 VS 4 PK Battle listener
    const unsubPk = subscribeToPkBattle(roomId, (battle) => {
      setPkBattle(battle);
    });

    // Real-time seat gift coins listener
    const unsubSeatCoins = subscribeToSeatGiftCoins(roomId, (coinsMap) => {
      setSeatGiftCoins(coinsMap);
    });

    // Real-time Music Queue & Player listener
    const unsubMusic = subscribeToMusicState(roomId, (mState) => {
      setMusicState(mState);
    });

    // Real-time Audience Presence listener
    const unsubAudience = subscribeToAudience(roomId, (listeners) => {
      setAudience(listeners);
    });

    // Real-time Animated Seat Emoji listener
    const unsubSeatEmojis = subscribeToSeatEmojis(roomId, (emojisMap) => {
      setActiveSeatEmojis(emojisMap);
    });

    // Register user presence in audience (automatic onDisconnect cleanup)
    let unregisterPresence: (() => void) | null = null;
    if (user) {
      const myAvatar = user.avatar || user.profileImage || '';
      unregisterPresence = registerAudiencePresence(roomId, {
        uid: user.uid,
        username: user.username,
        level: user.level,
        avatar: myAvatar,
        isVerified: Boolean(user.isVerified),
        badges: user.badges,
      });

      // Broadcast current user's luxury entrance
      broadcastUserEntrance(roomId, {
        uid: user.uid,
        username: user.username,
        level: user.level,
        avatar: myAvatar,
        isVerified: Boolean(user.isVerified),
      }).catch(console.error);
    }

    return () => {
      unsubRoom();
      unsubJackaroo();
      unsubEntrance();
      unsubGift();
      unsubPk();
      unsubSeatCoins();
      unsubMusic();
      unsubAudience();
      unsubSeatEmojis();
      if (unregisterPresence) unregisterPresence();
    };
  }, [roomId, user?.uid]);

  // Load Host custom room background and verification status
  useEffect(() => {
    if (!room?.hostId) return;
    getUserSocialProfile(room.hostId)
      .then((hostProfile) => {
        if (hostProfile) {
          if (hostProfile.roomBackground) {
            setHostRoomBackground(hostProfile.roomBackground);
          }
          if (hostProfile.isVerified) {
            setHostIsVerified(true);
          }
        }
      })
      .catch((err) => console.error('Error fetching host themes:', err));
  }, [room?.hostId]);

  /* ─────────────────────────────────────────────────────────────
     2. WebRTC Audio Streaming with LiveKit & VIP Voice Changer
     ───────────────────────────────────────────────────────────── */
  const {
    isConnected: isLiveKitConnected,
    isConnecting: isLiveKitConnecting,
    connectionError: livekitError,
    speakingUids,
    audioAutoplayBlocked,
    unlockAudioAutoplay,
    isSelfMonitoring,
    toggleSelfMonitor,
  } = useVoiceRoom({
    roomId: room?.id || '',
    currentUser: user,
    mySeat,
    allSeats: room?.seats || [],
  });

  // Keep last known mute state & voice effect synced so switching seats NEVER forces mic open
  useEffect(() => {
    if (mySeat) {
      lastKnownMuteRef.current = Boolean(mySeat.isMuted);
      lastKnownVoiceEffectRef.current = mySeat.voiceEffect || 'normal';
    }
  }, [mySeat?.isMuted, mySeat?.voiceEffect]);

  /* ─────────────────────────────────────────────────────────────
     3. Auto-scroll chat to bottom
     ───────────────────────────────────────────────────────────── */
  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [room?.activeChat, scrollToBottom]);

  /* ─────────────────────────────────────────────────────────────
     4. Seat Actions Handlers (Cascades to LiveKit Audio Engine)
     ───────────────────────────────────────────────────────────── */
  const handleSeatClick = async (seat: Seat) => {
    if (!room || !user) return;

    if (!seat.userId) {
      // Empty seat clicked: Join seat while strictly preserving current mute & VIP voice state
      try {
        await joinSeat(room.id, seat.seatNo, {
          uid: user.uid,
          username: user.username,
          avatar: user.avatar || user.profileImage || '',
          isVerified: Boolean(user.isVerified),
          isMuted: mySeat ? mySeat.isMuted : lastKnownMuteRef.current,
          voiceEffect: mySeat?.voiceEffect || lastKnownVoiceEffectRef.current,
        });
      } catch (err: any) {
        alert(err.message || 'Could not take this seat.');
      }
    } else {
      // Seat is occupied: Open action sheet / profile view
      setSelectedSeat(seat);
      setIsActionSheetOpen(true);
    }
  };

  const handleToggleMyMute = async () => {
    if (!room || !mySeat) return;
    try {
      const nextMuted = !mySeat.isMuted;
      lastKnownMuteRef.current = nextMuted;
      // Toggling isMuted in Firebase cascades to LiveKit setMicrophoneEnabled
      await toggleSeatMute(room.id, mySeat.seatNo, nextMuted);
    } catch (err: any) {
      console.error('Failed to toggle mute:', err);
    }
  };

  const handleChangeVoiceEffect = async (effect: VoiceEffectMode) => {
    if (!room || !mySeat || !user) return;
    const isVipUser = Boolean(user.isVerified || user.isAdmin);
    if (!isVipUser && effect !== 'normal') {
      alert('تایبەتمەندی گۆڕینی دەنگ (منداڵان / ڤینۆم) تەنها بۆ ئەندامانی VIP بەردەستە کە لەلایەن ئەدمینەوە پێیان دەبەخشرێت!');
      return;
    }
    try {
      lastKnownVoiceEffectRef.current = effect;
      await setSeatVoiceEffect(room.id, mySeat.seatNo, effect);
    } catch (err) {
      console.error('Failed to change voice effect:', err);
    }
  };

  const handleLeaveMySeat = async (seatNo?: number) => {
    if (!room) return;
    const targetSeatNo = seatNo ?? mySeat?.seatNo;
    if (!targetSeatNo) return;

    try {
      await leaveSeat(room.id, targetSeatNo);
      setIsActionSheetOpen(false);
    } catch (err: any) {
      console.error('Failed to vacate seat:', err);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     4b. Leave Room (Vacates seat first so user doesn't get stuck)
     ───────────────────────────────────────────────────────────── */
  const [isLeaving, setIsLeaving] = useState(false);
  const mySeatRef = useRef<Seat | null>(null);
  mySeatRef.current = mySeat;

  const handleLeaveRoom = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      if (mySeat && room) {
        await leaveSeat(room.id, mySeat.seatNo);
      }
      setActiveChatRecipient(null);
    } catch (err) {
      console.error('Failed to vacate seat on room leave:', err);
    } finally {
      navigate('/');
    }
  };

  // Ensure seat is released if component unmounts while user is on stage
  useEffect(() => {
    return () => {
      if (mySeatRef.current && roomId) {
        leaveSeat(roomId, mySeatRef.current.seatNo).catch(console.error);
      }
    };
  }, [roomId]);

  /* ─────────────────────────────────────────────────────────────
     5. Chat Messaging
     ───────────────────────────────────────────────────────────── */
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!room || !user || !chatInput.trim() || isSending) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setIsSending(true);

    try {
      await sendRoomMessage(
        room.id,
        user.uid || 'anon',
        user.username || 'User',
        messageText,
        user.avatar || user.profileImage || null,
        Boolean(user.isVerified),
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(err.message || 'Could not send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Send 3D Animated Emoji on Seat (if seated) & into Room Chat
  const handleSelectEmoji = useCallback(
    async (emojiId: string) => {
      if (!room || !user) return;
      try {
        if (mySeat) {
          // Immediately show locally and broadcast on seat
          setActiveSeatEmojis((prev) => ({
            ...prev,
            [mySeat.seatNo]: {
              id: `local_${Date.now()}`,
              emojiId,
              timestamp: Date.now(),
            },
          }));
          await sendSeatEmoji(
            room.id,
            mySeat.seatNo,
            emojiId,
            user.uid,
            user.username || 'User',
          );
        } else {
          // If not seated on a mic, send animated emoji into the live chat
          await sendRoomMessage(
            room.id,
            user.uid || 'anon',
            user.username || 'User',
            `[EMOJI:${emojiId}]`,
            user.avatar || user.profileImage || null,
            Boolean(user.isVerified),
          );
        }
      } catch (err) {
        console.error('Failed to send animated emoji:', err);
      }
    },
    [room, user, mySeat],
  );

  /* ─────────────────────────────────────────────────────────────
     6. Share / Copy Room link
     ───────────────────────────────────────────────────────────── */
  const handleShareRoom = () => {
    if (!room) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  /* ─────────────────────────────────────────────────────────────
     Render Loading / Error states
     ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-900 p-4 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/25"
        >
          <Radio className="h-7 w-7 text-white" />
        </motion.div>
        <p className="text-sm font-semibold text-white">Connecting to Voice Arena…</p>
        <p className="mt-1 text-xs text-slate-500">Initializing LiveKit WebRTC & 8 audio channels</p>
      </div>
    );
  }

  if (error || !room || !user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-900 p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-400">
          <PhoneOff className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Room Unavailable</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-xs">{error || 'This voice room was closed or could not be found.'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-transform active:scale-95"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  const isGradientBg = hostRoomBackground && !hostRoomBackground.startsWith('http') && !hostRoomBackground.startsWith('data:');
  const isImageBg = hostRoomBackground && (hostRoomBackground.startsWith('http') || hostRoomBackground.startsWith('data:'));

  return (
    <div
      className={`relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-surface-900 text-white select-none transition-all duration-700 ${
        isGradientBg ? 'vip-animated-cover' : 'bg-cover bg-center'
      }`}
      style={
        isImageBg
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(13, 13, 22, 0.78), rgba(13, 13, 22, 0.94)), url(${hostRoomBackground})`,
            }
          : isGradientBg
          ? {
              background: hostRoomBackground,
            }
          : undefined
      }
    >
      {/* ── Background Glow Effects ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-20 h-64 w-64 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-10 left-10 h-64 w-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
        />
      </div>

      {/* Audio Streams Provider (renders autoplay banners & error toasts silently) */}
      <AudioStreams
        isConnected={isLiveKitConnected}
        isConnecting={isLiveKitConnecting}
        connectionError={livekitError}
        audioAutoplayBlocked={audioAutoplayBlocked}
        onUnlockAudio={unlockAudioAutoplay}
        activeSpeakersCount={speakingUids.size}
      />

      {/* ─────────────────────────────────────────────────────────
         TOP BAR: Clean Header with Zero Overlap on Mobile
         ───────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-surface-900/80 px-3 py-2.5 backdrop-blur-xl gap-2">
        {/* Left Side: Host Info & Room Name */}
        <div
          onClick={() => room.hostId && setSelectedProfileUid(room.hostId)}
          className="flex cursor-pointer items-center gap-2 min-w-0 group"
          title="بینینی پڕۆفایلی خاوەنی ژوور"
        >
          <div
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 font-bold shadow-md text-xs ${
              hostIsVerified || vipUsersMap[room.hostId]
                ? 'vip-fire-avatar'
                : 'shadow-violet-500/20'
            }`}
          >
            <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
              {room.hostAvatar || usersAvatarMap[room.hostId] ? (
                <img
                  src={room.hostAvatar || usersAvatarMap[room.hostId]}
                  alt={room.hostName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{room.hostName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -top-1.5 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
              <Crown className="h-2.5 w-2.5 text-black fill-black" strokeWidth={2.5} />
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-xs sm:text-sm font-bold text-white tracking-wide max-w-[110px] xs:max-w-[140px] sm:max-w-[200px] group-hover:text-amber-300 transition">
              {room.roomName}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="truncate max-w-[110px]">Host: <strong className="text-violet-400">{room.hostName}</strong></span>
              {(hostIsVerified || vipUsersMap[room.hostId]) && (
                <span title="Verified VIP Host" className="inline-flex items-center gap-0.5 shrink-0">
                  <Crown className="h-3 w-3 text-amber-400 fill-amber-400 vip-crown-animation" />
                  <BadgeCheck
                    size={12}
                    className="text-sky-400 fill-sky-400/20 shrink-0"
                  />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Action Buttons (No text overflow, mobile friendly) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Live Audience Counter */}
          <div
            className="flex h-8 items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] px-2 text-xs font-bold text-slate-300"
            title="Active room listeners"
          >
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] text-white">{audience.length}</span>
          </div>

          {/* Invite Button */}
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex h-8 w-8 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/20"
            title="Invite friends"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          {/* Host Music Player Toggle Button */}
          {(isHost || user.isAdmin) && (
            <button
              onClick={() => setIsMusicPanelVisible((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold transition-colors ${
                isMusicPanelVisible || musicState.isPlaying
                  ? 'border-violet-400 bg-violet-500/25 text-violet-200'
                  : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
              }`}
              title="پێکردنی گۆرانی (Music Player)"
            >
              <Music className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Quick 1-Click Remove Password Button in Header (when room has password) */}
          {(isHost || user.isAdmin) && room.isPrivate && room.password && (
            <button
              onClick={async () => {
                try {
                  await updateRoomPassword(room.id, null);
                } catch (err: any) {
                  alert(err.message || 'نەتوانرا پاسۆرد لاببرێت');
                }
              }}
              className="flex h-8 items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/15 px-2 text-[10px] font-black text-rose-300 transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300"
              title="کرتە بکە بۆ لابردنی پاسۆردی ژوورەکە (Remove Room Password)"
            >
              <Lock className="h-3 w-3" />
              <span className="hidden xs:inline">لابردنی پاسۆرد</span>
            </button>
          )}

          {/* Host Controls Button */}
          {(isHost || user.isAdmin) && (
            <button
              onClick={() => setIsHostControlsOpen(true)}
              className="flex h-8 w-8 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
              title="Host Controls"
            >
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Panel</span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={handleShareRoom}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08]"
            title="Copy room link"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
          </button>

          {/* Report Room Button */}
          <button
            onClick={() => setIsRoomReportOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-400 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
            title="Report this room"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
          </button>

          {/* Leave Button - Safely vacates seat before exiting */}
          <button
            onClick={handleLeaveRoom}
            disabled={isLeaving}
            className="flex h-8 items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/15 px-2.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/25 active:scale-95 disabled:opacity-50"
            title="Leave Room"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────
         MAIN CONTENT AREA: 8-Seat Stage + Music + Audience + Chat
         ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* ── THE 8-SEAT AUDIO GRID WITH SEAT FLOATING BADGES ── */}
        <section className="shrink-0 p-4 pb-1">
          {/* 4 VS 4 PK Battle Arena Panel (5-min real-time battle) */}
          <PkBattlePanel
            roomId={room.id}
            currentUser={user}
            isHost={isHost}
            seats={room.seats}
            pkBattle={pkBattle}
          />

          <div className="flex items-center justify-between pb-2 px-1">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Live Mic Stage (8 Seats)
            </span>
            <span className="text-[10px] text-slate-500">
              {room.seats.filter((s) => s.userId).length} / 8 Seated
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {room.seats.map((seat) => {
              const isOccupied = Boolean(seat.userId);
              const isCurrentUser = seat.userId === user?.uid;
              const isHostSeat = seat.userId === room.hostId;
              const isSeatVip = Boolean(
                isOccupied &&
                  (seat.isVerified ||
                    (seat.userId && vipUsersMap[seat.userId]) ||
                    (isCurrentUser && user?.isVerified)),
              );
              const isPkActive = pkBattle?.status === 'active';
              const isTeamRed = [1, 2, 5, 6].includes(seat.seatNo);
              // True WebRTC speaking indicator powered by LiveKit Voice Activity Detection
              const isSpeaking =
                isOccupied &&
                !seat.isMuted &&
                seat.userId !== null &&
                speakingUids.has(seat.userId);

              // Dynamic border & glow depending on VIP fire stroke / speaking / PK team status
              let avatarBorderClass = 'border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-violet-500/50 hover:bg-white/[0.04]';
              if (isOccupied) {
                if (isSeatVip) {
                  avatarBorderClass = 'vip-fire-avatar';
                } else if (isSpeaking) {
                  avatarBorderClass = 'border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
                } else if (isPkActive) {
                  avatarBorderClass = isTeamRed
                    ? 'border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                    : 'border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.6)]';
                } else {
                  avatarBorderClass = 'border-2 border-violet-500/60 shadow-md shadow-violet-500/20';
                }
              }

              return (
                <div
                  key={`seat-${seat.seatNo}`}
                  onClick={() => handleSeatClick(seat)}
                  className="group flex cursor-pointer flex-col items-center"
                >
                  {/* Seat Avatar Container */}
                  <div className="relative flex items-center justify-center">
                    {/* Speaking Animated Wave Ring */}
                    {isSpeaking && (
                      <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0, 0.9] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-full border-2 border-emerald-400 pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                      />
                    )}

                    {/* PK Battle Team Pill Indicator on Seat */}
                    {isPkActive && (
                      <div
                        className={`absolute -top-2 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.2 text-[7px] font-black uppercase text-white shadow-md z-20 ${
                          isTeamRed ? 'bg-rose-600 border border-rose-400/80' : 'bg-sky-600 border border-sky-400/80'
                        }`}
                      >
                        {isTeamRed ? 'RED' : 'BLUE'}
                      </div>
                    )}

                    {/* Avatar / Empty Seat Base */}
                    <div
                      className={`
                        relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full transition-all duration-300
                        ${avatarBorderClass}
                      `}
                    >
                      {isOccupied ? (
                        <>
                          {/* Occupied Seat Avatar (Profile Picture or Initial) */}
                          {(() => {
                            const seatAvatarUrl =
                              seat.avatar ||
                              (seat.userId ? usersAvatarMap[seat.userId] : null) ||
                              (isCurrentUser ? user?.avatar || user?.profileImage : null) ||
                              audience.find((a) => a.uid === seat.userId)?.avatar ||
                              null;
                            return (
                              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-violet-700 via-purple-600 to-cyan-500 text-sm font-bold text-white uppercase shadow-inner">
                                {seatAvatarUrl ? (
                                  <img
                                    src={seatAvatarUrl}
                                    alt={seat.username || 'User'}
                                    className="h-full w-full rounded-full object-cover"
                                  />
                                ) : (
                                  seat.username?.charAt(0) || 'U'
                                )}
                              </div>
                            );
                          })()}

                          {/* Host Crown Indicator */}
                          {isHostSeat && (
                            <div className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow z-20">
                              <Crown className="h-2.5 w-2.5 text-black fill-black" strokeWidth={2.5} />
                            </div>
                          )}

                          {/* VIP Fire Crown Badge on Seat Profile Icon */}
                          {isSeatVip ? (
                            <div
                              title="VIP Royale"
                              className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-red-600 shadow-[0_0_10px_#f97316] z-20"
                            >
                              <Crown className="h-3 w-3 text-black fill-black" strokeWidth={2.5} />
                            </div>
                          ) : (
                            isOccupied &&
                            !isHostSeat && (
                              <div className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 shadow-md shadow-cyan-400/40 z-10">
                                <Diamond className="h-2.5 w-2.5 text-black fill-black" />
                              </div>
                            )
                          )}

                          {/* Received Gift Coins Badge on Profile Icon */}
                          {seat.userId && (seatGiftCoins[seat.userId] ?? 0) > 0 && (
                            <div
                              title={`${formatCoinsK(seatGiftCoins[seat.userId] ?? 0)} coins received`}
                              className="absolute -bottom-2 -left-1.5 z-20 flex items-center gap-0.5 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-500 to-yellow-500 px-1.5 py-0.5 text-[8px] font-black text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                            >
                              <Coins className="h-2.5 w-2.5 text-slate-950 shrink-0" />
                              <span>{formatCoinsK(seatGiftCoins[seat.userId] ?? 0)}</span>
                            </div>
                          )}

                          {/* Active VIP Voice Changer Badge on Seat (Child / Venom) */}
                          {seat.voiceEffect && seat.voiceEffect !== 'normal' && (
                            <div
                              className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[7.5px] font-black shadow-md ${
                                seat.voiceEffect === 'venom'
                                  ? 'border-purple-400/80 bg-gradient-to-r from-slate-950 via-purple-950 to-rose-950 text-purple-200 shadow-purple-500/40'
                                  : 'border-pink-400/80 bg-gradient-to-r from-pink-500 to-amber-400 text-black shadow-pink-500/40'
                              }`}
                            >
                              {seat.voiceEffect === 'venom' ? '👹 VENOM' : '👶 منداڵ'}
                            </div>
                          )}

                          {/* Mic Status Badge */}
                          <div
                            className={`
                              absolute -bottom-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-900 shadow-md
                              ${seat.isMuted ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-black'}
                            `}
                          >
                            {seat.isMuted ? (
                              <MicOff className="h-2.5 w-2.5" />
                            ) : (
                              <Mic className="h-2.5 w-2.5" />
                            )}
                          </div>

                          {/* 3D Animated Emoji Overlay Directly on Seat (like Screenshot 1) */}
                          <AnimatePresence>
                            {activeSeatEmojis[seat.seatNo] &&
                              Date.now() - activeSeatEmojis[seat.seatNo].timestamp < 4200 && (
                                <SeatEmojiOverlay
                                  key={activeSeatEmojis[seat.seatNo].id}
                                  emojiId={activeSeatEmojis[seat.seatNo].emojiId}
                                />
                              )}
                          </AnimatePresence>
                        </>
                      ) : (
                        <>
                          {/* Empty Seat State */}
                          {seat.isLocked ? (
                            <Lock className="h-5 w-5 text-slate-600" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500 transition-colors group-hover:text-violet-400">
                              <Plus className="h-5 w-5" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Seat Title / Colored Username + VIP Flame */}
                  <div className="mt-1.5 flex items-center justify-center gap-0.5 max-w-full px-1">
                    {isSeatVip && (
                      <Crown className="h-2.5 w-2.5 shrink-0 text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_#f59e0b]" />
                    )}
                    <span
                      className={`truncate text-center text-[11px] leading-tight max-w-[64px] ${
                        isOccupied
                          ? `font-bold ${SEAT_NAME_COLORS[(seat.seatNo - 1) % SEAT_NAME_COLORS.length]}`
                          : 'text-slate-500 font-medium'
                      }`}
                      title={isOccupied ? seat.username || `Seat ${seat.seatNo}` : `Seat ${seat.seatNo}`}
                    >
                      {isOccupied ? (isCurrentUser ? `${seat.username} (You)` : seat.username) : `Seat ${seat.seatNo}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── FLOATING VIP JACKAROO NOTIFICATION BANNER ── */}
          <div className="mt-2 space-y-2">
            <AnimatePresence>
              {activeJackarooGame && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => setIsJackarooOpen(true)}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/25 via-surface-800 to-orange-600/20 px-3.5 py-2 shadow-lg shadow-amber-500/15"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black font-black shadow">
                      🃏
                    </div>
                    <div>
                      <p className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>VIP JACKAROO · جاکۆرۆ</span>
                        <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[8px] text-amber-300 font-bold uppercase">
                          {activeJackarooGame.maxPlayers}P · {activeJackarooGame.status}
                        </span>
                      </p>
                      <p className="text-[10px] text-amber-200/90">
                        {activeJackarooGame.players.length}/{activeJackarooGame.maxPlayers} یاریزان · خەڵات: {formatCoinsK(activeJackarooGame.totalPot)} کۆین
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(isHost || user.isAdmin || activeJackarooGame.hostUid === user.uid) && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await closeJackarooGame(room.id);
                          } catch (err) {
                            console.error('Failed to cancel Jackaroo:', err);
                          }
                        }}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-2 py-1 text-[10px] font-black text-rose-300 hover:bg-rose-500/30"
                        title="هەڵوەشاندنەوەی یاری (Cancel Game)"
                      >
                        داخستن ✕
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-[11px] font-black text-amber-400">
                      <span>{activeJackarooGame.status === 'waiting' ? 'بەشداری بکە' : 'بینینی یاری'}</span>
                      <Flame className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── FEATURE 1: Collaborative Music Room & Media Queue ── */}
        <MusicPlayerPanel
          roomId={room.id}
          currentUser={user}
          isHost={Boolean(isHost || user.isAdmin)}
          seats={room.seats}
          musicState={musicState}
          isOpenModal={isMusicPanelVisible}
          onOpenPanel={() => setIsMusicPanelVisible(true)}
          onClosePanel={() => setIsMusicPanelVisible(false)}
        />

        {/* ── FEATURE 2: Live Room Audience Strip Row ── */}
        <AudienceGrid
          audience={audience}
          seats={room.seats}
          currentUser={user}
          vipUsersMap={vipUsersMap}
          onSendGiftToUser={(recipient) => {
            setGiftRecipient(recipient);
            setIsGiftModalOpen(true);
          }}
          onOpenPrivateChat={(recipient) => {
            setActiveChatRecipient(recipient);
          }}
          onOpenProfile={(uid) => {
            setSelectedProfileUid(uid);
          }}
        />

        {/* ── REAL-TIME LIVE CHAT DOCKED SECTION ── */}
        <section className="relative flex flex-1 flex-col overflow-hidden border-t border-white/[0.06] bg-surface-900/50 p-4">
          {/* Luxury User Entrance Visual Animations */}
          <EntranceAnimation entranceEvent={entranceEvent} />

          {/* TikTok-Style Live Room Gift Animation Overlay */}
          <GiftAnimationOverlay giftEvent={roomGiftEvent} />

          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Live Room Chat
            </span>
            <div className="flex items-center gap-2">
              {(isHost || user.isAdmin) && room.activeChat.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await clearRoomChat(room.id);
                    } catch (err) {
                      console.error('Failed to clear chat:', err);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 transition hover:bg-rose-500/25 active:scale-95"
                  title="سڕینەوەی چات (Clear Chat)"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>سڕینەوەی چات</span>
                </button>
              )}
              <span className="text-[10px] text-slate-500">
                {room.activeChat.length} messages
              </span>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1 text-xs"
          >
            {room.activeChat.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-500 text-center">
                <p>No messages yet.<br />Be the first to say hello!</p>
              </div>
            ) : (
              room.activeChat.map((msg) => {
                const isSystem = msg.senderId === 'system';
                const isMe = msg.senderId === user?.uid;
                const isHostSender = msg.senderId === room.hostId;

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-violet-500/15 bg-violet-500/10 px-3 py-1.5 text-center text-[11px] text-violet-300 font-medium"
                    >
                      {msg.text}
                    </div>
                  );
                }

                const msgAvatarUrl =
                  msg.senderAvatar ||
                  usersAvatarMap[msg.senderId] ||
                  (isMe ? user?.avatar || user?.profileImage : null) ||
                  room.seats.find((s) => s.userId === msg.senderId)?.avatar ||
                  audience.find((a) => a.uid === msg.senderId)?.avatar ||
                  null;

                const isSenderVip = Boolean(
                  msg.senderIsVerified ||
                    vipUsersMap[msg.senderId] ||
                    (isMe && user?.isVerified) ||
                    room.seats.find((s) => s.userId === msg.senderId)?.isVerified ||
                    audience.find((a) => a.uid === msg.senderId)?.isVerified,
                );

                const emojiMatch = msg.text.match(/^\[EMOJI:([a-z0-9-]+)\]$/);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Sender Profile Picture in Room Chat (Steady circular golden border for VIP so chat NEVER shakes) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (msg.senderId && msg.senderId !== 'system') {
                          setSelectedProfileUid(msg.senderId);
                        }
                      }}
                      title={`بینینی پڕۆفایل و چاتکردن لەگەڵ ${msg.senderName}`}
                      className={`relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-[10px] font-bold text-white shadow ${
                        isSenderVip
                          ? 'border-2 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                          : 'border border-white/15'
                      }`}
                    >
                      <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                        {msgAvatarUrl ? (
                          <img
                            src={msgAvatarUrl}
                            alt={msg.senderName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (msg.senderName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      {isSenderVip && (
                        <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 shadow">
                          <Crown className="h-2 w-2 text-black fill-black" strokeWidth={3} />
                        </span>
                      )}
                    </button>

                    <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (msg.senderId && msg.senderId !== 'system') {
                              setSelectedProfileUid(msg.senderId);
                            }
                          }}
                          className={`text-[10px] font-bold transition hover:underline ${
                            isSenderVip ? 'text-amber-300' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {isMe ? 'You' : msg.senderName}
                        </button>
                        {isSenderVip && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-red-500/25 border border-amber-400/50 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                            <Crown className="h-2 w-2 text-amber-400 fill-amber-400" />
                            <span>VIP</span>
                          </span>
                        )}
                        {isHostSender && (
                          <span className="flex items-center gap-0.5 rounded bg-amber-400/20 px-1 py-0.2 text-[8px] font-bold text-amber-300">
                            <Crown className="h-2 w-2" /> HOST
                          </span>
                        )}
                      </div>
                      {emojiMatch ? (
                        <div className="py-1">
                          <AnimatedEmojiGraphic emojiId={emojiMatch[1]} size={56} />
                        </div>
                      ) : (
                        <div
                          className={`
                            rounded-2xl px-3 py-2 text-xs leading-relaxed
                            ${
                              isMe
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-sm'
                                : 'bg-white/[0.05] border border-white/[0.06] text-slate-200 rounded-tl-sm'
                            }
                          `}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(true)}
              title="ئیمۆجی جوڵاو (Animated Emojis)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-300 shadow-sm transition hover:bg-amber-500/30 active:scale-95"
            >
              <Smile className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a message to the room…"
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500 focus:bg-white/[0.06]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isSending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-transform active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>

      {/* ─────────────────────────────────────────────────────────
         BOTTOM CONTROL PANEL: Mic, Games, Music, Gifts, Leave
         ───────────────────────────────────────────────────────── */}
      <footer className="relative z-20 shrink-0 border-t border-white/[0.08] bg-surface-900/90 px-3 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Mic Quick Toggle + VIP Voice Changer Button */}
          {mySeat ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleMyMute}
                className={`
                  flex items-center justify-center gap-1 rounded-2xl px-2.5 py-2 text-xs font-semibold transition-all shadow-md active:scale-95
                  ${
                    mySeat.isMuted
                      ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20'
                  }
                `}
              >
                {mySeat.isMuted ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Unmute</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mute</span>
                  </>
                )}
              </button>

              {/* VIP Voice Changer Button (Normal / Child / Venom) */}
              <button
                onClick={() => setIsVoiceChangerOpen(true)}
                className={`flex items-center gap-1 rounded-2xl border px-2.5 py-2 text-xs font-black transition-all shadow-md active:scale-95 ${
                  mySeat.voiceEffect === 'venom'
                    ? 'border-purple-400/60 bg-gradient-to-r from-purple-900 to-rose-900 text-purple-200 shadow-purple-500/30'
                    : mySeat.voiceEffect === 'child'
                      ? 'border-pink-400/60 bg-gradient-to-r from-pink-500/30 to-amber-500/30 text-pink-200 shadow-pink-500/20'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                }`}
                title="VIP Voice Changer (گۆڕینی دەنگ: منداڵان / ڤینۆم)"
              >
                <span>
                  {mySeat.voiceEffect === 'venom'
                    ? '👹'
                    : mySeat.voiceEffect === 'child'
                      ? '👶'
                      : '🎙️'}
                </span>
                <span className="text-[11px]">
                  {mySeat.voiceEffect === 'venom'
                    ? 'Venom'
                    : mySeat.voiceEffect === 'child'
                      ? 'منداڵ'
                      : 'دەنگ'}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-400 text-[10px] bg-white/[0.02] border border-white/[0.05] rounded-2xl px-2 py-2">
              <Volume2 className="h-3 w-3 text-violet-400" />
              <span className="hidden xs:inline">Stage</span>
            </div>
          )}

          {/* VIP JACKAROO (2, 3, OR 4 PLAYERS) GAME BUTTON */}
          <button
            onClick={() => setIsJackarooOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/20 px-3 py-2 text-xs font-black text-amber-300 shadow-md shadow-amber-500/15 transition-transform active:scale-95"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-amber-400" />
            <span>جاکۆرۆ · Jackaroo</span>
            {activeJackarooGame && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* 3D ANIMATED EMOJIS BUTTON */}
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(true)}
            className="flex items-center gap-1 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-2 text-xs font-bold text-amber-300 shadow-sm transition-transform hover:bg-amber-500/25 active:scale-95"
            title="ئیمۆجی جوڵاو لەسەر کورسی (Animated Seat Emojis)"
          >
            <Smile className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xs:inline">Emoji</span>
          </button>

          {/* INTERACTIVE GIFTS BUTTON */}
          <button
            onClick={() => {
              setGiftRecipient(null);
              setIsGiftModalOpen(true);
            }}
            className="relative flex items-center gap-1 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95"
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Gifts</span>
          </button>

          {/* Quick Leave Seat button (if seated) */}
          {mySeat && (
            <button
              onClick={() => handleLeaveMySeat()}
              className="flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] active:scale-95"
              title="Leave current seat"
            >
              <PhoneOff className="h-3 w-3 text-rose-400" />
              <span>Leave Seat</span>
            </button>
          )}
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────
         MODAL 1: Seat Action Sheet (Mute/Unmute, Leave Seat, Gift)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isActionSheetOpen && selectedSeat && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm rounded-3xl border border-white/[0.1] bg-surface-800 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div
                  onClick={() => {
                    if (selectedSeat.userId) {
                      setIsActionSheetOpen(false);
                      setSelectedProfileUid(selectedSeat.userId);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2.5 group"
                >
                  <div
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 font-bold text-white ${
                      selectedSeat.isVerified || (selectedSeat.userId && vipUsersMap[selectedSeat.userId])
                        ? 'vip-fire-avatar'
                        : 'overflow-hidden'
                    }`}
                  >
                    <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                      {selectedSeat.avatar || (selectedSeat.userId ? usersAvatarMap[selectedSeat.userId] : null) ? (
                        <img
                          src={selectedSeat.avatar || (selectedSeat.userId ? usersAvatarMap[selectedSeat.userId] : '') || ''}
                          alt={selectedSeat.username || 'User'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        selectedSeat.username?.charAt(0) || 'U'
                      )}
                    </div>
                    {(selectedSeat.isVerified || (selectedSeat.userId && vipUsersMap[selectedSeat.userId])) && (
                      <span className="absolute -top-1.5 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                        <Crown className="h-2.5 w-2.5 text-black fill-black" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                        {selectedSeat.username}
                      </h3>
                      {(selectedSeat.isVerified || (selectedSeat.userId && vipUsersMap[selectedSeat.userId])) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
                          <Crown className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">Seat #{selectedSeat.seatNo} · کرتە بکە بۆ پڕۆفایل</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsActionSheetOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {selectedSeat.userId === user?.uid ? (
                  <>
                    <button
                      onClick={async () => {
                        await toggleSeatMute(room.id, selectedSeat.seatNo, !selectedSeat.isMuted);
                        setIsActionSheetOpen(false);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.05] py-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.1]"
                    >
                      {selectedSeat.isMuted ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                      {selectedSeat.isMuted ? 'Unmute My Mic' : 'Mute My Mic'}
                    </button>

                    <button
                      onClick={() => handleLeaveMySeat(selectedSeat.seatNo)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                    >
                      <PhoneOff className="h-4 w-4" />
                      Leave This Seat
                    </button>
                  </>
                ) : (
                  <>
                    {/* Admin Silent Voice Changer Override (Changes any member's voice without VIP or permission!) */}
                    {user.isAdmin && selectedSeat.userId && (
                      <div className="space-y-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 mb-2">
                        <div className="flex items-center justify-between text-[10px] font-black text-amber-300">
                          <span>🎙️ گۆڕینی دەنگی ئەندام (بێ مۆڵەت · ئەدمین)</span>
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[8px] uppercase">
                            {selectedSeat.voiceEffect || 'normal'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'normal', label: '🎙️ ئاسایی' },
                              { id: 'child', label: '👶 منداڵان' },
                              { id: 'venom', label: '👹 ڤینۆم' },
                            ] as const
                          ).map((vOpt) => {
                            const isAct = (selectedSeat.voiceEffect || 'normal') === vOpt.id;
                            return (
                              <button
                                key={vOpt.id}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await setSeatVoiceEffect(room.id, selectedSeat.seatNo, vOpt.id);
                                    await setAdminForcedVoice(selectedSeat.userId!, vOpt.id);
                                    setIsActionSheetOpen(false);
                                  } catch (err: any) {
                                    alert(err.message || 'نەتوانرا دەنگی ئەندام بگۆڕدرێت');
                                  }
                                }}
                                className={`rounded-xl py-2 text-[11px] font-black transition active:scale-95 ${
                                  isAct
                                    ? 'bg-amber-400 text-black shadow-md'
                                    : 'border border-white/10 bg-black/40 text-white hover:bg-white/10'
                                }`}
                              >
                                {vOpt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Host Moderation Controls (Room Host can mute/unmute or kick member) */}
                    {isHost && (
                      <div className="space-y-2 border-b border-white/[0.08] pb-3 mb-2">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 px-1">
                          <Crown className="h-3 w-3" />
                          <span>Host Moderation</span>
                        </div>

                        {/* Host Mute/Unmute Member Mic */}
                        <button
                          onClick={async () => {
                            try {
                              await toggleSeatMute(room.id, selectedSeat.seatNo, !selectedSeat.isMuted);
                              setIsActionSheetOpen(false);
                            } catch (err: any) {
                              alert(err.message || 'Failed to toggle member microphone.');
                            }
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all active:scale-95 ${
                            selectedSeat.isMuted
                              ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                          }`}
                        >
                          {selectedSeat.isMuted ? (
                            <>
                              <Mic className="h-4 w-4 text-emerald-400" />
                              <span>Unmute Member Mic</span>
                            </>
                          ) : (
                            <>
                              <MicOff className="h-4 w-4 text-rose-400" />
                              <span>Mute Member Mic</span>
                            </>
                          )}
                        </button>

                        {/* Host Kick from Seat */}
                        <button
                          onClick={async () => {
                            try {
                              await leaveSeat(room.id, selectedSeat.seatNo);
                              setIsActionSheetOpen(false);
                            } catch (err: any) {
                              alert(err.message || 'Failed to remove member from seat.');
                            }
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs font-semibold text-slate-300 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
                        >
                          <PhoneOff className="h-3.5 w-3.5 text-rose-400" />
                          <span>Kick from Seat</span>
                        </button>
                      </div>
                    )}

                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-center text-xs text-slate-400">
                      <p>
                        Mic Status:{' '}
                        <span className={selectedSeat.isMuted ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                          {selectedSeat.isMuted ? 'Muted' : 'Speaking / Active Mic'}
                        </span>
                      </p>
                    </div>

                    {/* View User Profile button */}
                    <button
                      onClick={() => {
                        const targetId = selectedSeat.userId!;
                        setIsActionSheetOpen(false);
                        setSelectedProfileUid(targetId);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.1]"
                    >
                      <UserIcon className="h-4 w-4 text-amber-400" />
                      <span>بینینی پڕۆفایل (View Profile)</span>
                    </button>

                    {/* Direct Message button for seated user */}
                    <button
                      onClick={() => {
                        setIsActionSheetOpen(false);
                        setActiveChatRecipient({
                          uid: selectedSeat.userId!,
                          username: selectedSeat.username || 'User',
                          avatar:
                            selectedSeat.avatar ||
                            (selectedSeat.userId ? usersAvatarMap[selectedSeat.userId] : undefined) ||
                            undefined,
                        });
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/15 py-3 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/25"
                    >
                      <MessageCircle className="h-4 w-4 text-cyan-400" />
                      <span>ناردنی نامەی تایبەتی · Chat with {selectedSeat.username}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsActionSheetOpen(false);
                        setGiftRecipient({
                          uid: selectedSeat.userId!,
                          username: selectedSeat.username || 'User',
                        });
                        setIsGiftModalOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 py-3 text-xs font-bold text-black shadow-md shadow-amber-500/20"
                    >
                      <Gift className="h-4 w-4" />
                      Send Gift to {selectedSeat.username}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 2: VIP Jackaroo Board & Card Game (2, 3, or 4 Players)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isJackarooOpen && (
          <JackarooGamePanel
            roomId={room.id}
            currentUser={user}
            activeGame={activeJackarooGame}
            isRoomHost={Boolean(isHost || user.isAdmin)}
            onClose={() => setIsJackarooOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 3: VIP Voice Changer Modal (Normal / Child / Venom)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isVoiceChangerOpen && mySeat && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setIsVoiceChangerOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-amber-500/35 bg-gradient-to-b from-[#1b1630] via-[#131022] to-[#0c0a16] p-5 shadow-[0_0_50px_rgba(245,158,11,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 text-lg shadow-lg">
                    🎙️
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>گۆڕینی دەنگی VIP</span>
                      <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      کاتێک مایکت کراوەیە دەنگت ڕاستەوخۆ دەگۆڕێت
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVoiceChangerOpen(false)}
                  className="rounded-full bg-white/5 p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!(user.isVerified || user.isAdmin) ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-2">
                  <Crown className="mx-auto h-8 w-8 text-amber-400" />
                  <p className="text-xs font-black text-amber-300">
                    ئەم تایبەتمەندییە تەنها بۆ ئەندامانی VIP بەردەستە!
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    کاتێک ئەدمین نیشانەی VIP ـت پێ دەبەخشێت، دەتوانیت دەنگی خۆت لە کاتی قسەکردندا بگۆڕیت بۆ دەنگی منداڵان 👶 یان ڤینۆم 👹.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {(
                    [
                      {
                        id: 'normal',
                        icon: '🎙️',
                        title: 'دەنگی ئاسایی (Normal)',
                        desc: 'دەنگی سروشتی و ڕاستەقینەی خۆت',
                        border: 'border-emerald-400/50 bg-emerald-500/15',
                      },
                      {
                        id: 'child',
                        icon: '👶',
                        title: 'دەنگی منداڵان (Child / Baby)',
                        desc: 'دەنگێکی ناسک و خۆشی منداڵانە لە کاتی قسەکردن',
                        border: 'border-pink-400/60 bg-gradient-to-r from-pink-500/20 to-amber-500/15',
                      },
                      {
                        id: 'venom',
                        icon: '👹',
                        title: 'دەنگی ڤینۆم (Venom Monster)',
                        desc: 'دەنگی قووڵ و ترسناکی دێوی ڤینۆم بە نەڕەی دووانە',
                        border: 'border-purple-400/60 bg-gradient-to-r from-purple-900/40 to-rose-900/30',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = (mySeat.voiceEffect || 'normal') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={async () => {
                          await handleChangeVoiceEffect(opt.id);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                          active
                            ? `${opt.border} ring-2 ring-amber-400 scale-[1.01] shadow-lg`
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{opt.icon}</span>
                          <div>
                            <p className="text-xs font-black text-white">{opt.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </div>
                        {active && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Self-Monitor Test Toggle */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-semibold">
                      🎧 تاقیکردنەوەی دەنگی خۆم (گوێگرتن):
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelfMonitor}
                      className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        isSelfMonitoring
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                          : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {isSelfMonitoring ? 'چالاکە (گوێم لێیە)' : 'ناچالاکە'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 4: Interactive Gift Store
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isGiftModalOpen && (
          <GiftStoreModal
            roomId={room.id}
            currentUser={user}
            seats={room.seats}
            initialRecipient={giftRecipient}
            onClose={() => {
              setIsGiftModalOpen(false);
              setGiftRecipient(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 5: Room Report Modal
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isRoomReportOpen && (
          <ReportModal
            reporterUid={user.uid}
            reporterName={user.username}
            targetId={room.id}
            targetType="room"
            targetName={room.roomName}
            onClose={() => setIsRoomReportOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 6: Private Direct Message Chat Panel
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeChatRecipient && (
          <PrivateChat
            currentUser={user}
            recipientUser={activeChatRecipient}
            onClose={() => setActiveChatRecipient(null)}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 6B: User Profile Card Inside Room (Click Profile -> Chat / Gift)
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProfileUid && (
          <UserProfileManager
            currentUser={user}
            targetUid={selectedProfileUid}
            onClose={() => setSelectedProfileUid(null)}
            onOpenPrivateChat={(recipient) => {
              setSelectedProfileUid(null);
              setActiveChatRecipient({
                uid: recipient.uid,
                username: recipient.username,
                avatar: recipient.avatar ?? undefined,
              });
            }}
            onOpenGiftStore={(target) => {
              setSelectedProfileUid(null);
              setGiftRecipient(target);
              setIsGiftModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 7: Host Controls & Moderation Panel
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isHostControlsOpen && (isHost || user.isAdmin) && (
          <HostControlsPanel
            room={room}
            currentUser={user}
            activeJackarooGame={activeJackarooGame}
            onOpenMusicPlayer={() => setIsMusicPanelVisible(true)}
            onClose={() => setIsHostControlsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
         MODAL 8: Room Friends Invitation Modal
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <RoomInviteModal
            room={room}
            currentUser={user}
            onClose={() => setIsInviteModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 3D Animated Seat & Room Emoji Picker Drawer Modal */}
      <SeatEmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectEmoji={handleSelectEmoji}
      />

      {/* Live Incoming Direct Message & Activity Notification Toast (Inside Room) */}
      <IncomingChatToast
        currentUser={user}
        activeChatRecipientUid={activeChatRecipient?.uid || null}
        onOpenChat={(recipient) => setActiveChatRecipient(recipient)}
      />

      {/* Floating Animated Hearts Reaction (TikTok Style) */}
      <FloatingHearts />
    </div>
  );
}
