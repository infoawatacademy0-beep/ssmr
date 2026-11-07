import React from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';
import { Lock, Check, Sparkles } from 'lucide-react';

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
}

export const LEVEL_AVATAR_FRAMES: LevelFrameDef[] = [
  {
    id: 'lvl_5_crescent',
    minLevel: 5,
    kuName: 'مانگی زێڕین و فانۆس',
    enName: 'Golden Crescent & Lanterns',
    kuDesc: 'چوارچێوەی مانگی هیلالی نەخشدار بە زێڕ و دوو فانۆسی درەوشاوە.',
    enDesc: 'Ornate golden crescent moon with hanging glowing lanterns.',
    c1: '#fef08a',
    c2: '#f59e0b',
    c3: '#b45309',
    glow: 'rgba(245, 158, 11, 0.65)',
    ornament: 'crescent',
  },
  {
    id: 'lvl_10_emerald',
    minLevel: 10,
    kuName: 'تاجی زمڕودی سەوز',
    enName: 'Emerald Oasis Crown',
    kuDesc: 'نەخشی زمڕودی شاهانە بە گەوهەری سەوز و زێڕین.',
    enDesc: 'Royal emerald filigree with glowing jade gems.',
    c1: '#a7f3d0',
    c2: '#10b981',
    c3: '#065f46',
    glow: 'rgba(16, 185, 129, 0.65)',
    ornament: 'emerald',
  },
  {
    id: 'lvl_20_sapphire',
    minLevel: 20,
    kuName: 'باڵی فریشتەی یاقووتی',
    enName: 'Sapphire Angel Wings',
    kuDesc: 'باڵی درەوشاوەی شین و کریستاڵی ئاسمانی لە دەوری وێنەکەت.',
    enDesc: 'Celestial sapphire wings with crystal ice jewels.',
    c1: '#bae6fd',
    c2: '#0ea5e9',
    c3: '#1e3a8a',
    glow: 'rgba(14, 165, 233, 0.7)',
    ornament: 'wings',
  },
  {
    id: 'lvl_30_amethyst',
    minLevel: 30,
    kuName: 'ئەستێرەی مۆری شاهانە',
    enName: 'Amethyst Starlight',
    kuDesc: 'چوارچێوەی گەردوونی مۆر بە ئەستێرەی زێڕینی جوڵاو.',
    enDesc: 'Mystic purple royal ring adorned with golden stars.',
    c1: '#f3e8ff',
    c2: '#a855f7',
    c3: '#581c87',
    glow: 'rgba(168, 85, 247, 0.7)',
    ornament: 'stars',
  },
  {
    id: 'lvl_40_phoenix',
    minLevel: 40,
    kuName: 'باڵندەی ئاگرین (فۆنیکس)',
    enName: 'Crimson Phoenix Blaze',
    kuDesc: 'ئاگری سوور و پەڕی زێڕینی باڵندەی ئەفسانەیی فۆنیکس.',
    enDesc: 'Blazing crimson flames with golden phoenix feathers.',
    c1: '#fde047',
    c2: '#ef4444',
    c3: '#7f1d1d',
    glow: 'rgba(239, 68, 68, 0.75)',
    ornament: 'fire',
  },
  {
    id: 'lvl_50_sakura',
    minLevel: 50,
    kuName: 'گوڵی شاژنی زێڕین',
    enName: 'Rose Gold Empress',
    kuDesc: 'گوڵی پەمەیی و تاجی ئەڵماس بۆ دەرکەوتنێکی ناسک و شاهانە.',
    enDesc: 'Rose gold florals with sparkling diamond petals.',
    c1: '#fce7f3',
    c2: '#ec4899',
    c3: '#9d174d',
    glow: 'rgba(236, 72, 153, 0.7)',
    ornament: 'rose',
  },
  {
    id: 'lvl_60_cyber',
    minLevel: 60,
    kuName: 'بروسکەی ئەڵماسی شین',
    enName: 'Cyber Thunder Halo',
    kuDesc: 'وزەی کارەبایی و ئەڵماسی درەوشاوە بە کاریگەری سووڕاوە.',
    enDesc: 'High-voltage neon cyan energy with diamond shards.',
    c1: '#cffafe',
    c2: '#06b6d4',
    c3: '#164e63',
    glow: 'rgba(6, 182, 212, 0.8)',
    ornament: 'lightning',
  },
  {
    id: 'lvl_75_dragon',
    minLevel: 75,
    kuName: 'ئەژدیهای ئیمپراتۆری زێڕین',
    enName: 'Golden Dragon Lord',
    kuDesc: 'نەخشی ئەژدیهای زێڕین و گەوهەری یاقووتی سوور لە لووتکەدا.',
    enDesc: 'Imperial golden dragon scales with ruby crest.',
    c1: '#fef9c3',
    c2: '#eab308',
    c3: '#991b1b',
    glow: 'rgba(234, 179, 8, 0.85)',
    ornament: 'dragon',
  },
  {
    id: 'lvl_90_galaxy',
    minLevel: 90,
    kuName: 'گەردوونی بێکۆتا (گالاکسی)',
    enName: 'Cosmic Nebula Sovereign',
    kuDesc: 'خولگەی هەسارەکان و تیشکی ڕەنگاوڕەنگی گالاکسی.',
    enDesc: 'Orbiting cosmic rings with nebula starlight.',
    c1: '#e0e7ff',
    c2: '#6366f1',
    c3: '#ec4899',
    glow: 'rgba(99, 102, 241, 0.85)',
    ornament: 'galaxy',
  },
  {
    id: 'lvl_100_emperor',
    minLevel: 100,
    kuName: 'تاجی ئەفسانەی ئاستی ١٠٠',
    enName: 'Level 100 Mythic Immortal',
    kuDesc: 'بەرزترین شکۆی گۆڕەپان! تاجی ئیمپراتۆری عەیار ٢٤ و باڵی شاهانە.',
    enDesc: 'The ultimate Level 100 prestige! Imperial crown, wings & mythic aura.',
    c1: '#ffffff',
    c2: '#facc15',
    c3: '#dc2626',
    glow: 'rgba(250, 204, 21, 0.95)',
    ornament: 'emperor',
  },
];

