import { useState, useEffect, useMemo, useRef } from 'react';
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
  PenSquare,
  Image as ImageIcon,
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
  subscribeToUnreadDirectMessagesCount,
  subscribeToFollowersCount,
  subscribeToFollowingCount,
  subscribeToFriendsCount,
  uploadImageToImgBB,
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
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const postTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const postImageInputRef = useRef<HTMLInputElement | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const handlePostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setPublishPostError(tr('قەبارەی وێنە نابێت لە ١٠ مێگابایت زیاتر بێت.', 'Image must be under 10MB.'));
      return;
    }
    setPostImageFile(file);
    setPublishPostError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPostImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePostImage = () => {
    setPostImageFile(null);
    setPostImagePreview(null);
    if (postImageInputRef.current) {
      postImageInputRef.current.value = '';
    }
  };

  const handleOpenCreatePost = () => {
    setNavTab('dashboard');
    setIsCreatePostModalOpen(true);
    setTimeout(() => {
      postTextareaRef.current?.focus();
    }, 120);
  };

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
  const [unreadDMsCount, setUnreadDMsCount] = useState(0);

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

  // Live active chat threads count and unread messages count
  useEffect(() => {
    if (!user?.uid) return;
    const unsubInbox = subscribeToUserInbox(user.uid, (threads) => {
      setInboxThreadsCount(threads.length);
    });
    const unsubUnread = subscribeToUnreadDirectMessagesCount(user.uid, (count) => {
      setUnreadDMsCount(count);
    });

    return () => {
      unsubInbox();
      unsubUnread();
    };
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
    if (!cleanContent && !postImageFile) return;

    setIsPublishingPost(true);
    setPublishPostError(null);

    try {
      let hostedImageUrl: string | null = null;
      if (postImageFile) {
        setIsUploadingImage(true);
        hostedImageUrl = await uploadImageToImgBB(
          postImageFile,
          `post_${user.uid}_${Date.now()}`
        );
        setIsUploadingImage(false);
      }

      await createPost({
        authorUid: user.uid,
        authorName: user.username,
        authorAvatar: user.avatar || user.profileImage || null,
        authorIsVerified: Boolean(user.isVerified),
        content: cleanContent || (hostedImageUrl ? tr('وێنەیەکی نوێ', 'New photo shared') : ''),
        imageUrl: hostedImageUrl,
      });

      setNewPostContent('');
      handleRemovePostImage();
      setIsCreatePostModalOpen(false);
    } catch (err: any) {
      setPublishPostError(err.message ? t(err.message) : tr('نەتوانرا پۆست بڵاوبکرێتەوە.', 'Could not publish post.'));
    } finally {
      setIsPublishingPost(false);
      setIsUploadingImage(false);
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

  const getTotalMembers = (room: Room) => {
    const seatedCount = (room.seats || []).filter((s) => s.userId !== null).length;
    const count = typeof room.participantCount === 'number' && room.participantCount > 0
      ? room.participantCount
      : Math.max(seatedCount, 1);
    return Math.max(count, seatedCount, 1);
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
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold text-slate-400 transition-all hover:bg-slate-900/60 hover:text-white group"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <MessageSquare className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  {unreadDMsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <span>{t('nav.messages', 'نامەی تایبەتی')}</span>
              </div>
              {unreadDMsCount > 0 ? (
                <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] font-black shadow-md shadow-rose-500/30 animate-pulse border border-white/20">
                  {unreadDMsCount} {tr('نوێ', 'New')}
                </span>
              ) : inboxThreadsCount > 0 ? (
                <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700/60">
                  {inboxThreadsCount}
                </span>
              ) : null}
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
      <main className="flex-1 h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-32 md:pb-8">
        {/* Mobile Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3 md:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => openUserProfile(user.uid)}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white transition active:scale-95 ${
                user.isVerified ? 'vip-fire-avatar' : 'overflow-hidden border border-amber-500/30 shadow-md shadow-amber-500/10'
              }`}
              title={user.username}
            >
              <div className="h-full w-full overflow-hidden rounded-2xl flex items-center justify-center">
                {user.avatar || user.profileImage ? (
                  <img src={user.avatar || user.profileImage} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  (user.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              {user.isVerified && (
                <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                  <Crown className="h-2.5 w-2.5 text-black fill-black" />
                </span>
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-sm font-black text-white truncate max-w-[125px] sm:max-w-none">
                  {navTab === 'explore'
                    ? tr('گەڕان لە ژوورەکان', 'Explore Arenas')
                    : navTab === 'wallet'
                    ? tr('جزدان و دراوەکان', 'Wallet & Vault')
                    : navTab === 'settings'
                    ? tr('ڕێکخستنەکان', 'Settings')
                    : tr('گۆڕەپانی دەنگی', 'Voice Arena')}
                </h1>
                {navTab === 'dashboard' && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black text-emerald-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {tr('ڕاستەوخۆ', 'LIVE')}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium truncate block">
                {navTab === 'explore'
                  ? `${allRooms.length} ${tr('ژووری چالاک', 'Live Arenas')}`
                  : navTab === 'wallet'
                  ? `${formatCoinsK(user.coins)} ${tr('دراو', 'Coins')}`
                  : navTab === 'settings'
                  ? tr('کۆنترۆڵی سیستم', 'System Control')
                  : `${user.username || tr('بەخێربێیت', 'Welcome')}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Coins Wallet Badge */}
            <button
              onClick={() => {
                setNavTab('wallet');
              }}
              className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-2 py-1.5 text-xs font-black text-amber-300 shadow-sm active:scale-95 transition"
              title={tr('جزدان', 'Wallet')}
            >
              <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px]">{formatCoinsK(user.coins)}</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition"
              title={tr('گەڕان', 'Search')}
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications with Badge */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition"
              title={tr('ئاگادارکردنەوەکان', 'Notifications')}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white shadow-md shadow-rose-500/50">
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Friends */}
            <button
              onClick={() => setIsFriendsModalOpen(true)}
              className="relative flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-amber-400 hover:bg-slate-800 active:scale-95 transition"
              title={tr('هاوڕێکان', 'Friends')}
            >
              <HeartHandshake className="h-4 w-4" />
              {friendsCount + followersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-black shadow">
                  {friendsCount + followersCount > 9 ? '9+' : friendsCount + followersCount}
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
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
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
                const totalMembers = getTotalMembers(room);
                const isLocked = Boolean(room.isPrivate && room.password);

                return (
                  <motion.div
                    key={room.id}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoomClick(room)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/90 p-4 sm:p-5 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-amber-400/50 hover:shadow-2xl hover:shadow-amber-500/15 cursor-pointer"
                  >
                    {/* Top ambient glow line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div>
                      {/* Top Bar: Category & Total Members LIVE Badge (No seat count) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-300 border border-amber-500/20">
                          <Radio className="h-3 w-3 text-amber-400" />
                          <span>{room.category || 'Voice Arena'}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isLocked && (
                            <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-400 shadow-sm">
                              <Lock className="h-3 w-3" />
                              <span>{tr('داخراو', 'Locked')}</span>
                            </span>
                          )}

                          {/* Real-time Total Members Badge (Seated + Audience) */}
                          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300 shadow-sm shadow-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <Users className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{totalMembers} {tr('ئامادەبوو', 'Online')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Room Title */}
                      <h3 className="mt-3 font-display text-base font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {room.roomName}
                      </h3>

                      {/* Active Arena Tag / Description */}
                      <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                        {room.cinema?.isActive
                          ? `🎬 ${tr('سینەما چالاکە:', 'Cinema Live:')} ${room.cinema.title || tr('پەخشی ڤیدیۆ', 'Video Stream')}`
                          : tr('ژووری دەنگی و گەنگەشەی هاوڕێیان', 'Live voice arena and social lounge')}
                      </p>
                    </div>

                    {/* Bottom Info Bar: Host profile + Quick Join Button */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                      <div className="flex items-center gap-2.5 truncate max-w-[150px] sm:max-w-[180px]">
                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-[10px] font-black text-black shadow-md border border-white/20">
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
                        <div className="min-w-0">
                          <span className="block truncate font-bold text-slate-200 group-hover:text-white transition-colors">
                            {room.hostName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">{tr('خانەخوێ', 'Host')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-black text-amber-300 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-400 transition-all shadow-sm">
                        <span>{tr('چوونەژوورەوە', 'Join Arena')}</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
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

                      {/* Post Image Attachment (ImgBB Hosted) */}
                      {post.imageUrl && (
                        <div
                          onClick={() => setActiveLightboxImage(post.imageUrl!)}
                          className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 cursor-pointer group/img relative"
                        >
                          <img
                            src={post.imageUrl}
                            alt="Post image"
                            className="w-full max-h-[380px] sm:max-h-[460px] object-cover transition-transform duration-300 group-hover/img:scale-[1.01]"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                              {tr('کلیک بکە بۆ بینینی تەواو', 'Click to view full image')}
                            </span>
                          </div>
                        </div>
                      )}

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
              const totalMembers = getTotalMembers(room);
              const isLocked = Boolean(room.isPrivate && room.password);

              return (
                <motion.div
                  key={room.id}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoomClick(room)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/90 p-4 sm:p-5 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-amber-400/50 hover:shadow-2xl hover:shadow-amber-500/15 cursor-pointer"
                >
                  {/* Top ambient glow line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div>
                    {/* Top Category & Live status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-300 border border-amber-500/20">
                        <Radio className="h-3 w-3 text-amber-400" />
                        <span>{room.category || 'Voice Arena'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isLocked && (
                          <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-400 shadow-sm">
                            <Lock className="h-3 w-3" />
                            <span>{tr('داخراو', 'Locked')}</span>
                          </span>
                        )}

                        {/* Real-time Total Members Badge (Seated + Audience) */}
                        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300 shadow-sm shadow-emerald-500/20">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          <Users className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{totalMembers} {tr('ئامادەبوو', 'Online')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Room Name */}
                    <h3 className="mt-3 font-display text-base font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {room.roomName}
                    </h3>

                    {/* Room Info Snippet */}
                    <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                      {room.cinema?.isActive
                        ? `🎬 ${tr('سینەما چالاکە:', 'Cinema Live:')} ${room.cinema.title || tr('پەخشی ڤیدیۆ', 'Video Stream')}`
                        : room.description || tr('ژووری دەنگی و یارییە بەکۆمەڵەکان', 'Live voice arena and social lounge')}
                    </p>
                  </div>

                  {/* Host and Enter Arena button */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2.5 truncate max-w-[150px] sm:max-w-[180px]">
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-[10px] font-black text-black shadow-md border border-white/20">
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
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-slate-200 group-hover:text-white transition-colors">
                          {room.hostName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{tr('خانەخوێ', 'Host')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-black text-amber-300 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-400 transition-all shadow-sm">
                      <span>{tr('چوونەژوورەوە', 'Join Arena')}</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
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
                onClick={() => setNavTab('settings')}
                className="flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{tr('ڕێکخستنەکان', 'Settings')}</span>
              </button>
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

          {/* Wallet & Vault Shortcut */}
          <div
            onClick={() => setNavTab('wallet')}
            className="cursor-pointer rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 hover:border-amber-400/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {t('nav.wallet', 'جزدان و خەزێنەی دراو')}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {formatCoinsK(user.coins)} {tr('دراو بەردەستە', 'Coins available')}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
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
            className={`cursor-pointer rounded-3xl border p-5 transition group ${
              unreadDMsCount > 0
                ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/80 shadow-lg shadow-cyan-500/10'
                : 'border-slate-800/80 bg-slate-900/50 hover:border-cyan-400/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                  <MessageSquare className="h-5 w-5" />
                  {unreadDMsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {t('nav.messages', 'نامەی تایبەتی')}
                    </h4>
                    {unreadDMsCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md shadow-rose-500/40 animate-pulse">
                        {unreadDMsCount} {tr('نامەی نوێ', 'New Messages')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{tr('گفتوگۆی ڕاستەوخۆ لەگەڵ هاوڕێکانت', 'Direct private chat threads')}</p>
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
          4. MOBILE BOTTOM NAVIGATION DOCK (Perfect 5-Tab Symmetrical Layout with Dead-Center FAB)
          ══════════════════════════════════════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-950/92 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] px-2 pt-1.5 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-5 items-center justify-items-center w-full max-w-lg mx-auto">
          {/* 1. Dashboard Tab */}
          <button
            onClick={() => setNavTab('dashboard')}
            className={`w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-90 group relative ${
              navTab === 'dashboard'
                ? 'text-amber-400 font-bold bg-amber-400/10 border border-amber-400/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className={`h-5 w-5 transition-transform duration-200 ${navTab === 'dashboard' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'group-hover:scale-105'}`} />
            <span className="text-[10px] tracking-tight truncate max-w-full mt-0.5">
              {t('nav.dashboard', 'گۆڕەپان')}
            </span>
            {navTab === 'dashboard' && (
              <span className="absolute -bottom-0.5 h-1 w-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            )}
          </button>

          {/* 2. Explore Tab */}
          <button
            onClick={() => {
              setNavTab('explore');
              setSelectedCategory('All');
            }}
            className={`w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-90 group relative ${
              navTab === 'explore'
                ? 'text-amber-400 font-bold bg-amber-400/10 border border-amber-400/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className={`h-5 w-5 transition-transform duration-200 ${navTab === 'explore' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'group-hover:scale-105'}`} />
            <span className="text-[10px] tracking-tight truncate max-w-full mt-0.5">
              {t('nav.exploreRooms', 'گەڕان')}
            </span>
            {navTab === 'explore' && (
              <span className="absolute -bottom-0.5 h-1 w-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            )}
          </button>

          {/* 3. DEAD-CENTER ELEVATED FAB (Goes to Post Creation) */}
          <div className="w-full flex flex-col items-center justify-center relative -mt-5">
            <button
              onClick={handleOpenCreatePost}
              className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-500 text-slate-950 shadow-[0_4px_22px_rgba(245,158,11,0.55)] border-2 border-amber-300/60 ring-4 ring-slate-950 active:scale-90 hover:scale-105 transition-all duration-200"
              title={tr('پۆستکردن', 'Create Post')}
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </button>
            <span className="text-[9.5px] font-black text-amber-400 mt-1 truncate max-w-full tracking-tight">
              {tr('پۆست', 'Post')}
            </span>
          </div>

          {/* 4. Direct Messages Mobile Tab with Real-time Unread Badge */}
          <button
            onClick={() => setIsChatCenterOpen(true)}
            className="w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-90 group relative text-slate-400 hover:text-cyan-300"
          >
            <div className="relative">
              <MessageSquare className="h-5 w-5 text-cyan-400 transition-transform duration-200 group-hover:scale-105" />
              {unreadDMsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[8px] font-black text-white shadow-lg shadow-rose-500/60 animate-pulse border border-white/20">
                  {unreadDMsCount > 9 ? '9+' : unreadDMsCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight truncate max-w-full mt-0.5 ${unreadDMsCount > 0 ? 'text-rose-400 font-black' : ''}`}>
              {tr('نامەکان', 'Messages')}
            </span>
          </button>

          {/* 5. Settings / Account Tab */}
          <button
            onClick={() => setNavTab('settings')}
            className={`w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-90 group relative ${
              navTab === 'settings' || navTab === 'wallet'
                ? 'text-amber-400 font-bold bg-amber-400/10 border border-amber-400/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className={`h-5 w-5 transition-transform duration-200 ${navTab === 'settings' || navTab === 'wallet' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'group-hover:scale-105'}`} />
            <span className="text-[10px] tracking-tight truncate max-w-full mt-0.5">
              {t('settings.title', 'ڕێکخستن')}
            </span>
            {(navTab === 'settings' || navTab === 'wallet') && (
              <span className="absolute -bottom-0.5 h-1 w-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            )}
          </button>
        </div>
      </nav>

      {/* ── CREATE POST MODAL ── */}
      <AnimatePresence>
        {isCreatePostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg overflow-hidden rounded-t-[32px] sm:rounded-3xl border border-amber-500/30 bg-slate-900 p-5 sm:p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/20">
                    <PenSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-black text-white">
                      {tr('دروستکردنی پۆستی نوێ', 'Create New Post')}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {tr('بیرۆکە و پەیامەکانت لەگەڵ ئەندامان بەش بکە', 'Share ideas and updates with the community')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreatePostModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handlePublishPost(e);
                  setIsCreatePostModalOpen(false);
                }}
                className="mt-4 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden border border-amber-500/30 bg-slate-800">
                    {user.avatar || user.profileImage ? (
                      <img src={user.avatar || user.profileImage} alt={user.username} className="h-full w-full object-cover" />
                    ) : (
                      (user.username || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      ref={postTextareaRef}
                      rows={4}
                      maxLength={400}
                      autoFocus
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder={tr('پۆستێک، بیرۆکەیەک یان بانگهێشتێکی یاری بڵاوبکەرەوە…', 'Share a post, idea, or arena invite…')}
                      className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs sm:text-sm font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                    />

                    {/* Image Preview Box */}
                    {postImagePreview && (
                      <div className="relative mt-2.5 overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-950/80 shadow-inner">
                        <img
                          src={postImagePreview}
                          alt="Post upload preview"
                          className="w-full max-h-52 object-cover rounded-2xl"
                        />
                        <button
                          type="button"
                          onClick={handleRemovePostImage}
                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/80 text-white hover:bg-rose-600 transition shadow-lg border border-white/20"
                          title={tr('سڕینەوەی وێنە', 'Remove photo')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {isUploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm text-xs font-bold text-amber-300 gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                            <span>{tr('خەریکی ناردنی وێنەیە بۆ ImgBB…', 'Uploading to ImgBB…')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {publishPostError && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{publishPostError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hidden Native File Input */}
                <input
                  type="file"
                  ref={postImageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handlePostImageChange}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center gap-3">
                    {/* Add Image Button from Mobile / Desktop */}
                    <button
                      type="button"
                      onClick={() => postImageInputRef.current?.click()}
                      disabled={isPublishingPost || isUploadingImage}
                      className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${
                        postImageFile
                          ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                          : 'border-slate-800 bg-slate-800/80 text-slate-300 hover:border-amber-400/30 hover:text-white'
                      }`}
                      title={tr('هەڵبژاردنی وێنە لە مۆبایلەکەتەوە', 'Pick photo from device')}
                    >
                      <ImageIcon className="h-4 w-4 text-amber-400" />
                      <span>{postImageFile ? tr('گۆڕینی وێنە', 'Change Photo') : tr('وێنە زیادبکە', 'Add Photo')}</span>
                    </button>

                    <span className="text-[11px] font-mono text-slate-500">
                      {newPostContent.length}/400
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleRemovePostImage();
                        setIsCreatePostModalOpen(false);
                      }}
                      className="rounded-2xl border border-slate-800 bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
                    >
                      {tr('پەشیمانبوونەوە', 'Cancel')}
                    </button>

                    <button
                      type="submit"
                      disabled={(!newPostContent.trim() && !postImageFile) || isPublishingPost || isUploadingImage}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/25 transition active:scale-95 disabled:opacity-40"
                    >
                      {isPublishingPost ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-black" />
                          <span>{isUploadingImage ? tr('بەرزکردنەوەی وێنە…', 'Uploading…') : tr('خەریکی بڵاوکردنەوەیە…', 'Publishing…')}</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>{tr('بڵاوکردنەوە', 'Publish')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* ── FULLSCREEN IMAGE LIGHTBOX MODAL ── */}
      <AnimatePresence>
        {activeLightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveLightboxImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          >
            <button
              onClick={() => setActiveLightboxImage(null)}
              className="absolute top-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition shadow-lg"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={activeLightboxImage}
              alt="Full preview"
              className="max-h-[90vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
