import { motion } from 'framer-motion';

export interface CuratedAnimatedTheme {
  id: string;
  name: string;
  badge: string;
  themeValue: string;
  baseGradient: string;
  effectType:
    | 'real_fire'
    | 'pink_sakura'
    | 'crimson_lava'
    | 'cyber_lightning'
    | 'dragon_emerald'
    | 'royal_gold'
    | 'galaxy_meteor'
    | 'rainbow_aurora'
    | 'dark_obsidian';
}

export const CURATED_ANIMATED_THEMES: CuratedAnimatedTheme[] = [
  {
    id: 'real_fire',
    name: 'ئاگری ڕاستەقینە · Real Blazing Fire',
    badge: '🔥 Real Fire VIP',
    themeValue:
      'linear-gradient(180deg, #1a0500 0%, #450a0a 35%, #9a3412 70%, #ea580c 90%, #fde047 100%)',
    baseGradient:
      'linear-gradient(180deg, #1a0500 0%, #450a0a 35%, #9a3412 70%, #ea580c 90%, #fde047 100%)',
    effectType: 'real_fire',
  },
  {
    id: 'pink_sakura',
    name: 'پەمەیی شاژن و گوڵ · Pink Queen Sakura',
    badge: '🌸 Pink Queen VIP',
    themeValue:
      'linear-gradient(-45deg, #500724 0%, #9d174d 25%, #f43f5e 50%, #f472b6 75%, #831843 100%)',
    baseGradient:
      'linear-gradient(-45deg, #500724 0%, #9d174d 25%, #f43f5e 50%, #f472b6 75%, #831843 100%)',
    effectType: 'pink_sakura',
  },
  {
    id: 'crimson_lava',
    name: 'بورکانی سووری ئاگرین · Hellfire Inferno',
    badge: '🩸 Hellfire VIP',
    themeValue:
      'linear-gradient(-45deg, #450a0a 0%, #991b1b 25%, #ea580c 50%, #f59e0b 75%, #7f1d1d 100%)',
    baseGradient:
      'linear-gradient(-45deg, #450a0a 0%, #991b1b 25%, #ea580c 50%, #f59e0b 75%, #7f1d1d 100%)',
    effectType: 'crimson_lava',
  },
  {
    id: 'cyber_lightning',
    name: 'بروسکەی کارەبایی · Cyber Ice Lightning',
    badge: '⚡ Lightning VIP',
    themeValue:
      'linear-gradient(-45deg, #0f172a 0%, #0369a1 25%, #38bdf8 50%, #818cf8 75%, #0c4a6e 100%)',
    baseGradient:
      'linear-gradient(-45deg, #0f172a 0%, #0369a1 25%, #38bdf8 50%, #818cf8 75%, #0c4a6e 100%)',
    effectType: 'cyber_lightning',
  },
  {
    id: 'dragon_emerald',
    name: 'ئاگری ئەژدیهای سەوز · Dragon Emerald Fire',
    badge: '🐉 Dragon VIP',
    themeValue:
      'linear-gradient(-45deg, #022c22 0%, #059669 25%, #10b981 50%, #06b6d4 75%, #042f2e 100%)',
    baseGradient:
      'linear-gradient(-45deg, #022c22 0%, #059669 25%, #10b981 50%, #06b6d4 75%, #042f2e 100%)',
    effectType: 'dragon_emerald',
  },
  {
    id: 'royal_gold',
    name: 'زێڕی پاشایی ٢٤ عەیار · 24K Royal Gold',
    badge: '👑 24K Gold VIP',
    themeValue:
      'linear-gradient(-45deg, #78350f 0%, #b45309 25%, #fef08a 50%, #d97706 75%, #451a03 100%)',
    baseGradient:
      'linear-gradient(-45deg, #78350f 0%, #b45309 25%, #fef08a 50%, #d97706 75%, #451a03 100%)',
    effectType: 'royal_gold',
  },
  {
    id: 'galaxy_meteor',
    name: 'گەردوونی مۆر و نەیزەک · Cosmic Nebula',
    badge: '🌌 Galaxy VIP',
    themeValue:
      'linear-gradient(-45deg, #09090b 0%, #3b0764 25%, #7e22ce 50%, #06b6d4 75%, #1e1b4b 100%)',
    baseGradient:
      'linear-gradient(-45deg, #09090b 0%, #3b0764 25%, #7e22ce 50%, #06b6d4 75%, #1e1b4b 100%)',
    effectType: 'galaxy_meteor',
  },
  {
    id: 'rainbow_aurora',
    name: 'شەفەقی حەوت ڕەنگ · Mythic Chroma RGB',
    badge: '🌈 Chroma VIP',
    themeValue:
      'linear-gradient(-45deg, #be185d 0%, #7e22ce 25%, #0284c7 50%, #059669 75%, #d97706 100%)',
    baseGradient:
      'linear-gradient(-45deg, #be185d 0%, #7e22ce 25%, #0284c7 50%, #059669 75%, #d97706 100%)',
    effectType: 'rainbow_aurora',
  },
  {
    id: 'dark_obsidian',
    name: 'ڕەشی ئەڵماسی و ئاگر · Obsidian Gold',
    badge: '🖤 Obsidian VIP',
    themeValue:
      'linear-gradient(-45deg, #000000 0%, #18181b 30%, #fbbf24 50%, #27272a 70%, #09090b 100%)',
    baseGradient:
      'linear-gradient(-45deg, #000000 0%, #18181b 30%, #fbbf24 50%, #27272a 70%, #09090b 100%)',
    effectType: 'dark_obsidian',
  },
];

