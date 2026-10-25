export interface ChatTheme {
  id: string;
  name: string;
  nameEn: string;
  iconName: string;
  previewGradient: string;
  containerBg: string;
  headerBg: string;
  footerBg: string;
  myBubbleClass: string;
  theirBubbleClass: string;
  accentColor: string;
  accentHex: string;
  isDark: boolean;
  patternOverlay?: string;
}

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'inferno_fire',
    name: 'ئاگری نەورۆز · Inferno Fire',
    nameEn: 'Inferno Fire',
    iconName: 'Flame',
    previewGradient: 'linear-gradient(135deg, #f59e0b, #ea580c, #dc2626)',
    containerBg: 'bg-gradient-to-b from-[#140804] via-[#0d070b] to-[#08040a]',
    headerBg: 'bg-[#180a04]/80 border-amber-500/20',
    footerBg: 'bg-[#180a04]/85 border-amber-500/20',
    myBubbleClass:
      'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black font-bold shadow-lg shadow-amber-500/20 border border-amber-300/40',
    theirBubbleClass:
      'bg-[#1a0f0a]/90 text-slate-100 border border-amber-500/20 shadow-md',
    accentColor: 'text-amber-400',
    accentHex: '#f59e0b',
    isDark: true,
  },
  {
    id: 'cosmic_galaxy',
    name: 'شەوی گالاکسی · Cosmic Nebula',
    nameEn: 'Cosmic Nebula',
    iconName: 'Sparkles',
    previewGradient: 'linear-gradient(135deg, #a855f7, #6366f1, #3b82f6)',
    containerBg: 'bg-gradient-to-b from-[#0b051b] via-[#080313] to-[#04010a]',
    headerBg: 'bg-[#110729]/80 border-purple-500/20',
    footerBg: 'bg-[#110729]/85 border-purple-500/20',
    myBubbleClass:
      'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 text-white font-medium shadow-lg shadow-purple-500/25 border border-purple-400/30',
    theirBubbleClass:
      'bg-[#150a2e]/90 text-slate-100 border border-purple-500/20 shadow-md',
    accentColor: 'text-purple-400',
    accentHex: '#a855f7',
    isDark: true,
  },
  {
    id: 'kurdistan_emerald',
    name: 'سەوزایی کوردستان · Emerald Jade',
    nameEn: 'Kurdistan Emerald',
    iconName: 'Heart',
    previewGradient: 'linear-gradient(135deg, #10b981, #059669, #047857)',
    containerBg: 'bg-gradient-to-b from-[#03150d] via-[#020d08] to-[#010604]',
    headerBg: 'bg-[#051f14]/80 border-emerald-500/20',
    footerBg: 'bg-[#051f14]/85 border-emerald-500/20',
    myBubbleClass:
      'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/25 border border-emerald-400/30',
    theirBubbleClass:
      'bg-[#062417]/90 text-slate-100 border border-emerald-500/20 shadow-md',
    accentColor: 'text-emerald-400',
    accentHex: '#10b981',
    isDark: true,
  },
  {
    id: 'cyber_neon',
    name: 'سایبەر ئەلیکتریک · Cyber Electric',
    nameEn: 'Cyber Electric',
    iconName: 'Zap',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #0284c7, #2563eb)',
    containerBg: 'bg-gradient-to-b from-[#02131d] via-[#020b12] to-[#010609]',
    headerBg: 'bg-[#031c2c]/80 border-cyan-500/25',
    footerBg: 'bg-[#031c2c]/85 border-cyan-500/25',
    myBubbleClass:
      'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-black font-bold shadow-lg shadow-cyan-500/25 border border-cyan-300/40',
    theirBubbleClass:
      'bg-[#052233]/90 text-slate-100 border border-cyan-500/25 shadow-md',
    accentColor: 'text-cyan-400',
    accentHex: '#06b6d4',
    isDark: true,
  },
  {
    id: 'sakura_velvet',
    name: 'پەمەیی مەخمەلی · Sakura Velvet',
    nameEn: 'Sakura Velvet',
    iconName: 'Flower2',
    previewGradient: 'linear-gradient(135deg, #ec4899, #f43f5e, #be123c)',
    containerBg: 'bg-gradient-to-b from-[#18040d] via-[#100208] to-[#080104]',
    headerBg: 'bg-[#220613]/80 border-pink-500/25',
    footerBg: 'bg-[#220613]/85 border-pink-500/25',
    myBubbleClass:
      'bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-medium shadow-lg shadow-pink-500/25 border border-pink-400/30',
    theirBubbleClass:
      'bg-[#220715]/90 text-slate-100 border border-pink-500/20 shadow-md',
    accentColor: 'text-pink-400',
    accentHex: '#ec4899',
    isDark: true,
  },
  {
    id: 'royal_sunset',
    name: 'خۆرئاوابوون · Sunset Royale',
    nameEn: 'Sunset Royale',
    iconName: 'Sun',
    previewGradient: 'linear-gradient(135deg, #f97316, #e11d48, #9333ea)',
    containerBg: 'bg-gradient-to-b from-[#180608] via-[#0f040d] to-[#07010a]',
    headerBg: 'bg-[#200910]/80 border-rose-500/25',
    footerBg: 'bg-[#200910]/85 border-rose-500/25',
    myBubbleClass:
      'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white font-medium shadow-lg shadow-rose-500/25 border border-rose-400/30',
    theirBubbleClass:
      'bg-[#1d0a14]/90 text-slate-100 border border-rose-500/20 shadow-md',
    accentColor: 'text-orange-400',
    accentHex: '#f97316',
    isDark: true,
  },
  {
    id: 'imperial_gold',
    name: 'زێڕی شاهانە ٢٤K · Imperial 24K',
    nameEn: 'Imperial 24K Gold',
    iconName: 'Crown',
    previewGradient: 'linear-gradient(135deg, #fef08a, #eab308, #a16207)',
    containerBg: 'bg-gradient-to-b from-[#120f04] via-[#0b0902] to-[#050401]',
    headerBg: 'bg-[#1a1505]/85 border-yellow-500/30',
    footerBg: 'bg-[#1a1505]/90 border-yellow-500/30',
    myBubbleClass:
      'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-black font-black shadow-xl shadow-yellow-500/30 border border-yellow-200/60',
    theirBubbleClass:
      'bg-[#1a1405]/90 text-amber-100 border border-yellow-500/30 shadow-md',
    accentColor: 'text-yellow-400',
    accentHex: '#eab308',
    isDark: true,
  },
  {
    id: 'midnight_oled',
    name: 'شەوی ڕەش · Pure OLED Dark',
    nameEn: 'Pure OLED Dark',
    iconName: 'Moon',
    previewGradient: 'linear-gradient(135deg, #334155, #1e293b, #0f172a)',
    containerBg: 'bg-[#050608]',
    headerBg: 'bg-[#0a0c10]/90 border-white/[0.08]',
    footerBg: 'bg-[#0a0c10]/95 border-white/[0.08]',
    myBubbleClass:
      'bg-gradient-to-r from-slate-800 to-slate-700 text-white font-medium shadow-md border border-white/15',
    theirBubbleClass:
      'bg-[#0f1218] text-slate-200 border border-white/[0.08] shadow-md',
    accentColor: 'text-slate-300',
    accentHex: '#94a3b8',
    isDark: true,
  },
];

export const DEFAULT_CHAT_THEME = CHAT_THEMES[0]; // inferno_fire

export function getChatThemeById(id: string): ChatTheme {
  return CHAT_THEMES.find((t) => t.id === id) || DEFAULT_CHAT_THEME;
}
