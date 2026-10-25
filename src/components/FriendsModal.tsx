import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  X,
  MessageSquare,
  Crown,
  BadgeCheck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import type { User } from '../types';
import { getVipAvatarClass } from '../types';
import { useLanguage } from '../contexts';
import {
  followUser,
  unfollowUser,
  acceptFollow,
  subscribeToFriendsList,
  subscribeToFollowersList,
  subscribeToFollowingList,
  subscribeToFriendsCount,
  subscribeToFollowersCount,
  subscribeToFollowingCount,
} from '../services';

interface FriendsModalProps {
  currentUser: User;
  targetUser?: User | null;
  initialTab?: 'friends' | 'followers' | 'following';
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenDirectMessage?: (user: { uid: string; username: string; avatar?: string }) => void;
}

export default function FriendsModal({
  currentUser,
  targetUser,
  initialTab = 'friends',
  onClose,
  onOpenProfile,
  onOpenDirectMessage,
}: FriendsModalProps) {
  const { tr } = useLanguage();
  const activeUser = targetUser || currentUser;
  const isViewingSelf = activeUser.uid === currentUser.uid;

  const [activeTab, setActiveTab] = useState<'friends' | 'followers' | 'following'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');

  const [friends, setFriends] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);

  const [friendsCount, setFriendsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // My current following set (for determining button states: follow, unfollow, follow back)
  const [myFollowingMap, setMyFollowingMap] = useState<Record<string, boolean>>({});
  const [isProcessingUid, setIsProcessingUid] = useState<string | null>(null);

  // 1. Subscribe to counts
  useEffect(() => {
    const unsubFriends = subscribeToFriendsCount(activeUser.uid, setFriendsCount);
    const unsubFollowers = subscribeToFollowersCount(activeUser.uid, setFollowersCount);
    const unsubFollowing = subscribeToFollowingCount(activeUser.uid, setFollowingCount);

    return () => {
      unsubFriends();
      unsubFollowers();
      unsubFollowing();
    };
  }, [activeUser.uid]);

  // 2. Track current user's following list (to see if current user follows each item)
  useEffect(() => {
    const unsub = subscribeToFollowingList(currentUser.uid, (myFollowings) => {
      const map: Record<string, boolean> = {};
      myFollowings.forEach((u) => {
        map[u.uid] = true;
      });
      setMyFollowingMap(map);
    });
    return () => unsub();
  }, [currentUser.uid]);

  // 3. Subscribe to active user's lists
  useEffect(() => {
    const unsubFriends = subscribeToFriendsList(activeUser.uid, setFriends);
    const unsubFollowers = subscribeToFollowersList(activeUser.uid, setFollowers);
    const unsubFollowing = subscribeToFollowingList(activeUser.uid, setFollowing);

    return () => {
      unsubFriends();
      unsubFollowers();
      unsubFollowing();
    };
  }, [activeUser.uid]);

  // Handle follow / unfollow toggle
  const handleToggleFollow = async (targetUid: string) => {
    if (isProcessingUid || targetUid === currentUser.uid) return;
    setIsProcessingUid(targetUid);
    const isCurrentlyFollowing = Boolean(myFollowingMap[targetUid]);

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.uid, targetUid);
        setMyFollowingMap((prev) => ({ ...prev, [targetUid]: false }));
      } else {
        await followUser(currentUser.uid, targetUid);
        setMyFollowingMap((prev) => ({ ...prev, [targetUid]: true }));
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setIsProcessingUid(null);
    }
  };

  // Handle accepting follow back
  const handleAcceptFollow = async (follower: User) => {
    if (isProcessingUid || follower.uid === currentUser.uid) return;
    setIsProcessingUid(follower.uid);
    try {
      await acceptFollow(
        {
          uid: currentUser.uid,
          username: currentUser.username,
          avatar: currentUser.avatar || currentUser.profileImage,
        },
        follower.uid,
      );
      setMyFollowingMap((prev) => ({ ...prev, [follower.uid]: true }));
    } catch (err) {
      console.error('Failed to accept follow:', err);
    } finally {
      setIsProcessingUid(null);
    }
  };

  // Filter current active list by search term
  const getDisplayList = () => {
    let source: User[] = [];
    if (activeTab === 'friends') source = friends;
    else if (activeTab === 'followers') source = followers;
    else if (activeTab === 'following') source = following;

    const term = searchTerm.toLowerCase().trim();
    if (!term) return source;
    return source.filter((u) =>
      (u.username || '').toLowerCase().includes(term) || (u.bio || '').toLowerCase().includes(term),
    );
  };

  const displayList = getDisplayList();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex h-[88vh] max-h-[680px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-800 bg-[#0c0d14] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-black text-white">
                  {isViewingSelf
                    ? tr('لیستی هاوڕێ و فۆڵۆوەکانم', 'My Friends & Follows')
                    : tr(`هاوڕێ و فۆڵۆوەکانی ${activeUser.username}`, `${activeUser.username}'s Connections`)}
                </h2>
                <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black text-amber-400 uppercase border border-amber-400/20">
                  {friendsCount + followersCount}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {tr('هاوڕێیانی دوولایەنە، فۆڵۆوکاران و فۆڵۆوکراوەکان', 'Mutual friends, followers and following')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Subtabs Bar */}
        <div className="grid grid-cols-3 border-b border-white/[0.06] bg-slate-950/40 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
              activeTab === 'friends'
                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
            }`}
          >
            <HeartHandshake className="h-3.5 w-3.5 text-amber-400" />
            <span>{tr('هاوڕێکان', 'Friends')}</span>
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
              {friendsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('followers')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
              activeTab === 'followers'
                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <span>{tr('فۆڵۆوکاران', 'Followers')}</span>
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
              {followersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('following')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
              activeTab === 'following'
                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-purple-400" />
            <span>{tr('فۆڵۆوکراوان', 'Following')}</span>
            <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-mono text-purple-300">
              {followingCount}
            </span>
          </button>
        </div>

        {/* Search Filter Box */}
        <div className="p-3 border-b border-white/[0.06] bg-slate-900/30">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr('گەڕان بەپێی ناو یان کورتە…', 'Search members…')}
              className="w-full rounded-2xl border border-white/[0.08] bg-slate-950/70 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:bg-slate-900/80"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 rounded-full p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* User List Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {displayList.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
              <Users className="h-10 w-10 text-slate-700 mb-2.5 stroke-1" />
              <h4 className="text-xs font-bold text-slate-300">
                {searchTerm
                  ? tr('هیچ ئەندامێک نەدۆزرایەوە', 'No matching members found')
                  : activeTab === 'friends'
                    ? tr('هێشتا هیچ هاوڕێیەکی دوولایەنە نییە', 'No mutual friends yet')
                    : activeTab === 'followers'
                      ? tr('هێشتا هیچ فۆڵۆوکارێک نییە', 'No followers yet')
                      : tr('هێشتا فۆڵۆوی کەست نەکردووە', 'Not following anyone yet')}
              </h4>
              <p className="mt-1 text-[11px] text-slate-500 max-w-xs">
                {activeTab === 'friends'
                  ? tr(
                      'کاتێک لەگەڵ کەسێک فۆڵۆوی یەکتر بکەن، دەبن بە هاوڕێ و لێرەدا دەردەکەون.',
                      'When two users follow each other, they become mutual friends here.',
                    )
                  : tr(
                      'دەتوانیت لە بەشی گەڕاندا بەدوای هاوڕێیاندا بگەڕێیت و فۆڵۆویان بکەیت.',
                      'Discover other users and start following them from the discovery panel.',
                    )}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {displayList.map((user) => {
                const isCurrentUser = user.uid === currentUser.uid;
                const isUserFollowedByMe = Boolean(myFollowingMap[user.uid]);
                const isUserFollowingMe = Boolean(
                  (followers.some((f) => f.uid === user.uid) && isViewingSelf) ||
                    (currentUser.followers && currentUser.followers[user.uid]),
                );
                const isMutualFriend = isUserFollowedByMe && isUserFollowingMe;

                return (
                  <motion.div
                    key={user.uid}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-slate-900/40 p-3 transition hover:border-amber-400/30 hover:bg-slate-900/70"
                  >
                    {/* User Info (clickable to profile) */}
                    <div
                      onClick={() => {
                        onOpenProfile(user.uid);
                      }}
                      className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                    >
                      {/* Avatar with Live Indicator */}
                      <div
                        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0.5 ${
                          user.isVerified
                            ? `${getVipAvatarClass(user.isVerified, user.vipFrame)} bg-gradient-to-tr from-amber-300 via-orange-500 to-red-600`
                            : 'bg-gradient-to-tr from-amber-500 to-yellow-600'
                        }`}
                      >
                        {user.isVerified && (
                          <div className="absolute -top-2 -right-1 z-20 pointer-events-none">
                            <Crown className="h-4 w-4 text-amber-400 fill-amber-400 vip-crown-animation" />
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
                            <span className="font-display text-sm font-black text-amber-300">
                              {(user.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {/* Presence Dot */}
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-slate-950 ${
                            user.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </div>

                      {/* Username, Badges & Bio */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="truncate text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            {user.username}
                          </h4>
                          {user.isVerified && (
                            <BadgeCheck size={14} className="text-sky-400 fill-sky-400/20 shrink-0" />
                          )}
                          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-bold text-slate-300">
                            {tr('ئاستی', 'Lv')} {user.level || 1}
                          </span>
                          {isMutualFriend && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-400/20">
                              <HeartHandshake className="h-2.5 w-2.5" />
                              <span>{tr('هاوڕێ', 'Friend')}</span>
                            </span>
                          )}
                        </div>

                        <p className="truncate text-[11px] text-slate-400 mt-0.5">
                          {user.bio || tr('ئەندامی گۆڕەپانی دەنگی SSMR', 'Member of SSMR Live Arena')}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Direct Message button */}
                      {!isCurrentUser && onOpenDirectMessage && (
                        <button
                          onClick={() => {
                            onOpenDirectMessage({
                              uid: user.uid,
                              username: user.username,
                              avatar: user.avatar || user.profileImage,
                            });
                            onClose();
                          }}
                          title={tr('نامەی تایبەتی', 'Direct Message')}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 transition hover:bg-cyan-500/20"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Follow / Unfollow / Accept Follow Back Button */}
                      {!isCurrentUser && (
                        <>
                          {/* If they follow me, but I haven't followed them back yet: Accept & Follow Back button */}
                          {activeTab === 'followers' && !isUserFollowedByMe ? (
                            <button
                              onClick={() => handleAcceptFollow(user)}
                              disabled={isProcessingUid === user.uid}
                              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-1.5 text-xs font-black text-black shadow-md shadow-amber-500/20 transition hover:scale-105 active:scale-95"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>{tr('وەرگرتن و فۆڵۆو', 'Accept & Follow Back')}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleFollow(user.uid)}
                              disabled={isProcessingUid === user.uid}
                              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                                isUserFollowedByMe
                                  ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300'
                                  : 'border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600'
                              }`}
                            >
                              {isUserFollowedByMe ? (
                                <>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>{tr('فۆڵۆکراوە', 'Following')}</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-3.5 w-3.5" />
                                  <span>{tr('فۆڵۆکردن', 'Follow')}</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
