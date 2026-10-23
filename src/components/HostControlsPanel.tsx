import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  X,
  Lock,
  Unlock,
  Mic,
  MicOff,
  UserX,
  Megaphone,
  Check,
  AlertTriangle,
  Crown,
  Trash2,
  Gamepad2,
  Music,
} from 'lucide-react';
import type { Room, Seat, User, JackarooGame } from '../types';
import {
  kickUserFromSeat,
  toggleSeatLock,
  muteSeatByHost,
  sendRoomMessage,
  clearRoomChat,
  closeJackarooGame,
  updateRoomPassword,
} from '../services';

interface HostControlsPanelProps {
  room: Room;
  currentUser: User;
  activeJackarooGame?: JackarooGame | null;
  onOpenMusicPlayer?: () => void;
  onClose: () => void;
}

export default function HostControlsPanel({
  room,
  currentUser,
  activeJackarooGame,
  onOpenMusicPlayer,
  onClose,
}: HostControlsPanelProps) {
  const [announcementText, setAnnouncementText] = useState('');
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState(room.password || '');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSavedMsg, setPasswordSavedMsg] = useState<string | null>(null);

  const handleRemovePassword = async () => {
    setIsSavingPassword(true);
    setActionError(null);
    try {
      await updateRoomPassword(room.id, null);
      setPasswordInput('');
      setPasswordSavedMsg('پاسۆرد لەسەر ژوورەکە لادرا!');
      setTimeout(() => setPasswordSavedMsg(null), 2500);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا پاسۆرد لاببرێت');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    setActionError(null);
    try {
      await updateRoomPassword(room.id, passwordInput.trim() || null);
      setPasswordSavedMsg(
        passwordInput.trim() ? 'پاسۆردی نوێ دانرا!' : 'پاسۆرد لەسەر ژوورەکە لادرا!',
      );
      setTimeout(() => setPasswordSavedMsg(null), 2500);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا پاسۆرد بگۆڕدرێت');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleKick = async (seat: Seat) => {
    if (!seat.userId) return;
    if (seat.userId === currentUser.uid) {
      setActionError('ناتوانیت خۆت لە کورسی خاوەن ژوور لابدەیت.');
      return;
    }
    setActionError(null);
    try {
      await kickUserFromSeat(room.id, seat.seatNo, currentUser.username);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا ئەندام لاربدرێت.');
    }
  };

  const handleToggleLock = async (seat: Seat) => {
    setActionError(null);
    try {
      await toggleSeatLock(room.id, seat.seatNo, !seat.isLocked);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا دۆخی قفڵی کورسی بگۆڕدرێت.');
    }
  };

  const handleToggleMute = async (seat: Seat) => {
    setActionError(null);
    try {
      await muteSeatByHost(room.id, seat.seatNo, !seat.isMuted);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا دۆخی بێدەنگی بگۆڕدرێت.');
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    setIsAnnouncing(true);
    setActionError(null);
    try {
      await sendRoomMessage(
        room.id,
        'system',
        'Host Announcement',
        `[Announcement] ${announcementText.trim()}`,
      );
      setAnnouncementText('');
      setAnnouncementSuccess(true);
      setTimeout(() => setAnnouncementSuccess(false), 2000);
    } catch (err: any) {
      setActionError(err.message || 'نەتوانرا ئاگاداری بڵاوبکرێتەوە.');
    } finally {
      setIsAnnouncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                  ناوەندی کۆنترۆڵی خاوەن ژوور
                </h3>
                <span className="flex items-center gap-0.5 rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                  <Crown className="h-2.5 w-2.5" /> خاوەن
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{room.roomName} &bull; بەڕێوەبردنی ٨ کورسی ژوور</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {actionError && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Seats List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* Quick Host Room Actions: Clear Chat, Cancel Game, Play Music */}
          <div className="grid grid-cols-3 gap-2 pb-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await clearRoomChat(room.id);
                } catch (err: any) {
                  setActionError(err.message || 'نەتوانرا چات بسڕدرێتەوە');
                }
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-center text-[11px] font-bold text-rose-300 transition hover:bg-rose-500/20 active:scale-95"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>سڕینەوەی چات</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await closeJackarooGame(room.id);
                } catch (err: any) {
                  setActionError(err.message || 'نەتوانرا یاری هەڵبوەشێنرێتەوە');
                }
              }}
              disabled={!activeJackarooGame}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-center text-[11px] font-bold text-amber-300 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-40"
            >
              <Gamepad2 className="h-4 w-4 text-amber-400" />
              <span>داخستنی یاری</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenMusicPlayer?.();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-center text-[11px] font-bold text-violet-300 transition hover:bg-violet-500/20 active:scale-95"
            >
              <Music className="h-4 w-4 text-violet-400" />
              <span>پێکردنی گۆرانی</span>
            </button>
          </div>

          {/* Room Password Management Card (Remove or Set Password) */}
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {room.isPrivate && room.password ? (
                  <Lock className="h-4 w-4 text-rose-400" />
                ) : (
                  <Unlock className="h-4 w-4 text-emerald-400" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">
                    پاسۆردی ژوور (Room Password)
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {room.isPrivate && room.password
                      ? `ژوورەکە قفڵدراوە · پاسۆرد: ${room.password}`
                      : 'ژوورەکە کراوەیە و بێ پاسۆردە'}
                  </p>
                </div>
              </div>

              {room.isPrivate && room.password && (
                <button
                  type="button"
                  onClick={handleRemovePassword}
                  disabled={isSavingPassword}
                  className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/30 active:scale-95 disabled:opacity-50"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>لابردنی پاسۆرد</span>
                </button>
              )}
            </div>

            {passwordSavedMsg && (
              <p className="text-[11px] font-bold text-emerald-400">{passwordSavedMsg}</p>
            )}

            <form onSubmit={handleSaveNewPassword} className="flex items-center gap-2">
              <input
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="پاسۆردی نوێ بنووسە (بەتاڵی بهێڵەوە بۆ لابردن)..."
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isSavingPassword}
                className="shrink-0 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-black transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
              >
                {passwordInput.trim() ? 'دانانی پاسۆرد' : 'لابردن'}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              کۆنترۆڵی کورسییەکان (٨ شوێن)
            </span>
            <span className="text-[10px] text-slate-500">
              {room.seats.filter((s) => s.userId).length}/٨ قسەکەرانی چالاک
            </span>
          </div>

          <div className="space-y-2">
            {room.seats.map((seat) => {
              const isOccupied = Boolean(seat.userId);
              const isCurrentUser = seat.userId === currentUser.uid;

              return (
                <div
                  key={seat.seatNo}
                  className={`flex items-center justify-between rounded-2xl border p-3 transition ${
                    isOccupied
                      ? 'border-slate-800 bg-slate-950/70'
                      : seat.isLocked
                      ? 'border-rose-500/20 bg-rose-500/[0.03]'
                      : 'border-slate-800/50 bg-slate-950/30'
                  }`}
                >
                  {/* Seat Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs ${
                        isOccupied
                          ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md'
                          : seat.isLocked
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isOccupied ? (
                        seat.username?.charAt(0).toUpperCase()
                      ) : seat.isLocked ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        `#${seat.seatNo}`
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">
                          کورسی #{seat.seatNo}
                        </span>
                        {isOccupied && (
                          <span className="text-xs text-slate-300 font-medium">
                            &bull; {isCurrentUser ? 'تۆ (خاوەن ژوور)' : seat.username}
                          </span>
                        )}
                        {seat.isLocked && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold text-rose-300 uppercase">
                            قفڵکراو
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {isOccupied
                          ? seat.isMuted
                            ? 'مایک: بێدەنگکراو'
                            : 'مایک: چالاک'
                          : seat.isLocked
                          ? 'لەلایەن خاوەن ژوورەوە قفڵکراوە - ناتوانرێت دابنیشیت'
                          : 'بەتاڵە - کراوەیە بۆ هەموو گوێگران'}
                      </p>
                    </div>
                  </div>

                  {/* Seat Controls */}
                  <div className="flex items-center gap-1.5">
                    {isOccupied && !isCurrentUser && (
                      <>
                        <button
                          onClick={() => handleToggleMute(seat)}
                          title={seat.isMuted ? 'Unmute Speaker' : 'Force Mute Speaker'}
                          className={`rounded-xl p-2 transition ${
                            seat.isMuted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                        >
                          {seat.isMuted ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          onClick={() => handleKick(seat)}
                          title="Evict Speaker from Seat"
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20 transition"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {!isOccupied && (
                      <button
                        onClick={() => handleToggleLock(seat)}
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                          seat.isLocked
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'border border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {seat.isLocked ? (
                          <>
                            <Unlock className="h-3.5 w-3.5" />
                            <span>کردنەوە</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            <span>قفڵکردنی کورسی</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ئاگاداری ژوور Composer */}
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Megaphone className="h-4 w-4" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  ئاگاداری ژوور
                </h4>
              </div>
              {announcementSuccess && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <Check className="h-3 w-3" /> بڵاوکرایەوە!
                </span>
              )}
            </div>

            <form onSubmit={handleSendAnnouncement} className="space-y-2">
              <input
                type="text"
                maxLength={140}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="نامەیەکی گرنگ لە چاتی ژووردا بڵاوبکەرەوە..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!announcementText.trim() || isAnnouncing}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
              >
                {isAnnouncing ? 'خەریکی بڵاوکردنەوەیە...' : 'بڵاوکردنەوەی ئاگاداری'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
