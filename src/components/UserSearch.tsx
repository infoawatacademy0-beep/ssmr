import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  User as UserIcon,
  UserPlus,
  UserCheck,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import type { User } from '../types';
import {
  searchUsersByUsername,
  followUser,
  unfollowUser,
  checkIsFollowing,
} from '../services';

interface UserSearchProps {
  currentUser: User;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenDirectMessage?: (user: { uid: string; username: string; avatar?: string }) => void;
}

export default function UserSearch({
  currentUser,
  onClose,
  onOpenProfile,
  onOpenDirectMessage,
}: UserSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delayTimer = setTimeout(async () => {
      try {
        const found = await searchUsersByUsername(searchTerm, 15);
        // Exclude current user from search results
        const filtered = found.filter((u) => u.uid !== currentUser.uid);
        setResults(filtered);

        // Fetch follow states for results
        const followStatus: Record<string, boolean> = {};
        for (const u of filtered) {
          followStatus[u.uid] = await checkIsFollowing(currentUser.uid, u.uid);
        }
        setFollowingMap(followStatus);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayTimer);
  }, [searchTerm, currentUser.uid]);

  const handleToggleFollow = async (targetUid: string) => {
    const isCurrentlyFollowing = Boolean(followingMap[targetUid]);
    setFollowingMap((prev) => ({ ...prev, [targetUid]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.uid, targetUid);
      } else {
        await followUser(currentUser.uid, targetUid);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      setFollowingMap((prev) => ({ ...prev, [targetUid]: isCurrentlyFollowing }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                Discover Users
              </h2>
              <p className="text-[10px] text-slate-400">Search members across Voice Arena</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-950/40">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or keyword..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400 mb-2" />
              <p className="text-xs">Searching global registry...</p>
            </div>
          ) : !searchTerm.trim() ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8 text-slate-500">
              <UserIcon className="h-10 w-10 text-slate-700 mb-3" />
              <h4 className="text-xs font-bold text-slate-300">Start Typing to Search</h4>
              <p className="mt-1 text-[11px] text-slate-500 max-w-xs">
                Find your friends, match competitors, and top arena streamers by typing their username.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8 text-slate-500">
              <Search className="h-10 w-10 text-slate-700 mb-3" />
              <h4 className="text-xs font-bold text-slate-300">No Users Found</h4>
              <p className="mt-1 text-[11px] text-slate-500">
                No active users match &quot;{searchTerm}&quot;. Try a different query.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {results.map((targetUser) => {
                const isFollowing = Boolean(followingMap[targetUser.uid]);

                return (
                  <motion.div
                    key={targetUser.uid}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 transition hover:border-slate-700"
                  >
                    <div
                      onClick={() => {
                        onClose();
                        onOpenProfile(targetUser.uid);
                      }}
                      className="flex cursor-pointer items-center gap-3 min-w-0 flex-1"
                    >
                      {/* Avatar */}
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md">
                        {targetUser.avatar || targetUser.profileImage ? (
                          <img
                            src={targetUser.avatar || targetUser.profileImage}
                            alt={targetUser.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          targetUser.username.charAt(0).toUpperCase()
                        )}
                        {/* Presence indicator */}
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-slate-950 ${
                            targetUser.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                      </div>

                      {/* User Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="truncate text-xs font-bold text-white hover:text-amber-300 transition-colors">
                            {targetUser.username}
                          </h4>
                          {targetUser.level && targetUser.level > 5 && (
                            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5 text-purple-300">
                            <Sparkles className="h-3 w-3" />
                            Level {targetUser.level || 1}
                          </span>
                          <span>&bull;</span>
                          <span className="truncate max-w-[140px] text-slate-500">
                            {targetUser.bio || 'Exploring Voice Arena'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => handleToggleFollow(targetUser.uid)}
                        className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                          isFollowing
                            ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                            : 'border border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>

                      {onOpenDirectMessage && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenDirectMessage({
                              uid: targetUser.uid,
                              username: targetUser.username,
                              avatar: targetUser.avatar || (targetUser as any).profileImage,
                            });
                          }}
                          title="Send Private Message"
                          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-400 hover:bg-cyan-500/20 transition active:scale-95"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onOpenProfile(targetUser.uid);
                        }}
                        title="View Full Profile"
                        className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
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
