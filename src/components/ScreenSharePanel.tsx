import { useState, useEffect, useRef, useMemo } from 'react';
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
  Plus,
  Columns,
  Rows,
  Layers,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import type { RoomScreenShareState, ScreenShareDeviceType, User } from '../types';
import type {
  ActiveScreenShareStream,
  ScreenShareStartOptions,
} from '../hooks/useVoiceRoom';
import { subscribeToRoomScreenShareFrames } from '../services';
import { useLanguage } from '../contexts';

interface CombinedScreenItem {
  streamId: string;
  presenterUid: string;
  presenterName: string;
  presenterAvatar: string | null;
  deviceType: ScreenShareDeviceType;
  hasAudio: boolean;
  isLocal: boolean;
  webrtcStream: ActiveScreenShareStream | null;
  liveFrameDataUrl: string | null;
}

interface ScreenStreamTileProps {
  item: CombinedScreenItem;
  isObjectCover: boolean;
  isCollapsed: boolean;
  isFullscreen: boolean;
  isRotatedLandscape: boolean;
  isDualMode: boolean;
  canStop: boolean;
  isFocused: boolean;
  onToggleFocus: () => void;
  onStopStream: () => void;
}

/**
 * Individual Screen Stream Viewport Tile (supports both WebRTC <video> and instant Firebase JPEG frame stream).
 * Used for both single-screen and simultaneous dual-screen (PC + Mobile together) layouts.
 */
