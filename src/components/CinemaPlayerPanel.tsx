import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  Crown,
  Mic,
  MicOff,
  Film,
  Users,
  Flame,
  Tv,
} from 'lucide-react';
import type { RoomCinemaState, Seat, User, AudienceMember } from '../types';
import { getVipAvatarClass } from '../types';
import { updateCinemaPlayback } from '../services';
import { useLanguage } from '../contexts';

interface CinemaPlayerPanelProps {
  roomId: string;
  roomName: string;
  cinemaState: RoomCinemaState;
  seats: Seat[];
  currentUser: User;
  isHost: boolean;
  speakingUids: Set<string>;
  vipUsersMap: Record<string, boolean>;
  vipFramesMap: Record<string, string>;
  usersAvatarMap: Record<string, string>;
  audience: AudienceMember[];
  onSeatClick: (seat: Seat) => void;
  onOpenConfigModal: () => void;
  onOpenGiftStore?: (targetUserId?: string, targetUsername?: string) => void;
  onOpenProfile?: (uid: string) => void;
}

const SEAT_NAME_COLORS = [
  'text-emerald-400',
  'text-cyan-400',
  'text-pink-400',
  'text-amber-400',
];

export default function CinemaPlayerPanel({
  roomId,
  roomName,
  cinemaState,
  seats,
  currentUser,
  isHost,
  speakingUids,
  vipUsersMap,
  vipFramesMap,
  usersAvatarMap,
  audience,
  onSeatClick,
  onOpenConfigModal,
  onOpenProfile,
}: CinemaPlayerPanelProps) {
  const { tr, isRTL } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [audioBlockedNotice, setAudioBlockedNotice] = useState(false);

  // We only use the first 4 seats for the cinema theater sofa (seats 1, 2, 3, 4)
  const cinemaSeats = seats.slice(0, 4);

  // Synchronize video playback with Firebase Realtime Database
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cinemaState.videoUrl) return;

    // Check play / pause
    if (cinemaState.isPlaying && video.paused) {
      video.play().catch(() => {
        // Autoplay with audio was blocked by browser
        setAudioBlockedNotice(true);
      });
    } else if (!cinemaState.isPlaying && !video.paused) {
      video.pause();
    }

    // Check drift time
    const expectedTime =
      cinemaState.currentTime +
      (cinemaState.isPlaying ? (Date.now() - cinemaState.lastUpdated) / 1000 : 0);

    const drift = Math.abs(video.currentTime - expectedTime);
    if (drift > 2.5 && Number.isFinite(expectedTime)) {
      video.currentTime = expectedTime;
    }
  }, [cinemaState.isPlaying, cinemaState.currentTime, cinemaState.lastUpdated, cinemaState.videoUrl]);

  // Handle master play / pause toggle (Only Host can push state to Firebase)
  const handleTogglePlayPause = async () => {
    if (!isHost) return;
    const video = videoRef.current;
    const nextPlaying = !cinemaState.isPlaying;
    const currentTime = video ? video.currentTime : cinemaState.currentTime;

    try {
      await updateCinemaPlayback(roomId, nextPlaying, currentTime, {
        uid: currentUser.uid,
        username: currentUser.username,
      });
    } catch (err) {
      console.error('Failed to sync cinema playback:', err);
    }
  };

  // Handle personal volume change (does not affect other users)
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setAudioBlockedNotice(false);
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = volume || 0.8;
      }
    } else {
      setIsMuted(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }
  };

  const handleToggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-black p-4 flex justify-center items-center' : 'p-3 pb-1'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. CINEMA SCREEN WIDESCREEN VIDEO PLAYER
          ───────────────────────────────────────────────────────────── */}
      <div
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-black border-2 border-rose-950/80 shadow-[0_10px_35px_rgba(0,0,0,0.9),0_0_25px_rgba(225,29,72,0.2)] group"
      >
        {/* Cinema Screen Backlight / Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none z-10" />

        {/* Video Element */}
        <video
          ref={videoRef}
          src={cinemaState.videoUrl}
          playsInline
          webkit-playsinline="true"
          crossOrigin="anonymous"
          onError={() => setVideoError(true)}
          onEnded={() => {
            if (isHost) {
              updateCinemaPlayback(roomId, false, 0);
            }
          }}
          className="h-full w-full object-contain bg-black"
        />

        {/* Browser Audio Autoplay Unblock Banner */}
        {audioBlockedNotice && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={handleToggleMute}
              className="flex items-center gap-2 rounded-full bg-amber-500 text-black px-4 py-1.5 text-xs font-black shadow-xl animate-bounce hover:scale-105 active:scale-95 transition"
            >
              <Volume2 className="h-4 w-4" />
              <span>{tr('کلیک بکە بۆ کردنەوەی دەنگی فیلمەکە 🔊', 'Tap to unmute movie sound 🔊')}</span>
            </button>
          </div>
        )}

        {/* Top Header Overlay on Video Screen */}
        <div className="absolute top-2.5 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
          {/* Movie Title & Live Badge */}
          <div className="flex items-center gap-2 max-w-[70%]">
            <span className="flex items-center gap-1 rounded-lg bg-rose-600/90 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-md animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span>CINEMA</span>
            </span>

            <h3 className="truncate font-display text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {cinemaState.title || roomName}
            </h3>
          </div>

          {/* Right Header Action Icons */}
          <div className="flex items-center gap-1.5">
            {isHost && (
              <button
                onClick={onOpenConfigModal}
                title={tr('ڕێکخستنی فیلم و لینکی فایەربەیس', 'Cinema & Movie Settings')}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/60 border border-white/20 text-white hover:bg-amber-500 hover:text-black transition shadow"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={handleToggleFullscreen}
              title={isFullscreen ? tr('دەرچوون لە گەورەکردن', 'Exit Fullscreen') : tr('تەواوی شاشە', 'Fullscreen')}
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/60 border border-white/20 text-white hover:bg-white/20 transition shadow"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Bottom Playback Control Bar (Visible on Hover or for Host) */}
        <div
          className={`absolute bottom-2 inset-x-3 z-20 flex items-center justify-between rounded-xl bg-black/70 border border-white/10 px-3 py-1.5 backdrop-blur-md transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Host Play / Pause */}
          <div className="flex items-center gap-2">
            {isHost ? (
              <button
                onClick={handleTogglePlayPause}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-black hover:bg-amber-300 transition active:scale-95"
              >
                {cinemaState.isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-black" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-black ml-0.5" />
                )}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-amber-300 font-bold">
                <Tv className="h-3 w-3" />
                <span>{cinemaState.isPlaying ? tr('پەخشکراو', 'Playing') : tr('وەستێنراو', 'Paused')}</span>
              </span>
            )}

            <span className="text-[10px] text-slate-300 font-mono">
              {cinemaState.updatedByName ? `${tr('بەڕێوەبەر', 'Host')}: ${cinemaState.updatedByName}` : ''}
            </span>
          </div>

          {/* Personal Volume Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className="p-1 text-slate-300 hover:text-white transition"
              title={isMuted ? tr('دەنگ بکەرەوە', 'Unmute') : tr('بێدەنگکردن', 'Mute')}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-24 accent-amber-400 cursor-pointer h-1 rounded bg-slate-700"
            />
          </div>
        </div>

        {/* Video Error Overlay */}
        {videoError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
            <Film className="h-8 w-8 text-rose-500 mb-2" />
            <p className="text-xs font-bold text-white">
              {tr('نەتوانرا ڤیدیۆکە لێبدرێت', 'Cannot play this video')}
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-1">
              {tr('تکایە دڵنیابەرەوە لە دروستی بەستەری فیلمەکە لە فایەربەیس.', 'Check the Firebase storage URL format or permissions.')}
            </p>
            {isHost && (
              <button
                onClick={onOpenConfigModal}
                className="mt-2.5 rounded-xl bg-amber-400 text-black px-3 py-1 text-xs font-bold"
              >
                {tr('گۆڕینی بەستەر', 'Change URL')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. THE 4-SEAT THEATER VELVET COUCH ("har wako wenaka")
          ───────────────────────────────────────────────────────────── */}
      <div className="relative mt-2.5 w-full">
        {/* Luxury Theater Couch Frame */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-rose-900/60 bg-gradient-to-b from-[#3a0a14] via-[#2a070e] to-[#1a0408] p-2.5 sm:p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.8),inset_0_2px_15px_rgba(244,63,94,0.15)]">
          {/* Gold Trim Decorative Accent */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          {/* 4 Connected Plush Cushions Grid */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {cinemaSeats.map((seat, index) => {
              const isOccupied = Boolean(seat.userId);
              const isCurrentUser = seat.userId === currentUser.uid;
              const isHostSeat = seat.userId === roomId; // or room.hostId
              const isSeatVip = Boolean(
                isOccupied &&
                  (seat.isVerified ||
                    (seat.userId && vipUsersMap[seat.userId]) ||
                    (isCurrentUser && currentUser.isVerified)),
              );
              const isSpeaking =
                isOccupied &&
                !seat.isMuted &&
                seat.userId !== null &&
                speakingUids.has(seat.userId);

              // Seat avatar style
              let avatarBorderClass =
                'border-2 border-dashed border-rose-400/30 bg-black/40 hover:border-amber-400/60 hover:bg-black/60';
              if (isOccupied) {
                if (isSeatVip) {
                  avatarBorderClass = getVipAvatarClass(
                    true,
                    seat.userId ? vipFramesMap[seat.userId] : undefined,
                  );
                } else if (isSpeaking) {
                  avatarBorderClass =
                    'border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.7)]';
                } else {
                  avatarBorderClass =
                    'border-2 border-amber-400/60 shadow-md shadow-amber-500/20';
                }
              }

              const seatAvatarUrl =
                seat.avatar ||
                (seat.userId ? usersAvatarMap[seat.userId] : null) ||
                (isCurrentUser ? currentUser.avatar || currentUser.profileImage : null) ||
                audience.find((a) => a.uid === seat.userId)?.avatar ||
                null;

              return (
                <div
                  key={`cinema-seat-${seat.seatNo}`}
                  onClick={() => onSeatClick(seat)}
                  className="group relative flex cursor-pointer flex-col items-center"
                >
                  {/* Velvet Sofa Armchair Indentation Backing */}
                  <div className="relative flex flex-col items-center justify-center w-full py-2 rounded-xl bg-gradient-to-b from-[#4d0d1a] to-[#22040a] border border-rose-500/20 shadow-inner group-hover:border-rose-400/50 transition">
                    {/* Speaking Animated Wave Ring */}
                    {isSpeaking && (
                      <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0, 0.9] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-1 rounded-2xl border-2 border-emerald-400 pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                      />
                    )}

                    {/* Avatar / Empty Seat Button */}
                    <div
                      className={`relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full transition-all duration-300 ${avatarBorderClass}`}
                    >
                      {isOccupied ? (
                        <>
                          {/* User Avatar */}
                          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-rose-700 via-purple-600 to-amber-500 text-xs font-black text-white uppercase shadow-inner">
                            {seatAvatarUrl ? (
                              <img
                                src={seatAvatarUrl}
                                alt={seat.username || 'User'}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (seat.username || 'U').charAt(0).toUpperCase()
                            )}
                          </div>

                          {/* VIP Crown */}
                          {isSeatVip && (
                            <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                              <Crown className="h-2.5 w-2.5 text-black fill-black" />
                            </span>
                          )}

                          {/* Mic Muted / Open Status Indicator */}
                          <div
                            className={`absolute -bottom-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-black shadow ${
                              seat.isMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                            }`}
                          >
                            {seat.isMuted ? (
                              <MicOff className="h-2 w-2 stroke-[2.5]" />
                            ) : (
                              <Mic className="h-2 w-2 stroke-[2.5]" />
                            )}
                          </div>
                        </>
                      ) : (
                        /* Empty Seat Cushion with Plus Sign */
                        <div className="flex flex-col items-center justify-center text-rose-300/70 group-hover:text-amber-400 transition">
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5 group-hover:scale-110 transition" />
                          <span className="text-[9px] font-black text-rose-400/80">
                            {seat.seatNo}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Seat Footer / Username / Level Badge */}
                    <div className="mt-1 flex flex-col items-center max-w-full px-1">
                      <span
                        className={`truncate text-center text-[10px] sm:text-[11px] leading-tight max-w-[62px] ${
                          isOccupied
                            ? `font-black ${SEAT_NAME_COLORS[index % SEAT_NAME_COLORS.length]}`
                            : 'text-rose-300/60 font-semibold'
                        }`}
                      >
                        {isOccupied
                          ? isCurrentUser
                            ? `${seat.username} (${tr('تۆ', 'You')})`
                            : seat.username
                          : `${tr('کورسی', 'Seat')} ${seat.seatNo}`}
                      </span>

                      {/* Level / VIP Badge pill like screenshot */}
                      {isOccupied && (
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="rounded bg-black/60 border border-white/10 px-1 py-0.2 text-[8px] font-black text-amber-300">
                            {isSeatVip ? 'V5' : `Lv.${index + 1}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. AUDIENCE VIEWERS STRIP (Below the couch, as in screenshot)
          ───────────────────────────────────────────────────────────── */}
      <div className="mt-2 flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-black text-slate-300">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            <span>{audience.length}</span>
          </div>

          <div className="flex items-center -space-x-1 rtl:-space-x-reverse">
            {audience.slice(0, 5).map((member) => (
              <div
                key={member.uid}
                onClick={() => onOpenProfile?.(member.uid)}
                className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black bg-slate-800 text-[9px] font-bold text-white hover:scale-110 transition"
              >
                {member.avatar ? (
                  <img src={member.avatar} alt={member.username} className="h-full w-full object-cover" />
                ) : (
                  member.username.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={onOpenConfigModal}
              className="flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25 transition"
            >
              <Film className="h-3 w-3" />
              <span>{tr('گۆڕینی فیلم', 'Change Movie')}</span>
            </button>
          )}

          <span className="text-[10px] text-slate-500 font-semibold">
            {tr('سەیرکردنی هاوبەش', 'Watch Party')}
          </span>
        </div>
      </div>
    </div>
  );
}
