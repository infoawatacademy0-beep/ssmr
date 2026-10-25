import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatAudioPlayerProps {
  audioUrl: string;
  duration?: number;
  isMine: boolean;
  accentColor?: string;
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function ChatAudioPlayer({
  audioUrl,
  duration = 0,
  isMine,
  accentColor = '#f59e0b',
}: ChatAudioPlayerProps) {
  const { tr } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const seekTime = Number(e.target.value);
    if (audio) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Waveform heights pattern (16 bars)
  const barHeights = [40, 65, 30, 85, 55, 95, 70, 45, 90, 60, 80, 50, 75, 40, 60, 35];

  return (
    <div className="flex items-center gap-3 py-1 min-w-[210px] sm:min-w-[240px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md transition-all active:scale-90 ${
          isMine
            ? 'bg-black text-amber-400 hover:bg-slate-950 shadow-black/30'
            : 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-black hover:brightness-110 shadow-amber-500/20'
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Waveform & Progress Slider */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold opacity-80">
          <span className="flex items-center gap-1">
            <Mic className="h-2.5 w-2.5" />
            <span>{isPlaying ? formatDuration(currentTime) : tr('دەنگی تۆمارکراو', 'Voice Note')}</span>
          </span>
          <span>{formatDuration(totalDuration || duration)}</span>
        </div>

        {/* Animated Waveform Visualizer */}
        <div
          onClick={togglePlay}
          className="flex items-center gap-0.5 h-6 cursor-pointer py-1 select-none"
        >
          {barHeights.map((h, idx) => {
            const barProgress = (idx / barHeights.length) * 100;
            const isPlayed = barProgress <= progressPercent;

            return (
              <span
                key={idx}
                style={{ height: `${isPlaying ? Math.max(20, Math.sin(Date.now() / 200 + idx) * 40 + h * 0.7) : h}%` }}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPlayed
                    ? isMine
                      ? 'bg-black/90'
                      : 'bg-amber-400'
                    : isMine
                      ? 'bg-black/30'
                      : 'bg-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Seek Track */}
        <div className="relative flex items-center h-1.5 w-full">
          <input
            type="range"
            min={0}
            max={totalDuration || duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div
            className={`h-1 w-full rounded-full overflow-hidden ${
              isMine ? 'bg-black/20' : 'bg-white/15'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                isMine ? 'bg-black' : 'bg-amber-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
