import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  CheckCheck,
  UserPlus,
  Gift,
  MessageSquare,
  Gamepad2,
  Radio,
  Sparkles,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '../types';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services';

interface NotificationCenterProps {
  currentUid: string;
  onClose: () => void;
  onOpenProfile?: (uid: string) => void;
}

function formatNotificationTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'هەر ئێستا';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} خولەک لەمەوبەر`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} کاتژمێر لەمەوبەر`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} ڕۆژ لەمەوبەر`;
}

export default function NotificationCenter({
  currentUid,
  onClose,
  onOpenProfile,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsub = subscribeToNotifications(currentUid, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsub();
  }, [currentUid]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(currentUid);
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markNotificationRead(currentUid, notif.id);
    }

    if (notif.actionUrl) {
      onClose();
      navigate(notif.actionUrl);
    } else if (notif.roomId) {
      onClose();
      navigate(`/room/${notif.roomId}`);
    } else if (notif.senderUid && onOpenProfile) {
      onClose();
      onOpenProfile(notif.senderUid);
    }
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="h-4 w-4 text-cyan-400" />;
      case 'gift_received':
        return <Gift className="h-4 w-4 text-amber-400" />;
      case 'dm_received':
        return <MessageSquare className="h-4 w-4 text-emerald-400" />;
      case 'game_invite':
        return <Gamepad2 className="h-4 w-4 text-violet-400" />;
      case 'room_invite':
        return <Radio className="h-4 w-4 text-rose-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-amber-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                ئاگادارکردنەوەکان
              </h3>
              <p className="text-[10px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} ئاگاداری نەخوێندراوە` : 'هەمووی خوێندراوەتەوە'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white transition"
              >
                <CheckCheck className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">خوێندنەوەی هەمووی</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ئاگادارکردنەوەکان List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8 text-slate-500">
              <Bell className="h-10 w-10 text-slate-700 mb-3" />
              <h4 className="text-xs font-bold text-slate-300">هیچ ئاگادارکردنەوەیەک نییە</h4>
              <p className="mt-1 text-[11px] text-slate-500 max-w-xs">
                کاتێک کەسێک دیاریت بۆ دەنێرێت، فۆڵۆت دەکات یان بانگهێشتت دەکات، لێرەدا دەردەکەوێت.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                    notif.isRead
                      ? 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
                      : 'border-amber-400/30 bg-amber-500/[0.04] shadow-md hover:border-amber-400/50'
                  }`}
                >
                  {/* Icon or Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800">
                      {getNotificationIcon(notif.type)}
                    </div>
                    {!notif.isRead && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="truncate text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {notif.title}
                      </h4>
                      <span className="shrink-0 text-[10px] text-slate-500 font-medium">
                        {formatNotificationTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>

                    {(notif.roomId || notif.actionUrl) && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <span>چوونە نێو ژوور</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
