import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Compass,
  Wallet,
  Settings,
  LogOut,
  Radio,
  Plus,
  Flame,
  Gamepad2,
  Music,
  Coffee,
  MessageSquare,
  Sparkles,
  Coins,
  ShieldCheck,
  Headphones,
  Lock,
  ArrowRight,
  Eye,
  Send,
  Heart,
  Share2,
  Trash2,
  Clock,
  Check,
  Calendar,
  AlertCircle,
  FileText,
  User as UserIcon,
  ChevronRight,
  RefreshCw,
  Search,
  Bell,
  Trophy,
  ShoppingBag,
  ShieldAlert,
  BadgeCheck,
  Crown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import type { Room, RoomCategory, Post, ProfileVisitor, User } from '../types';
import {
  subscribeToFeaturedRooms,
  createRoom,
  createPost,
  toggleLikePost,
  deletePost,
  subscribeToPosts,
  subscribeToUserVisitors,
  subscribeToUnreadCount,
  subscribeToUserInbox,
} from '../services';

import UserProfileManager from './UserProfileManager';
import PrivateChat from './PrivateChat';
import ChatCenterModal from './ChatCenterModal';
import UserSearch from './UserSearch';
import NotificationCenter from './NotificationCenter';
import Leaderboard from './Leaderboard';
import ArenaShop from './ArenaShop';
import StoriesBar from './StoriesBar';
import SettingsModal from './SettingsModal';

const CATEGORIES: { label: string; value: RoomCategory | 'All'; icon: React.ElementType; color: string }[] = [
  { label: 'All Arenas', value: 'All', icon: Flame, color: 'text-amber-400' },
  { label: 'Gaming', value: 'Gaming', icon: Gamepad2, color: 'text-emerald-400' },
  { label: 'Voice Chat', value: 'Voice Chat', icon: MessageSquare, color: 'text-cyan-400' },
  { label: 'Music & Vibes', value: 'Music', icon: Music, color: 'text-rose-400' },
  { label: 'Chill Lounge', value: 'Chill', icon: Coffee, color: 'text-violet-400' },
];

