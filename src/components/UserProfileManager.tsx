import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User as UserIcon,
  Camera,
  Save,
  Clock,
  Sparkles,
  ShieldCheck,
  Eye,
  Coins,
  Award,
  X,
  Check,
  Flame,
  MessageSquare,
  FileText,
  ShieldAlert,
  UserPlus,
  UserCheck,
  Send,
  BadgeCheck,
  Crown,
} from 'lucide-react';
import { getVipAvatarClass, type User, type ProfileVisitor } from '../types';
import { useLanguage } from '../contexts';
import { AnimatedThemeOverlay } from './AnimatedThemeEffect';
import {
  updateUserSocialProfile,
  getUserSocialProfile,
  viewUserProfile,
  subscribeToUserVisitors,
  subscribeToUserPresence,
  subscribeToFollowState,
  followUser,
  unfollowUser,
  uploadImageToImgBB,
} from '../services';

import ReportModal from './ReportModal';

interface UserProfileManagerProps {
  currentUser: User;
  targetUid?: string | null;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: Partial<User>) => void;
  onOpenGiftStore?: (target: { uid: string; username: string }) => void;
  onOpenPrivateChat?: (target: { uid: string; username: string; avatar?: string | null }) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=180&auto=format&fit=crop&q=80',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=KingKurdistan&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=QueenRozh&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=ShadowWolf&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=GoldenLion&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/bottts/svg?seed=CyberVenom&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=AriaVIP&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DiyarPro&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=NarinStar&backgroundColor=ffd5dc',
];