function ScreenStreamTile({
  item,
  isObjectCover,
  isCollapsed,
  isFullscreen,
  isRotatedLandscape,
  isDualMode,
  canStop,
  isFocused,
  onToggleFocus,
  onStopStream,
}: ScreenStreamTileProps) {
  const { tr } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isWebRtcVideoPlaying, setIsWebRtcVideoPlaying] = useState(false);

  const activeStream = item.webrtcStream;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeStream || isCollapsed) {
      setIsWebRtcVideoPlaying(false);
      return;
    }

    setIsWebRtcVideoPlaying(false);
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');

    const { videoTrack, mediaStream, isLocal } = activeStream;

    if (videoTrack && typeof (videoTrack as any).attach === 'function') {
      try {
        (videoTrack as any).attach(videoEl);
      } catch {}
    }
    if (!videoEl.srcObject && mediaStream) {
      videoEl.srcObject = mediaStream;
    } else if (!videoEl.srcObject && (videoTrack as any)?.mediaStreamTrack) {
      videoEl.srcObject = new MediaStream([(videoTrack as any).mediaStreamTrack]);
    }

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
  }, [
    activeStream,
    activeStream?.streamKey,
    isCollapsed,
    isFullscreen,
    isRotatedLandscape,
  ]);

  const renderDeviceBadge = (dev: ScreenShareDeviceType) => {
    if (dev === 'mobile') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/25 border border-cyan-400/50 px-2 py-0.5 text-[9px] font-black text-cyan-200 shadow-sm">
          <Smartphone className="h-2.5 w-2.5 text-cyan-300" />
          <span>{tr('مۆبایل', 'Mobile')}</span>
        </span>
      );
    }
    if (dev === 'laptop') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/25 border border-violet-400/50 px-2 py-0.5 text-[9px] font-black text-violet-200 shadow-sm">
          <Laptop className="h-2.5 w-2.5 text-violet-300" />
          <span>{tr('لاپتۆپ', 'Laptop')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 px-2 py-0.5 text-[9px] font-black text-emerald-200 shadow-sm">
        <Monitor className="h-2.5 w-2.5 text-emerald-300" />
        <span>PC</span>
      </span>
    );
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black overflow-hidden group">
      {activeStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setIsWebRtcVideoPlaying(true)}
          onPlaying={() => setIsWebRtcVideoPlaying(true)}
          onTimeUpdate={(e) => {
            if (e.currentTarget.videoWidth > 0 && !isWebRtcVideoPlaying) {
              setIsWebRtcVideoPlaying(true);
            }
          }}
          className={`h-full w-full transition-all duration-200 ${
            isObjectCover ? 'object-cover' : 'object-contain'
          } ${
            !isWebRtcVideoPlaying && item.liveFrameDataUrl
              ? 'opacity-0 absolute inset-0'
              : 'opacity-100'
          }`}
        />
      )}

      {/* Instant Live Frame Stream Fallback (renders immediately before/when WebRTC video is negotiating) */}
      {(!activeStream || !isWebRtcVideoPlaying) && item.liveFrameDataUrl && (
        <img
          src={item.liveFrameDataUrl}
          alt={`${item.presenterName} live screen`}
          className={`h-full w-full select-none pointer-events-none ${
            isObjectCover ? 'object-cover' : 'object-contain'
          }`}
        />
      )}

      {/* Loading placeholder only during the first ~400ms before first frame or WebRTC track arrives */}
      {!activeStream && !item.liveFrameDataUrl && (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 animate-pulse">
            {item.deviceType === 'mobile' ? (
              <Smartphone className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-200">
            {tr(
              `پەیوەستبوون بە شاشەی ${item.presenterName}...`,
              `Connecting to ${item.presenterName}'s screen...`,
            )}
          </p>
        </div>
      )}

      {/* Per-Tile Overlay Badge & Controls when in Dual-Screen Mode */}
      {isDualMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 inset-x-2 z-20 flex items-center justify-between gap-1.5 pointer-events-auto"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-black/75 border border-white/15 backdrop-blur-md px-2 py-1 shadow-lg max-w-[75%]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-black text-white truncate">
              {item.presenterName}
            </span>
            {renderDeviceBadge(item.deviceType)}
            {item.hasAudio && (
              <Volume2 className="h-2.5 w-2.5 text-amber-300 shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFocus}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/75 border border-white/20 text-cyan-300 hover:bg-cyan-500/30 transition active:scale-90"
              title={
                isFocused
                  ? tr('پێشاندانی هەردوو شاشە پێکەوە', 'Show Both Screens Together')
                  : tr('گەورەکردنی ئەم شاشەیە', 'Focus This Screen')
              }
            >
              {isFocused ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </button>
            {canStop && (
              <button
                type="button"
                onClick={onStopStream}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow transition active:scale-90"
                title={tr('ڕاگرتنی ئەم شاشەیە', 'Stop This Screen')}
              >
                <PowerOff className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScreenSharePanelProps {
  roomId: string;
  screenShareState?: RoomScreenShareState | null;
  screenShares?: RoomScreenShareState[];
  activeScreenShare?: ActiveScreenShareStream | null;
  activeScreenShares?: ActiveScreenShareStream[];
  isLocalScreenSharing: boolean;
  currentUser: User;
  isHostOrAdmin: boolean;
  usersAvatarMap: Record<string, string>;
  onStopScreenShare: (streamId?: string) => void;
  onStartDirectScreenShare: (options?: ScreenShareStartOptions) => void;
  onOpenOptionsModal: (addSecondScreen?: boolean) => void;
}

export default function ScreenSharePanel({
  roomId,
  screenShareState,
  screenShares = [],
  activeScreenShare,
  activeScreenShares = [],
  isLocalScreenSharing,
  currentUser,
  isHostOrAdmin,
  usersAvatarMap,
  onStopScreenShare,
  onOpenOptionsModal,
}: ScreenSharePanelProps) {
  const { tr } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotatedLandscape, setIsRotatedLandscape] = useState(false);
  const [isObjectCover, setIsObjectCover] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [framesMap, setFramesMap] = useState<Record<string, string>>({});

  // Dual-screen layout mode: 'split' (Side-by-Side), 'stack' (Top & Bottom), or 'pip' (Main + Floating Mobile Corner)
  const [dualLayout, setDualLayout] = useState<'split' | 'stack' | 'pip'>('split');
  const [swappedOrder, setSwappedOrder] = useState(false);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);

  // Normalize lists
  const allFirebaseShares = useMemo(() => {
    if (screenShares.length > 0) return screenShares;
    if (screenShareState?.isActive) return [screenShareState];
    return [];
  }, [screenShares, screenShareState]);

  const allWebrtcStreams = useMemo(() => {
    if (activeScreenShares.length > 0) return activeScreenShares;
    if (activeScreenShare) return [activeScreenShare];
    return [];
  }, [activeScreenShares, activeScreenShare]);

  // Combine Firebase metadata + LiveKit WebRTC tracks + Firebase live JPEG frames into a unified list of active screens
  const combinedItems = useMemo<CombinedScreenItem[]>(() => {
    const items: CombinedScreenItem[] = [];
    const usedWebrtcIds = new Set<string>();

    for (const share of allFirebaseShares) {
      const sId = share.streamId || `${share.presenterUid}_${share.deviceType}`;
      // 1. Exact streamId match
      let matchedWebrtc =
        allWebrtcStreams.find(
          (w) => w.streamId === sId && !usedWebrtcIds.has(w.streamId),
        ) || null;

      // 2. Fallback match by presenterUid + deviceType
      if (!matchedWebrtc) {
        matchedWebrtc =
          allWebrtcStreams.find(
            (w) =>
              w.participantUid === share.presenterUid &&
              (!w.deviceType || w.deviceType === share.deviceType) &&
              !usedWebrtcIds.has(w.streamId),
          ) || null;
      }

      // 3. Fallback match by presenterUid
      if (!matchedWebrtc) {
        matchedWebrtc =
          allWebrtcStreams.find(
            (w) =>
              w.participantUid === share.presenterUid &&
              !usedWebrtcIds.has(w.streamId),
          ) || null;
      }

      if (matchedWebrtc) {
        usedWebrtcIds.add(matchedWebrtc.streamId);
      }

      const frameUrl =
        framesMap[sId] ||
        (matchedWebrtc ? framesMap[matchedWebrtc.streamId] : null) ||
        framesMap[share.presenterUid] ||
        null;

      const avatar =
        usersAvatarMap[share.presenterUid] ||
        share.presenterAvatar ||
        (share.presenterUid === currentUser.uid
          ? currentUser.avatar || currentUser.profileImage || null
          : null);

      items.push({
        streamId: sId,
        presenterUid: share.presenterUid,
        presenterName: share.presenterName || 'User',
        presenterAvatar: avatar,
        deviceType: matchedWebrtc?.deviceType || share.deviceType || 'pc',
        hasAudio: Boolean(matchedWebrtc?.hasAudio || share.hasSystemAudio),
        isLocal: Boolean(
          matchedWebrtc?.isLocal || share.presenterUid === currentUser.uid,
        ),
        webrtcStream: matchedWebrtc,
        liveFrameDataUrl: frameUrl,
      });
    }

    // Also include any active WebRTC stream whose Firebase metadata is still in flight
    for (const w of allWebrtcStreams) {
      if (usedWebrtcIds.has(w.streamId)) continue;
      usedWebrtcIds.add(w.streamId);

      const avatar =
        usersAvatarMap[w.participantUid] ||
        (w.participantUid === currentUser.uid
          ? currentUser.avatar || currentUser.profileImage || null
          : null);

      items.push({
        streamId: w.streamId,
        presenterUid: w.participantUid,
        presenterName: w.participantName || 'User',
        presenterAvatar: avatar,
        deviceType: w.deviceType || 'pc',
        hasAudio: w.hasAudio,
        isLocal: w.isLocal,
        webrtcStream: w,
        liveFrameDataUrl:
          framesMap[w.streamId] || framesMap[w.participantUid] || null,
      });
    }

    return swappedOrder ? [...items].reverse() : items;
  }, [
    allFirebaseShares,
    allWebrtcStreams,
    framesMap,
    usersAvatarMap,
    currentUser,
    swappedOrder,
  ]);

  const isVisible = combinedItems.length > 0;
  const isDualMode = combinedItems.length >= 2;

  // Reset focusedStreamId if that stream ended
  useEffect(() => {
    if (
      focusedStreamId &&
      !combinedItems.some((item) => item.streamId === focusedStreamId)
    ) {
      setFocusedStreamId(null);
    }
  }, [combinedItems, focusedStreamId]);

  // Subscribe to real-time live screen frames for ALL active streams in the room
  useEffect(() => {
    if (!roomId || !isVisible) {
      setFramesMap({});
      return;
    }
    const unsub = subscribeToRoomScreenShareFrames(roomId, (map) => {
      setFramesMap(map);
    });
    return () => unsub();
  }, [roomId, isVisible]);

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

  const primaryItem = combinedItems[0];
  const canStopAny = Boolean(
    isLocalScreenSharing ||
      isHostOrAdmin ||
      combinedItems.some((i) => i.presenterUid === currentUser.uid),
  );

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
        // Fallback: CSS full-viewport mode
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

  const renderHeaderDeviceBadges = () => {
    if (isDualMode) {
      const hasPc = combinedItems.some(
        (i) => i.deviceType === 'pc' || i.deviceType === 'laptop',
      );
      const hasMobile = combinedItems.some((i) => i.deviceType === 'mobile');
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500/25 via-emerald-500/25 to-violet-500/25 border border-cyan-400/50 px-2 py-0.5 text-[9px] font-black text-cyan-200 shadow-sm">
          <Monitor className="h-2.5 w-2.5 text-emerald-300" />
          <span>+</span>
          <Smartphone className="h-2.5 w-2.5 text-cyan-300" />
          <span>
            {hasPc && hasMobile
              ? tr('PC + مۆبایل پێکەوە', 'PC + Mobile Together')
              : `${combinedItems.length} ${tr('شاشە پێکەوە', 'Screens Live')}`}
          </span>
        </span>
      );
    }

    const dev = primaryItem.deviceType;
    if (dev === 'mobile') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[9px] font-black text-cyan-300">
          <Smartphone className="h-2.5 w-2.5" />
          <span>{tr('مۆبایل', 'Mobile')}</span>
        </span>
      );
    }
    if (dev === 'laptop') {
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
            {isDualMode
              ? tr('دوو شاشە پێکەوە پەخش دەکرێن', 'Dual Screens Sharing Live')
              : `${primaryItem.presenterName} ${tr('شاشەکەی هاوبەش کردووە', 'is sharing screen')}`}
          </span>
          {renderHeaderDeviceBadges()}
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
          {canStopAny && (
            <button
              type="button"
              onClick={() => onStopScreenShare()}
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

  const displayedItems = focusedStreamId
    ? combinedItems.filter((i) => i.streamId === focusedStreamId)
    : combinedItems;

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
        className={`z-20 flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-2 transition-opacity duration-300 ${
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
            {primaryItem.presenterAvatar ? (
              <img
                src={primaryItem.presenterAvatar}
                alt={primaryItem.presenterName}
                className="h-full w-full object-cover"
              />
            ) : (
              primaryItem.presenterName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                {isDualMode ? 'DUAL LIVE' : 'LIVE SCREEN'}
              </span>
              <span className="text-xs font-black text-white truncate max-w-[105px] sm:max-w-[150px]">
                {isDualMode
                  ? combinedItems
                      .map((i) => i.presenterName)
                      .filter((v, idx, a) => a.indexOf(v) === idx)
                      .join(' & ')
                  : primaryItem.presenterUid === currentUser.uid
                  ? tr('شاشەی تۆ (ڕاستەوخۆ)', 'Your Screen (Live)')
                  : primaryItem.presenterName}
              </span>
              {renderHeaderDeviceBadges()}
              {combinedItems.some((i) => i.hasAudio) && (
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
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {/* "+ Add Mobile / PC Screen" button so presenter or any member can share a second screen simultaneously! */}
          <button
            type="button"
            onClick={() => onOpenOptionsModal(true)}
            className="flex h-7 items-center gap-1 rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 px-2 text-[10px] font-black text-emerald-200 hover:brightness-110 transition active:scale-95 shadow-sm"
            title={tr(
              'زیادکردنی شاشەی مۆبایل یان کۆمپیوتەر تا هەردووکیان پێکەوە پیشان بدرێن',
              'Add Mobile or PC Screen so both are shown together',
            )}
          >
            <Plus className="h-3 w-3 text-emerald-300" />
            <Smartphone className="h-3 w-3 text-cyan-300" />
            <span>{tr('+ شاشەی مۆبایل / PC', '+ Add Screen')}</span>
          </button>

          {/* Dual-Screen Layout Switcher (Only when 2+ screens are active together) */}
          {isDualMode && !focusedStreamId && (
            <div className="flex items-center gap-0.5 rounded-xl border border-cyan-400/35 bg-black/50 p-0.5">
              <button
                type="button"
                onClick={() => setDualLayout('split')}
                className={`flex h-6 items-center gap-0.5 rounded-lg px-1.5 text-[9px] font-black transition ${
                  dualLayout === 'split'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={tr('دوو شاشە لە تەنیشت یەک (Side-by-Side)', 'Side-by-Side Split View')}
              >
                <Columns className="h-3 w-3" />
                <span className="hidden xs:inline">{tr('تەنیشت', 'Split')}</span>
              </button>
              <button
                type="button"
                onClick={() => setDualLayout('stack')}
                className={`flex h-6 items-center gap-0.5 rounded-lg px-1.5 text-[9px] font-black transition ${
                  dualLayout === 'stack'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={tr('دوو شاشە لە سەر و خوار (Stacked)', 'Top & Bottom Stacked View')}
              >
                <Rows className="h-3 w-3" />
                <span className="hidden xs:inline">{tr('سەروخوار', 'Stack')}</span>
              </button>
              <button
                type="button"
                onClick={() => setDualLayout('pip')}
                className={`flex h-6 items-center gap-0.5 rounded-lg px-1.5 text-[9px] font-black transition ${
                  dualLayout === 'pip'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={tr('شاشەی مۆبایل لە گۆشەی شاشەی کۆمپیوتەر (PiP)', 'Picture-in-Picture View')}
              >
                <Layers className="h-3 w-3" />
                <span className="hidden xs:inline">PiP</span>
              </button>
              <button
                type="button"
                onClick={() => setSwappedOrder((v) => !v)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-amber-300 hover:bg-white/10 transition"
                title={tr('ئاڵوگۆڕکردنی شوێنی دوو شاشەکە', 'Swap Screen Positions')}
              >
                <ArrowLeftRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Return to Dual View pill when 1 stream is temporarily focused */}
          {isDualMode && focusedStreamId && (
            <button
              type="button"
              onClick={() => setFocusedStreamId(null)}
              className="flex h-7 items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-500/20 px-2 text-[10px] font-black text-amber-200 hover:bg-amber-500/30 transition active:scale-95"
            >
              <Columns className="h-3 w-3" />
              <span>{tr('پێشاندانی هەردوو شاشە', 'Show Both Screens')}</span>
            </button>
          )}

          {/* Switch source button for local presenter */}
          {isLocalScreenSharing && (
            <button
              type="button"
              onClick={() => onOpenOptionsModal(false)}
              className="flex h-7 items-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition active:scale-95"
              title={tr('گۆڕینی سەرچاوەی شاشە', 'Switch Screen Source')}
            >
              <RefreshCw className="h-3 w-3" />
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

          {/* Rotate 90° Landscape Button */}
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
            title={
              isFullscreen
                ? tr('بچووککردنەوە', 'Exit Fullscreen')
                : tr('گەورەکردنی شاشە (Fullscreen)', 'Fullscreen')
            }
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
          {canStopAny && (
            <button
              type="button"
              onClick={() => onStopScreenShare()}
              className="flex h-7 items-center gap-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-2.5 text-[10px] font-black text-white shadow-md shadow-rose-600/30 hover:brightness-110 transition active:scale-95"
              title={tr('ڕاگرتنی هاوبەشکردنی شاشە', 'Stop Screen Share')}
            >
              <PowerOff className="h-3 w-3" />
              <span>{tr('ڕاگرتن', 'Stop')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Video Stream Viewport (Supports Single Screen OR Dual PC + Mobile Screen Together!) */}
      <div
        className={`relative bg-black overflow-hidden ${
          isFullscreen
            ? 'flex-1 w-full h-full'
            : isDualMode && !focusedStreamId
            ? dualLayout === 'stack'
              ? 'w-full h-[360px] sm:h-[420px]'
              : 'w-full h-[230px] sm:h-[290px]'
            : 'aspect-video w-full max-h-[250px] sm:max-h-[290px]'
        }`}
      >
        {/* CASE 1: Picture-in-Picture (PiP) Dual Mode (Main Screen + Floating Corner Screen) */}
        {isDualMode && !focusedStreamId && dualLayout === 'pip' ? (
          <div className="relative h-full w-full">
            {/* Main Screen (e.g. PC) */}
            <ScreenStreamTile
              item={displayedItems[0]}
              isObjectCover={isObjectCover}
              isCollapsed={isCollapsed}
              isFullscreen={isFullscreen}
              isRotatedLandscape={isRotatedLandscape}
              isDualMode={true}
              canStop={Boolean(
                isHostOrAdmin ||
                  displayedItems[0].isLocal ||
                  displayedItems[0].presenterUid === currentUser.uid,
              )}
              isFocused={false}
              onToggleFocus={() => setFocusedStreamId(displayedItems[0].streamId)}
              onStopStream={() => onStopScreenShare(displayedItems[0].streamId)}
            />

            {/* Floating Second Screen (e.g. Mobile) */}
            {displayedItems[1] && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2.5 right-2.5 z-20 w-[38%] max-w-[175px] aspect-[9/16] sm:aspect-video rounded-2xl border-2 border-cyan-400/80 bg-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.9),0_0_15px_rgba(6,182,212,0.45)] overflow-hidden"
              >
                <ScreenStreamTile
                  item={displayedItems[1]}
                  isObjectCover={isObjectCover}
                  isCollapsed={isCollapsed}
                  isFullscreen={isFullscreen}
                  isRotatedLandscape={isRotatedLandscape}
                  isDualMode={true}
                  canStop={Boolean(
                    isHostOrAdmin ||
                      displayedItems[1].isLocal ||
                      displayedItems[1].presenterUid === currentUser.uid,
                  )}
                  isFocused={false}
                  onToggleFocus={() =>
                    setFocusedStreamId(displayedItems[1].streamId)
                  }
                  onStopStream={() =>
                    onStopScreenShare(displayedItems[1].streamId)
                  }
                />
              </div>
            )}
          </div>
        ) : (
          /* CASE 2: Side-by-Side Split Grid, Top/Bottom Stack, or Single Screen */
          <div
            className={`grid h-full w-full ${
              displayedItems.length >= 2
                ? dualLayout === 'stack'
                  ? 'grid-cols-1 grid-rows-2 divide-y divide-cyan-500/30'
                  : 'grid-cols-2 divide-x divide-cyan-500/30'
                : 'grid-cols-1'
            }`}
          >
            {displayedItems.slice(0, 4).map((item) => {
              const itemCanStop = Boolean(
                isHostOrAdmin ||
                  item.isLocal ||
                  item.presenterUid === currentUser.uid,
              );
              return (
                <div
                  key={item.streamId}
                  className="relative h-full w-full min-h-0 min-w-0 overflow-hidden"
                >
                  <ScreenStreamTile
                    item={item}
                    isObjectCover={isObjectCover}
                    isCollapsed={isCollapsed}
                    isFullscreen={isFullscreen}
                    isRotatedLandscape={isRotatedLandscape}
                    isDualMode={isDualMode}
                    canStop={itemCanStop}
                    isFocused={focusedStreamId === item.streamId}
                    onToggleFocus={() =>
                      setFocusedStreamId((prev) =>
                        prev === item.streamId ? null : item.streamId,
                      )
                    }
                    onStopStream={() => onStopScreenShare(item.streamId)}
                  />
                </div>
              );
            })}
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
   Screen Share Launcher & Dual-Screen (PC + Mobile) Modal
   Allows ALL room members & host to share screen on Mobile, PC,
   or Laptop, and supports sharing PC + Mobile screens together
   at the exact same time so all members see both screens!
   ───────────────────────────────────────────────────────────── */

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isScreenSharing: boolean;
  activeSharesCount?: number;
  defaultAddSecondScreen?: boolean;
  unsupportedNotice?: boolean;
  onStartDirectScreenShare: (options?: ScreenShareStartOptions) => Promise<void>;
  onStartCameraShare: (
    facingMode: 'environment' | 'user',
    options?: ScreenShareStartOptions,
  ) => Promise<void>;
  onStartVideoFileShare: (
    file: File,
    options?: ScreenShareStartOptions,
  ) => Promise<void>;
  onStopScreenShare: (streamId?: string) => Promise<void>;
}

export function ScreenShareModal({
  isOpen,
  onClose,
  isScreenSharing,
  activeSharesCount = 0,
  defaultAddSecondScreen = false,
  unsupportedNotice = false,
  onStartDirectScreenShare,
  onStartCameraShare,
  onStartVideoFileShare,
  onStopScreenShare,
}: ScreenShareModalProps) {
  const { tr } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addSecondScreen, setAddSecondScreen] = useState(defaultAddSecondScreen);
  const [selectedDeviceTag, setSelectedDeviceTag] = useState<
    ScreenShareDeviceType | undefined
  >(undefined);

  useEffect(() => {
    if (isOpen) {
      setAddSecondScreen(defaultAddSecondScreen || isScreenSharing || activeSharesCount > 0);
    }
  }, [isOpen, defaultAddSecondScreen, isScreenSharing, activeSharesCount]);

  if (!isOpen) return null;

  const shareOptions: ScreenShareStartOptions = {
    addSecondScreen,
    deviceTypeOverride: selectedDeviceTag,
  };

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
          className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-cyan-500/35 bg-gradient-to-b from-[#0f172a] via-[#0b1120] to-[#060911] p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.2)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 text-black shadow-lg shadow-cyan-500/25">
                <Monitor className="h-5 w-5 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>
                    {tr(
                      'هاوبەشکردنی شاشە (مۆبایل و PC پێکەوە)',
                      'Live Screen Share (Mobile & PC)',
                    )}
                  </span>
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                </h3>
                <p className="text-[10px] text-emerald-300 font-bold">
                  {tr(
                    'کراوەیە بۆ هەموو ئەندامانی ژوور بە مۆبایل، لاپتۆپ یان PC',
                    'Open for all room members on Mobile, Laptop, or PC',
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

          {/* Device Type Selector Pills (Lets user label stream as PC, Mobile, or Auto) */}
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-400 mb-1.5">
              {tr('جۆری ئامێری شاشەکەت هەڵبژێرە:', 'Select screen device type:')}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDeviceTag('mobile')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-black transition active:scale-95 ${
                  selectedDeviceTag === 'mobile'
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-md shadow-cyan-500/20'
                    : 'border-white/10 bg-white/[0.03] text-cyan-300 hover:bg-white/[0.08]'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>{tr('مۆبایل', 'Mobile')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeviceTag('pc')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-black transition active:scale-95 ${
                  selectedDeviceTag === 'pc'
                    ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow-md shadow-emerald-500/20'
                    : 'border-white/10 bg-white/[0.03] text-emerald-300 hover:bg-white/[0.08]'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>{tr('کۆمپیوتەر (PC)', 'PC')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeviceTag('laptop')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-black transition active:scale-95 ${
                  selectedDeviceTag === 'laptop'
                    ? 'border-violet-400 bg-violet-500/25 text-violet-200 shadow-md shadow-violet-500/20'
                    : 'border-white/10 bg-white/[0.03] text-violet-300 hover:bg-white/[0.08]'
                }`}
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>{tr('لاپتۆپ', 'Laptop')}</span>
              </button>
            </div>
          </div>

          {/* Dual-Screen Mode Banner (PC + Mobile Together!) */}
          <div className="mt-3 rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/15 via-slate-900/80 to-emerald-500/15 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  <Columns className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white">
                    {tr(
                      'پێشاندانی هەردوو شاشەی PC و مۆبایل پێکەوە',
                      'Show Both PC & Mobile Screens Together',
                    )}
                  </p>
                  <p className="text-[9.5px] text-cyan-200/80">
                    {tr(
                      'شاشەی نوێ زیاد دەکات بێ ئەوەی شاشەکەی تر دابخرێت تا هەردووکیان پێکەوە بۆ ئەندامەکان دەربکەون',
                      'Displays both screens side-by-side simultaneously for all room members',
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddSecondScreen((v) => !v)}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-black transition ${
                  addSecondScreen
                    ? 'bg-emerald-400 text-black shadow-md shadow-emerald-400/30'
                    : 'border border-white/15 bg-white/5 text-slate-300'
                }`}
              >
                {addSecondScreen
                  ? tr('جووت شاشە: چالاک', 'Dual: ON')
                  : tr('تەک شاشە', 'Single')}
              </button>
            </div>

            <div className="mt-2 pt-2 border-t border-white/10 flex items-start gap-1.5 text-[10px] text-slate-300 leading-relaxed">
              <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {tr(
                  'چۆنیەتی پەخشکردنی PC و مۆبایل پێکەوە: لە کۆمپیوتەرەکەت شاشەی PC هاوبەش بکە، پاشان لە مۆبایلەکەشتەوە یان لێرەوە کرتە لە هاوبەشکردنی شاشە بکە — هەردوو شاشەکە پێکەوە لە تەنیشت یەک بۆ هەموو ئەندامان پیشان دەدرێن!',
                  'How to share PC + Mobile together: Share your PC screen on PC, then tap Share Screen on your Mobile (or add a 2nd screen below) — both screens will appear side-by-side for all members!',
                )}
              </span>
            </div>
          </div>

          {unsupportedNotice && (
            <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200 leading-relaxed">
              <p className="font-black text-amber-300 mb-0.5">
                {tr('تێبینی بۆ وێبگەڕی مۆبایلەکەت:', 'Mobile Browser Note:')}
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
                await onStartDirectScreenShare(shareOptions);
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/25 via-teal-500/20 to-emerald-500/25 p-3.5 text-start transition hover:brightness-110 active:scale-[0.99] shadow-lg shadow-cyan-500/15"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 to-emerald-400 text-black shadow-md">
                  <Monitor className="h-5 w-5 stroke-[2.3]" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    {isScreenSharing && addSecondScreen
                      ? tr(
                          '+ زیادکردنی شاشەی دووەم (PC / مۆبایل پێکەوە)',
                          '+ Add Second Screen (PC / Mobile Together)',
                        )
                      : tr(
                          'هاوبەشکردنی ڕاستەوخۆی شاشە (مۆبایل / PC / لاپتۆپ)',
                          'Direct Screen Share (Mobile / PC / Laptop)',
                        )}
                  </p>
                  <p className="text-[10px] text-cyan-200/80 mt-0.5">
                    {tr(
                      'شاشەی مۆبایل یان کۆمپیوتەرەکەت ڕاستەوخۆ بۆ هەموو ئەندامان پەخش بکە',
                      'Share your Mobile or PC screen live to all room members',
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
                  await onStartVideoFileShare(file, shareOptions);
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
                      'گونجاو بۆ هەموو مۆبایلێک (iPhone & Android) و کۆمپیوتەر بە دەنگ و ڕەنگەوە',
                      'Works on all iPhones, Android phones & PCs with full audio & video',
                    )}
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Share Live Camera as Screen (Can also be used as 2nd Mobile/PC Screen!) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onStartCameraShare('environment', shareOptions);
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
                    {tr('پەخشی ڕاستەوخۆی شاشە', 'Live Screen Stream')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await onStartCameraShare('user', shareOptions);
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
                    {tr('پەخشی ڕاستەوخۆی شاشە', 'Live Screen Stream')}
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
                <span>
                  {tr(
                    'ڕاگرتنی هاوبەشکردنی شاشەکانی من',
                    'Stop My Screen Sharing',
                  )}
                </span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
