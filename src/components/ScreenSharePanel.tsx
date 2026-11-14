import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Smartphone,
  Laptop,
  Maximize2,
  Minimize2,
  RotateCw,
  X,
  Volume2,
  Camera,
  FileVideo,
  Sparkles,
  PowerOff,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import type { RoomScreenShareState, User } from '../types';
import type { ActiveScreenShareStream } from '../hooks/useVoiceRoom';
import { useLanguage } from '../contexts';

interface ScreenSharePanelProps {
  roomId: string;
  screenShareState: RoomScreenShareState | null;
  activeScreenShare: ActiveScreenShareStream | null;
  isLocalScreenSharing: boolean;
  currentUser: User;
  isHostOrAdmin: boolean;
  usersAvatarMap: Record<string, string>;
  onStopScreenShare: () => void;
  onStartDirectScreenShare: () => void;
  onOpenOptionsModal: () => void;
}

export default function ScreenSharePanel({
  screenShareState,
  activeScreenShare,
  isLocalScreenSharing,
  currentUser,
  isHostOrAdmin,
  usersAvatarMap,
  onStopScreenShare,
  onOpenOptionsModal,
}: ScreenSharePanelProps) {
  const { tr } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotatedLandscape, setIsRotatedLandscape] = useState(false);
  const [isObjectCover, setIsObjectCover] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const isVisible = Boolean(activeScreenShare || screenShareState?.isActive);
  const presenterUid =
    activeScreenShare?.participantUid || screenShareState?.presenterUid || '';
  const presenterName =
    activeScreenShare?.participantName ||
    screenShareState?.presenterName ||
    (isLocalScreenSharing ? currentUser.username : 'User');
  const presenterAvatar =
    (presenterUid ? usersAvatarMap[presenterUid] : null) ||
    screenShareState?.presenterAvatar ||
    (presenterUid === currentUser.uid ? currentUser.avatar || currentUser.profileImage : null);

  const deviceType = screenShareState?.deviceType || 'pc';
  const canStop = Boolean(
    isLocalScreenSharing ||
      presenterUid === currentUser.uid ||
      isHostOrAdmin,
  );

  // Attach LiveKit videoTrack or MediaStream to the <video> element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeScreenShare || isCollapsed) return;

    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');

    const { videoTrack, mediaStream, isLocal } = activeScreenShare;

    if (videoTrack && typeof (videoTrack as any).attach === 'function') {
      (videoTrack as any).attach(videoEl);
    } else if (mediaStream) {
      videoEl.srcObject = mediaStream;
    }

    // Always mute the local video element itself (audio is played via LiveKit audio container for remote viewers)
    videoEl.muted = true;
    videoEl.play().catch(() => {});

    return () => {
      if (videoTrack && typeof (videoTrack as any).detach === 'function') {
        try {
          (videoTrack as any).detach(videoEl);
        } catch {}
      }
      if (isLocal && videoEl.srcObject) {
        videoEl.srcObject = null;
      }
    };
  }, [activeScreenShare, isCollapsed, isFullscreen, isRotatedLandscape]);

  // Listen to native fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      const fsEl =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl && isFullscreen && !isRotatedLandscape) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [isFullscreen, isRotatedLandscape]);

  if (!isVisible) return null;

  const handleToggleFullscreen = async () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      setIsRotatedLandscape(false);
      const fsEl =
        document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (fsEl) {
        try {
          await (document.exitFullscreen?.() ||
            (document as any).webkitExitFullscreen?.());
        } catch {}
      }
      return;
    }

    setIsFullscreen(true);
    const el = containerRef.current;
    if (el) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch {
        // Fallback: CSS full-viewport mode (already enabled via isFullscreen state)
      }
    }
  };

  const handleToggleRotateLandscape = () => {
    if (isRotatedLandscape) {
      setIsRotatedLandscape(false);
      setIsFullscreen(false);
    } else {
      setIsRotatedLandscape(true);
      setIsFullscreen(true);
    }
  };

  const renderDeviceBadge = () => {
    if (deviceType === 'mobile') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[9px] font-black text-cyan-300">
          <Smartphone className="h-2.5 w-2.5" />
          <span>{tr('مۆبایل', 'Mobile')}</span>
        </span>
      );
    }
    if (deviceType === 'laptop') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 border border-violet-400/40 px-2 py-0.5 text-[9px] font-black text-violet-300">
          <Laptop className="h-2.5 w-2.5" />
          <span>{tr('لاپتۆپ', 'Laptop')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-black text-emerald-300">
        <Monitor className="h-2.5 w-2.5" />
        <span>PC</span>
      </span>
    );
  };

  // Collapsed compact bar view
  if (isCollapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-emerald-950/60 px-3 py-2 shadow-lg shadow-cyan-500/15"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Monitor className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-black text-white truncate">
            {presenterName} {tr('شاشەکەی هاوبەش کردووە', 'is sharing screen')}
          </span>
          {renderDeviceBadge()}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-[10px] font-black text-cyan-200 hover:bg-cyan-500/30 transition active:scale-95"
          >
            <Eye className="h-3 w-3" />
            <span>{tr('بینینی شاشە', 'Watch Screen')}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {canStop && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="flex items-center gap-1 rounded-xl bg-rose-600/80 hover:bg-rose-600 px-2 py-1 text-[10px] font-black text-white transition active:scale-95"
              title={tr('ڕاگرتنی هاوبەشکردنی شاشە', 'Stop Screen Share')}
            >
              <PowerOff className="h-3 w-3" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[10005] flex flex-col bg-black select-none overflow-hidden'
          : 'relative mb-3 overflow-hidden rounded-3xl border border-cyan-400/40 bg-slate-950 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_25px_rgba(6,182,212,0.2)]'
      }
      style={
        isRotatedLandscape
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: '100dvh',
              height: '100dvw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              zIndex: 10005,
              background: '#000',
            }
          : undefined
      }
      onClick={() => setShowControls((v) => !v)}
    >
      {/* Top Info & Action Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`z-20 flex items-center justify-between gap-2 px-3 py-2 transition-opacity duration-300 ${
          isFullscreen
            ? `absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-3 pb-6 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`
            : 'border-b border-white/10 bg-gradient-to-r from-slate-900/95 via-cyan-950/40 to-slate-900/95'
        }`}
      >
        {/* Presenter Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-500 text-[10px] font-black text-black ring-2 ring-cyan-400/50 overflow-hidden">
            {presenterAvatar ? (
              <img
                src={presenterAvatar}
                alt={presenterName}
                className="h-full w-full object-cover"
              />
            ) : (
              presenterName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE SCREEN
              </span>
              <span className="text-xs font-black text-white truncate max-w-[115px] sm:max-w-[160px]">
                {presenterUid === currentUser.uid
                  ? tr('شاشەی تۆ (ڕاستەوخۆ)', 'Your Screen (Live)')
                  : presenterName}
              </span>
              {renderDeviceBadge()}
              {(activeScreenShare?.hasAudio || screenShareState?.hasSystemAudio) && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[8px] font-bold text-amber-300"
                  title={tr('دەنگی شاشە چالاکە', 'Screen audio enabled')}
                >
                  <Volume2 className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Viewer & Presenter Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Switch source button for local presenter */}
          {isLocalScreenSharing && (
            <button
              type="button"
              onClick={onOpenOptionsModal}
              className="flex h-7 items-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition active:scale-95"
              title={tr('گۆڕینی سەرچاوەی شاشە', 'Switch Screen Source')}
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">{tr('گۆڕین', 'Switch')}</span>
            </button>
          )}

          {/* Fit / Fill Toggle */}
          <button
            type="button"
            onClick={() => setIsObjectCover((v) => !v)}
            className={`flex h-7 items-center justify-center rounded-xl border px-2 text-[10px] font-bold transition active:scale-95 ${
              isObjectCover
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
            title={tr('پڕکردنی شاشە / قەبارەی ئاسایی', 'Toggle Fit / Fill')}
          >
            {isObjectCover ? tr('پڕ', 'Fill') : tr('تەواو', 'Fit')}
          </button>

          {/* Rotate 90° Landscape Button (Great for Mobile) */}
          <button
            type="button"
            onClick={handleToggleRotateLandscape}
            className={`flex h-7 w-7 items-center justify-center rounded-xl border transition active:scale-95 ${
              isRotatedLandscape
                ? 'border-cyan-400 bg-cyan-500/25 text-cyan-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            title={tr('سوڕاندنی شاشە بە پانی (Landscape)', 'Rotate Landscape 90°')}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white transition active:scale-95"
            title={isFullscreen ? tr('بچووککردنەوە', 'Exit Fullscreen') : tr('گەورەکردنی شاشە (Fullscreen)', 'Fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Collapse to mini bar (when not in fullscreen) */}
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition active:scale-95"
              title={tr('شاردنەوەی کاتی شاشە', 'Minimize Screen View')}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Stop Screen Share Button (Presenter or Host/Admin) */}
          {canStop && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="flex h-7 items-center gap-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-2.5 text-[10px] font-black text-white shadow-md shadow-rose-600/30 hover:brightness-110 transition active:scale-95"
              title={tr('ڕاگرتنی هاوبەشکردنی شاشە', 'Stop Screen Share')}
            >
              <PowerOff className="h-3 w-3" />
              <span>{tr('ڕاگرتن', 'Stop')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Video Stream Viewport */}
      <div
        className={`relative flex items-center justify-center bg-black overflow-hidden ${
          isFullscreen ? 'flex-1 w-full h-full' : 'aspect-video w-full max-h-[250px] sm:max-h-[290px]'
        }`}
      >
        {activeScreenShare ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full transition-all duration-200 ${
              isObjectCover ? 'object-cover' : 'object-contain'
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 animate-pulse">
              <Monitor className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-200">
              {tr(
                `پەیوەستبوون بە شاشەی ڕاستەوخۆی ${presenterName}...`,
                `Connecting to ${presenterName}'s live screen...`,
              )}
            </p>
            <p className="text-[10px] text-slate-400">
              {tr('چاوەڕوانی پەخشی WebRTC بە کوالێتی بەرز', 'Receiving real-time WebRTC video stream')}
            </p>
          </div>
        )}

        {/* Floating Exit Fullscreen Pill when in Fullscreen */}
        {isFullscreen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFullscreen();
            }}
            className={`absolute bottom-5 right-5 z-30 flex items-center gap-1.5 rounded-2xl border border-white/20 bg-black/75 backdrop-blur-md px-3.5 py-2 text-xs font-black text-white shadow-xl transition-opacity ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Minimize2 className="h-4 w-4 text-amber-400" />
            <span>{tr('گەڕانەوە بۆ ژوور', 'Back to Room')}</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Screen Share Launcher & Mobile Fallback Modal
   Allows 1-tap Direct Screen Share (Mobile / PC / Laptop),
   plus Camera Screen Share & Local Video File Share for mobile
   browsers that restrict OS getDisplayMedia.
   ───────────────────────────────────────────────────────────── */

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isScreenSharing: boolean;
  unsupportedNotice?: boolean;
  onStartDirectScreenShare: () => Promise<void>;
  onStartCameraShare: (facingMode: 'environment' | 'user') => Promise<void>;
  onStartVideoFileShare: (file: File) => Promise<void>;
  onStopScreenShare: () => Promise<void>;
}

export function ScreenShareModal({
  isOpen,
  onClose,
  isScreenSharing,
  unsupportedNotice = false,
  onStartDirectScreenShare,
  onStartCameraShare,
  onStartVideoFileShare,
  onStopScreenShare,
}: ScreenShareModalProps) {
  const { tr } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[10004] flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/35 bg-gradient-to-b from-[#0f172a] via-[#0b1120] to-[#060911] p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.2)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 text-black shadow-lg shadow-cyan-500/25">
                <Monitor className="h-5 w-5 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{tr('هاوبەشکردنی شاشە (Share Screen)', 'Live Screen Share')}</span>
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                </h3>
                <p className="text-[10px] text-slate-400">
                  {tr(
                    'شاشەی مۆبایل، لاپتۆپ یان کۆمپیوتەرەکەت ڕاستەوخۆ پەخش بکە',
                    'Directly share your Mobile, Laptop, or PC screen',
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-rose-600 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Device Badges Row */}
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-300">
              <Smartphone className="h-3.5 w-3.5" />
              {tr('مۆبایل', 'Mobile')}
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-300">
              <Laptop className="h-3.5 w-3.5" />
              {tr('لاپتۆپ', 'Laptop')}
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
              <Monitor className="h-3.5 w-3.5" />
              {tr('کۆمپیوتەر (PC)', 'Desktop PC')}
            </span>
          </div>

          {unsupportedNotice && (
            <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200 leading-relaxed">
              <p className="font-black text-amber-300 mb-0.5">
                {tr(
                  'تێبینی بۆ وێبگەڕی مۆبایلەکەت:',
                  'Mobile Browser Note:',
                )}
              </p>
              <p>
                {tr(
                  'ئەگەر وێبگەڕی مۆبایلەکەت ڕێگەی نەدا بە هاوبەشکردنی تەواوی شاشەی سیستەم، دەتوانیت لە خوارەوە ڕاستەوخۆ ڤیدیۆی ناو مۆبایلەکەت یان کامێراکەت لەسەر شاشەی ژوورەکە پەخش بکەیت، یان لە Chrome بیکەیتەوە.',
                  'If your mobile browser restricts OS-level display capture, you can stream any video from your phone or live camera directly to the room screen below!',
                )}
              </p>
            </div>
          )}

          {/* Share Options */}
          <div className="mt-3.5 space-y-2.5">
            {/* Option 1: Direct Screen Share (PC / Laptop / Mobile) */}
            <button
              type="button"
              onClick={async () => {
                await onStartDirectScreenShare();
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/25 via-teal-500/20 to-emerald-500/25 p-3.5 text-start transition hover:brightness-110 active:scale-[0.99] shadow-lg shadow-cyan-500/15"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 to-emerald-400 text-black shadow-md">
                  <Monitor className="h-5 w-5 stroke-[2.3]" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    {tr(
                      'هاوبەشکردنی ڕاستەوخۆی شاشە (مۆبایل / PC / لاپتۆپ)',
                      'Direct Screen Share (Mobile / PC / Laptop)',
                    )}
                  </p>
                  <p className="text-[10px] text-cyan-200/80 mt-0.5">
                    {tr(
                      'شاشەی تەواوی ئامێرەکەت یان پەنجەرەیەک ڕاستەوخۆ پیشانی ژوورەکە بدە',
                      'Share your entire screen, app window, or browser tab live',
                    )}
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Share Video / Screen Recording from Mobile or PC */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await onStartVideoFileShare(file);
                  onClose();
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-between rounded-2xl border border-violet-400/35 bg-violet-500/15 p-3.5 text-start transition hover:bg-violet-500/25 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/30 text-violet-300 border border-violet-400/30">
                  <FileVideo className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    {tr(
                      'پەخشکردنی ڤیدیۆی ناو مۆبایل / کۆمپیوتەر لەسەر شاشە',
                      'Share Video from Mobile / PC to Screen',
                    )}
                  </p>
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    {tr(
                      'گونجاو بۆ هەموو مۆبایلێک (iPhone & Android) بە دەنگ و ڕەنگەوە',
                      'Works on all iPhones & Android phones with full audio & video',
                    )}
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Share Live Camera as Screen */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onStartCameraShare('environment');
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-start transition hover:bg-white/[0.08] active:scale-95"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Camera className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-white truncate">
                    {tr('کامێرای دواوە', 'Back Camera')}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {tr('پەخشی ڕاستەوخۆ', 'Live Stream')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await onStartCameraShare('user');
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-start transition hover:bg-white/[0.08] active:scale-95"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300">
                  <Camera className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-white truncate">
                    {tr('کامێرای پێشەوە', 'Front Camera')}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {tr('پەخشی ڕاستەوخۆ', 'Live Stream')}
                  </p>
                </div>
              </button>
            </div>

            {isScreenSharing && (
              <button
                type="button"
                onClick={async () => {
                  await onStopScreenShare();
                  onClose();
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 py-3 text-xs font-black text-white shadow-lg shadow-rose-600/30 hover:brightness-110 active:scale-95 transition"
              >
                <PowerOff className="h-4 w-4" />
                <span>{tr('ڕاگرتنی هاوبەشکردنی شاشە', 'Stop Screen Sharing')}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
