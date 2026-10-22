import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Bell, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User, AppNotification } from '../types';
import {
  subscribeToUserInbox,
  subscribeToNotifications,
  markNotificationRead,
  playChatNotificationSound,
} from '../services';

interface IncomingChatToastProps {
  currentUser: User | null;
  activeChatRecipientUid?: string | null;
  onOpenChat: (recipient: { uid: string; username: string; avatar?: string }) => void;
}

interface ToastBannerData {
  id: string;
  kind: 'chat' | 'activity';
  senderUid: string;
  senderName: string;
  senderAvatar?: string | null;
  messagePreview: string;
  subtitle: string;
  roomId?: string;
  notifId?: string;
}

export default function IncomingChatToast({
  currentUser,
  activeChatRecipientUid,
  onOpenChat,
}: IncomingChatToastProps) {
  const navigate = useNavigate();
  const [activeToast, setActiveToast] = useState<ToastBannerData | null>(null);

  const seenThreadTimestampsRef = useRef<Record<string, number>>({});
  const inboxInitializedRef = useRef(false);

  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifsInitializedRef = useRef(false);

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = (banner: ToastBannerData) => {
    setActiveToast(banner);
    playChatNotificationSound();

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = setTimeout(() => {
      setActiveToast(null);
      dismissTimerRef.current = null;
    }, 6500);
  };

  // 1. Subscribe to real-time Direct Message Inbox (works both inside VoiceRoom and on Dashboard)
  useEffect(() => {
    if (!currentUser?.uid) return;

    inboxInitializedRef.current = false;
    seenThreadTimestampsRef.current = {};

    const unsub = subscribeToUserInbox(currentUser.uid, (threads) => {
      const now = Date.now();

      if (!inboxInitializedRef.current) {
        inboxInitializedRef.current = true;
        threads.forEach((t) => {
          seenThreadTimestampsRef.current[t.threadId] = t.lastMessageTimestamp || 0;
        });
        return;
      }

      const allowDMs = localStorage.getItem('ssmr_allow_dms') !== 'false';
      if (!allowDMs) return;

      for (const thread of threads) {
        const prevTs = seenThreadTimestampsRef.current[thread.threadId] || 0;
        const msgTs = thread.lastMessageTimestamp || 0;

        if (msgTs > prevTs) {
          seenThreadTimestampsRef.current[thread.threadId] = msgTs;

          const isFromOtherUser =
            thread.lastSenderUid && thread.lastSenderUid !== currentUser.uid;
          const isRecent = now - msgTs < 15000;
          const isCurrentlyOpen =
            activeChatRecipientUid && activeChatRecipientUid === thread.recipientUid;

          if (isFromOtherUser && isRecent && !isCurrentlyOpen) {
            triggerToast({
              id: `dm-${thread.threadId}-${msgTs}`,
              kind: 'chat',
              senderUid: thread.recipientUid,
              senderName: thread.recipientName || 'ئەندام',
              senderAvatar: thread.recipientAvatar || null,
              messagePreview: thread.lastMessage || 'نامەیەکی نوێت بۆ هات 💬',
              subtitle: 'نامەی تایبەتی نوێ · کلیک بکە بۆ وەڵامدانەوە',
            });
            break;
          }
        }
      }
    });

    return () => unsub();
  }, [currentUser?.uid, activeChatRecipientUid]);

  // 2. Subscribe to real-time Activity Notifications (room invites & follower updates)
  useEffect(() => {
    if (!currentUser?.uid) return;

    notifsInitializedRef.current = false;
    seenNotifIdsRef.current = new Set();

    const unsub = subscribeToNotifications(currentUser.uid, (notifs: AppNotification[]) => {
      const now = Date.now();

      if (!notifsInitializedRef.current) {
        notifsInitializedRef.current = true;
        notifs.forEach((n) => seenNotifIdsRef.current.add(n.id));
        return;
      }

      const pushEnabled = localStorage.getItem('ssmr_push_notifs') !== 'false';
      if (!pushEnabled) return;

      for (const n of notifs) {
        if (!seenNotifIdsRef.current.has(n.id)) {
          seenNotifIdsRef.current.add(n.id);

          if (!n.isRead && now - n.timestamp < 15000 && n.senderUid !== currentUser.uid) {
            triggerToast({
              id: `notif-${n.id}`,
              kind: 'activity',
              senderUid: n.senderUid,
              senderName: n.senderName || n.title,
              senderAvatar: n.senderAvatar || null,
              messagePreview: n.body,
              subtitle: n.title || 'ئاگادارکردنەوەی نوێ',
              roomId: n.roomId,
              notifId: n.id,
            });
            break;
          }
        }
      }
    });

    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleToastClick = () => {
    if (!activeToast || !currentUser) return;
    const toast = activeToast;
    setActiveToast(null);

    if (toast.kind === 'chat') {
      onOpenChat({
        uid: toast.senderUid,
        username: toast.senderName,
        avatar: toast.senderAvatar ?? undefined,
      });
    } else if (toast.kind === 'activity') {
      if (toast.notifId) {
        markNotificationRead(currentUser.uid, toast.notifId).catch(() => {});
      }
      if (toast.roomId) {
        navigate(`/room/${toast.roomId}`);
      }
    }
  };

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          key={activeToast.id}
          initial={{ y: -90, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -90, opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          className="fixed top-3 left-1/2 z-[80] w-[94vw] max-w-md -translate-x-1/2"
        >
          <div
            onClick={handleToastClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleToastClick();
            }}
            className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/50 bg-slate-950/95 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-2xl transition hover:border-amber-400 hover:bg-slate-900/95 active:scale-[0.98]"
          >
            {/* Glowing Accent Bar */}
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-400 via-yellow-500 to-rose-500" />

            {/* Sender Avatar */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 font-black text-base text-white shadow-md ring-2 ring-amber-400/40 ml-1">
              {activeToast.senderAvatar ? (
                <img
                  src={activeToast.senderAvatar}
                  alt={activeToast.senderName}
                  className="h-full w-full object-cover"
                />
              ) : (
                (activeToast.senderName || 'U').charAt(0).toUpperCase()
              )}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black shadow">
                {activeToast.kind === 'chat' ? (
                  <MessageSquare className="h-3 w-3 fill-black" />
                ) : (
                  <Bell className="h-3 w-3 fill-black" />
                )}
              </span>
            </div>

            {/* Notification Text Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-display text-xs font-black text-white">
                  {activeToast.senderName}
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                  {activeToast.kind === 'chat' ? 'نامەی نوێ' : 'ئاگاداری'}
                  <ArrowUpRight className="h-2.5 w-2.5" />
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-100">
                {activeToast.messagePreview}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-amber-300/90">
                {activeToast.subtitle}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/15 hover:text-white"
              title="داخستن"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
