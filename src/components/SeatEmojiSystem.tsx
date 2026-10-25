import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Smile } from 'lucide-react';
import { useLanguage } from '../contexts';
import { MOBILE_EMOJI_CATEGORIES } from '../constants/mobileEmojis';

export interface SeatEmojiEvent {
  id: string;
  seatNo: number;
  emojiId: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface EmojiCatalogItem {
  vip?: boolean;
  id: string;
  label: string;
  labelKu?: string;
  labelEn?: string;
}

export const SEAT_EMOJI_CATALOG: EmojiCatalogItem[] = [
  { id: 'grin', label: 'پێکەنین', labelKu: 'پێکەنین', labelEn: 'Grin' },
  { id: 'wave-hand', label: 'سڵاوکردن', labelKu: 'سڵاوکردن', labelEn: 'Wave' },
  { id: 'buzzer', label: 'دوگمەی سوور', labelKu: 'دوگمەی سوور', labelEn: 'Buzzer' },
  { id: 'slot-machine', label: 'بەخت', labelKu: 'بەخت', labelEn: 'Slots' },
  { id: 'facepalm-laugh', label: 'پێکەنینی زۆر', labelKu: 'پێکەنینی زۆر', labelEn: 'Laughing' },
  { id: 'kiss-right', label: 'ماچ', labelKu: 'ماچ', labelEn: 'Kiss' },
  { id: 'kiss-left', label: 'ماچ', labelKu: 'ماچ', labelEn: 'Kiss' },
  { id: 'rose-smile', label: 'گوڵی سوور', labelKu: 'گوڵی سوور', labelEn: 'Rose' },
  { id: 'heart-eyes', label: 'خۆشەویستی', labelKu: 'خۆشەویستی', labelEn: 'Heart Eyes' },
  { id: 'cool-shades', label: 'چاوێلکە', labelKu: 'چاوێلکە', labelEn: 'Sunglasses' },
  { id: 'shisha', label: 'نێرگەلە', labelKu: 'نێرگەلە', labelEn: 'Shisha' },
  { id: 'rainbow-vomit', label: 'پەلکەزێڕینە', labelKu: 'پەلکەزێڕینە', labelEn: 'Rainbow' },
  { id: 'peeking-shy', label: 'شەرمکردن', labelKu: 'شەرمکردن', labelEn: 'Shy' },
  { id: 'ninja-bomb', label: 'بۆمب', labelKu: 'بۆمب', labelEn: 'Bomb' },
  { id: 'angry-rage', label: 'توڕەبوون', labelKu: 'توڕەبوون', labelEn: 'Angry' },
  { id: 'crying-rivers', label: 'گریان', labelKu: 'گریان', labelEn: 'Crying' },
  { id: 'vip-crown', label: 'تاج', labelKu: 'تاج', labelEn: 'Crown', vip: true },
  { id: 'vip-diamond', label: 'ئەڵماس', labelKu: 'ئەڵماس', labelEn: 'Diamond', vip: true },
  { id: 'vip-fire', label: 'ئاگر', labelKu: 'ئاگر', labelEn: 'Fire', vip: true },
  { id: 'vip-rocket', label: 'ڕۆکێت', labelKu: 'ڕۆکێت', labelEn: 'Rocket', vip: true },
  { id: 'vip-trophy', label: 'پاڵەوان', labelKu: 'پاڵەوان', labelEn: 'Trophy', vip: true },
  { id: 'vip-money', label: 'پارە', labelKu: 'پارە', labelEn: 'Money', vip: true },
  { id: 'vip-party', label: 'ئاهەنگ', labelKu: 'ئاهەنگ', labelEn: 'Party', vip: true },
  { id: 'vip-star', label: 'ئەستێرە', labelKu: 'ئەستێرە', labelEn: 'Star', vip: true },
  { id: 'vip-heart', label: 'دڵ', labelKu: 'دڵ', labelEn: 'Heart', vip: true },
  { id: 'vip-unicorn', label: 'ئەسپی شاخدار', labelKu: 'ئەسپی شاخدار', labelEn: 'Unicorn', vip: true },
  { id: 'vip-lion', label: 'شێر', labelKu: 'شێر', labelEn: 'Lion', vip: true },
  { id: 'vip-ghost', label: 'تارمایی', labelKu: 'تارمایی', labelEn: 'Ghost', vip: true },
];

/**
 * Real 3D emoji artwork (Microsoft Fluent Emoji 3D). The hand-drawn SVGs below
 * are kept as an offline/error fallback.
 */
const FLUENT_3D_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/';
const FLUENT_3D_EMOJI: Record<string, string> = {
  'grin': 'Grinning squinting face/3D/grinning_squinting_face_3d.png',
  'wave-hand': 'Waving hand/Default/3D/waving_hand_3d_default.png',
  'buzzer': 'Police car light/3D/police_car_light_3d.png',
  'slot-machine': 'Slot machine/3D/slot_machine_3d.png',
  'facepalm-laugh': 'Rolling on the floor laughing/3D/rolling_on_the_floor_laughing_3d.png',
  'kiss-right': 'Face blowing a kiss/3D/face_blowing_a_kiss_3d.png',
  'kiss-left': 'Kissing face/3D/kissing_face_3d.png',
  'rose-smile': 'Rose/3D/rose_3d.png',
  'heart-eyes': 'Smiling face with heart-eyes/3D/smiling_face_with_heart-eyes_3d.png',
  'cool-shades': 'Smiling face with sunglasses/3D/smiling_face_with_sunglasses_3d.png',
  'shisha': 'Face exhaling/3D/face_exhaling_3d.png',
  'rainbow-vomit': 'Face vomiting/3D/face_vomiting_3d.png',
  'peeking-shy': 'Flushed face/3D/flushed_face_3d.png',
  'ninja-bomb': 'Bomb/3D/bomb_3d.png',
  'angry-rage': 'Pouting face/3D/pouting_face_3d.png',
  'crying-rivers': 'Loudly crying face/3D/loudly_crying_face_3d.png',
  // VIP-only emojis (full 3D spin animation)
  'vip-crown': 'Crown/3D/crown_3d.png',
  'vip-diamond': 'Gem stone/3D/gem_stone_3d.png',
  'vip-fire': 'Fire/3D/fire_3d.png',
  'vip-rocket': 'Rocket/3D/rocket_3d.png',
  'vip-trophy': 'Trophy/3D/trophy_3d.png',
  'vip-money': 'Money bag/3D/money_bag_3d.png',
  'vip-party': 'Party popper/3D/party_popper_3d.png',
  'vip-star': 'Glowing star/3D/glowing_star_3d.png',
  'vip-heart': 'Sparkling heart/3D/sparkling_heart_3d.png',
  'vip-unicorn': 'Unicorn/3D/unicorn_3d.png',
  'vip-lion': 'Lion/3D/lion_3d.png',
  'vip-ghost': 'Ghost/3D/ghost_3d.png',
};
/**
 * Renders a 3D-shaded animated emoji matching the 16 voice-room emojis.
 */
export function AnimatedEmojiGraphic({
  emojiId,
  size = 64,
}: {
  emojiId: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isVipEmoji = emojiId.startsWith('vip-');
  const fluentUrl = FLUENT_3D_EMOJI[emojiId] ? `${FLUENT_3D_BASE}${encodeURI(FLUENT_3D_EMOJI[emojiId])}` : null;
  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={
        emojiId === 'facepalm-laugh' || emojiId === 'grin'
          ? {
              rotate: [0, -6, 6, -5, 5, 0],
              scale: [1, 1.08, 0.97, 1.06, 1],
            }
          : emojiId === 'wave-hand'
            ? {
                rotate: [0, -14, 14, -12, 12, 0],
                y: [0, -3, 0],
              }
            : emojiId === 'buzzer'
              ? {
                  scale: [1, 0.92, 1.08, 0.94, 1],
                }
              : emojiId === 'heart-eyes' || emojiId === 'rose-smile'
                ? {
                    scale: [1, 1.1, 1, 1.08, 1],
                  }
                : emojiId === 'angry-rage' || emojiId === 'ninja-bomb'
                  ? {
                      x: [0, -3, 3, -3, 3, 0],
                      scale: [1, 1.08, 1],
                    }
                  : {
                      y: [0, -4, 0, -3, 0],
                      scale: [1, 1.05, 1],
                    }
      }
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative flex items-center justify-center select-none pointer-events-none"
    >
      {fluentUrl && !imgFailed ? (
        isVipEmoji ? (
          <motion.img
            src={fluentUrl}
            alt={emojiId}
            draggable={false}
            onError={() => setImgFailed(true)}
            animate={{ rotateY: [0, 360], scale: [1, 1.12, 1], y: [0, -5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d', perspective: 400 }}
            className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(251,191,36,0.85)]"
          />
        ) : (
          <img src={fluentUrl} alt={emojiId} draggable={false} onError={() => setImgFailed(true)} className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]" />
        )
      ) : (
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]">
        <defs>
          <radialGradient id="emo-yellow-3d" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#fff799" />
            <stop offset="45%" stopColor="#ffd43b" />
            <stop offset="85%" stopColor="#f59f00" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
          <radialGradient id="emo-orange-3d" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffd8a8" />
            <stop offset="40%" stopColor="#ff922b" />
            <stop offset="85%" stopColor="#e8590c" />
            <stop offset="100%" stopColor="#c92a2a" />
          </radialGradient>
          <radialGradient id="emo-bomb-3d" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="45%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
          <linearGradient id="emo-tear-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#74c0fc" />
            <stop offset="50%" stopColor="#339af0" />
            <stop offset="100%" stopColor="#1c7ed6" />
          </linearGradient>
          <linearGradient id="emo-mouth-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7f1d1d" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="emo-hand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="emo-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff0055" />
            <stop offset="20%" stopColor="#ff9900" />
            <stop offset="40%" stopColor="#ffee00" />
            <stop offset="60%" stopColor="#00e676" />
            <stop offset="80%" stopColor="#00b0ff" />
            <stop offset="100%" stopColor="#d500f9" />
          </linearGradient>
        </defs>

        {/* 1. GRIN */}
        {emojiId === 'grin' && (
          <g>
            <circle cx="60" cy="60" r="50" fill="url(#emo-yellow-3d)" />
            <ellipse cx="32" cy="63" rx="9" ry="5" fill="#f97316" opacity="0.35" />
            <ellipse cx="88" cy="63" rx="9" ry="5" fill="#f97316" opacity="0.35" />
            <path d="M34 48 Q42 35 50 48" fill="none" stroke="#5c2b09" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M70 48 Q78 35 86 48" fill="none" stroke="#5c2b09" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M28 66 Q60 104 92 66 Z" fill="url(#emo-mouth-grad)" />
            <path d="M31 67 Q60 76 89 67 L86 64 L34 64 Z" fill="#ffffff" />
            <ellipse cx="60" cy="83" rx="18" ry="7" fill="#fb7185" />
          </g>
        )}

        {/* 2. WAVE HAND */}
        {emojiId === 'wave-hand' && (
          <g>
            {/* Blue Cuff */}
            <rect x="38" y="84" width="44" height="22" rx="10" fill="#2563eb" stroke="#60a5fa" strokeWidth="2" />
            <ellipse cx="60" cy="85" rx="22" ry="6" fill="#1d4ed8" />
            {/* 3D Palm & Fingers */}
            <path
              d="M38 82 L34 48 A5.5 5.5 0 0 1 45 46 L48 64 L49 32 A6 6 0 0 1 61 32 L61 62 L64 34 A6 6 0 0 1 76 35 L73 64 L78 44 A5.5 5.5 0 0 1 88 47 L82 74 L94 64 A6 6 0 0 1 101 73 L80 90 Q60 95 38 82 Z"
              fill="#fed7aa"
              stroke="#fb923c"
              strokeWidth="2"
            />
            <ellipse cx="60" cy="72" rx="15" ry="11" fill="#fdba74" opacity="0.45" />
          </g>
        )}

        {/* 3. RED BUZZER BUTTON */}
        {emojiId === 'buzzer' && (
          <g>
            {/* Silver Base */}
            <ellipse cx="60" cy="88" rx="40" ry="18" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
            <ellipse cx="60" cy="83" rx="36" ry="14" fill="#94a3b8" />
            {/* Red Button */}
            <g>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 5; 0 0"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <ellipse cx="60" cy="74" rx="30" ry="13" fill="#b91c1c" />
              <ellipse cx="60" cy="68" rx="30" ry="13" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
            </g>
            {/* Sparks */}
            <path d="M14 68 L24 72 M16 80 L26 77" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
              <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" />
            </path>
            <path d="M106 68 L96 72 M104 80 L94 77" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
              <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" />
            </path>
            {/* Pressing Hand */}
            <g>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 -4; 0 4; 0 -4"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <path
                d="M85 24 L54 34 Q42 40 44 52 L58 64 Q48 72 58 76 L88 56 Z"
                fill="#fed7aa"
                stroke="#f97316"
                strokeWidth="2"
              />
              <rect x="80" y="18" width="16" height="26" rx="6" transform="rotate(-25 80 18)" fill="#e2e8f0" />
            </g>
          </g>
        )}

        {/* 4. SLOT MACHINE */}
        {emojiId === 'slot-machine' && (
          <g>
            <rect x="18" y="26" width="76" height="68" rx="14" fill="#4f46e5" stroke="#a5b4fc" strokeWidth="3" />
            <rect x="26" y="36" width="60" height="48" rx="8" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" />
            {/* Lever */}
            <path d="M94 60 L106 60 L106 38" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <circle cx="106" cy="36" r="7" fill="#ef4444" />
            {/* Spinning Wheel */}
            <circle cx="56" cy="60" r="18" fill="#ef4444" stroke="#fca5a5" strokeWidth="2.5" />
            <circle cx="56" cy="60" r="11" fill="#ffffff" />
            <text x="56" y="65" textAnchor="middle" fontSize="15" fontWeight="900" fill="#1e1b4b">
              7
            </text>
            {/* Blinking Marquee Lights */}
            {[26, 40, 54, 68, 82].map((lx, i) => (
              <circle key={i} cx={lx} cy="30" r="3" fill={i % 2 === 0 ? '#fde047' : '#4ade80'}>
                <animate attributeName="opacity" values="1;0.2;1" dur="0.5s" begin={`${i * 0.1}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}

        {/* 5. FACEPALM LAUGHING TEARS (Exact match to Screenshot 1!) */}
        {emojiId === 'facepalm-laugh' && (
          <g>
            <circle cx="60" cy="60" r="50" fill="url(#emo-yellow-3d)" />
            {/* Peeking Eye */}
            <ellipse cx="44" cy="46" rx="8" ry="6" fill="#451a03" />
            {/* Big Laughing Open Mouth */}
            <path d="M30 62 Q58 102 90 70 Z" fill="url(#emo-mouth-grad)" />
            <path d="M33 63 Q60 76 87 70 L85 65 L35 60 Z" fill="#ffffff" />
            <ellipse cx="58" cy="81" rx="16" ry="7" fill="#fb7185" />
            {/* Streaming Blue Tears Left & Right */}
            <path
              d="M42 46 Q28 68 24 98 Q32 104 38 96 Q42 72 46 50 Z"
              fill="url(#emo-tear-grad)"
            >
              <animate attributeName="opacity" values="0.85;1;0.85" dur="0.6s" repeatCount="indefinite" />
            </path>
            <path
              d="M84 58 Q96 78 90 104 Q82 106 78 98 Q84 78 80 60 Z"
              fill="url(#emo-tear-grad)"
            />
            {/* 3D Golden Hand Facepalming Across Forehead */}
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 75 55; -5 75 55; 3 75 55; 0 75 55"
                dur="0.9s"
                repeatCount="indefinite"
              />
              <path
                d="M104 68 Q112 52 96 42 L62 24 Q55 21 53 26 Q51 31 60 35 L48 31 Q42 29 41 35 Q40 40 52 44 L45 43 Q39 42 40 48 Q41 53 54 56 L49 57 Q44 57 46 62 Q48 67 66 69 L88 73 Q100 75 104 68 Z"
                fill="url(#emo-hand-grad)"
                stroke="#b45309"
                strokeWidth="1.8"
              />
            </g>
          </g>
        )}

        {/* 6. KISS RIGHT */}
        {emojiId === 'kiss-right' && (
          <g>
            <circle cx="56" cy="60" r="48" fill="url(#emo-yellow-3d)" />
            <circle cx="50" cy="64" r="9" fill="#f97316" opacity="0.4" />
            <path d="M54 42 Q64 36 72 44" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M58 50 Q66 47 72 52" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M88 56 Q98 56 96 63 Q98 70 88 70" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            {/* Floating Red Heart */}
            <g>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 8 -8; 0 0"
                dur="1s"
                repeatCount="indefinite"
              />
              <path
                d="M102 42 C102 36 94 34 94 40 C94 34 86 36 86 42 C86 48 94 53 94 56 C94 53 102 48 102 42 Z"
                fill="#ef4444"
              />
            </g>
          </g>
        )}

        {/* 7. KISS LEFT */}
        {emojiId === 'kiss-left' && (
          <g>
            <circle cx="64" cy="60" r="48" fill="url(#emo-yellow-3d)" />
            <circle cx="70" cy="64" r="9" fill="#f97316" opacity="0.4" />
            <path d="M66 42 Q56 36 48 44" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M62 50 Q54 47 48 52" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M32 56 Q22 56 24 63 Q22 70 32 70" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            {/* Floating Red Heart */}
            <g>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; -8 -8; 0 0"
                dur="1s"
                repeatCount="indefinite"
              />
              <path
                d="M34 42 C34 36 26 34 26 40 C26 34 18 36 18 42 C18 48 26 53 26 56 C26 53 34 48 34 42 Z"
                fill="#ef4444"
              />
            </g>
          </g>
        )}

        {/* 8. ROSE SMILE */}
        {emojiId === 'rose-smile' && (
          <g>
            <circle cx="62" cy="60" r="48" fill="url(#emo-yellow-3d)" />
            <circle cx="38" cy="62" r="8" fill="#f97316" opacity="0.4" />
            <circle cx="86" cy="62" r="8" fill="#f97316" opacity="0.4" />
            <path d="M36 48 Q46 38 54 48" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M70 48 Q78 38 88 48" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M50 62 Q62 76 74 62 Z" fill="url(#emo-mouth-grad)" />
            {/* Stem & Rose */}
            <path d="M28 58 L46 98" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="34" cy="76" rx="7" ry="4" transform="rotate(-25 34 76)" fill="#22c55e" />
            <circle cx="26" cy="54" r="13" fill="#e11d48" />
            <path d="M20 50 Q26 42 32 50 Q26 58 20 50 Z" fill="#fb7185" />
            <ellipse cx="42" cy="92" rx="9" ry="7" fill="url(#emo-hand-grad)" />
          </g>
        )}

        {/* 9. HEART EYES */}
        {emojiId === 'heart-eyes' && (
          <g>
            <circle cx="60" cy="60" r="50" fill="url(#emo-yellow-3d)" />
            {/* Left Pulsing Heart Eye */}
            <g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.12;1"
                additive="sum"
                dur="0.8s"
                repeatCount="indefinite"
              />
              <path
                d="M52 42 C52 33 40 30 40 39 C40 30 28 33 28 42 C28 51 40 58 40 62 C40 58 52 51 52 42 Z"
                fill="#ef4444"
              />
            </g>
            {/* Right Pulsing Heart Eye */}
            <path
              d="M92 42 C92 33 80 30 80 39 C80 30 68 33 68 42 C68 51 80 58 80 62 C80 58 92 51 92 42 Z"
              fill="#ef4444"
            />
            <path d="M34 70 Q60 98 86 70 Z" fill="url(#emo-mouth-grad)" />
          </g>
        )}

        {/* 10. COOL SHADES */}
        {emojiId === 'cool-shades' && (
          <g>
            <circle cx="60" cy="60" r="50" fill="url(#emo-yellow-3d)" />
            {/* Sunglasses Frame */}
            <path d="M14 44 L106 44" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
            <rect x="20" y="40" width="35" height="22" rx="7" fill="url(#emo-rainbow)" stroke="#0f172a" strokeWidth="4" />
            <rect x="65" y="40" width="35" height="22" rx="7" fill="url(#emo-rainbow)" stroke="#0f172a" strokeWidth="4" />
            {/* Smirk */}
            <path d="M44 78 Q66 86 80 72" fill="none" stroke="#451a03" strokeWidth="5" strokeLinecap="round" />
            {/* Star Glint */}
            <path d="M98 32 L100 40 L108 42 L100 44 L98 52 L96 44 L88 42 L96 40 Z" fill="#ffffff">
              <animate attributeName="opacity" values="0.2;1;0.2" dur="1s" repeatCount="indefinite" />
            </path>
          </g>
        )}

        {/* 11. SHISHA / HOOKAH */}
        {emojiId === 'shisha' && (
          <g>
            <circle cx="56" cy="60" r="48" fill="url(#emo-yellow-3d)" />
            <path d="M34 48 Q42 38 50 48" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M64 48 Q72 38 80 48" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M46 66 Q56 80 68 66 Z" fill="url(#emo-mouth-grad)" />
            {/* Hookah Pipe & Base */}
            <path d="M92 38 L92 72 L80 98 L104 98 L92 72" fill="#ea580c" stroke="#fdba74" strokeWidth="2" />
            <ellipse cx="92" cy="38" rx="10" ry="3.5" fill="#cbd5e1" />
            <path d="M88 58 Q74 96 42 82" fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
            {/* Smoke Puff */}
            <circle cx="38" cy="30" r="6" fill="#e2e8f0" opacity="0.7">
              <animate attributeName="cy" values="36;18" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* 12. RAINBOW VOMIT */}
        {emojiId === 'rainbow-vomit' && (
          <g>
            <circle cx="60" cy="54" r="46" fill="url(#emo-yellow-3d)" />
            <path d="M34 42 L46 48 L34 54" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M86 42 L74 48 L86 54" fill="none" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="42" y="64" width="36" height="14" rx="7" fill="#451a03" />
            {/* Animated Rainbow Stream */}
            <rect x="44" y="70" width="32" height="42" rx="4" fill="url(#emo-rainbow)">
              <animate attributeName="height" values="36;45;36" dur="0.6s" repeatCount="indefinite" />
            </rect>
          </g>
        )}

        {/* 13. PEEKING SHY */}
        {emojiId === 'peeking-shy' && (
          <g>
            <circle cx="60" cy="68" r="46" fill="url(#emo-yellow-3d)" />
            <path d="M36 46 Q44 40 52 46" fill="none" stroke="#451a03" strokeWidth="4" strokeLinecap="round" />
            <path d="M68 46 Q76 40 84 46" fill="none" stroke="#451a03" strokeWidth="4" strokeLinecap="round" />
            <circle cx="44" cy="60" r="8" fill="#451a03" />
            <circle cx="42" cy="57" r="3" fill="#ffffff" />
            <circle cx="76" cy="60" r="8" fill="#451a03" />
            <circle cx="74" cy="57" r="3" fill="#ffffff" />
            <ellipse cx="30" cy="70" rx="8" ry="4.5" fill="#f97316" opacity="0.45" />
            <ellipse cx="90" cy="70" rx="8" ry="4.5" fill="#f97316" opacity="0.45" />
          </g>
        )}

        {/* 14. NINJA BOMB */}
        {emojiId === 'ninja-bomb' && (
          <g>
            <circle cx="60" cy="64" r="46" fill="url(#emo-bomb-3d)" />
            <rect x="52" y="12" width="16" height="10" rx="3" fill="#94a3b8" />
            <path d="M60 12 Q72 2 82 10" fill="none" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="82" cy="10" r="5" fill="#f97316">
              <animate attributeName="r" values="4;7;4" dur="0.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="44" cy="62" r="7" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />
            <circle cx="76" cy="62" r="7" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />
          </g>
        )}

        {/* 15. ANGRY RAGE */}
        {emojiId === 'angry-rage' && (
          <g>
            <circle cx="60" cy="62" r="48" fill="url(#emo-orange-3d)" />
            <path d="M30 42 L54 54" stroke="#451a03" strokeWidth="6" strokeLinecap="round" />
            <path d="M90 42 L66 54" stroke="#451a03" strokeWidth="6" strokeLinecap="round" />
            <circle cx="44" cy="58" r="6" fill="#451a03" />
            <circle cx="76" cy="58" r="6" fill="#451a03" />
            <path d="M42 84 Q60 70 78 84" fill="none" stroke="#451a03" strokeWidth="5.5" strokeLinecap="round" />
          </g>
        )}

        {/* 16. CRYING RIVERS */}
        {emojiId === 'crying-rivers' && (
          <g>
            <circle cx="60" cy="60" r="48" fill="url(#emo-yellow-3d)" />
            <rect x="30" y="50" width="14" height="54" rx="6" fill="url(#emo-tear-grad)">
              <animate attributeName="height" values="48;56;48" dur="0.7s" repeatCount="indefinite" />
            </rect>
            <rect x="76" y="50" width="14" height="54" rx="6" fill="url(#emo-tear-grad)">
              <animate attributeName="height" values="48;56;48" dur="0.7s" repeatCount="indefinite" />
            </rect>
            <path d="M30 48 Q38 42 46 48" fill="none" stroke="#451a03" strokeWidth="5" strokeLinecap="round" />
            <path d="M74 48 Q82 42 90 48" fill="none" stroke="#451a03" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="60" cy="78" rx="14" ry="10" fill="url(#emo-mouth-grad)" />
          </g>
        )}
      </svg>
      )}
    </motion.div>
  );
}

/**
 * Renders the animated emoji directly on top of a voice room seat (Screenshot 1 style).
 */
export function SeatEmojiOverlay({ emojiId }: { emojiId: string }) {
  return (
    <motion.div
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1.22, 1.05], opacity: 1 }}
      exit={{ scale: 0.3, opacity: 0 }}
      transition={{ duration: 0.4, ease: 'backOut' }}
      className="pointer-events-none absolute -inset-2 z-30 flex items-center justify-center"
    >
      <AnimatedEmojiGraphic emojiId={emojiId} size={74} />
    </motion.div>
  );
}

/**
 * Interactive 4x4 3D Animated Emoji Drawer Modal (Screenshot 2 style).
 */
export function SeatEmojiPickerModal({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectMobileEmoji,
  isVip = false,
  initialTab = 'mobile',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji?: (emojiId: string) => void;
  onSelectMobileEmoji?: (emoji: string) => void;
  isVip?: boolean;
  initialTab?: 'mobile' | 'animated';
}) {
  const { tr } = useLanguage();
  const [activeTab, setActiveTab] = useState<'mobile' | 'animated'>(initialTab);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([
    '😂', '❤️', '🔥', '👑', '😍', '👏', '🌹', '✨', '🦁', '💯', '🥳', '🥰', '🙏', '💎', '🚀', '🤍'
  ]);

  const currentCategory =
    MOBILE_EMOJI_CATEGORIES.find((c) => c.id === selectedCategoryId) ||
    MOBILE_EMOJI_CATEGORIES[0];

  const handlePickMobileEmoji = (emoji: string) => {
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 16));
    if (onSelectMobileEmoji) {
      onSelectMobileEmoji(emoji);
    } else if (onSelectEmoji) {
      onSelectEmoji(emoji);
    }
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-[#14141f] pb-6 shadow-[0_-15px_40px_rgba(0,0,0,0.85)]"
          >
            {/* Top Category & Tab Selector */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Primary Mode Switcher */}
                <div className="flex rounded-xl bg-black/40 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('mobile')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === 'mobile'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>😀</span>
                    <span>{tr('ئیمۆجی مۆبایل', 'Mobile Emojis')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('animated')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === 'animated'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>✨</span>
                    <span>{tr('٣D جوڵاو', '3D Animated')}</span>
                  </button>
                </div>
              </div>

              {isVip && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <Crown className="h-4 w-4 fill-amber-400" />
                </div>
              )}
            </div>

            {/* ── TAB 1: ALL MOBILE EMOJIS (Categorized) ── */}
            {activeTab === 'mobile' && (
              <div className="pt-2">
                {/* Horizontal Category Tabs Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none">
                  {MOBILE_EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        selectedCategoryId === cat.id
                          ? 'border border-violet-500/50 bg-violet-600/30 text-violet-200 shadow-sm'
                          : 'border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                      }`}
                    >
                      <span className="text-sm">{cat.icon}</span>
                      <span className="text-[11px]">{tr(cat.nameKu, cat.nameEn)}</span>
                    </button>
                  ))}
                </div>

                {/* Quick / Recent Emojis Bar */}
                <div className="flex items-center gap-2 border-y border-white/[0.05] bg-black/20 px-4 py-1.5">
                  <span className="text-[10px] font-bold text-slate-500 shrink-0">
                    {tr('خێرا:', 'Quick:')}
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                    {recentEmojis.map((emoji, idx) => (
                      <button
                        key={`rec-${idx}-${emoji}`}
                        type="button"
                        onClick={() => handlePickMobileEmoji(emoji)}
                        className="text-lg hover:scale-125 active:scale-90 transition-transform shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Emojis Grid */}
                <div className="grid grid-cols-8 sm:grid-cols-9 gap-1.5 px-4 pt-3 max-h-[46vh] overflow-y-auto">
                  {currentCategory.emojis.map((emoji, index) => (
                    <button
                      key={`emoji-${index}-${emoji}`}
                      type="button"
                      onClick={() => handlePickMobileEmoji(emoji)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl hover:bg-white/10 active:scale-80 hover:scale-115 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 2: 3D ANIMATED SEAT EMOJIS ── */}
            {activeTab === 'animated' && (
              <div className="grid grid-cols-4 gap-3 px-5 pt-4 max-h-[50vh] overflow-y-auto">
                {SEAT_EMOJI_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.vip && !isVip) return;
                      if (onSelectEmoji) onSelectEmoji(item.id);
                      onClose();
                    }}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl p-2 transition hover:bg-white/[0.06] active:scale-90 ${
                      item.vip ? 'bg-amber-400/[0.06] ring-1 ring-amber-400/30' : ''
                    } ${item.vip && !isVip ? 'opacity-50' : ''}`}
                    title={tr(item.labelKu || item.label, item.labelEn || item.label)}
                  >
                    <AnimatedEmojiGraphic emojiId={item.id} size={64} />
                    {item.vip && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 shadow">
                        <Crown className="h-2.5 w-2.5 fill-black text-black" />
                      </span>
                    )}
                    <span className="mt-1 text-[10px] text-slate-400 group-hover:text-white truncate max-w-full">
                      {tr(item.labelKu || item.label, item.labelEn || item.label)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
