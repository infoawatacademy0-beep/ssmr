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
  HeartHandshake,
  Users,
  UserCheck,
  X,
  Mic,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import {
  formatCoinsK,
  getVipAvatarClass,
  type Room,
  type RoomCategory,
  type Post,
  type ProfileVisitor,
  type User,
} from '../types';
import { AnimatedThemeOverlay } from './AnimatedThemeEffect';
import {
  subscribeToRoomsList,
  subscribeToFeaturedRooms,
  createRoom,
  createPost,
  toggleLikePost,
  deletePost,
  subscribeToPosts,
  subscribeToUserVisitors,
  subscribeToUnreadCount,
  subscribeToUserInbox,
  subscribeToFollowersCount,
  subscribeToFollowingCount,
  subscribeToFriendsCount,
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
import FriendsModal from './FriendsModal';
import IncomingChatToast from './IncomingChatToast';
import PostCommentsSection from './PostCommentsSection';
import { useLanguage } from '../contexts';

const CATEGORIES: { label: string; value: RoomCategory | 'All'; icon: React.ElementType; color: string }[] = [
  { label: 'هەموو ژوورەکان', value: 'All', icon: Flame, color: 'text-amber-400' },
  { label: 'یارییەکان', value: 'Gaming', icon: Gamepad2, color: 'text-emerald-400' },
  { label: 'چاتی دەنگی', value: 'Voice Chat', icon: MessageSquare, color: 'text-cyan-400' },
  { label: 'میوزیک و گۆرانی', value: 'Music', icon: Music, color: 'text-rose-400' },
  { label: 'هاوڕێیەتی و پشوو', value: 'Chill', icon: Coffee, color: 'text-violet-400' },
];

const ROOM_NAME_SUGGESTIONS = [
  { ku: 'دیوەخانی هاوڕێیان', en: 'Friends Lounge' },
  { ku: 'شەوانی کوردستان و چات', en: 'Kurdistan Night Chat' },
  { ku: 'ژووری دەنگی گەنجان', en: 'Youth Voice Room' },
  { ku: 'گۆڕەپانی جاکۆرۆ و یاری', en: 'Jackaroo & Gaming Arena' },
  { ku: 'ژووری میوزیک و گۆرانی', en: 'Music & Song Lounge' },
];

function formatTimeAgo(timestamp: number, isEn: boolean = false): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return isEn ? 'Just now' : 'هەر ئێستا';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} خولەک لەمەوبەر`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return isEn ? `${diffHr}h ago` : `${diffHr} کاتژمێر لەمەوبەر`;
  const diffDays = Math.floor(diffHr / 24);
  return isEn ? `${diffDays}d ago` : `${diffDays} ڕۆژ لەمەوبەر`;
}

function getAccountAge(createdAt: number, isEn: boolean = false): string {
  const diffMs = Date.now() - (createdAt || Date.now());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return isEn ? 'Joined today' : 'ئەمڕۆ بەشداربووە';
  if (diffDays === 1) return isEn ? 'Member for 1 day' : 'ئەندامە بۆ ١ ڕۆژ';
  if (diffDays < 30) return isEn ? `Member for ${diffDays} days` : `ئەندامە بۆ ${diffDays} ڕۆژ`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return isEn ? 'Member for 1 month' : 'ئەندامە بۆ ١ مانگ';
  if (diffMonths < 12) return isEn ? `Member for ${diffMonths} months` : `ئەندامە بۆ ${diffMonths} مانگ`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1
    ? (isEn ? 'Member for 1 year' : 'ئەندامە بۆ ١ ساڵ')
    : (isEn ? `Member for ${diffYears} years` : `ئەندامە بۆ ${diffYears} ساڵ`);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { language, t, tr, isRTL } = useLanguage();
  const isEn = language === 'en';
  const navigate = useNavigate();

  // Active navigation tab
  const [navTab, setNavTab] = useState<'dashboard' | 'explore' | 'wallet' | 'settings'>('dashboard');

  // Strict 4-room directory & Explore Arenas state
  const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory | 'All'>('All');
  const [exploreSearchQuery, setExploreSearchQuery] = useState('');

  // Posts Feed State
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [publishPostError, setPublishPostError] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [expandedCommentsPostIds, setExpandedCommentsPostIds] = useState<Record<string, boolean>>({});

  const toggleComments = (postId: string) => {
    setExpandedCommentsPostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

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
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [inboxThreadsCount, setInboxThreadsCount] = useState(0);

  // Live Followers, Following & Friends counts
  useEffect(() => {
    if (!user?.uid) return;
    const unsubFollowers = subscribeToFollowersCount(user.uid, setFollowersCount);
    const unsubFollowing = subscribeToFollowingCount(user.uid, setFollowingCount);
    const unsubFriends = subscribeToFriendsCount(user.uid, setFriendsCount);

    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubFriends();
    };
  }, [user?.uid]);

  // Unread Notifications live count (respects Activity Notifications toggle)
  useEffect(() => {
    if (!user?.uid) return;
    let latestCount = 0;
    const applyCount = () => {
      const enabled = localStorage.getItem('ssmr_push_notifs') !== 'false';
      setUnreadNotifsCount(enabled ? latestCount : 0);
    };
    const unsub = subscribeToUnreadCount(user.uid, (count) => {
      latestCount = count;
      applyCount();
    });
    window.addEventListener('ssmr-settings-changed', applyCount);
    return () => {
      unsub();
      window.removeEventListener('ssmr-settings-changed', applyCount);
    };
  }, [user?.uid]);

  // Live active chat threads count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserInbox(user.uid, (threads) => {
      setInboxThreadsCount(threads.length);
    });
    return () => unsub();
  }, [user?.uid]);

  // 1. Subscribe to all live voice rooms for Explore & Dashboard
  useEffect(() => {
    const unsubscribe = subscribeToRoomsList((rooms) => {
      setAllRooms(rooms);
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

  // Filtered rooms for Dashboard Spotlight (strictly at most 4)
  const displayRooms = useMemo(() => {
    if (selectedCategory === 'All') return featuredRooms.slice(0, 4);
    const filtered = featuredRooms.filter(
      (r) => (r.category || 'Voice Chat').toLowerCase() === selectedCategory.toLowerCase(),
    );
    return (filtered.length > 0 ? filtered : featuredRooms).slice(0, 4);
  }, [featuredRooms, selectedCategory]);

  // Filtered rooms for Explore Arenas view (All Matching Rooms)
  const filteredExploreRooms = useMemo(() => {
    let list = allRooms;
    if (selectedCategory !== 'All') {
      list = list.filter(
        (r) => (r.category || 'Voice Chat').toLowerCase() === selectedCategory.toLowerCase(),
      );
    }
    if (exploreSearchQuery.trim()) {
      const q = exploreSearchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.roomName.toLowerCase().includes(q) ||
          r.hostName.toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allRooms, selectedCategory, exploreSearchQuery]);

  // Level & XP Progress Calculations
  const xpInCurrentLevel = (user?.xp || 0) % 1000;
  const xpProgressPercentage = Math.min(100, Math.max(8, Math.round((xpInCurrentLevel / 1000) * 100)));

  // Handlers
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newRoomName.trim()) {
      setCreateRoomError(tr('تکایە ناوی ژوور بنووسە.', 'Please enter an arena name.'));
      return;
    }
    if (isPrivate && !roomPassword.trim()) {
      setCreateRoomError(tr('تکایە وشەی نهێنی بۆ ژوورە تایبەتەکە دابنێ.', 'Please enter a password for the private arena.'));
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
          avatar: user.avatar || user.profileImage || '',
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
      setCreateRoomError(err.message ? t(err.message) : tr('نەتوانرا ژوور دروست بکرێت.', 'Could not create arena.'));
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
        authorIsVerified: Boolean(user.isVerified),
        content: cleanContent,
      });
      setNewPostContent('');
    } catch (err: any) {
      setPublishPostError(err.message ? t(err.message) : tr('نەتوانرا پۆست بڵاوبکرێتەوە.', 'Could not publish post.'));
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
    if (!window.confirm(tr('ئایا دڵنیایت لە سڕینەوەی ئەم پۆستە؟', 'Are you sure you want to delete this post?'))) return;
    try {
      await deletePost(postId, user.uid);
    } catch (err: any) {
      alert(err.message ? t(err.message) : tr('نەتوانرا پۆست بسڕدرێتەوە.', 'Could not delete post.'));
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
                  {tr('گۆڕەپانی SSMR', 'SSMR Arena')}
                </span>
                <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black tracking-widest text-amber-400 uppercase border border-amber-400/20">
                  {tr('ڕاستەوخۆ', 'LIVE')}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500">{tr('تۆڕی کۆمەڵایەتی ڕاستەوخۆ', 'Live Social Network')}</p>
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
              <span>{t('nav.dashboard', 'سەرەکی')}</span>
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
              <span>{t('nav.exploreRooms', 'گەڕان لە ژوورەکان')}</span>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <Search className="h-4 w-4" />
              <span>{t('nav.discoverUsers', 'دۆزینەوەی ئەندامان')}</span>
            </button>

            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>{t('nav.hallOfFame', 'ڕیزبەندی پاڵەوانان')}</span>
            </button>

            <button
              onClick={() => setIsShopOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <ShoppingBag className="h-4 w-4 text-purple-400" />
              <span>{t('nav.shop', 'فرۆشگا و خەزێنە')}</span>
            </button>

            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4" />
                <span>{t('nav.notifications', 'ئاگادارکردنەوەکان')}</span>
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
                <span>{t('nav.messages', 'نامەی تایبەتی')}</span>
              </div>
              {inboxThreadsCount > 0 && (
                <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                  {inboxThreadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsFriendsModalOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <HeartHandshake className="h-4 w-4 text-amber-400" />
                <span>{t('nav.friends', 'هاوڕێ و فۆڵۆوەکان')}</span>
              </div>
              <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                {friendsCount + followersCount}
              </span>
            </button>

            <button
              onClick={() => setNavTab('wallet')}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                navTab === 'wallet'
                  ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4" />
                <span>{t('nav.wallet', 'جزدان')}</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-amber-300">
                {formatCoinsK(user.coins)}
              </span>
            </button>

            <button
              onClick={() => setNavTab('settings')}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                navTab === 'settings'
                  ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>{t('settings.title', 'ڕێکخستنەکان')}</span>
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
            <span>{tr('کردنەوەی ژوور', 'Create Room')}</span>
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
              {navTab === 'explore' ? (
                <Compass className="h-4 w-4" />
              ) : navTab === 'wallet' ? (
                <Wallet className="h-4 w-4" />
              ) : navTab === 'settings' ? (
                <Settings className="h-4 w-4" />
              ) : (
                <Radio className="h-4 w-4" />
              )}
            </div>
            <div>
              <h1 className="font-display text-sm font-black text-white">
                {navTab === 'explore'
                  ? tr('گەڕان لە ژوورەکان', 'Explore Arenas')
                  : navTab === 'wallet'
                  ? tr('جزدان و دراوەکان', 'Wallet & Vault')
                  : navTab === 'settings'
                  ? tr('ڕێکخستنەکانی هەژمار', 'Settings')
                  : tr('ژووری دەنگی', 'Voice Arena')}
              </h1>
              <span className="text-[9px] text-slate-400 uppercase font-bold">
                {navTab === 'explore'
                  ? `${allRooms.length} ${tr('ژووری چالاک', 'Live Arenas')}`
                  : navTab === 'wallet'
                  ? `${formatCoinsK(user.coins)} ${tr('دراو', 'Coins')}`
                  : navTab === 'settings'
                  ? tr('کۆنترۆڵی سیستم', 'System Control')
                  : tr('پەخشی ڕاستەوخۆ', 'Live Broadcast')}
              </span>
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
              onClick={() => setIsFriendsModalOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-amber-400"
              title="Friends & Connections"
            >
              <HeartHandshake className="h-4 w-4" />
              {friendsCount + followersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 text-[8px] font-bold text-black flex items-center justify-center">
                  {friendsCount + followersCount > 9 ? '9+' : friendsCount + followersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300"
            >
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{formatCoinsK(user.coins)}</span>
            </button>

            <button
              onClick={() => openUserProfile(user.uid)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white ${
                user.isVerified ? 'vip-fire-avatar' : 'overflow-hidden border border-white/10'
              }`}
            >
              <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                {user.avatar || user.profileImage ? (
                  <img src={user.avatar || user.profileImage} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  (user.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              {user.isVerified && (
                <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 shadow">
                  <Crown className="h-2 w-2 text-black fill-black" />
                </span>
              )}
            </button>
          </div>
        </div>

        {navTab === 'dashboard' && (
          <>
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
                      <span>{tr(cat.label, cat.value === 'All' ? 'All Arenas' : cat.value)}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" />
                <span>{tr('کردنەوەی ژوور', 'Create Room')}</span>
              </button>
            </div>

            {/* ── SECTION 1: STRICT 4-ROOM DIRECTORY (SPOTLIGHT GRID) ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <h2 className="font-display text-xs font-bold tracking-wider text-slate-300 uppercase">
                    {tr('ژوورە چالاکەکان', 'Active Arenas')}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setNavTab('explore');
                    setSelectedCategory('All');
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span>{tr('هەموو ژوورەکان', 'Explore All')}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

          {displayRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-12 text-center">
              <Headphones className="h-8 w-8 text-slate-600 mb-2" />
              <h3 className="text-xs font-bold text-white">{tr('هیچ ژوورێکی ڕاستەوخۆ نییە', 'No Live Arenas Found')}</h3>
              <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                {tr('یەکەم کەس بە کە ژوورێکی دەنگی بکاتەوە بە یاری و پەخشی دەنگ!', 'Be the first to launch an arena with voice chat and games!')}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3.5 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black"
              >
                {tr('یەکەم ژوور بکەرەوە', 'Launch First Arena')}
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
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-violet-600/40 text-[9px] font-black text-violet-200">
                          {room.hostAvatar || (room.hostId === user.uid ? user.avatar || user.profileImage : '') ? (
                            <img
                              src={room.hostAvatar || user.avatar || user.profileImage}
                              alt={room.hostName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            room.hostName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="truncate">{room.hostName}</span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold group-hover:translate-x-1 transition-transform">
                        <span>{tr('چوونەژوورەوە', 'Join Arena')}</span>
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
                className={`relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-xs font-black text-black shadow-md transition hover:scale-105 ${
                  user.isVerified ? 'vip-fire-avatar' : 'overflow-hidden'
                }`}
              >
                <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
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
                {user.isVerified && (
                  <span className="absolute -top-1.5 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                    <Crown className="h-2.5 w-2.5 text-black fill-black" />
                  </span>
                )}
              </div>

              <div className="flex-1">
                <form onSubmit={handlePublishPost} className="space-y-2.5">
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={tr('پۆستێک، بیرۆکەیەک یان بانگهێشتێکی یاری بڵاوبکەرەوە…', 'Share a post, idea, or arena invite…')}
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
                      <span>{isPublishingPost ? tr('خەریکی بڵاوکردنەوەیە…', 'Publishing…') : tr('بڵاوکردنەوە', 'Publish')}</span>
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
                  {tr('پۆستە گشتییەکان', 'Public Posts')} ({posts.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500">{tr('پۆست', 'Posts')}</span>
            </div>

            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-12 text-center">
                <MessageSquare className="h-7 w-7 text-slate-600 mb-2" />
                <p className="text-xs font-bold text-white">{tr('هێشتا هیچ پۆستێک بڵاونەکراوەتەوە', 'No posts published yet')}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {tr('یەکەم کەس بە کە پۆستێک لەسەر شاشەی گشتی بڵاوبکاتەوە!', 'Be the first to share an update on the community feed!')}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {posts.map((post) => {
                  const isAuthor = post.authorUid === user.uid;
                  const isPostVip = Boolean(post.authorIsVerified || (isAuthor && user.isVerified));
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
                          <div
                            className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md ${
                              isPostVip
                                ? getVipAvatarClass(true, isAuthor ? user.vipFrame : undefined)
                                : 'overflow-hidden'
                            }`}
                          >
                            <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                              {post.authorAvatar || (isAuthor ? user.avatar || user.profileImage : null) ? (
                                <img
                                  src={post.authorAvatar || user.avatar || user.profileImage || ''}
                                  alt={post.authorName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                post.authorName.charAt(0).toUpperCase()
                              )}
                            </div>
                            {isPostVip && (
                              <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 shadow">
                                <Crown className="h-2 w-2 text-black fill-black" />
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                                {post.authorName}
                              </h4>
                              {isPostVip && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 text-[8px] font-black text-amber-300">
                                  <Crown className="h-2 w-2 text-amber-400 fill-amber-400" />
                                  VIP
                                </span>
                              )}
                              {isAuthor && (
                                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-semibold text-slate-400">
                                  {tr('تۆ', 'You')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimeAgo(post.timestamp, isEn)}</span>
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
                        <div className="flex items-center gap-1.5 sm:gap-2">
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
                            onClick={() => toggleComments(post.id)}
                            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-90 ${
                              expandedCommentsPostIds[post.id]
                                ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-sm shadow-amber-400/10'
                                : 'hover:bg-white/[0.04] hover:text-white'
                            }`}
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>{post.commentsCount || 0}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => handleSharePost(post.id)}
                          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
                        >
                          {copiedPostId === post.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">{tr('لینک کۆپی کرا', 'Link Copied')}</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="text-[11px]">{tr('هاوبەشکردن', 'Share')}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expandable Comments Drawer */}
                      {expandedCommentsPostIds[post.id] && (
                        <PostCommentsSection
                          postId={post.id}
                          postAuthorUid={post.authorUid}
                          currentUser={user}
                          onOpenUserProfile={openUserProfile}
                        />
                      )}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </section>
      </>
    )}

    {/* ══════════════════════════════════════════════════════════════
        EXPLORE ARENAS DISCOVERY VIEW
        ══════════════════════════════════════════════════════════════ */}
    {navTab === 'explore' && (
      <div className="space-y-6">
        {/* Explore Arenas Hero Header */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-slate-900/70 to-slate-900/90 p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/25">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg sm:text-xl font-black text-white">
                    {tr('گەڕان لە هەموو ژوورەکان', 'Explore Voice Arenas')}
                  </h2>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{allRooms.length} {tr('ژووری چالاک', 'Live')}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {tr(
                    'هەموو ژوورە کراوەکان ببینە، بەپێی بابەت و هاوڕێکانت بگەڕێ و یەکسەر بەشداری بکە',
                    'Discover and join all active live voice rooms, gaming lobbies, and podcasts in real time',
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-4 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>{tr('کردنەوەی ژوور', 'Create Room')}</span>
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="mt-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={exploreSearchQuery}
              onChange={(e) => setExploreSearchQuery(e.target.value)}
              placeholder={tr('گەڕان بەپێی ناوی ژوور، بەکارهێنەر، یان بابەت…', 'Search arenas by room name, host, or keyword…')}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 pl-10 pr-10 py-3 text-xs font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
            />
            {exploreSearchQuery && (
              <button
                onClick={() => setExploreSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            const isSelected = selectedCategory === cat.value;
            const count =
              cat.value === 'All'
                ? allRooms.length
                : allRooms.filter(
                    (r) => (r.category || 'Voice Chat').toLowerCase() === cat.value.toLowerCase(),
                  ).length;

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
                <span>{tr(cat.label, cat.value === 'All' ? 'All Arenas' : cat.value)}</span>
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    isSelected ? 'bg-amber-400/25 text-amber-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Arenas Grid */}
        {filteredExploreRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-16 text-center px-4">
            <Compass className="h-10 w-10 text-slate-600 mb-3 animate-spin-slow" />
            <h3 className="text-sm font-bold text-white">
              {tr('هیچ ژوورێک نەدۆزرایەوە', 'No Arenas Found')}
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {exploreSearchQuery.trim()
                ? tr(
                    `هیچ ژوورێک بۆ گەڕان بە دوای "${exploreSearchQuery}" نەدۆزرایەوە. وشەی گەڕانەکەت بگۆڕە یان بپاڕێوە.`,
                    `No arenas matched "${exploreSearchQuery}". Try adjusting your search query or category filter.`,
                  )
                : tr(
                    'لە ئێستادا هیچ ژوورێک لەم بەشەدا نییە. دەتوانیت یەکەم ژوور بکەیتەوە!',
                    'There are currently no active rooms in this category. You can launch the first one!',
                  )}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {(exploreSearchQuery || selectedCategory !== 'All') && (
                <button
                  onClick={() => {
                    setExploreSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  {tr('پاککردنەوەی فلتەرەکان', 'Clear Filters')}
                </button>
              )}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400"
              >
                {tr('دروستکردنی ژووری نوێ', 'Create Arena')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExploreRooms.map((room) => {
              const occupiedCount = getOccupiedCount(room);
              const isLocked = Boolean(room.isPrivate && room.password);

              return (
                <motion.div
                  key={room.id}
                  whileHover={{ y: -3 }}
                  onClick={() => handleRoomClick(room)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 p-4.5 shadow-xl backdrop-blur-xl transition hover:border-amber-400/40 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer"
                >
                  <div>
                    {/* Top Category & Live status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 uppercase border border-white/[0.06]">
                        {room.category || 'Voice Chat'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isLocked && (
                          <span title="Locked Arena">
                            <Lock className="h-3.5 w-3.5 text-rose-400" />
                          </span>
                        )}
                        <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{occupiedCount}/8</span>
                        </div>
                      </div>
                    </div>

                    {/* Room Name */}
                    <h3 className="mt-2.5 font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {room.roomName}
                    </h3>

                    {/* Room Info Snippet */}
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                      {room.description || tr('ژووری دەنگی و یارییە بەکۆمەڵەکان', 'Live voice arena and social lounge')}
                    </p>
                  </div>

                  {/* Mic Stage Seat Pill Indicators */}
                  <div className="my-3.5 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-medium">
                      <div className="flex items-center gap-1">
                        <Mic className="h-3 w-3 text-amber-400" />
                        <span>{tr('کورسییەکانی مایک', 'Stage Seats')}</span>
                      </div>
                      <span className="font-mono text-amber-300 font-bold">
                        {occupiedCount}/8
                      </span>
                    </div>
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

                  {/* Host and Enter Arena button */}
                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 truncate max-w-[150px]">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-600/40 text-[10px] font-black text-violet-200">
                        {room.hostAvatar || (room.hostId === user.uid ? user.avatar || user.profileImage : '') ? (
                          <img
                            src={room.hostAvatar || user.avatar || user.profileImage}
                            alt={room.hostName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          room.hostName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="truncate">
                        <span className="block truncate font-semibold text-slate-300">{room.hostName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold group-hover:translate-x-1 transition-transform">
                      <span>{tr('چوونەژوورەوە', 'Join Arena')}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════
        WALLET & VAULT OVERVIEW VIEW
        ══════════════════════════════════════════════════════════════ */}
    {navTab === 'wallet' && (
      <div className="space-y-6">
        {/* Wallet Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-slate-900/90 p-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/30">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg sm:text-xl font-black text-white">
                  {tr('جزدان و خەزێنەی دراوەکان', 'Coins Vault & Wallet')}
                </h2>
                <p className="text-xs text-slate-400">
                  {tr('باڵانسی فەرمی دراوەکانت و چالاکییەکانی بەخشین', 'Your official coin balance, store, and gift rewards')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsShopOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-4 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-95"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{tr('فرۆشگای دراو و VIP', 'Coins & VIP Shop')}</span>
              </button>
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
              >
                <Coins className="h-4 w-4 text-amber-400" />
                <span>{tr('مێژووی جزدان', 'Wallet Details')}</span>
              </button>
            </div>
          </div>

          {/* Big Coins Counter */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between rounded-2xl border border-amber-500/20 bg-slate-950/60 p-5 gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tr('باڵانسی بەردەست', 'Available Balance')}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-8 w-8 text-amber-400" />
                <span className="font-mono text-3xl sm:text-4xl font-black text-amber-300">
                  {user.coins.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-amber-400/80">{tr('دراو', 'Coins')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{tr('سیستەمی پارێزراوی خەزێنە', 'Protected Vault Security')}</span>
            </div>
          </div>
        </div>

        {/* Perks Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
              <Sparkles className="h-5 w-5" />
            </div>
            <h4 className="font-display text-sm font-bold text-white">
              {tr('ناردنی دیاری لە ژوورەکاندا', 'Send Gifts in Rooms')}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {tr('بە دراوەکانت پشتگیری پێشکەشکاران و بەشداربووان بکە بە دیاری ناوازە و ئەنیمەیشن.', 'Support your favorite hosts and speakers with animated gifts.')}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-3">
              <Crown className="h-5 w-5" />
            </div>
            <h4 className="font-display text-sm font-bold text-white">
              {tr('پلەی تایبەت و ڕەنگاوڕەنگ', 'VIP & Badge Titles')}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {tr('تاجی VIP، کەڤەری ئەنیمەیشن و چوارچێوەی ئاگرین بۆ پرۆفایلەکەت بەدەستبهێنە.', 'Unlock VIP badges, animated profile covers, and glowing borders.')}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
              <Music className="h-5 w-5" />
            </div>
            <h4 className="font-display text-sm font-bold text-white">
              {tr('سینەما و پەخشی مووزیک', 'Cinema & Music Stream')}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {tr('گۆرانی و ڤیدیۆی دڵخوازت لە ژوورەکاندا بە هاوبەشی پەخش بکە و چێژ وەربگرە.', 'Request songs and stream cinema playlists with friends in real-time.')}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════
        SETTINGS & ACCOUNT HUB VIEW
        ══════════════════════════════════════════════════════════════ */}
    {navTab === 'settings' && (
      <div className="space-y-6">
        {/* Settings Header Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 text-amber-400 shadow-lg">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-white">
                {tr('ڕێکخستنەکان و هەژمار', 'Settings & Preferences')}
              </h2>
              <p className="text-xs text-slate-400">
                {tr('کۆنترۆڵی هەژمار، تایبەتمەندییەکان، زمان و ئاسایشی کۆگاکەت', 'Manage profile, language, notifications, and security')}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Options Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* User Profile Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div
                onClick={() => openUserProfile(user.uid)}
                className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full overflow-hidden border border-white/10 bg-slate-800"
              >
                {user.avatar || user.profileImage ? (
                  <img src={user.avatar || user.profileImage} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  (user.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="font-display text-sm font-bold text-white">{user.username}</h4>
                <span className="text-xs text-slate-400">ID: {user.uid.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => openUserProfile(user.uid)}
                className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>{tr('دەستکاریکردنی پرۆفایل', 'Edit Profile')}</span>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
              >
                <span>{tr('ڕێکخستنی زیاتر', 'More')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main Preferences Shortcut */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <Settings className="h-4 w-4" />
                <span>{tr('ڕێکخستنە سەرەکییەکان', 'Core App Settings')}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {tr('گۆڕینی زمان، دەنگ، بەشی پارێزراوی و ئاگادارکردنەوەکان لە پەنجەرەی ڕێکخستندا.', 'Adjust language, audio preferences, and privacy controls.')}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
              >
                <Settings className="h-4 w-4" />
                <span>{tr('کردنەوەی پانێڵی ڕێکخستنەکان', 'Open Settings Panel')}</span>
              </button>
            </div>
          </div>

          {/* Hall of Fame / Leaderboard */}
          <div
            onClick={() => setIsLeaderboardOpen(true)}
            className="cursor-pointer rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 hover:border-amber-400/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {t('nav.hallOfFame', 'ڕیزبەندی پاڵەوانان')}
                  </h4>
                  <p className="text-xs text-slate-400">{tr('بەرزترین ئاستەکان و خاوەن دراوەکان', 'Top XP and coin leaderboard')}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Direct Messages & Chat Center */}
          <div
            onClick={() => setIsChatCenterOpen(true)}
            className="cursor-pointer rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 hover:border-cyan-400/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {t('nav.messages', 'نامەی تایبەتی')}
                  </h4>
                  <p className="text-xs text-slate-400">{tr('گفتوگۆ لەگەڵ هاوڕێکانت', 'Direct private chat threads')}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Logout Row */}
        <div className="pt-2">
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>{tr('چوونەدەرەوە لە هەژمار', 'Log Out')}</span>
          </button>
        </div>
      </div>
    )}
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
              className={`relative h-24 w-full overflow-hidden transition-all duration-500 ${
                user.isVerified ? 'vip-animated-cover vip-shine-effect' : ''
              }`}
              style={
                user.profileCover
                  ? user.profileCover.startsWith('http') || user.profileCover.startsWith('data:')
                    ? { backgroundImage: `url(${user.profileCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: user.profileCover }
                  : { background: 'linear-gradient(180deg, #1a0500 0%, #450a0a 35%, #9a3412 70%, #ea580c 90%, #fde047 100%)' }
              }
            >
              {(!user.profileCover ||
                (!user.profileCover.startsWith('http') && !user.profileCover.startsWith('data:'))) && (
                <AnimatedThemeOverlay
                  themeValue={user.profileCover || 'real_fire'}
                  compact
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950" />
              {user.isVerified && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-400/50 text-amber-300 shadow-md">
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
                className={`relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 shadow-xl transition hover:scale-105 ring-2 ring-slate-950 ${
                  user.isVerified
                    ? `${getVipAvatarClass(user.isVerified, user.vipFrame)} bg-gradient-to-tr from-amber-300 via-orange-500 to-red-600`
                    : 'overflow-hidden bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 shadow-amber-500/15'
                }`}
              >
                {user.isVerified && (
                  <div className="absolute -top-2.5 -right-1 z-20 pointer-events-none">
                    <Crown className="h-5 w-5 text-amber-400 fill-amber-400 vip-crown-animation drop-shadow-[0_2px_6px_rgba(251,191,36,0.8)]" />
                  </div>
                )}
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950">
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
                  "{user.bio || tr('ئەندامی ژووری دەنگی SSMR.', 'SSMR Voice Arena Member.')}"
                </p>
              </div>
            </div>

          {/* Account Age Counter */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400 font-medium">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span>{getAccountAge(user.createdAt, isEn)}</span>
          </div>

          {/* Dynamic Tier Level & XP Progress Percentage Bar */}
          <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-purple-300">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>{tr('ئاستی', 'Level')} {user.level || 1}</span>
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
              <span>{isEn ? '1,000 XP to next level' : '١٠٠٠ XP بۆ ئاستی دواتر'}</span>
            </div>
          </div>

          {/* Live Wallet Balance */}
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">{tr('باڵانسی جزدان', 'Wallet Balance')}</span>
            </div>
            <span className="font-mono text-sm font-black text-amber-300">
              {formatCoinsK(user.coins)}
            </span>
          </div>

          {/* Followers, Following & Friends Stats */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setIsFriendsModalOpen(true)}
              className="flex flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/5 py-2 px-1 transition hover:bg-cyan-500/15 hover:border-cyan-400/40"
            >
              <span className="font-mono text-xs font-black text-white">{followersCount}</span>
              <span className="text-[9px] font-bold text-cyan-300">{tr('فۆڵۆوکار', 'Followers')}</span>
            </button>

            <button
              onClick={() => setIsFriendsModalOpen(true)}
              className="flex flex-col items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/5 py-2 px-1 transition hover:bg-purple-500/15 hover:border-purple-400/40"
            >
              <span className="font-mono text-xs font-black text-white">{followingCount}</span>
              <span className="text-[9px] font-bold text-purple-300">{tr('فۆڵۆوکراو', 'Following')}</span>
            </button>

            <button
              onClick={() => setIsFriendsModalOpen(true)}
              className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5 py-2 px-1 transition hover:bg-amber-500/15 hover:border-amber-400/40"
            >
              <span className="font-mono text-xs font-black text-white">{friendsCount}</span>
              <span className="text-[9px] font-bold text-amber-300">{tr('هاوڕێکان', 'Friends')}</span>
            </button>
          </div>

          <button
            onClick={() => openUserProfile(user.uid)}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-bold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-300"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>{tr('دەستکاریکردنی پڕۆفایل', 'Edit Profile')}</span>
          </button>
        </div>
      </div>

        {/* Recent Profile Visitors Panel */}
        <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Eye className="h-4 w-4 text-amber-400" />
              <h4 className="font-display text-xs font-bold uppercase tracking-wider">
                {tr('سەردانیکەرانی پڕۆفایل', 'Profile Visitors')} ({visitors.length})
              </h4>
            </div>
            <span className="text-[9px] text-slate-500">{tr('ڕاستەوخۆ', 'Live')}</span>
          </div>

          {visitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
              {tr('هێشتا هیچ سەردانیکەرێک تۆمار نەکراوە.', 'No visitors recorded yet.')}
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
                    {formatTimeAgo(visitor.timestamp, isEn)}
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
          <span>{t('nav.dashboard', 'گۆڕەپان')}</span>
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
          <span>{t('nav.exploreRooms', 'گەڕان')}</span>
        </button>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/25 -mt-4"
        >
          <Plus className="h-6 w-6" />
        </button>

        <button
          onClick={() => setNavTab('wallet')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            navTab === 'wallet' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Wallet className="h-5 w-5" />
          <span>{t('nav.wallet', 'جزدان')}</span>
        </button>

        <button
          onClick={() => setNavTab('settings')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            navTab === 'settings' ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          <Settings className="h-5 w-5" />
          <span>{t('settings.title', 'ڕێکخستنەکان')}</span>
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
                      {tr('دروستکردنی ژووری دەنگی', 'Create Voice Arena')}
                    </h2>
                    <p className="text-[10px] font-medium text-amber-400 uppercase">
                      {tr('ژووری دەنگی ٨ کورسی', '8-Seat Voice Room')}
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
                    {tr('ناوی ژوور', 'Room Name')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder={tr('بۆ نموونە: دیوەخانی هاوڕێیان', 'e.g., Friends Lounge')}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ROOM_NAME_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug.en}
                        type="button"
                        onClick={() => setNewRoomName(tr(sug.ku, sug.en))}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:border-amber-400/30 hover:text-amber-300"
                      >
                        {tr(sug.ku, sug.en)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    {tr('بەش هەڵبژێرە', 'Select Category')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { cat: 'Gaming' as RoomCategory, label: tr('یارییەکان', 'Gaming'), icon: Gamepad2 },
                      { cat: 'Voice Chat' as RoomCategory, label: tr('چاتی دەنگی', 'Voice Chat'), icon: MessageSquare },
                      { cat: 'Music' as RoomCategory, label: tr('میوزیک و گۆرانی', 'Music'), icon: Music },
                      { cat: 'Chill' as RoomCategory, label: tr('هاوڕێیەتی و پشوو', 'Chill'), icon: Coffee },
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
                      <span className="text-xs font-bold text-white">{tr('ژووری تایبەت', 'Private Room')}</span>
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
                      placeholder={tr('وشەی نهێنی ژوور بنووسە', 'Enter room password')}
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
                    <span>{isCreatingRoom ? tr('خەریکی دروستکردنە…', 'Creating arena…') : tr('دەستپێکردنی پەخشی ڕاستەوخۆ', 'Launch Live Broadcast')}</span>
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
                    {tr('ژووری قفڵکراو', 'Locked Room')}
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
                  {tr('وشەی نهێنی بنووسە بۆ چوونەژوورەوە بۆ', 'Enter password to join')}{' '}
                  <strong>{lockedRoomTarget.roomName}</strong>:
                </p>

                <input
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  placeholder={tr('وشەی نهێنی ژوور', 'Room password')}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                />

                {passwordError && (
                  <p className="text-[11px] text-rose-400 font-medium">
                    {tr('وشەی نهێنی هەڵەیە. تکایە دووبارە هەوڵبدەرەوە.', 'Incorrect password. Please try again.')}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20"
                >
                  {tr('کردنەوە و چوونەژوورەوە', 'Unlock & Join')}
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
                {tr('باڵانسی خەزێنەی جزدان', 'Wallet Vault Balance')}
              </h3>
              <div className="mt-2 font-mono text-3xl font-black text-amber-300">
                {formatCoinsK(user.coins)}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {tr('کۆین دەتوانیت لە یارییەکانی زار و جاکۆرۆ و ناردنی دیارییە شاهانەکان بەکاریبهێنیت.', 'Use coins in Dice & Jackaroo games and for sending royal gifts.')}
              </p>

              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="mt-6 w-full rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20"
              >
                {tr('داخستنی جزدان', 'Close Wallet')}
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
            currentUser={user}
            onClose={() => setIsNotificationsOpen(false)}
            onOpenProfile={(uid) => openUserProfile(uid)}
          />
        )}
      </AnimatePresence>

      {/* ── FRIENDS & FOLLOW CONNECTIONS MODAL ── */}
      <AnimatePresence>
        {isFriendsModalOpen && user && (
          <FriendsModal
            currentUser={user}
            onClose={() => setIsFriendsModalOpen(false)}
            onOpenProfile={(uid) => openUserProfile(uid)}
            onOpenDirectMessage={(recipient) => {
              setIsFriendsModalOpen(false);
              setActiveChatRecipient({
                uid: recipient.uid,
                username: recipient.username,
                avatar: recipient.avatar,
              });
            }}
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

      {/* ── ڕاستەوخۆ INCOMING CHAT & ACTIVITY NOTIFICATION BANNER ── */}
      <IncomingChatToast
        currentUser={user}
        activeChatRecipientUid={activeChatRecipient?.uid || null}
        onOpenChat={(recipient) => setActiveChatRecipient(recipient)}
      />

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
