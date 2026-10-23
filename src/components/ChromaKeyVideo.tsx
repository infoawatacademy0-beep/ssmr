import { useEffect, useRef, useState, useCallback } from 'react';

export type ChromaKeyColor = 'auto' | 'green' | 'blue' | 'white' | 'black' | 'none';

export interface ChromaKeyVideoProps {
  src: string;
  keyColor?: ChromaKeyColor;
  similarity?: number;
  smoothness?: number;
  className?: string;
  canvasClassName?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  onError?: (err?: any) => void;
}

/**
 * ChromaKeyVideo:
 * Real-time hardware-accelerated chroma-key background removal for web video.
 * Removes green, blue, white, or black background from videos dynamically
 * using HTML5 Canvas & requestVideoFrameCallback / requestAnimationFrame.
 */
export default function ChromaKeyVideo({
  src,
  keyColor = 'auto',
  className = '',
  canvasClassName = 'drop-shadow-[0_0_15px_rgba(249,115,22,0.7)]',
  autoPlay = true,
  playsInline = true,
  muted = true,
  loop = true,
  onEnded,
  onError,
}: ChromaKeyVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const rvfcIdRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Chroma-key per-frame processing
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || canvas.width === 0 || canvas.height === 0) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (keyColor !== 'none') {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;
      const len = data.length;
      const w = canvas.width;
      const h = canvas.height;

      let effectiveColor = keyColor;
      if (effectiveColor === 'auto' && w > 8 && h > 8) {
        // Sample 4 corners slightly inset to detect background color
        const c1 = (4 * w + 4) * 4;
        const c2 = (4 * w + (w - 5)) * 4;
        const c3 = ((h - 5) * w + 4) * 4;
        const c4 = ((h - 5) * w + (w - 5)) * 4;
        const rAvg = (data[c1] + data[c2] + data[c3] + data[c4]) / 4;
        const gAvg = (data[c1 + 1] + data[c2 + 1] + data[c3 + 1] + data[c4 + 1]) / 4;
        const bAvg = (data[c1 + 2] + data[c2 + 2] + data[c3 + 2] + data[c4 + 2]) / 4;

        if (gAvg > 60 && gAvg > rAvg * 1.2 && gAvg > bAvg * 1.2) {
          effectiveColor = 'green';
        } else if (bAvg > 60 && bAvg > rAvg * 1.2 && bAvg > gAvg * 1.2) {
          effectiveColor = 'blue';
        } else if (rAvg > 200 && gAvg > 200 && bAvg > 200) {
          effectiveColor = 'white';
        } else if (rAvg < 50 && gAvg < 50 && bAvg < 50) {
          effectiveColor = 'black';
        } else {
          effectiveColor = 'green'; // Default fallback
        }
      }

      if (effectiveColor === 'green') {
        // Green Screen Chroma Key
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Green dominance formula with soft edge feathering
          if (g > 65 && g > r * 1.22 && g > b * 1.22) {
            const diff = g - Math.max(r, b);
            if (diff > 40) {
              data[i + 3] = 0; // Completely transparent
            } else {
              // Edge feathering
              data[i + 3] = Math.max(0, Math.floor(255 * (1 - diff / 40)));
              data[i + 1] = Math.floor((r + b) / 2); // Despill green fringe
            }
          }
        }
      } else if (effectiveColor === 'blue') {
        // Blue Screen Chroma Key
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (b > 65 && b > r * 1.22 && b > g * 1.22) {
            const diff = b - Math.max(r, g);
            if (diff > 40) {
              data[i + 3] = 0;
            } else {
              data[i + 3] = Math.max(0, Math.floor(255 * (1 - diff / 40)));
              data[i + 2] = Math.floor((r + g) / 2); // Despill blue fringe
            }
          }
        }
      } else if (effectiveColor === 'white') {
        // White background removal (Luminance Threshold)
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (brightness > 215) {
            const diff = brightness - 215;
            data[i + 3] = Math.max(0, Math.floor(255 * (1 - diff / 40)));
          }
        }
      } else if (effectiveColor === 'black') {
        // Black background removal
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (brightness < 45) {
            data[i + 3] = Math.max(0, Math.floor(255 * (brightness / 45)));
          }
        }
      }

      ctx.putImageData(frame, 0, 0);
    }

    // Schedule next frame with requestVideoFrameCallback or fallback to requestAnimationFrame
    if ('requestVideoFrameCallback' in video) {
      rvfcIdRef.current = (video as any).requestVideoFrameCallback(() => {
        processFrame();
      });
    } else {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    }
  }, [keyColor]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (canvasRef.current && video.videoWidth > 0 && video.videoHeight > 0) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }
    };

    const handlePlay = () => {
      processFrame();
    };

    const handleEndedEvent = () => {
      if (onEnded) onEnded();
    };

    const handleErrorEvent = (err: any) => {
      console.warn('Video failed to load or play:', src, err);
      setLoadError(true);
      if (onError) onError(err);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEndedEvent);
    video.addEventListener('error', handleErrorEvent);

    // Attempt video playback
    video.play().catch((err) => {
      if (!video.muted) {
        video.muted = true;
        video.play().catch((playErr) => {
          handleErrorEvent(playErr);
        });
      } else {
        handleErrorEvent(err);
      }
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEndedEvent);
      video.removeEventListener('error', handleErrorEvent);

      if (rvfcIdRef.current && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(rvfcIdRef.current);
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [src, processFrame, onEnded, onError]);

  if (loadError) {
    return null;
  }

  // If video is natively transparent (WebM with alpha), render direct video
  if (keyColor === 'none') {
    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline={playsInline}
        muted={muted}
        loop={loop}
        className={className}
      />
    );
  }

  const isExternal = src.startsWith('http://') || src.startsWith('https://');

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Offscreen HTML5 video (keeps decoding active on mobile without display: none) */}
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline={playsInline}
        muted={muted}
        loop={loop}
        crossOrigin={isExternal ? 'anonymous' : undefined}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
          zIndex: -1,
        }}
      />

      {/* Hardware-accelerated Chroma-Key Canvas output */}
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full object-contain pointer-events-none ${canvasClassName}`}
      />
    </div>
  );
}
