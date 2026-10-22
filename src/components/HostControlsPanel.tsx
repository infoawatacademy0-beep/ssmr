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

  const handleKick = async (seat: Seat) => {
    if (!seat.userId) return;
    if (seat.userId === currentUser.uid) {
      setActionError('You cannot kick yourself from the host seat.');
      return;
    }
    setActionError(null);
    try {
      await kickUserFromSeat(room.id, seat.seatNo, currentUser.username);
    } catch (err: any) {
      setActionError(err.message || 'Failed to kick user.');
    }
  };

  const handleToggleLock = async (seat: Seat) => {
    setActionError(null);
    try {
      await toggleSeatLock(room.id, seat.seatNo, !seat.isLocked);
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle seat lock.');
    }
  };

  const handleToggleMute = async (seat: Seat) => {
    setActionError(null);
    try {
      await muteSeatByHost(room.id, seat.seatNo, !seat.isMuted);
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle mute state.');
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
      setActionError(err.message || 'Failed to send announcement.');
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
                  Host Command Center
                </h3>
                <span className="flex items-center gap-0.5 rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                  <Crown className="h-2.5 w-2.5" /> HOST
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{room.roomName} &bull; 8-Seat Stage Moderation</p>
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

          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Seat Moderation (8 Slots)
            </span>
            <span className="text-[10px] text-slate-500">
              {room.seats.filter((s) => s.userId).length}/8 Active Speakers
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
                          Seat #{seat.seatNo}
                        </span>
                        {isOccupied && (
                          <span className="text-xs text-slate-300 font-medium">
                            &bull; {isCurrentUser ? 'You (Host)' : seat.username}
                          </span>
                        )}
                        {seat.isLocked && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold text-rose-300 uppercase">
                            Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {isOccupied
                          ? seat.isMuted
                            ? 'Microphone: Muted'
                            : 'Microphone: Active'
                          : seat.isLocked
                          ? 'Locked by host - members cannot sit'
                          : 'Vacant - open to all listeners'}
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
                            <span>Unlock</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            <span>Lock Seat</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Room Announcement Composer */}
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Megaphone className="h-4 w-4" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Room Announcement
                </h4>
              </div>
              {announcementSuccess && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <Check className="h-3 w-3" /> Broadcasted!
                </span>
              )}
            </div>

            <form onSubmit={handleSendAnnouncement} className="space-y-2">
              <input
                type="text"
                maxLength={140}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Broadcast a prominent message across room chat..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!announcementText.trim() || isAnnouncing}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
              >
                {isAnnouncing ? 'Broadcasting...' : 'Broadcast Announcement'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