export function resolveUserLevelFrame(
  level: number = 1,
  selectedFrameId?: string | null,
): LevelFrameDef | null {
  if (selectedFrameId === 'none') return null;
  if (selectedFrameId) {
    const found = LEVEL_AVATAR_FRAMES.find((f) => f.id === selectedFrameId);
    if (found && level >= found.minLevel) return found;
  }
  const unlocked = LEVEL_AVATAR_FRAMES.filter((f) => level >= f.minLevel);
  return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
}

export async function saveUserSelectedLevelFrame(uid: string, frameId: string | null): Promise<void> {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    avatarFrame: frameId || 'none',
  });
}

/**
 * Renders the ornate 3D-like SVG frame overlay around a circular avatar.
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
      className="pointer-events-none absolute -inset-[18%] z-20 h-[136%] w-[136%] select-none overflow-visible"
      style={{ filter: `drop-shadow(0 2px 6px ${frame.glow})` }}
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

      {/* Outer Filigree Dashed Halo */}
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke={`url(#${uid}_g)`}
        strokeWidth="1.6"
        strokeDasharray="5 3"
        opacity="0.85"
      />

      {/* Main Metallic Beveled Ring */}
      <circle
        cx="60"
        cy="60"
        r="42.5"
        fill="none"
        stroke={`url(#${uid}_g)`}
        strokeWidth="4.2"
      />
      <circle
        cx="60"
        cy="60"
        r="39.5"
        fill="none"
        stroke={frame.c1}
        strokeWidth="0.9"
        opacity="0.7"
      />

      {/* 1. LEVEL 5: GOLDEN CRESCENT MOON & HANGING LANTERNS (like uploaded reference image) */}
      {frame.ornament === 'crescent' && (
        <g>
          {/* Thick Ornate Crescent on Left/Bottom */}
          <path
            d="M 48 16 A 45 45 0 1 0 103 72 A 39 39 0 1 1 48 16 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="0.8"
          />
          {/* Filigree dots along crescent */}
          <circle cx="22" cy="48" r="2" fill={frame.c1} />
          <circle cx="20" cy="64" r="2.5" fill={frame.c1} />
          <circle cx="26" cy="80" r="2" fill={frame.c1} />
          <circle cx="40" cy="94" r="2.5" fill={frame.c1} />
          <circle cx="58" cy="101" r="2" fill={frame.c1} />
          {/* Mosque Dome / Palace silhouette at bottom */}
          <path
            d="M 48 98 Q 60 86 72 98 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="0.7"
          />
          <line x1="60" y1="83" x2="60" y2="89" stroke={frame.c1} strokeWidth="1.3" />
          {/* Top-Right Hanging Lantern 1 */}
          <line x1="95" y1="26" x2="95" y2="38" stroke={frame.c1} strokeWidth="1.2" />
          <polygon
            points="91,38 99,38 101,45 95,51 89,45"
            fill={`url(#${uid}_gem)`}
            stroke={frame.c3}
            strokeWidth="1"
          />
          {/* Right Hanging Lantern 2 */}
          <line x1="106" y1="48" x2="106" y2="62" stroke={frame.c1} strokeWidth="1.2" />
          <polygon
            points="102,62 110,62 112,70 106,76 100,70"
            fill={`url(#${uid}_gem)`}
            stroke={frame.c3}
            strokeWidth="1"
          />
          {/* Hanging Star */}
          <circle cx="88" cy="98" r="3" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 2. LEVEL 10: EMERALD OASIS CROWN */}
      {frame.ornament === 'emerald' && (
        <g>
          <polygon
            points="44,18 52,8 60,16 68,8 76,18"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="1"
          />
          <circle cx="60" cy="13" r="3.5" fill={`url(#${uid}_gem)`} />
          <circle cx="16" cy="60" r="4" fill={`url(#${uid}_gem)`} />
          <circle cx="104" cy="60" r="4" fill={`url(#${uid}_gem)`} />
          <polygon points="54,102 60,110 66,102 60,97" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 3. LEVEL 20: SAPPHIRE ANGEL WINGS */}
      {frame.ornament === 'wings' && (
        <g>
          {/* Left Wing */}
          <path
            d="M 18 72 C 4 58, 4 36, 18 22 C 14 38, 18 50, 22 62 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="1"
          />
          <path
            d="M 14 58 C 2 46, 6 28, 22 16"
            fill="none"
            stroke={frame.c1}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Right Wing */}
          <path
            d="M 102 72 C 116 58, 116 36, 102 22 C 106 38, 102 50, 98 62 Z"
            fill={`url(#${uid}_g)`}
            stroke={frame.c1}
            strokeWidth="1"
          />
          <path
            d="M 106 58 C 118 46, 114 28, 98 16"
            fill="none"
            stroke={frame.c1}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon points="54,15 60,6 66,15 60,21" fill={`url(#${uid}_gem)`} />
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
            />
          ))}
        </g>
      )}

      {/* 5. LEVEL 40: CRIMSON PHOENIX BLAZE */}
      {frame.ornament === 'fire' && (
        <g>
          <path
            d="M 38 18 Q 50 2 60 12 Q 70 2 82 18 Q 68 14 60 20 Q 52 14 38 18 Z"
            fill={`url(#${uid}_g)`}
            stroke="#fde047"
            strokeWidth="1"
          />
          <path
            d="M 14 68 Q 4 50 18 34 Q 16 52 22 64 Z"
            fill={`url(#${uid}_g)`}
          />
          <path
            d="M 106 68 Q 116 50 102 34 Q 104 52 98 64 Z"
            fill={`url(#${uid}_g)`}
          />
          <polygon points="53,101 60,112 67,101 60,95" fill="#fde047" />
        </g>
      )}

      {/* 6. LEVEL 50: ROSE GOLD EMPRESS */}
      {frame.ornament === 'rose' && (
        <g>
          <polygon
            points="40,19 48,7 60,15 72,7 80,19"
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
              <circle cx={cx} cy={cy} r="3" fill="#fde047" />
            </g>
          ))}
        </g>
      )}

      {/* 7. LEVEL 60: CYBER THUNDER HALO */}
      {frame.ornament === 'lightning' && (
        <g>
          <polygon points="56,4 66,4 60,14 68,14 54,26 58,15 50,15" fill="#fde047" />
          <polygon points="10,55 18,48 18,60 10,67" fill={`url(#${uid}_gem)`} />
          <polygon points="110,55 102,48 102,60 110,67" fill={`url(#${uid}_gem)`} />
          <polygon points="54,102 60,112 66,102 60,96" fill={`url(#${uid}_gem)`} />
        </g>
      )}

      {/* 8. LEVEL 75: GOLDEN DRAGON LORD */}
      {frame.ornament === 'dragon' && (
        <g>
          {/* Imperial Dragon Horns & Ruby */}
          <path
            d="M 32 24 Q 24 6 44 12 L 52 17 L 60 5 L 68 17 L 76 12 Q 96 6 88 24 Z"
            fill={`url(#${uid}_g)`}
            stroke="#fef08a"
            strokeWidth="1"
          />
          <circle cx="60" cy="14" r="4.5" fill="#ef4444" stroke="#fef08a" strokeWidth="1.2" />
          <path d="M 14 44 L 6 60 L 14 76 L 19 60 Z" fill={`url(#${uid}_g)`} />
          <path d="M 106 44 L 114 60 L 106 76 L 101 60 Z" fill={`url(#${uid}_g)`} />
          <polygon points="50,100 60,113 70,100 60,94" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />
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
            strokeWidth="2"
            transform="rotate(-25 60 60)"
          />
          <circle cx="15" cy="40" r="4" fill="#fde047" />
          <circle cx="105" cy="80" r="4.5" fill="#ec4899" />
          <polygon points="53,13 60,3 67,13 60,19" fill="#ffffff" />
        </g>
      )}

      {/* 10. LEVEL 100: MYTHIC IMMORTAL EMPEROR */}
      {frame.ornament === 'emperor' && (
        <g>
          {/* Grand Golden Wings */}
          <path
            d="M 18 78 C 0 60, 0 30, 22 14 C 15 34, 18 52, 24 68 Z"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1"
          />
          <path
            d="M 102 78 C 120 60, 120 30, 98 14 C 105 34, 102 52, 96 68 Z"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1"
          />
          {/* Grand Imperial Crown */}
          <polygon
            points="36,20 42,5 52,15 60,1 68,15 78,5 84,20"
            fill={`url(#${uid}_g)`}
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          <circle cx="60" cy="11" r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          <circle cx="48" cy="15" r="2.5" fill="#38bdf8" />
          <circle cx="72" cy="15" r="2.5" fill="#38bdf8" />
          {/* Bottom Royal Crest */}
          <polygon
            points="46,100 60,115 74,100 60,93"
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
 * Interactive showcase & selector for Level 5 -> 100 Avatar Frames.
 * Can be rendered inside UserProfileManager and SettingsModal.
 */
export function LevelFramesShowcase({
  userLevel = 1,
  selectedFrameId,
  userAvatar,
  username = 'U',
  isOwner = true,
  onSelectFrame,
  tr,
}: {
  userLevel: number;
  selectedFrameId?: string | null;
  userAvatar?: string | null;
  username?: string;
  isOwner?: boolean;
  onSelectFrame?: (frameId: string | null) => void;
  tr: (ku: string, en: string) => string;
}) {
  const activeFrame = resolveUserLevelFrame(userLevel, selectedFrameId);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950">
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
                  {tr('چوارچێوەی شاهانەی وێنەی پڕۆفایل (ئاستی ٥ تا ١٠٠)', 'Royal Level Avatar Frames (Lv. 5 – 100)')}
                </h3>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {tr(
                  'لەگەڵ بەرزبوونەوەی ئاستەکەت (Level)، چوارچێوەی نوێ و ناوازە بۆ وێنەی پڕۆفایلەکەت دەکرێتەوە!',
                  'As your Level increases, exclusive ornate frames unlock automatically for your profile, seats & posts!',
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 font-mono text-xs font-black text-amber-300">
              {tr('ئاستی ئێستات:', 'Your Level:')} {userLevel}
            </span>
            {isOwner && onSelectFrame && activeFrame && (
              <button
                type="button"
                onClick={() => onSelectFrame('none')}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {tr('لابردن', 'Remove')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of all 10 Level Frames */}
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
              {/* Live Avatar Preview with this Frame */}
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

              {/* Info */}
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
    </div>
  );
}
