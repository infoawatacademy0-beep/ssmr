import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';
import { Lock, Check, Sparkles, Flame, Crown, Image as ImageIcon, Shield, Gem } from 'lucide-react';
import { CURATED_ANIMATED_THEMES, AnimatedThemeOverlay } from './AnimatedThemeEffect';
import { calculateVipLevelFromXp } from '../types';

export interface LevelFrameDef {
  id: string;
  minLevel: number;
  kuName: string;
  enName: string;
  kuDesc: string;
  enDesc: string;
  c1: string;
  c2: string;
  c3: string;
  glow: string;
  ornament: 'crescent' | 'emerald' | 'wings' | 'stars' | 'fire' | 'rose' | 'lightning' | 'dragon' | 'galaxy' | 'emperor';
  coverThemeId: string;
  kuCoverName: string;
  enCoverName: string;
}

export const LEVEL_AVATAR_FRAMES: LevelFrameDef[] = [
  {
    id: 'lvl_5_crescent',
    minLevel: 1,
    kuName: 'مانگی زێڕین و فانۆسی جوڵاو',
    enName: 'Golden Crescent & Lanterns',
    kuDesc: 'چوارچێوەی ئەنیمەیشنی مانگی هیلالی نەخشدار بە زێڕ و دوو فانۆسی درەوشاوەی جوڵاو.',
    enDesc: 'Animated golden crescent moon with swinging glowing lanterns.',
    c1: '#fef08a',
    c2: '#f59e0b',
    c3: '#b45309',
    glow: 'rgba(245, 158, 11, 0.85)',
    ornament: 'crescent',
    coverThemeId: 'royal_gold',
    kuCoverName: 'کەڤەری ئەنیمەیشنی زێڕی شاهانە',
    enCoverName: '24K Royal Gold Animated Cover',
  },
  {
    id: 'lvl_10_emerald',
    minLevel: 5,
    kuName: 'تاجی زمڕودی سەوزی جوڵاو',
    enName: 'Emerald Oasis Crown',
    kuDesc: 'نەخشی زمڕودی شاهانە بە گەوهەری سەوز و بازنەی زێڕینی سووڕاوە.',
    enDesc: 'Royal emerald filigree with rotating golden halo & pulsing jade gems.',
    c1: '#a7f3d0',
    c2: '#10b981',
    c3: '#065f46',
    glow: 'rgba(16, 185, 129, 0.85)',
    ornament: 'emerald',
    coverThemeId: 'dragon_emerald',
    kuCoverName: 'کەڤەری ئەنیمەیشنی ئاگری زمڕود',
    enCoverName: 'Dragon Emerald Animated Cover',
  },
  {
    id: 'lvl_20_sapphire',
    minLevel: 10,
    kuName: 'باڵی فریشتەی یاقووتی جوڵاو',
    enName: 'Sapphire Angel Wings',
    kuDesc: 'باڵی جوڵاوی شین و کریستاڵی ئاسمانی لە دەوری وێنەکەت لە کاتی دانیشتن لەسەر کورسی.',
    enDesc: 'Animated flapping sapphire wings with crystal ice jewels.',
    c1: '#bae6fd',
    c2: '#0ea5e9',
    c3: '#1e3a8a',
    glow: 'rgba(14, 165, 233, 0.85)',
    ornament: 'wings',
    coverThemeId: 'cyber_lightning',
    kuCoverName: 'کەڤەری ئەنیمەیشنی بروسکەی شین',
    enCoverName: 'Cyber Lightning Animated Cover',
  },
  {
    id: 'lvl_30_amethyst',
    minLevel: 20,
    kuName: 'ئەستێرەی مۆری سووڕاوە',
    enName: 'Amethyst Starlight',
    kuDesc: 'چوارچێوەی گەردوونی مۆر بە ئەستێرەی زێڕینی سووڕاوە و تیشکی درەوشاوە.',
    enDesc: 'Mystic purple royal ring with orbiting golden stars.',
    c1: '#f3e8ff',
    c2: '#a855f7',
    c3: '#581c87',
    glow: 'rgba(168, 85, 247, 0.85)',
    ornament: 'stars',
    coverThemeId: 'galaxy_meteor',
    kuCoverName: 'کەڤەری ئەنیمەیشنی گەردوونی مۆر',
    enCoverName: 'Cosmic Nebula Animated Cover',
  },
  {
    id: 'lvl_40_phoenix',
    minLevel: 30,
    kuName: 'ئاگری باڵندەی فۆنیکس (جوڵاو)',
    enName: 'Crimson Phoenix Blaze',
    kuDesc: 'ئاگری سووری جوڵاو و پەڕی زێڕینی باڵندەی ئەفسانەیی فۆنیکس.',
    enDesc: 'Animated blazing crimson flames with golden phoenix feathers.',
    c1: '#fde047',
    c2: '#ef4444',
    c3: '#7f1d1d',
    glow: 'rgba(239, 68, 68, 0.9)',
    ornament: 'fire',
    coverThemeId: 'real_fire',
    kuCoverName: 'کەڤەری ئەنیمەیشنی ئاگری ڕاستەقینە',
    enCoverName: 'Real Blazing Fire Animated Cover',
  },
  {
    id: 'lvl_50_sakura',
    minLevel: 40,
    kuName: 'گوڵی شاژنی زێڕینی جوڵاو',
    enName: 'Rose Gold Empress',
    kuDesc: 'گوڵی پەمەیی گەشاوە و تاجی ئەڵماسی درەوشاوە بۆ دەرکەوتنێکی شاهانە.',
    enDesc: 'Animated rose gold florals with sparkling diamond petals.',
    c1: '#fce7f3',
    c2: '#ec4899',
    c3: '#9d174d',
    glow: 'rgba(236, 72, 153, 0.85)',
    ornament: 'rose',
    coverThemeId: 'pink_sakura',
    kuCoverName: 'کەڤەری ئەنیمەیشنی پەمەیی شاژن و گوڵ',
    enCoverName: 'Pink Queen Sakura Animated Cover',
  },
  {
    id: 'lvl_60_cyber',
    minLevel: 50,
    kuName: 'بروسکەی ئەڵماسی کارەبایی',
    enName: 'Cyber Thunder Halo',
    kuDesc: 'وزەی کارەبایی و ئەڵماسی درەوشاوە بە کاریگەری سووڕاوەی خێرا.',
    enDesc: 'High-voltage rotating neon cyan energy with diamond shards.',
    c1: '#cffafe',
    c2: '#06b6d4',
    c3: '#164e63',
    glow: 'rgba(6, 182, 212, 0.9)',
    ornament: 'lightning',
    coverThemeId: 'crimson_lava',
    kuCoverName: 'کەڤەری ئەنیمەیشنی بورکانی ئاگرین',
    enCoverName: 'Hellfire Lava Animated Cover',
  },
  {
    id: 'lvl_75_dragon',
    minLevel: 75,
    kuName: 'ئەژدیهای ئیمپراتۆری زێڕین',
    enName: 'Golden Dragon Lord',
    kuDesc: 'نەخشی ئەژدیهای زێڕین و گەوهەری یاقووتی سووری درەوشاوە.',
    enDesc: 'Imperial golden dragon scales with pulsing ruby crest.',
    c1: '#fef9c3',
    c2: '#eab308',
    c3: '#991b1b',
    glow: 'rgba(234, 179, 8, 0.92)',
    ornament: 'dragon',
    coverThemeId: 'dark_obsidian',
    kuCoverName: 'کەڤەری ئەنیمەیشنی ڕەشی ئەڵماسی و ئاگر',
    enCoverName: 'Obsidian Gold Animated Cover',
  },
  {
    id: 'lvl_90_galaxy',
    minLevel: 90,
    kuName: 'گەردوونی بێکۆتا (گالاکسی سووڕاوە)',
    enName: 'Cosmic Nebula Sovereign',
    kuDesc: 'خولگەی سووڕاوەی هەسارەکان و تیشکی ڕەنگاوڕەنگی گالاکسی.',
    enDesc: 'Orbiting cosmic rings with animated nebula starlight.',
    c1: '#e0e7ff',
    c2: '#6366f1',
    c3: '#ec4899',
    glow: 'rgba(99, 102, 241, 0.92)',
    ornament: 'galaxy',
    coverThemeId: 'galaxy_meteor',
    kuCoverName: 'کەڤەری ئەنیمەیشنی نەیزەکی گەردوونی',
    enCoverName: 'Cosmic Meteor Animated Cover',
  },
  {
    id: 'lvl_100_emperor',
    minLevel: 100,
    kuName: 'تاجی ئەفسانەی ئاستی ١٠٠',
    enName: 'Level 100 Mythic Immortal',
    kuDesc: 'بەرزترین شکۆی گۆڕەپان! تاجی ئیمپراتۆری عەیار ٢٤ و باڵی شاهانەی جوڵاو.',
    enDesc: 'The ultimate Level 100 prestige! Animated imperial crown, wings & mythic aura.',
    c1: '#ffffff',
    c2: '#facc15',
    c3: '#dc2626',
    glow: 'rgba(250, 204, 21, 0.98)',
    ornament: 'emperor',
    coverThemeId: 'rainbow_aurora',
    kuCoverName: 'کەڤەری ئەنیمەیشنی ئیمپراتۆری حەوت ڕەنگ',
    enCoverName: 'Mythic Chroma RGB Animated Cover',
  },
];

