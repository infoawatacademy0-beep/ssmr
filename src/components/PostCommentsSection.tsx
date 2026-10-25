import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Trash2,
  Crown,
  Clock,
  MessageSquare,
  AlertCircle,
  CornerDownRight,
} from 'lucide-react';
import type { PostComment, User } from '../types';
import { getVipAvatarClass } from '../types';
import {
  subscribeToPostComments,
  addPostComment,
  deletePostComment,
} from '../services';
import { useLanguage } from '../contexts';

interface PostCommentsSectionProps {
  postId: string;
  postAuthorUid: string;
  currentUser: User;
  onOpenUserProfile?: (uid: string) => void;
}

function formatCommentTime(timestamp: number, isEn: boolean = false): string {
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

export default function PostCommentsSection({
  postId,
  postAuthorUid,
  currentUser,
  onOpenUserProfile,
}: PostCommentsSectionProps) {
  const { tr, isEn } = useLanguage();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe to real-time comments on this post
  useEffect(() => {
    const unsub = subscribeToPostComments(postId, (list) => {
      setComments(list);
    });
    return () => unsub();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCommentText.trim();
    if (!clean || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await addPostComment(postId, {
        authorUid: currentUser.uid,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatar || currentUser.profileImage || null,
        authorIsVerified: Boolean(currentUser.isVerified),
        content: clean,
      });
      setNewCommentText('');
    } catch (err: any) {
      setErrorMsg(err.message || tr('نەتوانرا کۆمێنت بنێردرێت', 'Failed to post comment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const confirmText = tr(
      'ئایا دڵنیایت لە سڕینەوەی ئەم کۆمێنتە؟',
      'Are you sure you want to delete this comment?',
    );
    if (!window.confirm(confirmText)) return;

    try {
      await deletePostComment(postId, commentId, currentUser.uid);
    } catch (err: any) {
      alert(err.message || tr('نەتوانرا کۆمێنت بسڕدرێتەوە', 'Failed to delete comment'));
    }
  };

  return (
    <div className="mt-3.5 border-t border-white/[0.06] pt-3.5 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
        <div className="flex items-center gap-1.5 text-amber-400">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>
            {tr('کۆمێنتەکان', 'Comments')} ({comments.length})
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-medium">
          {tr('ڕاستەوخۆ', 'Live')}
        </span>
      </div>

      {/* Comment Input Composer */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-[10px] font-black text-black shadow-sm">
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

        <div className="relative flex-1">
          <input
            type="text"
            maxLength={250}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder={tr('کۆمێنتێک بنووسە…', 'Write a comment…')}
            className="w-full rounded-2xl border border-white/[0.08] bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:bg-slate-900/90 pr-9 rtl:pr-3 rtl:pl-9"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim() || isSubmitting}
            aria-label={tr('ناردنی کۆمێنت', 'Post Comment')}
            className="absolute top-1/2 -translate-y-1/2 right-2 rtl:right-auto rtl:left-2 flex h-6 w-6 items-center justify-center rounded-xl bg-amber-400 text-black shadow transition hover:scale-105 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Send className="h-3 w-3 stroke-[2.5]" />
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-2 pt-1 max-h-72 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-3 text-center">
            <p className="text-[11px] font-semibold text-slate-400">
              {tr('هێشتا هیچ کۆمێنتێک نییە', 'No comments yet')}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {tr(
                'یەکەم کەس بە کە بۆچوونی خۆت بنووسیت!',
                'Be the first to share your thoughts!',
              )}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((comment) => {
              const isMine = comment.authorUid === currentUser.uid;
              const isPostAuthor = postAuthorUid === currentUser.uid;
              const canDelete = isMine || isPostAuthor;

              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="group relative flex items-start gap-2.5 rounded-2xl border border-white/[0.05] bg-slate-950/40 p-2.5 transition hover:border-white/[0.1] hover:bg-slate-950/70"
                >
                  {/* Author Avatar */}
                  <div
                    onClick={() => onOpenUserProfile?.(comment.authorUid)}
                    className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[10px] font-black text-white shadow-sm ring-1 ring-white/10 hover:opacity-90"
                  >
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.authorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      comment.authorName.charAt(0).toUpperCase()
                    )}
                    {comment.authorIsVerified && (
                      <span className="absolute -top-0.5 -right-0.5 z-10 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 shadow">
                        <Crown className="h-1.5 w-1.5 text-black fill-black" />
                      </span>
                    )}
                  </div>

                  {/* Comment Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          onClick={() => onOpenUserProfile?.(comment.authorUid)}
                          className="cursor-pointer text-[11px] font-bold text-white hover:text-amber-300 transition-colors"
                        >
                          {comment.authorName}
                        </span>

                        {comment.authorIsVerified && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-1 py-0.2 text-[7px] font-black text-amber-300">
                            <Crown className="h-1.5 w-1.5 text-amber-400 fill-amber-400" />
                            VIP
                          </span>
                        )}

                        {isMine && (
                          <span className="rounded-md bg-white/[0.06] px-1 py-0.2 text-[8px] font-semibold text-slate-400">
                            {tr('تۆ', 'You')}
                          </span>
                        )}

                        {comment.authorUid === postAuthorUid && (
                          <span className="rounded-md bg-amber-400/10 border border-amber-400/20 px-1 py-0.2 text-[8px] font-bold text-amber-400">
                            {tr('خاوەنی پۆست', 'Author')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-500 font-medium">
                          {formatCommentTime(comment.timestamp, isEn)}
                        </span>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(comment.id)}
                            title={tr('سڕینەوەی کۆمێنت', 'Delete Comment')}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-1 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-words font-sans">
                      {comment.content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