export function detectThemeEffectType(
  value?: string | null,
): CuratedAnimatedTheme['effectType'] | null {
  if (!value) return null;
  const matched = CURATED_ANIMATED_THEMES.find((t) => t.themeValue === value || t.id === value);
  if (matched) return matched.effectType;

  if (value.includes('#9a3412') || value.includes('#ea580c')) return 'real_fire';
  if (value.includes('#9d174d') || value.includes('#f472b6')) return 'pink_sakura';
  if (value.includes('#38bdf8') || value.includes('#0369a1')) return 'cyber_lightning';
  if (value.includes('#10b981') || value.includes('#059669')) return 'dragon_emerald';
  if (value.includes('#7e22ce') || value.includes('#3b0764')) return 'galaxy_meteor';
  if (value.includes('#78350f') || value.includes('#fef08a')) return 'royal_gold';
  if (value.includes('#fbbf24') && value.includes('#18181b')) return 'dark_obsidian';
  return 'real_fire';
}

interface AnimatedThemeOverlayProps {
  themeValue?: string | null;
  compact?: boolean;
}

export function AnimatedThemeOverlay({
  themeValue,
  compact = false,
}: AnimatedThemeOverlayProps) {
  const effectType = detectThemeEffectType(themeValue);
  if (!effectType) return null;

  const isFireLike =
    effectType === 'real_fire' ||
    effectType === 'crimson_lava' ||
    effectType === 'dragon_emerald' ||
    effectType === 'dark_obsidian';

  const flameColors =
    effectType === 'dragon_emerald'
      ? { outer: '#059669', mid: '#10b981', core: '#a7f3d0', ember: '#34d399' }
      : effectType === 'crimson_lava'
        ? { outer: '#991b1b', mid: '#ef4444', core: '#fde047', ember: '#f87171' }
        : { outer: '#dc2626', mid: '#f97316', core: '#fef08a', ember: '#fbbf24' };

  const particlePositions = compact ? [12, 32, 52, 72, 88] : [8, 20, 34, 48, 62, 76, 90];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* 1. REAL RISING FLAMES & EMBERS (Real Fire / Crimson Lava / Dragon Emerald / Obsidian) */}
      {isFireLike && (
        <>
          {/* Glowing Bottom Fire Bed */}
          <motion.div
            animate={{ opacity: [0.65, 0.95, 0.7], scaleY: [1, 1.18, 0.96, 1.12, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-x-0 bottom-0 h-2/3 origin-bottom"
            style={{
              background: `linear-gradient(to top, ${flameColors.outer}e6 0%, ${flameColors.mid}99 45%, transparent 100%)`,
              filter: 'blur(6px)',
            }}
          />

          {/* Animated SVG Flame Tongues Rising Across the Bottom */}
          <div className="absolute inset-x-0 -bottom-2 flex items-end justify-around">
            {particlePositions.map((leftPct, i) => (
              <motion.svg
                key={`flame-${i}`}
                viewBox="0 0 60 90"
                className={compact ? 'h-14 w-10 -mx-2' : 'h-24 w-16 -mx-2'}
                animate={{
                  scaleY: [0.88, 1.22, 0.92, 1.16, 0.88],
                  scaleX: [1, 0.92, 1.08, 0.95, 1],
                  y: [2, -4, 1, -3, 2],
                }}
                transition={{
                  duration: 0.9 + (i % 3) * 0.25,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: 'easeInOut',
                }}
                style={{
                  filter: `drop-shadow(0 0 10px ${flameColors.mid})`,
                }}
              >
                <path
                  d="M30 4 C42 25 56 42 52 65 C49 80 39 88 30 88 C21 88 11 80 8 65 C4 42 18 25 30 4 Z"
                  fill={flameColors.outer}
                  opacity={0.85}
                />
                <path
                  d="M30 18 C39 34 48 48 45 67 C43 78 36 85 30 85 C24 85 17 78 15 67 C12 48 21 34 30 18 Z"
                  fill={flameColors.mid}
                  opacity={0.92}
                />
                <path
                  d="M30 36 C36 48 41 58 39 71 C37 80 33 84 30 84 C27 84 23 80 21 71 C19 58 24 48 30 36 Z"
                  fill={flameColors.core}
                />
              </motion.svg>
            ))}
          </div>

          {/* Rising Glowing Fire Sparks / Embers */}
          {particlePositions.map((leftPct, i) => (
            <motion.span
              key={`ember-${i}`}
              animate={{
                y: [0, compact ? -55 : -110],
                x: [0, i % 2 === 0 ? 12 : -12, 0],
                opacity: [0, 1, 0.9, 0],
                scale: [0.5, 1.25, 0.4],
              }}
              transition={{
                duration: 1.6 + (i % 3) * 0.4,
                repeat: Infinity,
                delay: i * 0.22,
                ease: 'easeOut',
              }}
              style={{
                left: `${leftPct}%`,
                bottom: '6%',
                backgroundColor: i % 2 === 0 ? flameColors.core : flameColors.ember,
                boxShadow: `0 0 8px 2px ${flameColors.mid}`,
              }}
              className="absolute h-2 w-2 rounded-full"
            />
          ))}
        </>
      )}

      {/* 2. PINK QUEEN SAKURA PETALS & NEON HEARTS */}
      {effectType === 'pink_sakura' && (
        <>
          <motion.div
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-t from-pink-500/40 via-rose-500/15 to-transparent"
          />
          {particlePositions.map((leftPct, i) => (
            <motion.div
              key={`sakura-${i}`}
              animate={{
                y: [compact ? 40 : 90, -20],
                x: [0, i % 2 === 0 ? 14 : -14, 0],
                rotate: [0, 180, 360],
                opacity: [0, 1, 0.9, 0],
                scale: [0.7, 1.15, 0.8],
              }}
              transition={{
                duration: 2.4 + (i % 3) * 0.5,
                repeat: Infinity,
                delay: i * 0.28,
                ease: 'easeInOut',
              }}
              style={{ left: `${leftPct}%`, bottom: '0%' }}
              className="absolute text-xs drop-shadow-[0_0_8px_#f472b6]"
            >
              {i % 2 === 0 ? '🌸' : '💖'}
            </motion.div>
          ))}
        </>
      )}

      {/* 3. CYBER ICE LIGHTNING STORM */}
      {effectType === 'cyber_lightning' && (
        <>
          <motion.div
            animate={{ opacity: [0.1, 0.75, 0.15, 0.85, 0.1] }}
            transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.12, 0.25, 0.35, 1] }}
            className="absolute inset-0 bg-gradient-to-tr from-cyan-500/35 via-sky-400/25 to-indigo-500/35"
          />
          {particlePositions.slice(0, 4).map((leftPct, i) => (
            <motion.svg
              key={`bolt-${i}`}
              viewBox="0 0 40 80"
              className={compact ? 'absolute top-0 h-16 w-8' : 'absolute top-0 h-28 w-12'}
              style={{
                left: `${leftPct + 5}%`,
                filter: 'drop-shadow(0 0 10px #38bdf8)',
              }}
              animate={{ opacity: [0, 1, 0, 0.9, 0], scaleY: [0.8, 1.1, 0.9] }}
              transition={{
                duration: 1.8 + i * 0.35,
                repeat: Infinity,
                delay: i * 0.4,
              }}
            >
              <path
                d="M22 0 L8 34 L20 34 L10 78 L34 28 L21 28 Z"
                fill="#e0f2fe"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
            </motion.svg>
          ))}
        </>
      )}

      {/* 4. 24K ROYAL GOLD SPARKS & CROWNS */}
      {effectType === 'royal_gold' && (
        <>
          <motion.div
            animate={{ opacity: [0.3, 0.65, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-t from-amber-500/40 via-yellow-300/15 to-transparent"
          />
          {particlePositions.map((leftPct, i) => (
            <motion.div
              key={`gold-${i}`}
              animate={{
                y: [compact ? 45 : 95, -15],
                opacity: [0, 1, 0],
                scale: [0.6, 1.2, 0.6],
              }}
              transition={{
                duration: 2.1 + (i % 3) * 0.4,
                repeat: Infinity,
                delay: i * 0.25,
              }}
              style={{ left: `${leftPct}%`, bottom: '2%' }}
              className="absolute text-xs drop-shadow-[0_0_8px_#facc15]"
            >
              {i % 3 === 0 ? '👑' : '✨'}
            </motion.div>
          ))}
        </>
      )}

      {/* 5. GALAXY METEOR & RAINBOW AURORA */}
      {(effectType === 'galaxy_meteor' || effectType === 'rainbow_aurora') && (
        <>
          {particlePositions.map((leftPct, i) => (
            <motion.div
              key={`star-${i}`}
              animate={{
                y: [compact ? 40 : 90, -20],
                x: [0, 18],
                opacity: [0, 1, 0],
                scale: [0.5, 1.3, 0.5],
              }}
              transition={{
                duration: 2 + (i % 3) * 0.4,
                repeat: Infinity,
                delay: i * 0.25,
              }}
              style={{ left: `${leftPct}%`, bottom: '5%' }}
              className="absolute text-xs drop-shadow-[0_0_8px_#c084fc]"
            >
              {effectType === 'rainbow_aurora' ? '💎' : '🌠'}
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}
