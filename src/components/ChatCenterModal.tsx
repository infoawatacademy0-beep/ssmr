import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  X,
  ArrowRight,
  Plus,
} from 'lucide-react';
import type { User, UserInboxItem } from '../types';
import { subscribeToUserInbox, searchUsersByUsername } from '../services';
import { useLanguage } from '../contexts';

interface ChatCenterModalProps {
  currentUser: User;
  onClose: () => void;
  onSelectUser: (user: { uid: string; username: string; avatar?: string | null }) => void;
}

function formatInboxTime(timestamp: number, isEn: boolean): string {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return isEn ? 'Just now' : 'هەر ئێستا';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} خولەک لەمەوبەر`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return isEn ? `${diffHr}h ago` : `${diffHr} کاتژمێر لەمەوبەر`;
  const diffDays = Math.floor(diffHr / 24);
  return isEn ? `${diffDays}d ago` : `${diffDays} ڕۆژ لەمەوبەر`;
}

export default function ChatCenterModal({
  currentUser,
  onClose,
  onSelectUser,
}: ChatCenterModalProps) {
  const { tr, language } = useLanguage();
  const isEn = language === 'en';

  const [inboxThreads, setInboxThreads] = useState<UserInboxItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'search'>('inbox');

  // 1. Subscribe to user's real-time inbox threads
  useEffect(() => {
    const unsub = subscribeToUserInbox(currentUser.uid, (threads) => {
      setInboxThreads(threads);
    });
    return () => unsub();
  }, [currentUser.uid]);

  // 2. Search users when typing
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(term);
        // Exclude self from search
        setSearchResults(results.filter((u) => u.uid !== currentUser.uid));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser.uid]);

  const filteredInbox = inboxThreads.filter((t) =>
    (t.recipientName || '').toLowerCase().includes(searchTerm.toLowerCase().trim()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex h-[88vh] max-h-[680px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-black text-white">
                {tr('نامەی تایبەتی', 'Direct Messages')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {tr('چاتی ڕاستەوخۆ و پارێزراو', 'Live & Secure Private Chat')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-800/60 bg-slate-900/30">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value.trim() && activeTab !== 'search') {
                  setActiveTab('search');
                } else if (!e.target.value.trim() && activeTab === 'search') {
                  setActiveTab('inbox');
                }
              }}
              placeholder={tr('گەڕان لە گفتوگۆکان یان دۆزینەوەی ئەندام...', 'Search chats or discover users...')}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
            />
          </div>

          {/* Tab Navigation */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'inbox'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{tr('گفتوگۆکان', 'Conversations')} ({inboxThreads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'search'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>{tr('دۆزینەوەی ئەندام', 'Find Members')}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-2">
          {/* TAB 1: RECENT INBOX CONVERSATIONS */}
          {activeTab === 'inbox' && (
            <>
              {filteredInbox.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 mb-3">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-white">
                    {tr('هێشتا هیچ گفتوگۆیەک نییە', 'No conversations yet')}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    {tr('هێشتا هیچ نامەیەکت نەناردووە. بەدوای ئەنداماندا بگەڕێ بۆ دەستپێکردنی چات!', 'You haven\'t started any chats yet. Search for members to begin!')}
                  </p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{tr('دەستپێکردنی چاتی نوێ', 'Start New Chat')}</span>
                  </button>
                </div>
              ) : (
                filteredInbox.map((item) => (
                  <button
                    key={item.threadId || item.recipientUid}
                    onClick={() => {
                      onSelectUser({
                        uid: item.recipientUid,
                        username: item.recipientName,
                        avatar: item.recipientAvatar,
                      });
                      onClose();
                    }}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 text-left transition hover:border-cyan-500/40 hover:bg-slate-900/90 hover:scale-[1.01]"
                  >
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 font-bold text-white shadow-md">
                      {item.recipientAvatar ? (
                        <img
                          src={item.recipientAvatar}
                          alt={item.recipientName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        item.recipientName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sm text-white truncate">
                          {item.recipientName}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 shrink-0">
                          {formatInboxTime(item.lastMessageTimestamp, isEn)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.lastSenderUid === currentUser.uid ? tr('تۆ: ', 'You: ') : ''}
                        {item.lastMessage || tr('فایلی نارد', 'Sent an attachment')}
                      </p>
                    </div>

                    <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
                  </button>
                ))
              )}
            </>
          )}

          {/* TAB 2: SEARCH & DISCOVER USERS TO CHAT */}
          {activeTab === 'search' && (
            <>
              {isSearching ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {tr('خەریکی گەڕانە...', 'Searching...')}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mb-2">
                    <Search className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white">
                    {searchTerm.trim()
                      ? tr(`هیچ ئەندامێک نەدۆزرایەوە بە ناوی "${searchTerm}"`, `No users found matching "${searchTerm}"`)
                      : tr('ناوی ئەندامێک بنووسە بۆ چاتکردن', 'Type a username to start chatting')}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {tr('بەدوای ناودا بگەڕێ بۆ ناردنی نامەی ڕاستەوخۆ', 'Search by username to send direct messages')}
                  </p>
                </div>
              ) : (
                searchResults.map((targetUser) => (
                  <div
                    key={targetUser.uid}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 transition hover:border-slate-700 hover:bg-slate-900/70"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 font-bold text-black shadow-md">
                        {targetUser.avatar || (targetUser as any).profileImage ? (
                          <img
                            src={targetUser.avatar || (targetUser as any).profileImage}
                            alt={targetUser.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          targetUser.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-white block truncate">
                          {targetUser.username}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {tr('ئاستی', 'Level')} {targetUser.level || 1} &bull; {(targetUser.coins ?? 0).toLocaleString()} {tr('کۆین', 'Coins')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelectUser({
                          uid: targetUser.uid,
                          username: targetUser.username,
                          avatar: targetUser.avatar || (targetUser as any).profileImage,
                        });
                        onClose();
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:scale-105 active:scale-95 transition"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{tr('چات', 'Chat')}</span>
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
