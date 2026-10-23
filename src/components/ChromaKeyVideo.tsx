import { useEffect, useRef, useState, useCallback } from 'react';

export type ChromaKeyColor = 'green' | 'blue' | 'white' | 'black' | 'none';

export interface ChromaKeyVideoProps {
  src: string;
  keyColor?: ChromaKeyColor;
  similarity?: number;
  smoothness?: number;
  className?: string;
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
  keyColor = 'green',
  similarity = 0.38,
  smoothness = 0.12,
  className = '',
  autoPlay = true,
  playsInline = true,
  muted = false,
  loop = false,
  onEnded,
  onError,
}: ChromaKeyVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const rvfcIdRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Chroma-key per-frame processing
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
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

      if (keyColor === 'green') {
        // Green Screen Chroma Key
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Green dominance formula with soft edge feathering
          if (g > 65 && g > r * 1.25 && g > b * 1.25) {
            const diff = g - Math.max(r, b);
            if (diff > 45) {
              data[i + 3] = 0; // Completely transparent
            } else {
              // Edge feathering to eliminate green fringing
              data[i + 3] = Math.max(0, Math.floor(255 * (1 - diff / 45)));
              // Despill: pull green channel down to reduce fringe discoloration
              data[i + 1] = Math.floor((r + b) / 2);
            }
          }
        }
      } else if (keyColor === 'blue') {
        // Blue Screen Chroma Key
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (b > 65 && b > r * 1.25 && b > g * 1.25) {
            const diff = b - Math.max(r, g);
            if (diff > 45) {
              data[i + 3] = 0;
            } else {
              data[i + 3] = Math.max(0, Math.floor(255 * (1 - diff / 45)));
              data[i + 2] = Math.floor((r + g) / 2); // Despill blue
            }
          }
        }
      } else if (keyColor === 'white') {
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
      } else if (keyColor === 'black') {
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
      setIsReady(true);
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
      // If browser blocked unmuted autoplay, retry muted
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

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Hidden offscreen HTML5 video providing stream */}
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline={playsInline}
        muted={muted}
        loop={loop}
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Hardware-accelerated Chroma-Key Canvas output */}
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-[0_0_35px_rgba(249,115,22,0.85)]"
      />
    </div>
  );
}