export function resolveUserLevelFrame(
  level: number = 1,
  selectedFrameId?: string | null,
): LevelFrameDef | null {
  if (selectedFrameId === 'none') return null;
  if (selectedFrameId) {
    const found = LEVEL_AVATAR_FRAMES.find((f) => f.id === selectedFrameId);
    if (found) return found;
  }
  const safeLevel = Math.max(1, Number(level) || 1);
  const unlocked = LEVEL_AVATAR_FRAMES.filter((f) => safeLevel >= f.minLevel);
  return unlocked.length > 0 ? unlocked[unlocked.length - 1] : LEVEL_AVATAR_FRAMES[0];
}

export async function saveUserSelectedLevelFrame(uid: string, frameId: string | null): Promise<void> {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    avatarFrame: frameId || 'none',
  });
}

export async function saveUserSelectedAnimatedCover(uid: string, coverValue: string | null): Promise<void> {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    profileCover: coverValue || null,
  });
}

/**
 * Renders the animated 3D-like SVG frame overlay around a circular avatar.
 * Parent container MUST be `relative`.
 */
export function AvatarFrameOverlay({
  frameId,
  level = 1,
}: {
  frameId?: string | null;
  level?: number;
}) {
  const frame = resolveUserLevelFrame(level, frameId);
  if (!frame) return null;

  const uid = `af_${frame.id}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className="pointer-events-none absolute -inset-[22%] z-[25] h-[144%] w-[144%] select-none overflow-visible"
      style={{ filter: `drop-shadow(0 2px 10px ${frame.glow})` }}
    >
      <defs>
        <linearGradient id={`${uid}_g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={frame.c1} />
          <stop offset="50%" stopColor={frame.c2} />
          <stop offset="100%" stopColor={frame.c3} />
        </linearGradient>
        <radialGradient id={`${uid}_gem`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor={frame.c1} />
          <stop offset="100%" stopColor={frame.c3} />
        </radialGradient>
      </defs>

      {/* Continuously Rotating Outer Filigree Halo */}
      <circle
        cx="60"
        cy="60"
        r="47"
        fill="none"
        stroke={`url(#${uid}_g)`}
        strokeWidth="2.1"
        strokeDasharray="6 3"
        opacity="0.95"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 60 60"
          to="360 60 60"
          dur="12s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Main Metallic Beveled Ring with Subtle Pulse */}
      <circle
        cx="60"
        cy="60"
        r="42.5"
        fill="none"
        stroke={`url(#${uid}_g)`}
        strokeWidth="4.6"
      >
        <animate
          attributeName="stroke-width"
          values="4.2;5.4;4.2"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="60"
        cy="60"
        r="39.5"
        fill="none"
        stroke={frame.c1}
        strokeWidth="1.2"
        strokeDasharray="4 2"
        opacity="0.85"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 60 60"
          to="0 60 60"
          dur="15s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Orbiting Sparkle Particles */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 60 60"
          to="0 60 60"
          dur="8s"
          repeatCount="indefinite"
        />
        <circle cx="60" cy="13" r="2.4" fill="#ffffff" opacity="0.95" />
        <circle cx="60" cy="107" r="2.4" fill={frame.c1} opacity="0.95" />
        <circle cx="13" cy="60" r="2.1" fill={frame.c1} opacity="0.9" />
        <circle cx="107" cy="60" r="2.1" fill="#ffffff" opacity="0.9" />
      </g>

      {/* 1. LEVEL 5: GOLDEN CRESCENT MOON & SWINGING LANTERNS (matches uploaded image) */}
      {frame.ornament === 'crescent' && (
        <g>
          {/* Thick Ornate Crescent on Left/Bottom */}
          <path
            d="M 48 16 A 45 45 0 1 0 103 72 A 39 39 0 1 1 48 16 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="0.9"
          />
          {/* Filigree glowing pearls along crescent */}
          <circle cx="22" cy="48" r="2.2" fill="#ffffff">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="20" cy="64" r="2.6" fill={frame.c1} />
          <circle cx="26" cy="80" r="2.2" fill="#ffffff">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="40" cy="94" r="2.6" fill={frame.c1} />
          <circle cx="58" cy="101" r="2.2" fill="#ffffff" />
          {/* Golden Mosque Dome / Palace silhouette at bottom */}
          <path
            d="M 48 98 Q 60 85 72 98 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="0.8"
          />
          <line x1="60" y1="81" x2="60" y2="88" stroke={frame.c1} strokeWidth="1.4" />
          {/* Top-Right Swinging Lantern 1 */}
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-6 95 26; 6 95 26; -6 95 26"
              dur="2.6s"
              repeatCount="indefinite"
            />
            <line x1="95" y1="26" x2="95" y2="38" stroke={frame.c1} strokeWidth="1.3" />
            <polygon
              points="90,38 100,38 102,46 95,52 88,46"
              fill={`url(#${uid}_gem)`}
              stroke={frame.c3}
              strokeWidth="1"
            />
          </g>
          {/* Right Swinging Lantern 2 */}
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="5 106 48; -5 106 48; 5 106 48"
              dur="2.2s"
              repeatCount="indefinite"
            />
            <line x1="106" y1="48" x2="106" y2="62" stroke={frame.c1} strokeWidth="1.3" />
            <polygon
              points="101,62 111,62 113,70 106,77 99,70"
              fill={`url(#${uid}_gem)`}
              stroke={frame.c3}
              strokeWidth="1"
            />
          </g>
          {/* Glowing Star */}
          <circle cx="88" cy="98" r="3.2" fill={`url(#${uid}_gem)`}>
            <animate attributeName="r" values="2.5;4;2.5" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* 2. LEVEL 10: EMERALD OASIS CROWN */}
      {frame.ornament === 'emerald' && (
        <g>
          <polygon
            points="44,18 52,7 60,15 68,7 76,18"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="1"
          />
          <circle cx="60" cy="12" r="3.8" fill={`url(#${uid}_gem)`}>
            <animate attributeName="r" values="3;4.5;3" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="16" cy="60" r="4.2" fill={`url(#${uid}_gem)`} />
          <circle cx="104" cy="60" r="4.2" fill={`url(#${uid}_gem)`} />
          <polygon points="54,102 60,111 66,102 60,97" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 3. LEVEL 20: SAPPHIRE ANGEL WINGS */}
      {frame.ornament === 'wings' && (
        <g>
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-4 22 62; 4 22 62; -4 22 62"
              dur="2.2s"
              repeatCount="indefinite"
            />
            <path
              d="M 18 72 C 3 58, 3 34, 18 20 C 14 38, 18 50, 22 62 Z"
              fill={`url(#${uid}_g)`}
              stroke="#ffffff"
              strokeWidth="1"
            />
          </g>
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="4 98 62; -4 98 62; 4 98 62"
              dur="2.2s"
              repeatCount="indefinite"
            />
            <path
              d="M 102 72 C 117 58, 117 34, 102 20 C 106 38, 102 50, 98 62 Z"
              fill={`url(#${uid}_g)`}
              stroke="#ffffff"
              strokeWidth="1"
            />
          </g>
          <polygon points="54,15 60,5 66,15 60,21" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 4. LEVEL 30: AMETHYST STARLIGHT */}
      {frame.ornament === 'stars' && (
        <g>
          {[
            [60, 11],
            [20, 32],
            [100, 32],
            [20, 88],
            [100, 88],
            [60, 107],
          ].map(([cx, cy], idx) => (
            <polygon
              key={idx}
              points={`${cx},${cy - 6} ${cx + 2},${cy - 2} ${cx + 6},${cy - 2} ${cx + 3},${cy + 1} ${cx + 4},${cy + 6} ${cx},${cy + 3} ${cx - 4},${cy + 6} ${cx - 3},${cy + 1} ${cx - 6},${cy - 2} ${cx - 2},${cy - 2}`}
              fill="#fde047"
              stroke={frame.c3}
              strokeWidth="0.7"
            >
              <animate attributeName="opacity" values="0.5;1;0.5" dur={`${1.4 + idx * 0.2}s`} repeatCount="indefinite" />
            </polygon>
          ))}
        </g>
      )}

      {/* 5. LEVEL 40: CRIMSON PHOENIX BLAZE */}
      {frame.ornament === 'fire' && (
        <g>
          <path
            d="M 38 18 Q 50 1 60 12 Q 70 1 82 18 Q 68 14 60 20 Q 52 14 38 18 Z"
            fill={`url(#${uid}_g)`}
            stroke="#fde047"
            strokeWidth="1"
          >
            <animateTransform attributeName="transform" type="scale" values="1;1.04;1" dur="1.4s" repeatCount="indefinite" additive="sum" />
          </path>
          <path d="M 14 68 Q 3 50 18 32 Q 16 52 22 64 Z" fill={`url(#${uid}_g)`} />
          <path d="M 106 68 Q 117 50 102 32 Q 104 52 98 64 Z" fill={`url(#${uid}_g)`} />
          <polygon points="53,101 60,113 67,101 60,95" fill="#fde047" />
        </g>
      )}

      {/* 6. LEVEL 50: ROSE GOLD EMPRESS */}
      {frame.ornament === 'rose' && (
        <g>
          <polygon
            points="40,19 48,6 60,15 72,6 80,19"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1"
          />
          {[
            [22, 82],
            [98, 82],
            [60, 105],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="6.5" fill={frame.c2} stroke={frame.c1} strokeWidth="1" />
              <circle cx={cx} cy={cy} r="3" fill="#fde047">
                <animate attributeName="r" values="2.5;3.8;2.5" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </g>
      )}

      {/* 7. LEVEL 60: CYBER THUNDER HALO */}
      {frame.ornament === 'lightning' && (
        <g>
          <polygon points="56,3 66,3 60,13 68,13 54,26 58,15 50,15" fill="#fde047">
            <animate attributeName="opacity" values="1;0.3;1;0.8;1" dur="1.2s" repeatCount="indefinite" />
          </polygon>
          <polygon points="10,55 18,48 18,60 10,67" fill={`url(#${uid}_gem)`} />
          <polygon points="110,55 102,48 102,60 110,67" fill={`url(#${uid}_gem)`} />
          <polygon points="54,102 60,112 66,102 60,96" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 8. LEVEL 75: GOLDEN DRAGON LORD */}
      {frame.ornament === 'dragon' && (
        <g>
          <path
            d="M 32 24 Q 24 5 44 11 L 52 17 L 60 4 L 68 17 L 76 11 Q 96 5 88 24 Z"
            fill={`url(#${uid}_g)`}
            stroke="#fef08a"
            strokeWidth="1"
          />
          <circle cx="60" cy="14" r="4.5" fill="#ef4444" stroke="#fef08a" strokeWidth="1.2">
            <animate attributeName="r" values="4;5.2;4" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <path d="M 14 44 L 5 60 L 14 76 L 19 60 Z" fill={`url(#${uid}_g)`} />
          <path d="M 106 44 L 115 60 L 106 76 L 101 60 Z" fill={`url(#${uid}_g)`} />
          <polygon points="50,100 60,114 70,100 60,94" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />
        </g>
      )}

      {/* 9. LEVEL 90: COSMIC NEBULA SOVEREIGN */}
      {frame.ornament === 'galaxy' && (
        <g>
          <ellipse
            cx="60"
            cy="60"
            rx="54"
            ry="18"
            fill="none"
            stroke={`url(#${uid}_g)`}
            strokeWidth="2.2"
            transform="rotate(-25 60 60)"
          >
            <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="10s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="15" cy="40" r="4" fill="#fde047" />
          <circle cx="105" cy="80" r="4.5" fill="#ec4899" />
          <polygon points="53,13 60,2 67,13 60,19" fill="#ffffff" />
        </g>
      )}

      {/* 10. LEVEL 100: MYTHIC IMMORTAL EMPEROR */}
      {frame.ornament === 'emperor' && (
        <g>
          <g>
            <animateTransform attributeName="transform" type="rotate" values="-5 24 68; 5 24 68; -5 24 68" dur="2s" repeatCount="indefinite" />
            <path
              d="M 18 78 C -1 60, -1 28, 22 12 C 15 34, 18 52, 24 68 Z"
              fill={`url(#${uid}_g)`}
              stroke="#ffffff"
              strokeWidth="1.1"
            />
          </g>
          <g>
            <animateTransform attributeName="transform" type="rotate" values="5 96 68; -5 96 68; 5 96 68" dur="2s" repeatCount="indefinite" />
            <path
              d="M 102 78 C 121 60, 121 28, 98 12 C 105 34, 102 52, 96 68 Z"
              fill={`url(#${uid}_g)`}
              stroke="#ffffff"
              strokeWidth="1.1"
            />
          </g>
          <polygon
            points="36,20 42,4 52,15 60,0 68,15 78,4 84,20"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1.3"
          />
          <circle cx="60" cy="11" r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1">
            <animate attributeName="r" values="3.8;5;3.8" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="48" cy="15" r="2.5" fill="#38bdf8" />
          <circle cx="72" cy="15" r="2.5" fill="#38bdf8" />
          <polygon
            points="46,100 60,116 74,100 60,93"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1"
          />
          <circle cx="60" cy="103" r="3.5" fill="#ef4444" />
        </g>
      )}
    </svg>
  );
}

/**
 * Interactive showcase & selector for:
 * 1) Level 5 -> 100 Animated Avatar Frames
 * 2) Level 5 -> 100 Animated Profile Covers (بەرگی جوڵاوی پڕۆفایل)
 */
export function LevelFramesShowcase({
  userLevel = 1,
  selectedFrameId,
  selectedCoverValue,
  userAvatar,
  username = 'U',
  isOwner = true,
  onSelectFrame,
  onSelectCover,
  tr,
}: {
  userLevel: number;
  selectedFrameId?: string | null;
  selectedCoverValue?: string | null;
  userAvatar?: string | null;
  username?: string;
  isOwner?: boolean;
  onSelectFrame?: (frameId: string | null) => void;
  onSelectCover?: (coverValue: string | null) => void;
  tr: (ku: string, en: string) => string;
}) {
  const [subMode, setSubMode] = useState<'frames' | 'covers'>('frames');
  const activeFrame = resolveUserLevelFrame(userLevel, selectedFrameId);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative m-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-amber-500 to-yellow-600 text-base font-black text-black">
                {userAvatar ? (
                  <img src={userAvatar} alt={username} className="h-full w-full object-cover" />
                ) : (
                  username.charAt(0).toUpperCase()
                )}
              </div>
              <AvatarFrameOverlay frameId={selectedFrameId} level={userLevel} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-sm font-black text-white">
                  {tr('چوارچێوە و کەڤەری ئەنیمەیشن (ئاستی ٥ تا ١٠٠)', 'Animated Frames & Covers (Lv. 5 – 100)')}
                </h3>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {tr(
                  'لەگەڵ بەرزبوونەوەی ئاستەکەت (Level)، چوارچێوەی جوڵاو و کەڤەری ئەنیمەیشن بۆ پڕۆفایل و کورسییەکانی ژوور دەکرێتەوە!',
                  'Unlock animated avatar frames and live profile covers automatically as you level up!',
                )}
              </p>
            </div>
          </div>

          <span className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 font-mono text-xs font-black text-amber-300">
            {tr('ئاستی ئێستات:', 'Your Level:')} {userLevel}
          </span>
        </div>

        {/* Sub-Mode Switcher: Avatar Frames vs Animated Profile Covers */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setSubMode('frames')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition-all ${
              subMode === 'frames'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Crown className="h-3.5 w-3.5" />
            <span>{tr('چوارچێوەی جوڵاوی وێنە', 'Animated Avatar Frames')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('covers')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition-all ${
              subMode === 'covers'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>{tr('کەڤەری ئەنیمەیشنی پڕۆفایل', 'Animated Profile Covers')}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: LEVEL AVATAR FRAMES */}
      {subMode === 'frames' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LEVEL_AVATAR_FRAMES.map((frame) => {
            const unlocked = userLevel >= frame.minLevel;
            const isEquipped = activeFrame?.id === frame.id;

            return (
              <div
                key={frame.id}
                onClick={() => {
                  if (isOwner && unlocked && onSelectFrame) {
                    onSelectFrame(frame.id);
                  }
                }}
                className={`group relative flex items-center gap-3.5 rounded-3xl border p-3.5 transition-all ${
                  isEquipped
                    ? 'border-amber-400 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50 cursor-pointer'
                    : unlocked
                      ? 'border-white/10 bg-slate-900/60 hover:border-amber-400/40 hover:bg-slate-900 cursor-pointer'
                      : 'border-white/[0.06] bg-slate-950/50 opacity-75'
                }`}
              >
                {/* Live Animated Avatar Preview */}
                <div className="relative m-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 text-sm font-black text-white">
                    {userAvatar ? (
                      <img src={userAvatar} alt={username} className="h-full w-full object-cover" />
                    ) : (
                      username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <AvatarFrameOverlay frameId={frame.id} level={100} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-black ${
                        unlocked
                          ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tr(`ئاستی ${frame.minLevel}`, `Level ${frame.minLevel}`)}
                    </span>

                    {isEquipped ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                        <Check className="h-3 w-3" />
                        {tr('بەکارهێنراو', 'Equipped')}
                      </span>
                    ) : unlocked ? (
                      <span className="text-[10px] font-bold text-amber-300 group-hover:underline">
                        {isOwner ? tr('هەڵبژاردن', 'Equip') : tr('کراوەتەوە', 'Unlocked')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400">
                        <Lock className="h-3 w-3" />
                        {tr('داخراوە', 'Locked')}
                      </span>
                    )}
                  </div>

                  <h4 className="mt-1 truncate font-display text-xs font-black text-white">
                    {tr(frame.kuName, frame.enName)}
                  </h4>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-400">
                    {unlocked
                      ? tr(frame.kuDesc, frame.enDesc)
                      : tr(
                          `کاتێک دەگەیتە ئاستی ${frame.minLevel} ئەم چوارچێوەیەت بۆ دەکرێتەوە!`,
                          `Reach Level ${frame.minLevel} to unlock this royal frame!`,
                        )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 2: ANIMATED PROFILE COVERS (UNLOCKED BY LEVEL 5 -> 100) */}
      {subMode === 'covers' && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {LEVEL_AVATAR_FRAMES.map((frame) => {
            const themeObj =
              CURATED_ANIMATED_THEMES.find((t) => t.id === frame.coverThemeId) || CURATED_ANIMATED_THEMES[0];
            const unlocked = userLevel >= frame.minLevel;
            const isEquipped =
              selectedCoverValue === themeObj.themeValue || selectedCoverValue === themeObj.id;

            return (
              <div
                key={`cover_${frame.id}`}
                onClick={() => {
                  if (isOwner && unlocked && onSelectCover) {
                    onSelectCover(themeObj.themeValue);
                  }
                }}
                className={`group relative overflow-hidden rounded-3xl border transition-all ${
                  isEquipped
                    ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20 cursor-pointer'
                    : unlocked
                      ? 'border-white/10 hover:border-amber-400/50 cursor-pointer'
                      : 'border-white/[0.06] opacity-75'
                }`}
              >
                {/* Live Animated Cover Banner Preview */}
                <div
                  className="relative h-24 w-full overflow-hidden"
                  style={{ background: themeObj.baseGradient }}
                >
                  <AnimatedThemeOverlay themeValue={themeObj.themeValue} compact />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-black backdrop-blur-md ${
                        unlocked
                          ? 'border-amber-400/50 bg-black/60 text-amber-300'
                          : 'border-slate-700 bg-black/70 text-slate-300'
                      }`}
                    >
                      {tr(`ئاستی ${frame.minLevel}`, `Level ${frame.minLevel}`)}
                    </span>

                    {isEquipped ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-200 backdrop-blur-md">
                        <Check className="h-3 w-3" />
                        {tr('بەکارهێنراو', 'Equipped')}
                      </span>
                    ) : unlocked ? (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black text-amber-200 backdrop-blur-md">
                        {isOwner ? tr('داینێ لەسەر پڕۆفایل', 'Apply Cover') : tr('کراوەتەوە', 'Unlocked')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 backdrop-blur-md">
                        <Lock className="h-3 w-3" />
                        {tr('داخراوە', 'Locked')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/90 p-3.5">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <h4 className="truncate font-display text-xs font-black text-white">
                      {tr(frame.kuCoverName, frame.enCoverName)}
                    </h4>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {unlocked
                      ? tr(
                          'کەڤەری ئەنیمەیشنی جوڵاو بۆ پشتەوەی وێنەی پڕۆفایلەکەت.',
                          'Live animated banner cover for your profile header.',
                        )
                      : tr(
                          `لە ئاستی ${frame.minLevel} ئەم کەڤەرە جوڵاوەت بۆ دەکرێتەوە!`,
                          `Unlocks automatically when you reach Level ${frame.minLevel}!`,
                        )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Clean TopTop-style inline VIP Level badge (e.g. "VIP 1", "VIP 5") without any crown on avatar.
 */
export function VipLevelBadge({
  isVip,
  vipLevel,
  vipXp,
  compact = false,
  onClick,
}: {
  isVip?: boolean;
  vipLevel?: number;
  vipXp?: number;
  compact?: boolean;
  onClick?: () => void;
}) {
  const vLvl = calculateVipLevelFromXp(vipXp ?? 0, isVip, vipLevel);
  if (vLvl <= 0) return null;

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-gradient-to-r from-[#1a2e22] via-[#1f3b2c] to-[#122219] font-black tracking-wider text-emerald-300 shadow-sm ${
        onClick ? 'cursor-pointer hover:brightness-110' : ''
      } ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[10px]'}`}
    >
      <Shield className={compact ? 'h-2.5 w-2.5 text-emerald-400 fill-emerald-400/30' : 'h-3 w-3 text-emerald-400 fill-emerald-400/30'} />
      <span className="italic">VIP {vLvl}</span>
    </span>
  );
}

/**
 * TopTop-style 3 Metallic Prestige Cards shown on Profile (M-Tier + Lv.X + VIP X), matching Screenshot 2.
 */
export function TopTopPrestigeBadges({
  level = 1,
  coins = 0,
  isVip = false,
  vipLevel,
  vipXp,
  onOpenVipCenter,
}: {
  level?: number;
  coins?: number;
  isVip?: boolean;
  vipLevel?: number;
  vipXp?: number;
  onOpenVipCenter?: () => void;
}) {
  const vLvl = calculateVipLevelFromXp(vipXp ?? 0, isVip, vipLevel);
  const mTier = Math.max(1, Math.min(10, Math.floor((coins || 0) / 25000) + (vLvl > 0 ? vLvl : 1)));

  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      {/* 1. Wealth / M-Tier Metallic Bronze Card */}
      <div
        onClick={onOpenVipCenter}
        className="relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl border border-amber-500/45 bg-gradient-to-r from-[#3a2008] via-[#5c340e] to-[#291504] px-2.5 py-2 shadow-md transition hover:scale-[1.02]"
      >
        <span className="font-display text-xs sm:text-sm font-black tracking-wide text-amber-100 drop-shadow">
          M{mTier}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-300/50 bg-gradient-to-b from-sky-400/30 to-blue-900/60 shadow-inner">
          <Gem className="h-4 w-4 text-sky-300" />
        </div>
      </div>

      {/* 2. Level (Lv.X) Metallic Purple Card */}
      <div
        onClick={onOpenVipCenter}
        className="relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl border border-purple-400/55 bg-gradient-to-r from-[#581c87] via-[#7e22ce] to-[#3b0764] px-2.5 py-2 shadow-md transition hover:scale-[1.02]"
      >
        <span className="font-display text-xs sm:text-sm font-black tracking-wide text-white drop-shadow">
          Lv.{level || 1}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/60 bg-gradient-to-b from-cyan-400/30 to-indigo-950/80 shadow-inner">
          <Sparkles className="h-4 w-4 text-cyan-200" />
        </div>
      </div>

      {/* 3. VIP Level (VIP X) Metallic Dark Bronze/Emerald Shield Card */}
      <div
        onClick={onOpenVipCenter}
        className="relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl border border-amber-400/50 bg-gradient-to-r from-[#261f14] via-[#382e1e] to-[#17130c] px-2.5 py-2 shadow-md transition hover:scale-[1.02]"
      >
        <span className="font-display text-xs sm:text-sm font-black italic tracking-wide text-amber-100 drop-shadow">
          VIP {vLvl}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-400/60 bg-gradient-to-b from-emerald-500/35 to-emerald-950/90 shadow-inner">
          <Shield className="h-4 w-4 text-emerald-300 fill-emerald-400/30" />
        </div>
      </div>
    </div>
  );
}
