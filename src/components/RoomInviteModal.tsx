import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  X,
  Share2,
  Check,
  Send,
  Radio,
  Search,
} from 'lucide-react';
import type { Room, User } from '../types';
import { searchUsersByUsername, sendRoomInvite } from '../services';

interface RoomInviteModalProps {
  room: Room;
  currentUser: User;
  onClose: () => void;
}

export default function RoomInviteModal({
  room,
  currentUser,
  onClose,
}: RoomInviteModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState(false);
  const [isSending, setIsSending] = useState<string | null>(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      // Default to general search
      searchUsersByUsername('a', 10).then((res) => {
        setUsers(res.filter((u) => u.uid !== currentUser.uid));
      });
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchUsersByUsername(searchTerm, 10);
      setUsers(results.filter((u) => u.uid !== currentUser.uid));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser.uid]);

  const handleSendInvite = async (targetUser: User) => {
    setIsSending(targetUser.uid);
    try {
      await sendRoomInvite({
        roomId: room.id,
        roomName: room.roomName,
        hostUid: currentUser.uid,
        hostName: currentUser.username,
        inviteeUid: targetUser.uid,
      });
      setInvitedUids((prev) => new Set([...prev, targetUser.uid]));
    } catch (err) {
      console.error('Failed to send invite:', err);
    } finally {
      setIsSending(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-violet-500/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                بانگهێشت بۆ ژوور
              </h3>
              <p className="text-[10px] text-slate-400">بانگهێشتکردنی هاوڕێیان بۆ {room.roomName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Share Link Row */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Radio className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate text-xs font-semibold text-slate-300">
                {window.location.href}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-black shadow-md hover:bg-amber-400"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>کۆپی کرا</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>کۆپیکردنی لینک</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ناوی ئەندام بنووسە بۆ بانگهێشتکردن..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {users.map((target) => {
            const hasBeenInvited = invitedUids.has(target.uid);
            const isCurrentlySending = isSending === target.uid;

            return (
              <div
                key={target.uid}
                className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
                    {target.avatar || target.profileImage ? (
                      <img
                        src={target.avatar || target.profileImage}
                        alt={target.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      target.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{target.username}</h4>
                    <span className="text-[10px] text-slate-400">ئاستی {target.level || 1}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSendInvite(target)}
                  disabled={hasBeenInvited || isCurrentlySending}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
                    hasBeenInvited
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50'
                  }`}
                >
                  {hasBeenInvited ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>نێردرا</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>{isCurrentlySending ? 'دەنێردرێت...' : 'بانگهێشت'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