const ROOM_NAME_SUGGESTIONS = [
  'Grand Masters Arena',
  'Late Night Chill & Talk',
  'Arabic Voice Lounge',
  'High-Stakes Dice Arena',
  'Lo-Fi Beats & Chat',
];

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getAccountAge(createdAt: number): string {
  const diffMs = Date.now() - (createdAt || Date.now());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Joined today';
  if (diffDays === 1) return 'Member for 1 day';
  if (diffDays < 30) return `Member for ${diffDays} days`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Member for 1 month';
  if (diffMonths < 12) return `Member for ${diffMonths} months`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? 'Member for 1 year' : `Member for ${diffYears} years`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active navigation tab
  const [navTab, setNavTab] = useState<'dashboard' | 'explore' | 'wallet' | 'settings'>('dashboard');

  // Strict 4-room directory state
  const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory | 'All'>('All');

  // Posts Feed State
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [publishPostError, setPublishPostError] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Visitors State for Right Sidebar
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);

  // Create Room Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState<RoomCategory>('Gaming');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);

  // Private Room Unlock State
  const [lockedRoomTarget, setLockedRoomTarget] = useState<Room | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Profile Manager Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);

  // Private Chat (DM) State
  const [activeChatRecipient, setActiveChatRecipient] = useState<{
    uid: string;
    username: string;
    avatar?: string;
  } | null>(null);

  // Wallet Modal State
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // New Mega Feature Modals State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatCenterOpen, setIsChatCenterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [inboxThreadsCount, setInboxThreadsCount] = useState(0);

  // Unread Notifications live count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadNotifsCount(count);
    });
    return () => unsub();
  }, [user?.uid]);

  // Live active chat threads count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserInbox(user.uid, (threads) => {
      setInboxThreadsCount(threads.length);
    });
    return () => unsub();
  }, [user?.uid]);

  // 1. Subscribe to exactly 4 active rooms using .limitToFirst(4)
  useEffect(() => {
    const unsubscribe = subscribeToFeaturedRooms(4, (rooms) => {
      setFeaturedRooms(rooms);
    });
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to real-time posts feed
  useEffect(() => {
    const unsubscribe = subscribeToPosts((allPosts) => {
      setPosts(allPosts);
    });
    return () => unsubscribe();
  }, []);

  // 3. Subscribe to current user's profile visitors
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToUserVisitors(user.uid, (updatedVisitors) => {
      setVisitors(updatedVisitors);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Filtered rooms based on selected category (strictly at most 4)
  const displayRooms = useMemo(() => {
    if (selectedCategory === 'All') return featuredRooms.slice(0, 4);
    const filtered = featuredRooms.filter(
      (r) => (r.category || 'Voice Chat').toLowerCase() === selectedCategory.toLowerCase(),
    );
    return (filtered.length > 0 ? filtered : featuredRooms).slice(0, 4);
  }, [featuredRooms, selectedCategory]);

  // Level & XP Progress Calculations
  const xpInCurrentLevel = (user?.xp || 0) % 1000;
  const xpProgressPercentage = Math.min(100, Math.max(8, Math.round((xpInCurrentLevel / 1000) * 100)));

  // Handlers
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newRoomName.trim()) {
      setCreateRoomError('Please provide an arena title.');
      return;
    }
    if (isPrivate && !roomPassword.trim()) {
      setCreateRoomError('Please enter a password for private arena.');
      return;
    }

    setIsCreatingRoom(true);
    setCreateRoomError(null);

    try {
      const roomId = await createRoom({
        roomName: newRoomName.trim(),
        hostUser: {
          uid: user.uid,
          username: user.username,
          avatar: user.avatar,
        },
        category: newRoomCategory,
        isPrivate,
        password: isPrivate ? roomPassword.trim() : '',
      });

      setIsCreateModalOpen(false);
      setNewRoomName('');
      setRoomPassword('');
      setIsPrivate(false);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setCreateRoomError(err.message || 'Failed to create room.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleRoomClick = (room: Room) => {
    if (room.isPrivate && room.password && room.hostId !== user?.uid) {
      setLockedRoomTarget(room);
      setEnteredPassword('');
      setPasswordError(false);
    } else {
      navigate(`/room/${room.id}`);
    }
  };

  const handleUnlockRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockedRoomTarget) return;

    if (enteredPassword.trim() === lockedRoomTarget.password) {
      navigate(`/room/${lockedRoomTarget.id}`);
    } else {
      setPasswordError(true);
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanContent = newPostContent.trim();
    if (!cleanContent) return;

    setIsPublishingPost(true);
    setPublishPostError(null);

    try {
      await createPost({
        authorUid: user.uid,
        authorName: user.username,
        authorAvatar: user.avatar || user.profileImage || null,
        content: cleanContent,
      });
      setNewPostContent('');
    } catch (err: any) {
      setPublishPostError(err.message || 'Failed to broadcast post.');
    } finally {
      setIsPublishingPost(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) return;
    try {
      await toggleLikePost(postId, user.uid);
    } catch (err) {
      console.error('Like toggle error:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await deletePost(postId, user.uid);
    } catch (err: any) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  const handleSharePost = (postId: string) => {
    const shareUrl = `${window.location.origin}/#post-${postId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const openUserProfile = (uid: string) => {
    setSelectedProfileUid(uid);
    setIsProfileModalOpen(true);
  };

  const getOccupiedCount = (room: Room) => {
    if (!room.seats) return 0;
    return room.seats.filter((s) => s.userId !== null).length;
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* ══════════════════════════════════════════════════════════════
          1. LEFT NAVIGATION SIDEBAR (Desktop Workspace Panel)
          ══════════════════════════════════════════════════════════════ */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-slate-950/90 p-5 backdrop-blur-2xl md:flex">
        <div className="space-y-8">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 shadow-xl shadow-amber-500/20">
              <Radio className="h-6 w-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-base font-black tracking-wider text-white">
                  SSMR ARENA
                </span>
                <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black tracking-widest text-amber-400 uppercase border border-amber-400/20">
                  LIVE
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500">Real-Time Social Core</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setNavTab('dashboard')}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                navTab === 'dashboard'
                  ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setNavTab('explore');
                setSelectedCategory('All');
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                navTab === 'explore'
                  ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Explore Arenas</span>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <Search className="h-4 w-4" />
              <span>Discover Users</span>
            </button>

            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Hall of Fame</span>
            </button>

            <button
              onClick={() => setIsShopOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <ShoppingBag className="h-4 w-4 text-purple-400" />
              <span>Armory &amp; Vault</span>
            </button>

            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </div>
              {unreadNotifsCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsChatCenterOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <span>Direct Chat</span>
              </div>
              {inboxThreadsCount > 0 && (
                <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                  {inboxThreadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4" />
                <span>Wallet</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-amber-300">
                {(user.coins ?? 0).toLocaleString()}
              </span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Host Quick Action Button */}
        <div className="space-y-3 pt-6 border-t border-slate-800/60">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>HOST ARENA</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          2. CENTER MAIN STREAM (The Core Content Workspace)
          ══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-24 md:pb-8">
        {/* Mobile Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500 text-black shadow-md">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-display text-sm font-black text-white">VOICE ARENA</h1>
              <span className="text-[9px] text-slate-400 uppercase font-bold">Live Stream</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-slate-300"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-slate-300"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 text-[8px] font-bold text-white flex items-center justify-center">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsChatCenterOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-cyan-400"
              title="Direct Chat"
            >
              <MessageSquare className="h-4 w-4" />
              {inboxThreadsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-cyan-500 text-[8px] font-bold text-black flex items-center justify-center">
                  {inboxThreadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300"
            >
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{(user.coins ?? 0).toLocaleString()}</span>
            </button>

            <button
              onClick={() => openUserProfile(user.uid)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-xs font-bold text-white"
            >
              {user.avatar || user.profileImage ? (
                <img src={user.avatar || user.profileImage} alt={user.username} className="h-full w-full object-cover" />
              ) : (
                (user.username || 'U').charAt(0).toUpperCase()
              )}
            </button>
          </div>
        </div>

        {/* 24-Hour Stories Bar */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-3.5 backdrop-blur-xl">
          <StoriesBar currentUser={user} />
        </section>

        {/* Category Filter Pills Bar */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5">
            {CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              const isSelected = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'border border-slate-800/80 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <IconComp className={`h-3.5 w-3.5 ${cat.color}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            <span>Launch Stage</span>
          </button>
        </div>

        {/* ── SECTION 1: STRICT 4-ROOM DIRECTORY (SPOTLIGHT GRID) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              <h2 className="font-display text-xs font-bold tracking-wider text-slate-300 uppercase">
                Active Arenas (Strict 4 Directory)
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">Firebase Real-Time Listeners</span>
          </div>

          {displayRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-12 text-center">
              <Headphones className="h-8 w-8 text-slate-600 mb-2" />
              <h3 className="text-xs font-bold text-white">No Live Rooms Found</h3>
              <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                Be the pioneer host to launch an 8-seat stage arena with integrated games and voice streaming!
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3.5 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black"
              >
                Host First Arena
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {displayRooms.map((room) => {
                const occupiedCount = getOccupiedCount(room);
                const isLocked = Boolean(room.isPrivate && room.password);

                return (
                  <motion.div
                    key={room.id}
                    whileHover={{ y: -3 }}
                    onClick={() => handleRoomClick(room)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50 p-4.5 shadow-xl backdrop-blur-xl transition hover:border-amber-400/40 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 uppercase border border-white/[0.06]">
                          {room.category || 'Voice Chat'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isLocked && <Lock className="h-3.5 w-3.5 text-rose-400" />}
                          <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{occupiedCount}/8</span>
                          </div>
                        </div>
                      </div>

                      <h3 className="mt-2 font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {room.roomName}
                      </h3>
                    </div>

                    {/* Mic Stage Seat Pill Indicators */}
                    <div className="my-3.5 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-2.5">
                      <div className="grid grid-cols-8 gap-1">
                        {Array.from({ length: 8 }).map((_, idx) => {
                          const isOccupied = room.seats && room.seats[idx]?.userId;
                          return (
                            <div
                              key={idx}
                              className={`h-1.5 rounded-full ${
                                isOccupied
                                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                  : 'bg-white/10'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2 truncate max-w-[140px]">
                        <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-violet-600/40 text-[9px] font-black text-violet-200">
                          {room.hostName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{room.hostName}</span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold group-hover:translate-x-1 transition-transform">
                        <span>JOIN</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECTION 2: GLOBAL MICRO-BLOGGING POST FEED ── */}
        <section className="space-y-4 pt-2">
          {/* Post Creation Standalone Textarea */}
          <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl sm:p-5">
            <div className="flex items-start gap-3">
              <div
                onClick={() => openUserProfile(user.uid)}
                className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-xs font-black text-black shadow-md transition hover:scale-105"
              >
                {user.avatar || user.profileImage ? (
                  <img
                    src={user.avatar || user.profileImage}
                    alt={user.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (user.username || 'U').charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1">
                <form onSubmit={handlePublishPost} className="space-y-2.5">
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Broadcast an update, match challenge, or thought across the arena…"
                    className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                  />

                  {publishPostError && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{publishPostError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-500">
                      {newPostContent.length}/400
                    </span>

                    <button
                      type="submit"
                      disabled={!newPostContent.trim() || isPublishingPost}
                      className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isPublishingPost ? 'Broadcasting…' : 'POST'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Social Post Feed Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-xs font-bold tracking-wider text-slate-300 uppercase">
                  Global Stream ({posts.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500">Real-Time Firebase Feed</span>
            </div>

            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-12 text-center">
                <MessageSquare className="h-7 w-7 text-slate-600 mb-2" />
                <p className="text-xs font-bold text-white">No Posts Broadcasted Yet</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Be the first user to publish a message on the global board!
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {posts.map((post) => {
                  const isAuthor = post.authorUid === user.uid;
                  const isLiked = Boolean(post.likedBy && post.likedBy[user.uid]);
                  const likesCount = post.likesCount || 0;

                  return (
                    <motion.article
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-4 shadow-lg backdrop-blur-md transition hover:border-slate-700/80 sm:p-5"
                    >
                      {/* Post Author Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div
                          onClick={() => openUserProfile(post.authorUid)}
                          className="group flex cursor-pointer items-center gap-2.5"
                        >
                          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md">
                            {post.authorAvatar ? (
                              <img
                                src={post.authorAvatar}
                                alt={post.authorName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              post.authorName.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                                {post.authorName}
                              </h4>
                              {isAuthor && (
                                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-semibold text-slate-400">
                                  You
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimeAgo(post.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        {isAuthor && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            title="Delete post"
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Post Content */}
                      <p className="mt-3 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {/* Post Actions Bar */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs text-slate-400">
                        <button
                          onClick={() => handleToggleLike(post.id)}
                          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-90 ${
                            isLiked
                              ? 'border border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-sm shadow-rose-500/10'
                              : 'hover:bg-white/[0.04] hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`h-4 w-4 transition-colors ${
                              isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                            }`}
                          />
                          <span>{likesCount}</span>
                        </button>

                        <button
                          onClick={() => handleSharePost(post.id)}
                          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
                        >
                          {copiedPostId === post.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Link Copied</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="text-[11px]">Share</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════════════════════════════
          3. RIGHT CONTROL SIDEBAR (User Summary & Overview)
          ══════════════════════════════════════════════════════════════ */}
      <aside className="hidden w-84 shrink-0 flex-col overflow-y-auto border-l border-slate-800/80 bg-slate-950/80 p-5 space-y-5 backdrop-blur-2xl xl:flex">
        {/* User Identity Card */}
        <div className={`overflow-hidden rounded-3xl border bg-slate-900/50 shadow-xl transition-all ${
          user.isVerified
            ? 'border-amber-500/40 shadow-amber-500/10 vip-border-glow'
            : 'border-slate-800/80'
        }`}>
          {/* VIP / Custom Cover Preview if verified or has cover */}
          {(user.profileCover || user.isVerified) && (
            <div
              className={`relative h-20 w-full overflow-hidden transition-all duration-500 ${
                user.isVerified ? 'vip-animated-cover vip-shine-effect' : ''
              }`}
              style={
                user.profileCover
                  ? user.profileCover.startsWith('http') || user.profileCover.startsWith('data:')
                    ? { backgroundImage: `url(${user.profileCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: user.profileCover }
                  : { background: 'linear-gradient(-45deg, #78350f 0%, #b45309 25%, #fef08a 50%, #d97706 75%, #451a03 100%)' }
              }
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950" />
              {user.isVerified && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-400/50 text-amber-300 shadow-md">
                  <Crown className="h-3 w-3 text-amber-400 fill-amber-400 vip-crown-animation" />
                  <span className="text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">VIP</span>
                </div>
              )}
            </div>
          )}

          <div className={`p-5 ${user.profileCover || user.isVerified ? '-mt-6 relative z-10 pt-0' : ''}`}>
            <div className="flex items-start gap-3.5">
              <div
                onClick={() => openUserProfile(user.uid)}
                className={`relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl p-0.5 shadow-xl transition hover:scale-105 ring-2 ring-slate-950 ${
                  user.isVerified
                    ? 'bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 shadow-amber-500/30 vip-border-glow'
                    : 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 shadow-amber-500/15'
                }`}
              >
                {user.isVerified && (
                  <div className="absolute -top-2.5 -right-1 z-20 pointer-events-none">
                    <Crown className="h-5 w-5 text-amber-400 fill-amber-400 vip-crown-animation drop-shadow-[0_2px_6px_rgba(251,191,36,0.8)]" />
                  </div>
                )}
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
                  {user.avatar || user.profileImage ? (
                    <img
                      src={user.avatar || user.profileImage}
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-xl font-black text-amber-300">
                      {(user.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display text-base font-black text-white">
                    {user.username}
                  </h3>
                  {user.isVerified && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-black text-amber-300 uppercase">
                        <Crown className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                        VIP
                      </span>
                      <span title="Verified Elite Profile" className="inline-flex items-center">
                        <BadgeCheck
                          size={15}
                          className="text-sky-400 fill-sky-400/20 shrink-0"
                        />
                      </span>
                    </div>
                  )}
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                </div>
                <p className="text-[11px] text-slate-400 italic line-clamp-2">
                  "{user.bio || 'Exploring the Live Voice Arena.'}"
                </p>
              </div>
            </div>

          {/* Account Age Counter */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400 font-medium">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span>{getAccountAge(user.createdAt)}</span>
          </div>

          {/* Dynamic Tier Level & XP Progress Percentage Bar */}
          <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-purple-300">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Level {user.level || 1} Tier</span>
              </div>
              <span className="font-mono text-amber-300 text-[11px]">{xpProgressPercentage}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgressPercentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 to-purple-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{xpInCurrentLevel} XP</span>
              <span>1000 XP next tier</span>
            </div>
          </div>

          {/* Live Wallet Balance */}
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">Wallet Balance</span>
            </div>
            <span className="font-mono text-sm font-black text-amber-300">
              {(user.coins ?? 0).toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => openUserProfile(user.uid)}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-bold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-300"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>Edit Profile Identity</span>
          </button>
        </div>
      </div>

        {/* Recent Profile Visitors Panel */}
        <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Eye className="h-4 w-4 text-amber-400" />
              <h4 className="font-display text-xs font-bold uppercase tracking-wider">
                Profile Visitors ({visitors.length})
              </h4>
            </div>
            <span className="text-[9px] text-slate-500">Live Telemetry</span>
          </div>

          {visitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
              No recent visitors logged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {visitors.slice(0, 5).map((visitor, idx) => (
                <div
                  key={`${visitor.visitorUid}-${visitor.timestamp}-${idx}`}
                  onClick={() => openUserProfile(visitor.visitorUid)}
                  className="flex items-center justify-between rounded-2xl border border-slate-800/40 bg-slate-950/40 p-2.5 transition hover:border-amber-400/30 hover:bg-slate-900 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-violet-600 text-[10px] font-black text-white">
                      {visitor.avatar ? (
                        <img src={visitor.avatar} alt={visitor.visitorName} className="h-full w-full object-cover" />
                      ) : (
                        visitor.visitorName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[100px]">
                      {visitor.visitorName}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-medium">
                    {formatTimeAgo(visitor.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          4. MOBILE BOTTOM NAVIGATION BAR
          ══════════════════════════════════════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-800/80 bg-slate-950/95 py-2.5 backdrop-blur-xl px-2 md:hidden">
        <button
          onClick={() => setNavTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            navTab === 'dashboard' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Arena</span>
        </button>

        <button
          onClick={() => {
            setNavTab('explore');
            setSelectedCategory('All');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            navTab === 'explore' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Explore</span>
        </button>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/25 -mt-4"
        >
          <Plus className="h-6 w-6" />
        </button>

        <button
          onClick={() => setIsWalletModalOpen(true)}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            navTab === 'wallet' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Wallet className="h-5 w-5" />
          <span>Wallet</span>
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500"
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </nav>

      {/* ── CREATE ARENA MODAL ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-black shadow-lg">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-sm font-bold text-white tracking-wide">
                      LAUNCH VOICE ARENA
                    </h2>
                    <p className="text-[10px] font-medium text-amber-400 uppercase">
                      Instant 8-Seat Synchronized Room
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:text-white"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              {createRoomError && (
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {createRoomError}
                </div>
              )}

              <form onSubmit={handleCreateRoom} className="mt-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Arena Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Arabic Voice Lounge"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ROOM_NAME_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setNewRoomName(sug)}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:border-amber-400/30 hover:text-amber-300"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Select Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { cat: 'Gaming' as RoomCategory, label: 'Gaming', icon: Gamepad2 },
                      { cat: 'Voice Chat' as RoomCategory, label: 'Voice Chat', icon: MessageSquare },
                      { cat: 'Music' as RoomCategory, label: 'Music & DJ', icon: Music },
                      { cat: 'Chill' as RoomCategory, label: 'Chill Lounge', icon: Coffee },
                    ].map(({ cat, label, icon: IconComp }) => {
                      const isSelected = newRoomCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewRoomCategory(cat)}
                          className={`flex items-center gap-2 rounded-2xl border p-3 transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400/15 text-amber-300 shadow-md shadow-amber-500/10'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/40'
                          }`}
                        >
                          <IconComp className="h-4 w-4" />
                          <span className="text-xs font-bold">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Private room toggle */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Private Arena</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`h-5 w-9 rounded-full transition-colors relative ${
                        isPrivate ? 'bg-amber-400' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-black transition-transform ${
                          isPrivate ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {isPrivate && (
                    <input
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Enter room password"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingRoom}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 py-3.5 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{isCreatingRoom ? 'Launching Arena…' : 'LAUNCH LIVE ARENA'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── PRIVATE ROOM PASSWORD PROMPT MODAL ── */}
      <AnimatePresence>
        {lockedRoomTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <h3 className="font-display text-xs font-bold text-white uppercase">
                    Locked Arena
                  </h3>
                </div>
                <button
                  onClick={() => setLockedRoomTarget(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleUnlockRoom} className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">
                  Enter password to enter <strong>{lockedRoomTarget.roomName}</strong>:
                </p>

                <input
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  placeholder="Arena Password"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                />

                {passwordError && (
                  <p className="text-[11px] text-rose-400 font-medium">Incorrect password. Please try again.</p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20"
                >
                  Unlock & Join
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── USER PROFILE & VISITOR TELEMETRY MODAL ── */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <UserProfileManager
            currentUser={user}
            targetUid={selectedProfileUid}
            onClose={() => {
              setIsProfileModalOpen(false);
              setSelectedProfileUid(null);
            }}
            onOpenPrivateChat={(recipient) => {
              setIsProfileModalOpen(false);
              setSelectedProfileUid(null);
              setActiveChatRecipient({
                uid: recipient.uid,
                username: recipient.username,
                avatar: recipient.avatar ?? undefined,
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── PRIVATE DIRECT MESSAGE CHAT PANEL ── */}
      <AnimatePresence>
        {activeChatRecipient && user && (
          <PrivateChat
            currentUser={user}
            recipientUser={activeChatRecipient}
            onClose={() => setActiveChatRecipient(null)}
          />
        )}
      </AnimatePresence>

      {/* ── QUICK WALLET MODAL ── */}
      <AnimatePresence>
        {isWalletModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                <Wallet className="h-7 w-7" />
              </div>

              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                Arena Vault Balance
              </h3>
              <div className="mt-2 font-mono text-3xl font-black text-amber-300">
                {(user.coins ?? 0).toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Gold coins can be used in 1v1 Dice Battles, 4-Player Board Battles, and Luxury Animated Stage Gifts.
              </p>

              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="mt-6 w-full rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20"
              >
                Close Vault
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── USER SEARCH MODAL ── */}
      <AnimatePresence>
        {isSearchOpen && (
          <UserSearch
            currentUser={user}
            onClose={() => setIsSearchOpen(false)}
            onOpenProfile={(uid) => openUserProfile(uid)}
            onOpenDirectMessage={(recipient) => {
              setIsSearchOpen(false);
              setActiveChatRecipient({
                uid: recipient.uid,
                username: recipient.username,
                avatar: recipient.avatar,
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── DIRECT CHAT & MESSAGES CENTER MODAL ── */}
      <AnimatePresence>
        {isChatCenterOpen && user && (
          <ChatCenterModal
            currentUser={user}
            onClose={() => setIsChatCenterOpen(false)}
            onSelectUser={(recipient) => {
              setIsChatCenterOpen(false);
              setActiveChatRecipient({
                uid: recipient.uid,
                username: recipient.username,
                avatar: recipient.avatar ?? undefined,
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── NOTIFICATION CENTER SLIDER ── */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <NotificationCenter
            currentUid={user.uid}
            onClose={() => setIsNotificationsOpen(false)}
            onOpenProfile={(uid) => openUserProfile(uid)}
          />
        )}
      </AnimatePresence>

      {/* ── LEADERBOARD HALL OF FAME ── */}
      <AnimatePresence>
        {isLeaderboardOpen && (
          <Leaderboard
            onClose={() => setIsLeaderboardOpen(false)}
            onOpenProfile={(uid) => openUserProfile(uid)}
          />
        )}
      </AnimatePresence>

      {/* ── ARENA SHOP & VAULT ── */}
      <AnimatePresence>
        {isShopOpen && (
          <ArenaShop
            currentUser={user}
            onClose={() => setIsShopOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SYSTEM SETTINGS & SIGN OUT MODAL ── */}
      <AnimatePresence>
        {isSettingsOpen && user && (
          <SettingsModal
            currentUser={user}
            onClose={() => setIsSettingsOpen(false)}
            onLogout={logout}
            onOpenEditProfile={() => openUserProfile(user.uid)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