function formatTimeAgo(timestamp: number, isEn: boolean = false): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return isEn ? 'Just now' : 'هەر ئێستا';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} خولەک لەمەوبەر`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return isEn ? `${diffHr}h ago` : `${diffHr} کاتژمێر لەمەوبەر`;
  const diffDays = Math.floor(diffHr / 24);
  return isEn ? `${diffDays}d ago` : `${diffDays} ڕۆژ لەمەوبەر`;
}

export default function UserProfileManager({
  currentUser,
  targetUid,
  onClose,
  onProfileUpdated,
  onOpenGiftStore,
  onOpenPrivateChat,
}: UserProfileManagerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isViewingSelf = !targetUid || targetUid === currentUser.uid;
  const { tr, language } = useLanguage();
  const isEn = language === "en";
  const activeUid = targetUid || currentUser.uid;

  const [profileData, setProfileData] = useState<User>(currentUser);
  const [isLoadingProfile, setIsLoadingProfile] = useState(!isViewingSelf);
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);

  // Real-time presence state
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: number; statusText: string }>({
    isOnline: false,
    lastSeen: Date.now(),
    statusText: 'Offline',
  });

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  // Moderation Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Editable fields state
  const [usernameInput, setUsernameInput] = useState(currentUser.username || '');
  const [bioInput, setBioInput] = useState(currentUser.bio || '');
  const [avatarInput, setAvatarInput] = useState(currentUser.avatar || currentUser.profileImage || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active sub-tab in modal: 'profile' or 'visitors'
  const [activeTab, setActiveTab] = useState<'profile' | 'visitors'>('profile');

  // 1. Fetch target user's profile if viewing someone else
  useEffect(() => {
    let isMounted = true;

    if (!isViewingSelf) {
      setIsLoadingProfile(true);
      // Log the profile visit
      viewUserProfile(activeUid, {
        uid: currentUser.uid,
        username: currentUser.username,
        avatar: currentUser.avatar,
      }).catch(console.error);

      getUserSocialProfile(activeUid)
        .then((fetched) => {
          if (isMounted && fetched) {
            setProfileData(fetched);
            setUsernameInput(fetched.username || '');
            setBioInput(fetched.bio || '');
            setAvatarInput(fetched.avatar || fetched.profileImage || '');
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingProfile(false);
        });
    } else {
      setProfileData(currentUser);
      setUsernameInput(currentUser.username || '');
      setBioInput(currentUser.bio || '');
      setAvatarInput(currentUser.avatar || currentUser.profileImage || '');
    }

    return () => {
      isMounted = false;
    };
  }, [activeUid, isViewingSelf, currentUser]);

  // 2. Real-time subscription to recent visitors
  useEffect(() => {
    const unsubscribe = subscribeToUserVisitors(activeUid, (updatedVisitors) => {
      setVisitors(updatedVisitors);
    });
    return () => unsubscribe();
  }, [activeUid]);

  // 3. Real-time presence subscription
  useEffect(() => {
    const unsubscribe = subscribeToUserPresence(activeUid, (pres) => {
      setPresence(pres);
    });
    return () => unsubscribe();
  }, [activeUid]);

  // 4. Follow status subscription
  useEffect(() => {
    if (isViewingSelf) return;
    const unsubscribe = subscribeToFollowState(currentUser.uid, activeUid, (following) => {
      setIsFollowing(following);
    });
    return () => unsubscribe();
  }, [currentUser.uid, activeUid, isViewingSelf]);

  // Toggle follow action
  const handleToggleFollow = async () => {
    if (isTogglingFollow) return;
    setIsTogglingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, activeUid);
      } else {
        await followUser(currentUser.uid, activeUid);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setIsTogglingFollow(false);
    }
  };

  // Auto-save profile picture immediately and navigate to Dashboard
  const handleAutoSaveAvatar = async (newAvatarUrl: string) => {
    if (!isViewingSelf || !newAvatarUrl) return;
    setAvatarInput(newAvatarUrl);
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const trimmedUsername = usernameInput.trim() || currentUser.username;
      await updateUserSocialProfile(currentUser.uid, {
        username: trimmedUsername,
        bio: bioInput.trim(),
        avatar: newAvatarUrl.trim(),
        profileImage: newAvatarUrl.trim(),
      });
      const updated = {
        ...profileData,
        username: trimmedUsername,
        bio: bioInput.trim(),
        avatar: newAvatarUrl.trim(),
        profileImage: newAvatarUrl.trim(),
      };
      setProfileData(updated);
      onProfileUpdated?.(updated);
      setSaveSuccess(true);
      onClose();
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || tr('نەتوانرا وێنەی پڕۆفایل خەزن بکرێت.', 'Failed to save profile picture.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isViewingSelf) return;

    const trimmedUsername = usernameInput.trim();
    if (!trimmedUsername) {
      setErrorMessage(tr('تکایە ناوی بەکارهێنەر بنووسە.', 'Please enter a username.'));
      return;
    }
    if (trimmedUsername.length < 3) {
      setErrorMessage(tr('ناو نابێت لە ٣ پیت کەمتر بێت.', 'Username must be at least 3 characters.'));
      return;
    }
    if (trimmedUsername.length > 25) {
      setErrorMessage(tr('ناو نابێت لە ٢٥ پیت زیاتر بێت.', 'Username cannot exceed 25 characters.'));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await updateUserSocialProfile(currentUser.uid, {
        username: trimmedUsername,
        bio: bioInput.trim(),
        avatar: avatarInput.trim(),
        profileImage: avatarInput.trim(),
      });

      const updated = {
        ...profileData,
        username: trimmedUsername,
        bio: bioInput.trim(),
        avatar: avatarInput.trim(),
        profileImage: avatarInput.trim(),
      };
      setProfileData(updated);
      onProfileUpdated?.(updated);

      setSaveSuccess(true);
      onClose();
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || tr('نەتوانرا پڕۆفایل نوێ بکرێتەوە.', 'Failed to update social profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayedUsername = (isViewingSelf ? usernameInput.trim() : '') || profileData.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/25 bg-[#0d0d16] shadow-2xl"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-md">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-black tracking-wider text-white uppercase">
                  {isViewingSelf ? 'بەڕێوەبردنی پڕۆفایل' : `پڕۆفایلی ${profileData.username}`}
                </h2>
                <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black text-amber-400 uppercase border border-amber-400/20">
                  ئاستی {profileData.level || 1}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {tr('ناسنامە و سەردانیکەرانی پڕۆفایل', 'Identity & profile visitors')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isViewingSelf && (
              <button
                onClick={() => setIsReportModalOpen(true)}
                title="Report User"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <ShieldAlert className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── SUB-TABS (PROFILE / VISITORS) ── */}
        <div className="flex border-b border-white/[0.06] bg-white/[0.01] px-6 pt-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>{tr("ناسنامەی پڕۆفایل", "Profile Identity")}</span>
          </button>

          <button
            onClick={() => setActiveTab('visitors')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'visitors'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{tr("سەردانیکەرانی ئەم دواییە", "Recent Visitors")} ({visitors.length})</span>
          </button>
        </div>

        {/* ── BODY CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">
              <Check className="h-4 w-4" />
              <span>{tr("پڕۆفایل بە سەرکەوتوویی نوێکرایەوە!", "Profile updated successfully!")}</span>
            </div>
          )}

          {activeTab === 'profile' && (
            <>
              {/* Profile Card Header Preview (with Custom Profile Cover if present) */}
              <div className={`relative overflow-hidden rounded-3xl border bg-slate-900/60 shadow-xl transition-all duration-300 ${
                profileData.isVerified
                  ? 'border-amber-400/50 shadow-amber-500/20 vip-border-glow'
                  : 'border-white/[0.08]'
              }`}>
                {profileData.profileCover || profileData.isVerified ? (
                  <div
                    className={`relative h-32 w-full overflow-hidden transition-all duration-500 ${
                      profileData.isVerified ? 'vip-animated-cover vip-shine-effect' : ''
                    }`}
                    style={
                      profileData.profileCover
                        ? profileData.profileCover.startsWith('http') || profileData.profileCover.startsWith('data:')
                          ? { backgroundImage: `url(${profileData.profileCover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : { background: profileData.profileCover }
                        : { background: 'linear-gradient(180deg, #1a0500 0%, #450a0a 35%, #9a3412 70%, #ea580c 90%, #fde047 100%)' }
                    }
                  >
                    {(!profileData.profileCover ||
                      (!profileData.profileCover.startsWith('http') &&
                        !profileData.profileCover.startsWith('data:'))) && (
                      <AnimatedThemeOverlay
                        themeValue={profileData.profileCover || 'real_fire'}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950" />
                    {profileData.isVerified && (
                      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-400/60 shadow-xl shadow-amber-500/30">
                        <Crown className="h-4 w-4 text-amber-400 fill-amber-400 vip-crown-animation" />
                        <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                          VIP ROYALE
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-10 w-full bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-transparent" />
                )}

                <div className="p-5 pt-0 relative z-10">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 -mt-8 sm:-mt-6">
                    {/* Avatar Display with Presence Indicator & VIP Blazing Fire Stroke */}
                    <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full p-0.5 shadow-xl ring-4 ring-slate-950 ${
                      profileData.isVerified
                        ? `${getVipAvatarClass(profileData.isVerified, profileData.vipFrame)} bg-gradient-to-tr from-amber-300 via-orange-500 to-red-600`
                        : 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 shadow-amber-500/20'
                    }`}>
                      {profileData.isVerified && (
                        <div className="absolute -top-3.5 -right-1 z-20 pointer-events-none flex items-center gap-0.5">
                          <Crown className="h-6 w-6 text-amber-400 fill-amber-400 vip-crown-animation drop-shadow-[0_2px_8px_rgba(251,191,36,0.95)]" />
                        </div>
                      )}
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0d0d16]">
                        {avatarInput ? (
                          <img
                            src={avatarInput}
                            alt={displayedUsername}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-2xl font-black text-amber-300">
                            {displayedUsername.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Live Presence Circle Dot */}
                      <span
                        className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full ring-2 ring-[#0d0d16] ${
                          presence.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-1 sm:pt-4">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 className="font-display text-base font-black text-white">
                          {displayedUsername}
                        </h3>
                        {profileData.isVerified && (
                          <div className="flex items-center gap-1.5">
                            <span
                              title="Verified Elite VIP Profile"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-wider uppercase shadow-sm shadow-amber-500/20"
                            >
                              <Crown className="h-3 w-3 text-amber-400 fill-amber-400" />
                              <span>VIP</span>
                            </span>
                            <span title="Verified Elite Profile" className="inline-flex items-center">
                              <BadgeCheck
                                size={16}
                                className="text-sky-400 fill-sky-400/20 shrink-0"
                              />
                            </span>
                          </div>
                        )}
                        <ShieldCheck className="h-4 w-4 text-cyan-400" />
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({presence.statusText})
                        </span>
                      </div>

                    <p className="text-xs text-slate-300 font-medium italic">
                      "{bioInput || profileData.bio || 'ئەندامی ژووری دەنگی SSMR.'}"
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                        <span>{(profileData.coins ?? 0).toLocaleString()} {tr("کۆین", "Coins")}</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                        <span>{tr("ئاستی", "Level")} {profileData.level || 1} ({profileData.xp || 0} XP)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Action Bar (Follow, Message, Send Gift) */}
                {!isViewingSelf && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-end gap-2">
                    {/* Mutual Follow Button */}
                    <button
                      onClick={handleToggleFollow}
                      disabled={isTogglingFollow}
                      className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                        isFollowing
                          ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300'
                          : 'border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                      <span>{isFollowing ? tr("فۆڵۆکراوە", "Following") : tr("فۆڵۆکردن", "Follow")}</span>
                    </button>

                    {/* Direct Message Button */}
                    {onOpenPrivateChat && (
                      <button
                        onClick={() => {
                          onOpenPrivateChat({
                            uid: profileData.uid,
                            username: profileData.username,
                            avatar: profileData.avatar,
                          });
                          onClose();
                        }}
                        className="flex items-center gap-1.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{tr("نامە", "Message")}</span>
                      </button>
                    )}

                    {/* Gift Store Button */}
                    {onOpenGiftStore && (
                      <button
                        onClick={() => onOpenGiftStore({ uid: profileData.uid, username: profileData.username })}
                        className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2 text-xs font-black text-black shadow-md shadow-amber-500/20"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{tr("ناردنی دیاری", "Send Gift")}</span>
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Edit Form (Only visible when viewing one's own profile) */}
              {isViewingSelf && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Change Username / گۆڕینی ناو */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {tr("ناوی بەکارهێنەر (گۆڕینی ناو)", "Username (Change Name)")}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder={tr("ناوی نوێ بنووسە…", "Enter new username…")}
                        minLength={3}
                        maxLength={25}
                        required
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:bg-white/[0.06]"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{tr("لانیکەم ٣ و زۆرینەی ٢٥ پیت", "3 to 25 characters")}</span>
                      <span>{usernameInput.length} / 25</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {tr("کورتەی پڕۆفایل / بایۆ (لانیکەم ١٦٠ پیت)", "Bio / Status (Max 160 chars)")}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={160}
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      placeholder={tr("کورتەیەک دەربارەی خۆت یان ئارەزووەکانت بنووسە…", "Write something about yourself or your interests…")}
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:bg-white/[0.06]"
                    />
                    <div className="mt-1 flex justify-end text-[10px] text-slate-500 font-mono">
                      {bioInput.length} / 160
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {tr("وێنەی پڕۆفایل (Profile Image)", "Profile Picture")}
                      </label>
                      <label
                        className={`flex cursor-pointer items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25 transition ${
                          isUploadingImage ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>{isUploadingImage ? tr('خەریکی بەرزکردنەوەیە...', 'Uploading...') : tr('هەڵبژاردن لە مۆبایل', 'Upload from Device')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingImage}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setIsUploadingImage(true);
                            setErrorMessage(null);
                            try {
                              const hostedUrl = await uploadImageToImgBB(file, `avatar_${currentUser.uid}`);
                              await handleAutoSaveAvatar(hostedUrl);
                            } catch (err: any) {
                              setErrorMessage(err.message || 'نەتوانرا وێنەکە بەرزبکرێتەوە بۆ ImgBB.');
                            } finally {
                              setIsUploadingImage(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={avatarInput}
                        onChange={(e) => setAvatarInput(e.target.value)}
                        placeholder={tr("بەستەری وێنە دابنێ یان لە خوارەوە هەڵبژێرە...", "Paste image URL or pick preset below...")}
                        className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                      />
                    </div>

                    {/* Quick Avatar Presets (24 Options) — Auto-saves & redirects to Dashboard on click */}
                    <div className="mt-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {tr("هەڵبژاردنی وێنەی پڕۆفایل", "Avatar Presets")} ({AVATAR_PRESETS.length} {tr("وێنە · خەزنکردنی خۆکار", "presets · auto-saves")}):
                      </span>
                      <div className="mt-2 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
                        {AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleAutoSaveAvatar(preset)}
                            className={`h-11 w-11 overflow-hidden rounded-xl border-2 transition-all hover:scale-105 ${
                              avatarInput === preset
                                ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                                : 'border-white/10 opacity-85 hover:opacity-100'
                            }`}
                          >
                            <img src={preset} alt={`preset-${idx + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-3.5 text-xs font-black text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      <span>{isSaving ? tr('خەریکی خەزنکردنە…', 'Saving…') : tr('خەزنکردنی پڕۆفایل', 'Save Profile')}</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {activeTab === 'visitors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {tr("تۆماری سەردانیکەران", "Visitors History")}
                </span>
                <span className="text-[10px] text-slate-500">
                  {tr("تۆمارکردنی ئۆتۆماتیکی هەر ٥ خولەک جارێک", "Recorded automatically every 5 minutes")}
                </span>
              </div>

              {visitors.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.01] py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500 mb-2">
                    <Eye className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">{tr("هێشتا هیچ سەردانیکەرێک تۆمار نەکراوە", "No visitors recorded yet")}</p>
                  <p className="mt-1 text-[11px] text-slate-500 max-w-xs">
                    {tr("کاتێک کەسانی تر پڕۆفایلەکەت دەکەنەوە، لێرەدا بە کاتەوە دەردەکەون.", "When other users open your profile, they will appear here.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visitors.map((visitor, idx) => (
                    <motion.div
                      key={`${visitor.visitorUid}-${visitor.timestamp}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-amber-400/30 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md">
                          {visitor.avatar ? (
                            <img
                              src={visitor.avatar}
                              alt={visitor.visitorName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            visitor.visitorName.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-white">
                            {visitor.visitorName}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {tr("سەردانی پڕۆفایلەکەتی کرد", "Visited your profile")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300/80">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>{formatTimeAgo(visitor.timestamp, isEn)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── MODERATION REPORT MODAL ── */}
      <AnimatePresence>
        {isReportModalOpen && (
          <ReportModal
            targetId={profileData.uid}
            targetType="user"
            targetName={profileData.username}
            reporterUid={currentUser.uid}
            reporterName={currentUser.username}
            onClose={() => setIsReportModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
