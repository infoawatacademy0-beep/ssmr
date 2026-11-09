import { useState, useRef, useEffect } from 'react';
import { Film, Play } from 'lucide-react';
import { getYouTubeThumbnailUrl } from '../utils/youtube';

interface EpisodeVideoThumbnailProps {
  videoUrl: string;
  fallbackPosterUrl?: string;
  episodeNumber?: number;
  title?: string;
  className?: string;
  showPlayOverlay?: boolean;
}

function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Automatically extracts and displays a visual frame (thumbnail) directly
 * from inside the episode's video stream, skipping initial black intro frames.
 */
export default function EpisodeVideoThumbnail({
  videoUrl,
  fallbackPosterUrl,
  episodeNumber,
  title,
  className = 'h-16 w-28',
  showPlayOverlay = true,
}: EpisodeVideoThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [durationText, setDurationText] = useState<string>('');
  const hasSeekedRef = useRef(false);

  // Lazy-load video frame when the episode item enters the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setIsVisible(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset state if videoUrl changes
  useEffect(() => {
    setIsFrameReady(false);
    setHasError(false);
    setDurationText('');
    hasSeekedRef.current = false;
  }, [videoUrl]);

  const ytThumbnail = getYouTubeThumbnailUrl(videoUrl);

  // Append media fragment #t=10 so browsers immediately fetch a frame ~10s into the video
  const fragmentVideoSrc = (() => {
    if (ytThumbnail) return '';
    const clean = (videoUrl || '').trim();
    if (!clean) return '';
    if (clean.includes('#t=')) return clean;
    return `${clean}#t=10`;
  })();

  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (Number.isFinite(vid.duration) && vid.duration > 0) {
      setDurationText(formatVideoDuration(vid.duration));

      // Seek to ~12% into the episode (between 5s and 90s) to avoid black intro frames
      if (!hasSeekedRef.current && vid.duration > 4) {
        hasSeekedRef.current = true;
        const targetTime = Math.min(90, Math.max(5, Math.floor(vid.duration * 0.12)));
        try {
          vid.currentTime = targetTime;
        } catch {
          setIsFrameReady(true);
        }
        return;
      }
    }
    setIsFrameReady(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 select-none ${className}`}
    >
      {/* Fallback Poster, YouTube Auto-Thumbnail, or Placeholder */}
      {(!isFrameReady || hasError || ytThumbnail) && (
        <div className="absolute inset-0 z-0">
          {ytThumbnail || fallbackPosterUrl ? (
            <img
              src={ytThumbnail || fallbackPosterUrl}
              alt={title || ''}
              className={`h-full w-full object-cover ${ytThumbnail ? 'opacity-100' : 'opacity-75'}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-amber-950 text-amber-300/70">
              <Film className="h-5 w-5 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Actual Video Element Seeking to an Inside Frame */}
      {isVisible && fragmentVideoSrc && !hasError && (
        <video
          ref={videoRef}
          src={fragmentVideoSrc}
          preload="metadata"
          muted
          playsInline
          webkit-playsinline="true"
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setIsFrameReady(true)}
          onSeeked={() => setIsFrameReady(true)}
          onError={() => setHasError(true)}
          className={`relative z-10 h-full w-full object-cover pointer-events-none transition-opacity duration-300 ${
            isFrameReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Subtle Dark Vignette for Badges */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

      {/* Center Play Icon Overlay */}
      {showPlayOverlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 border border-white/25 text-amber-300 shadow-md backdrop-blur-[2px] group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
            <Play className="h-3 w-3 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Episode Number Badge (Top-Left or Bottom-Left) */}
      {episodeNumber !== undefined && (
        <span className="pointer-events-none absolute top-1 left-1 z-20 rounded-md bg-black/80 border border-amber-400/40 px-1.5 py-0.2 font-mono text-[9px] font-black text-amber-300 shadow">
          #{episodeNumber}
        </span>
      )}

      {/* Auto-detected Episode Duration Badge (Bottom-Right) */}
      {durationText && (
        <span className="pointer-events-none absolute bottom-1 right-1 z-20 rounded bg-black/80 px-1 py-0.2 font-mono text-[8px] font-bold text-slate-200">
          {durationText}
        </span>
      )}
    </div>
  );
}
