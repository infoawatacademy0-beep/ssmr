import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Send,
  MessageSquare,
  Share2,
  Trash2,
  Sparkles,
  Clock,
  Check,
  Flame,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { Post, User } from '../types';
import {
  createPost,
  toggleLikePost,
  deletePost,
  subscribeToPosts,
} from '../services';

interface PostTimelineProps {
  currentUser: User;
  onOpenUserProfile?: (uid: string) => void;
}

function formatPostTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'هەر ئێستا';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} خولەک لەمەوبەر`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} کاتژمێر لەمەوبەر`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} ڕۆژ لەمەوبەر`;
}

export default function PostTimeline({
  currentUser,
  onOpenUserProfile,
}: PostTimelineProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Subscribe to real-time posts feed
  useEffect(() => {
    const unsubscribe = subscribeToPosts((allPosts) => {
      setPosts(allPosts);
    });
    return () => unsubscribe();
  }, []);

  // Handle Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if (!content) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      await createPost({
        authorUid: currentUser.uid,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatar || currentUser.profileImage || null,
        content,
      });
      setNewPostContent('');
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish post.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Like Toggle
  const handleToggleLike = async (postId: string) => {
    try {
      await toggleLikePost(postId, currentUser.uid);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Handle Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('ئایا دڵنیایت لە سڕینەوەی ئەم پۆستە؟')) return;
    try {
      await deletePost(postId, currentUser.uid);
    } catch (err: any) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  // Handle Share Link
  const handleSharePost = (postId: string) => {
    const shareUrl = `${window.location.origin}/#post-${postId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ── POST COMPOSER ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e0e18]/90 p-4 shadow-xl backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <div
            onClick={() => onOpenUserProfile?.(currentUser.uid)}
            className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-xs font-black text-black shadow-md transition hover:opacity-90"
          >
            {currentUser.avatar || currentUser.profileImage ? (
              <img
                src={currentUser.avatar || currentUser.profileImage}
                alt={currentUser.username}
                className="h-full w-full object-cover"
              />
            ) : (
              currentUser.username.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <form onSubmit={handleCreatePost} className="space-y-2.5">
              <textarea
                rows={2}
                maxLength={400}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="چی ڕوودەدات لە گۆڕەپانەکەت؟ نوێکاری، بانگهێشتی یاری یان بیرۆکەکانت بڵاوبکەرەوە…"
                className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:bg-white/[0.05]"
              />

              {publishError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{publishError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-slate-500">
                  {newPostContent.length}/400
                </span>

                <button
                  type="submit"
                  disabled={!newPostContent.trim() || isPublishing}
                  className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isPublishing ? 'خەریکی بڵاوکردنەوەیە…' : 'بڵاوکردنەوە'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── TIMELINE FEED ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-xs font-bold tracking-wider text-slate-300 uppercase">
              پۆستە گشتییەکان ({posts.length})
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">تۆڕی ڕاستەوخۆ</span>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.01] py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-2 border border-amber-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-white">هێشتا هیچ پۆستێک نییە</p>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              یەکەم کەس بە کە پۆستێک یان بانگهێشتی یاری لە تەواوی گۆڕەپاندا بڵاوبکاتەوە!
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {posts.map((post) => {
              const isAuthor = post.authorUid === currentUser.uid;
              const isLiked = Boolean(post.likedBy && post.likedBy[currentUser.uid]);
              const likesCount = post.likesCount || 0;

              return (
                <motion.article
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl border border-white/[0.07] bg-[#0e0e18]/80 p-4 shadow-lg backdrop-blur-md transition hover:border-white/[0.12] sm:p-5"
                >
                  {/* Post Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => onOpenUserProfile?.(post.authorUid)}
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
                              تۆ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{formatPostTime(post.timestamp)}</span>
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
                  <p className="mt-3 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
                    {post.content}
                  </p>

                  {/* Post Actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-xs text-slate-400">
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
                          <span className="text-emerald-400 text-[11px]">لینک کۆپی کرا</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="text-[11px]">هاوبەشکردن</span>
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
    </div>
  );
}
