import { useState } from 'react';
import type { GiftIconKey } from '../constants/gifts';
import ChromaKeyVideo, { type ChromaKeyColor } from './ChromaKeyVideo';

/* ─────────────────────────────────────────────────────────────
   TikTok-Style Gift Icons — Pure Inline SVG or Chroma-Key Video / Image
   When a gift has videoUrl or imageUrl, it displays the live video
   or image; otherwise it falls back to the hand-crafted SVG icon.
   ───────────────────────────────────────────────────────────── */

interface GiftIconProps {
  iconKey: GiftIconKey;
  size?: number;
  className?: string;
  videoUrl?: string;
  imageUrl?: string;
  videoKeyColor?: ChromaKeyColor;
}

export default function GiftIcon({
  iconKey,
  size = 48,
  className = '',
  videoUrl,
  imageUrl,
  videoKeyColor = 'auto',
}: GiftIconProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const s = size;

  // 1. If videoUrl is provided and not errored, render real-time Chroma-Key video!
  if (videoUrl && !videoFailed) {
    return (
      <div
        style={{ width: s, height: s }}
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
      >
        <ChromaKeyVideo
          src={videoUrl}
          keyColor={videoKeyColor}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-contain"
          canvasClassName="drop-shadow-[0_0_8px_rgba(249,115,22,0.65)]"
          onError={() => setVideoFailed(true)}
        />
      </div>
    );
  }

  // 2. If imageUrl is provided, render high-res image
  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={iconKey}
        style={{ width: s, height: s }}
        className={`object-contain drop-shadow ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  switch (iconKey) {
    /* ━━━ HEART ME — Cute smiling heart ━━━ */
    case 'heart-me':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <radialGradient id="hm-g" cx="50%" cy="40%">
              <stop offset="0%" stopColor="#ff6b9d" />
              <stop offset="100%" stopColor="#c2185b" />
            </radialGradient>
          </defs>
          <path
            d="M32 56S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 32-24 32Z"
            fill="url(#hm-g)"
            stroke="#ff8ab0"
            strokeWidth="1.5"
          />
          {/* Eyes */}
          <ellipse cx="24" cy="28" rx="2.5" ry="3" fill="#fff" opacity="0.9" />
          <ellipse cx="40" cy="28" rx="2.5" ry="3" fill="#fff" opacity="0.9" />
          {/* Smile */}
          <path d="M26 36q6 6 12 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          {/* Blush */}
          <circle cx="18" cy="34" r="4" fill="#ff4081" opacity="0.3" />
          <circle cx="46" cy="34" r="4" fill="#ff4081" opacity="0.3" />
        </svg>
      );

    /* ━━━ TEAPOT POURING TEA INTO TEA GLASS (قۆری چای و پیاڵە) ━━━ */
    case 'teapot':
    case 'rose':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="tp-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="tp-tea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="55%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <filter id="tp-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Tilted Ornate Golden Teapot (Top-Left pouring toward Bottom-Right) */}
          <g transform="translate(0, 0)">
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-8 22 20; 14 22 20; -8 22 20"
              dur="2.4s"
              repeatCount="indefinite"
            />
            {/* Handle */}
            <path
              d="M11 14 C4 14, 4 26, 12 26"
              fill="none"
              stroke="url(#tp-gold)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Teapot Belly */}
            <ellipse cx="21" cy="21" rx="10" ry="8.5" fill="url(#tp-gold)" filter="url(#tp-glow)" />
            {/* Decorative Motif on Teapot */}
            <ellipse cx="21" cy="21" rx="5.5" ry="4" fill="#fef08a" opacity="0.35" />
            {/* Lid & Finial */}
            <ellipse cx="21" cy="12.5" rx="6" ry="2.2" fill="#fbbf24" />
            <circle cx="21" cy="10" r="2" fill="#fde047" />
            {/* Spout reaching toward the tea glass */}
            <path
              d="M29 19 Q36 18 39 24 L37 26 Q33 23 28 24 Z"
              fill="url(#tp-gold)"
            />
          </g>

          {/* Animated Pouring Stream of Red/Amber Tea */}
          <path
            d="M38 25 Q41 32 41 44"
            fill="none"
            stroke="url(#tp-tea)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="4 2"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="12;0"
              dur="0.45s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>

          {/* Hot Steam Wisps Rising from Glass */}
          <path
            d="M39 34 Q37 30 40 27"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.6"
          >
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.4s" repeatCount="indefinite" />
          </path>
          <path
            d="M45 35 Q47 31 44 28"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.6"
          >
            <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.4s" repeatCount="indefinite" />
          </path>

          {/* Classic Saucer (ژێرپیاڵە) */}
          <ellipse cx="42" cy="56" rx="13" ry="3.2" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.2" />
          <ellipse cx="42" cy="55.5" rx="8" ry="1.6" fill="#fef08a" opacity="0.45" />

          {/* Slim-Waisted Kurdish Tea Glass (پیاڵە / ئیستکان) */}
          <path
            d="M34 36 L50 36 Q46 45 48 54 L36 54 Q38 45 34 36 Z"
            fill="rgba(255,255,255,0.22)"
            stroke="#fde047"
            strokeWidth="1.4"
          />

          {/* Glowing Crimson Tea Inside the Glass */}
          <path
            d="M35.5 41 L48.5 41 Q46 47 47.2 53.2 L36.8 53.2 Q38 47 35.5 41 Z"
            fill="url(#tp-tea)"
          >
            <animate
              attributeName="opacity"
              values="0.85;1;0.85"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>

          {/* Gold Rim on Tea Glass */}
          <ellipse cx="42" cy="36" rx="8" ry="1.8" fill="none" stroke="#fde047" strokeWidth="1.5" />
        </svg>
      );

    /* ━━━ NEON HEART — Glowing animated heart ━━━ */
    case 'neon-heart':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <filter id="nh-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="nh-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff1493" />
              <stop offset="100%" stopColor="#ff69b4" />
            </linearGradient>
          </defs>
          <path
            d="M32 56S6 38 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 16-26 34-26 34Z"
            fill="url(#nh-g)"
            filter="url(#nh-glow)"
          />
          <path
            d="M32 56S6 38 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 16-26 34-26 34Z"
            fill="none"
            stroke="#ff69b4"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {/* Sparkle dots */}
          <circle cx="20" cy="20" r="1.5" fill="#fff" opacity="0.8">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="44" cy="18" r="1" fill="#fff" opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="32" cy="14" r="1.2" fill="#fff" opacity="0.7">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      );

    /* ━━━ FIRE — Sacred Flame ━━━ */
    case 'fire':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="fi-g" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff6f00" />
              <stop offset="50%" stopColor="#ff9100" />
              <stop offset="100%" stopColor="#ffd600" />
            </linearGradient>
            <filter id="fi-glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Outer flame */}
          <path
            d="M32 4c0 0-20 20-20 38a20 20 0 0 0 40 0C52 24 32 4 32 4Z"
            fill="url(#fi-g)"
            filter="url(#fi-glow)"
          >
            <animateTransform attributeName="transform" type="scale" values="1 1;1.03 0.97;0.97 1.03;1 1" dur="0.8s" repeatCount="indefinite" />
          </path>
          {/* Inner flame */}
          <path
            d="M32 20c0 0-10 12-10 24a10 10 0 0 0 20 0C42 32 32 20 32 20Z"
            fill="#ffeb3b"
            opacity="0.85"
          >
            <animateTransform attributeName="transform" type="scale" values="1 1;0.95 1.05;1.05 0.95;1 1" dur="0.6s" repeatCount="indefinite" />
          </path>
          {/* Core glow */}
          <ellipse cx="32" cy="46" rx="5" ry="8" fill="#fff" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.5s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      );

    /* ━━━ DIAMOND — Sparkling gemstone ━━━ */
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="dm-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4dd0e1" />
              <stop offset="50%" stopColor="#00acc1" />
              <stop offset="100%" stopColor="#006064" />
            </linearGradient>
            <filter id="dm-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Diamond shape */}
          <polygon points="32,4 52,24 32,60 12,24" fill="url(#dm-g)" filter="url(#dm-glow)" />
          {/* Facets */}
          <polygon points="32,4 22,24 32,20 42,24" fill="#4dd0e1" opacity="0.5" />
          <polygon points="12,24 22,24 32,60" fill="#00838f" opacity="0.4" />
          <polygon points="52,24 42,24 32,60" fill="#00acc1" opacity="0.3" />
          <line x1="22" y1="24" x2="42" y2="24" stroke="#80deea" strokeWidth="1" opacity="0.6" />
          {/* Sparkle stars */}
          <g>
            <polygon points="10,12 11,15 14,15 12,17 13,20 10,18 7,20 8,17 6,15 9,15" fill="#fff" opacity="0.8">
              <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </polygon>
            <polygon points="52,8 53,11 56,11 54,13 55,16 52,14 49,16 50,13 48,11 51,11" fill="#fff" opacity="0.6">
              <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
            </polygon>
            <polygon points="50,44 51,46 53,46 51.5,47.5 52,50 50,48.5 48,50 48.5,47.5 47,46 49,46" fill="#b2ebf2" opacity="0.7">
              <animate attributeName="opacity" values="0;0.9;0" dur="2.5s" begin="1s" repeatCount="indefinite" />
            </polygon>
          </g>
        </svg>
      );

    /* ━━━ SPORTS CAR — Racing car ━━━ */
    case 'sports-car':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="sc-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4081" />
              <stop offset="100%" stopColor="#c2185b" />
            </linearGradient>
          </defs>
          {/* Car body */}
          <path d="M8 40h48v6a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V40Z" fill="url(#sc-g)" />
          {/* Roof / windshield */}
          <path d="M18 40l6-14h16l8 14" fill="#e91e63" />
          <path d="M24 26h16l3 7H21Z" fill="#80deea" opacity="0.4" />
          {/* Headlights */}
          <rect x="52" y="41" width="4" height="3" rx="1" fill="#ffd600" opacity="0.9" />
          <rect x="8" y="41" width="4" height="3" rx="1" fill="#ff5252" opacity="0.7" />
          {/* Wheels */}
          <circle cx="18" cy="49" r="5.5" fill="#212121" />
          <circle cx="18" cy="49" r="3" fill="#616161" />
          <circle cx="18" cy="49" r="1.2" fill="#bdbdbd" />
          <circle cx="46" cy="49" r="5.5" fill="#212121" />
          <circle cx="46" cy="49" r="3" fill="#616161" />
          <circle cx="46" cy="49" r="1.2" fill="#bdbdbd" />
          {/* Speed lines */}
          <line x1="2" y1="36" x2="12" y2="36" stroke="#ff80ab" strokeWidth="1.5" opacity="0.5">
            <animate attributeName="x1" values="-4;2;-4" dur="0.4s" repeatCount="indefinite" />
          </line>
          <line x1="0" y1="42" x2="8" y2="42" stroke="#ff80ab" strokeWidth="1" opacity="0.3">
            <animate attributeName="x1" values="-6;0;-6" dur="0.5s" repeatCount="indefinite" />
          </line>
        </svg>
      );

    /* ━━━ LION — TikTok Roaring Fire Lion ━━━ */
    case 'lion':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <radialGradient id="ln-g" cx="50%" cy="40%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="55%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#b91c1c" />
            </radialGradient>
            <linearGradient id="ln-fire" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
            <filter id="ln-glow">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Erupting Back Flames */}
          <path
            d="M10 48 Q4 26 18 10 Q24 2 32 4 Q40 2 46 10 Q60 26 54 48 Z"
            fill="url(#ln-fire)"
            filter="url(#ln-glow)"
          >
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 1; 1.06 1.08; 0.97 1.03; 1 1"
              dur="0.65s"
              repeatCount="indefinite"
            />
          </path>
          {/* Fiery Mane */}
          <circle cx="32" cy="32" r="21" fill="url(#ln-g)" filter="url(#ln-glow)" />
          {/* Blazing Mane Spikes */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, idx) => {
            const rad = (angle * Math.PI) / 180;
            const x = 32 + 23 * Math.cos(rad);
            const y = 32 + 23 * Math.sin(rad);
            return (
              <circle key={angle} cx={x} cy={y} r="4.5" fill={idx % 2 === 0 ? '#ef4444' : '#fbbf24'} opacity="0.85">
                <animate
                  attributeName="r"
                  values="3.5;5.5;3.5"
                  dur={`${0.5 + (idx % 3) * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            );
          })}
          {/* Fierce Golden Face */}
          <circle cx="32" cy="33" r="14.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
          {/* Glowing Fire Eyes */}
          <polygon points="21,27 28,29 23,31" fill="#fef08a" filter="url(#ln-glow)" />
          <polygon points="43,27 36,29 41,31" fill="#fef08a" filter="url(#ln-glow)" />
          {/* Nose */}
          <polygon points="29,34 35,34 32,37.5" fill="#7c2d12" />
          {/* Roaring Open Mouth with Fangs & Fire */}
          <path d="M25 39 Q32 49 39 39 Z" fill="#7f1d1d" stroke="#451a03" strokeWidth="1.2" />
          <polygon points="27,39 28.5,42.5 30,39" fill="#ffffff" />
          <polygon points="34,39 35.5,42.5 37,39" fill="#ffffff" />
        </svg>
      );

    /* ━━━ ROCKET — Orbital launch ━━━ */
    case 'rocket':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="rk-g" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#e0e0e0" />
              <stop offset="100%" stopColor="#9e9e9e" />
            </linearGradient>
            <filter id="rk-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Flame exhaust */}
          <path d="M27 52l5 10 5-10" fill="#ff6f00" opacity="0.9" filter="url(#rk-glow)">
            <animate attributeName="d" values="M27 52l5 10 5-10;M28 52l4 12 4-12;M27 52l5 10 5-10" dur="0.3s" repeatCount="indefinite" />
          </path>
          <path d="M29 52l3 6 3-6" fill="#ffd600" opacity="0.8">
            <animate attributeName="d" values="M29 52l3 6 3-6;M30 52l2 8 2-8;M29 52l3 6 3-6" dur="0.25s" repeatCount="indefinite" />
          </path>
          {/* Rocket body */}
          <path d="M26 52V26a6 6 0 0 1 12 0v26H26Z" fill="url(#rk-g)" />
          {/* Nose cone */}
          <path d="M26 26l6-18 6 18" fill="#7c4dff" />
          {/* Window */}
          <circle cx="32" cy="32" r="4" fill="#1a237e" stroke="#b388ff" strokeWidth="1" />
          <circle cx="33" cy="31" r="1.2" fill="#e8eaf6" opacity="0.5" />
          {/* Fins */}
          <path d="M26 48l-6 8h6" fill="#7c4dff" />
          <path d="M38 48l6 8h-6" fill="#7c4dff" />
          {/* Stripe */}
          <rect x="26" y="42" width="12" height="2" fill="#e53935" rx="1" />
        </svg>
      );

    /* ━━━ NEBULA — Cosmic spiral ━━━ */
    case 'nebula':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <radialGradient id="nb-g" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#ff4081" />
              <stop offset="40%" stopColor="#e040fb" />
              <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
            </radialGradient>
            <filter id="nb-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Outer glow ring */}
          <circle cx="32" cy="32" r="28" fill="url(#nb-g)" filter="url(#nb-glow)" opacity="0.7">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="8s" repeatCount="indefinite" />
          </circle>
          {/* Spiral arms */}
          <path d="M32 32 Q42 18 50 28 Q56 38 42 40 Q34 42 32 32Z" fill="#e040fb" opacity="0.6">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="6s" repeatCount="indefinite" />
          </path>
          <path d="M32 32 Q22 46 14 36 Q8 26 22 24 Q30 22 32 32Z" fill="#ff80ab" opacity="0.5">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="6s" repeatCount="indefinite" />
          </path>
          {/* Core */}
          <circle cx="32" cy="32" r="6" fill="#fff" opacity="0.9">
            <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Stars */}
          {[
            [14, 14], [50, 12], [8, 48], [54, 50], [32, 6], [20, 54], [48, 32],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1" fill="#fff">
              <animate attributeName="opacity" values="0.2;1;0.2" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
      );

    /* ━━━ CROWN — Imperial Crown ━━━ */
    case 'crown':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="cr-g" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd600" />
              <stop offset="100%" stopColor="#ff8f00" />
            </linearGradient>
            <filter id="cr-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Crown body */}
          <path
            d="M8 46l4-22 10 10 10-22 10 22 10-10 4 22Z"
            fill="url(#cr-g)"
            stroke="#ffab00"
            strokeWidth="1.5"
            filter="url(#cr-glow)"
          />
          {/* Base band */}
          <rect x="8" y="44" width="48" height="8" rx="3" fill="#ff8f00" stroke="#e65100" strokeWidth="1" />
          {/* Jewels */}
          <circle cx="20" cy="48" r="2.5" fill="#e53935" />
          <circle cx="32" cy="48" r="2.5" fill="#1e88e5" />
          <circle cx="44" cy="48" r="2.5" fill="#43a047" />
          {/* Top jewels */}
          <circle cx="12" cy="24" r="2" fill="#e53935">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="32" cy="12" r="2.5" fill="#1e88e5">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="52" cy="24" r="2" fill="#43a047">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      );

    /* ━━━ INTERSTELLAR — Galaxy voyager ━━━ */
    case 'interstellar':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <radialGradient id="is-bg">
              <stop offset="0%" stopColor="#1a237e" />
              <stop offset="100%" stopColor="#000033" />
            </radialGradient>
            <radialGradient id="is-star">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
            </radialGradient>
            <filter id="is-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Space background */}
          <circle cx="32" cy="32" r="30" fill="url(#is-bg)" />
          {/* Warp ring */}
          <ellipse cx="32" cy="32" rx="26" ry="8" fill="none" stroke="#7c4dff" strokeWidth="2" opacity="0.6" filter="url(#is-glow)">
            <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="32" cy="32" rx="20" ry="6" fill="none" stroke="#b388ff" strokeWidth="1.5" opacity="0.4">
            <animateTransform attributeName="transform" type="rotate" from="120 32 32" to="480 32 32" dur="3s" repeatCount="indefinite" />
          </ellipse>
          {/* Astronaut / center figure */}
          <circle cx="32" cy="28" r="6" fill="#e8eaf6" />
          <circle cx="32" cy="28" r="4.5" fill="#283593" />
          <circle cx="33" cy="27" r="1.5" fill="#7c4dff" opacity="0.7" />
          <rect x="28" y="34" width="8" height="10" rx="3" fill="#e8eaf6" />
          {/* Stars */}
          {[
            [10, 8], [54, 10], [6, 50], [56, 48], [24, 6], [42, 58], [8, 30], [56, 28],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 1.2 : 0.8} fill="#fff">
              <animate attributeName="opacity" values="0.1;1;0.1" dur={`${1 + i * 0.4}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
      );

    /* ━━━ WHITE TIGER — Lightning beast ━━━ */
    case 'white-tiger':
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <defs>
            <linearGradient id="wt-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e3f2fd" />
              <stop offset="100%" stopColor="#90caf9" />
            </linearGradient>
            <filter id="wt-glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Lightning behind */}
          <path d="M18 4l4 14-6 2 10 20-4-12 6-2-8-18" fill="#64b5f6" opacity="0.6" filter="url(#wt-glow)">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1s" repeatCount="indefinite" />
          </path>
          <path d="M44 6l-3 12 5 2-8 18 3-10-5-2 6-16" fill="#42a5f5" opacity="0.5" filter="url(#wt-glow)">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.8s" begin="0.3s" repeatCount="indefinite" />
          </path>
          {/* Tiger head - rounded shape */}
          <ellipse cx="32" cy="34" rx="18" ry="16" fill="url(#wt-g)" />
          {/* Ears */}
          <path d="M16 22l-2-10 10 6Z" fill="#e3f2fd" stroke="#90caf9" strokeWidth="1" />
          <path d="M48 22l2-10-10 6Z" fill="#e3f2fd" stroke="#90caf9" strokeWidth="1" />
          <path d="M17 22l-1-6 6 4Z" fill="#ffab91" opacity="0.5" />
          <path d="M47 22l1-6-6 4Z" fill="#ffab91" opacity="0.5" />
          {/* Stripes */}
          <path d="M28 22v6" stroke="#546e7a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M32 20v8" stroke="#546e7a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M36 22v6" stroke="#546e7a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          {/* Eyes - electric blue */}
          <ellipse cx="24" cy="32" rx="3.5" ry="3" fill="#0d47a1" />
          <ellipse cx="40" cy="32" rx="3.5" ry="3" fill="#0d47a1" />
          <circle cx="25" cy="31" r="1.2" fill="#64b5f6" />
          <circle cx="41" cy="31" r="1.2" fill="#64b5f6" />
          <circle cx="25.5" cy="31.5" r="0.5" fill="#fff" />
          <circle cx="41.5" cy="31.5" r="0.5" fill="#fff" />
          {/* Nose */}
          <path d="M30 38l2 2 2-2" fill="#90a4ae" />
          {/* Mouth */}
          <path d="M28 42q4 3 8 0" fill="none" stroke="#546e7a" strokeWidth="1" strokeLinecap="round" />
          {/* Whiskers */}
          <line x1="14" y1="38" x2="22" y2="37" stroke="#b0bec5" strokeWidth="0.8" />
          <line x1="14" y1="41" x2="22" y2="40" stroke="#b0bec5" strokeWidth="0.8" />
          <line x1="42" y1="37" x2="50" y2="38" stroke="#b0bec5" strokeWidth="0.8" />
          <line x1="42" y1="40" x2="50" y2="41" stroke="#b0bec5" strokeWidth="0.8" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 64 64" width={s} height={s} className={className}>
          <circle cx="32" cy="32" r="24" fill="#424242" />
          <text x="32" y="38" textAnchor="middle" fill="#fff" fontSize="20">?</text>
        </svg>
      );
  }
}
