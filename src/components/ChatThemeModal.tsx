import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  X,
  Check,
  Sparkles,
  Image,
  Sliders,
  RotateCcw,
  Flame,
  Zap,
  Moon,
  Crown,
  Flower2,
  Sun,
  Heart,
} from 'lucide-react';
import { CHAT_THEMES, type ChatTheme, getChatThemeById } from '../constants/chatThemes';
import { useLanguage } from '../contexts';

interface ChatThemeModalProps {
  currentThemeId: string;
  customWallpaperUrl?: string;
  wallpaperOpacity?: number;
  onSelectTheme: (themeId: string) => void;
  onSetCustomWallpaper: (url: string) => void;
  onSetWallpaperOpacity: (opacity: number) => void;
  onClose: () => void;
}

const WALLPAPER_PRESETS = [
  {
    name: 'شەوی ئەستێرەکان',
    nameEn: 'Starry Cosmic',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'چیای کوردستان',
    nameEn: 'Kurdish Peaks',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'ئاگری نیۆن',
    nameEn: 'Neon Inferno',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'کاربۆنی ڕەش',
    nameEn: 'Dark Minimalist',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
  },
];

export default function ChatThemeModal({
  currentThemeId,
  customWallpaperUrl = '',
  wallpaperOpacity = 30,
  onSelectTheme,
  onSetCustomWallpaper,
  onSetWallpaperOpacity,
  onClose,
}: ChatThemeModalProps) {
  const { tr } = useLanguage();
  const [selectedId, setSelectedId] = useState(currentThemeId);
  const [wallpaperInput, setWallpaperInput] = useState(customWallpaperUrl);
  const [opacity, setOpacity] = useState(wallpaperOpacity);
  const [activeTab, setActiveTab] = useState<'themes' | 'wallpaper'>('themes');

  const handleApply = () => {
    onSelectTheme(selectedId);
    onSetCustomWallpaper(wallpaperInput.trim());
    onSetWallpaperOpacity(opacity);
    onClose();
  };

  const handleReset = () => {
    setSelectedId('inferno_fire');
    setWallpaperInput('');
    setOpacity(30);
    onSelectTheme('inferno_fire');
    onSetCustomWallpaper('');
    onSetWallpaperOpacity(30);
  };

  const selectedTheme = getChatThemeById(selectedId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex h-[90vh] max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/25 bg-[#0d0e17] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-slate-900/60 p-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-md">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-black uppercase tracking-wider text-white">
                {tr('ڕێکخستن و ڕووکاری چات', 'Chat Themes & Wallpaper')}
              </h2>
              <p className="text-[10px] text-slate-400">
                {tr('ڕووکار، باکگراوند و ڕەنگی بڵقی نامەکان دیاریبکە', 'Customize themes, wallpapers & bubbles')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 border-b border-white/[0.06] bg-slate-950/40 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2 text-xs font-bold transition-all ${
              activeTab === 'themes'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{tr('ڕووکارەکان (Themes)', 'Themes')} ({CHAT_THEMES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2 text-xs font-bold transition-all ${
              activeTab === 'wallpaper'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Image className="h-3.5 w-3.5" />
            <span>{tr('وێنەی باکگراوند (Wallpaper)', 'Wallpaper')}</span>
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 border-b border-white/[0.06] bg-slate-950/70">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {tr('پێشبینینی ڕاستەوخۆ (Live Preview)', 'Live Preview')}
          </span>
          <div
            className={`relative rounded-2xl p-3 overflow-hidden border border-white/10 ${selectedTheme.containerBg}`}
          >
            {wallpaperInput && (
              <div
                className="absolute inset-0 bg-cover bg-center pointer-events-none"
                style={{
                  backgroundImage: `url(${wallpaperInput})`,
                  opacity: opacity / 100,
                }}
              />
            )}
            <div className="relative z-10 space-y-2">
              <div className="flex justify-start">
                <div className={`rounded-2xl px-3 py-1.5 text-xs max-w-[80%] ${selectedTheme.theirBubbleClass}`}>
                  {tr('سڵاو! دۆخی ئەم ڕووکارە چۆنە؟ 👋', 'Hey! How does this theme look? 👋')}
                </div>
              </div>
              <div className="flex justify-end">
                <div className={`rounded-2xl px-3 py-1.5 text-xs max-w-[80%] ${selectedTheme.myBubbleClass}`}>
                  {tr('زۆر جوانە! ڕەنگەکانی زۆر دڵگیرن 🔥✨', 'Awesome! The colors look stunning 🔥✨')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'themes' && (
            <div className="grid grid-cols-2 gap-2.5">
              {CHAT_THEMES.map((theme) => {
                const isSelected = theme.id === selectedId;

                return (
                  <motion.div
                    key={theme.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedId(theme.id)}
                    className={`relative cursor-pointer overflow-hidden rounded-2xl border p-3 transition-all ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-500/10 shadow-lg shadow-amber-500/15'
                        : 'border-white/[0.08] bg-slate-900/50 hover:border-white/20 hover:bg-slate-900'
                    }`}
                  >
                    {/* Color Swatch Dot */}
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="h-6 w-6 rounded-full shadow-md border border-white/20"
                        style={{ background: theme.previewGradient }}
                      />
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <h4 className="text-xs font-black text-white truncate">
                      {tr(theme.name, theme.nameEn)}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
                      {theme.nameEn}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {activeTab === 'wallpaper' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {tr('بەستەری وێنەی باکگراوند (Custom Wallpaper URL)', 'Custom Wallpaper URL')}
                </label>
                <input
                  type="url"
                  value={wallpaperInput}
                  onChange={(e) => setWallpaperInput(e.target.value)}
                  placeholder="https://images.unsplash.com/…"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400"
                />
              </div>

              {/* Wallpaper Presets */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {tr('وێنەی ئامادەکراو (Wallpaper Presets)', 'Preset Wallpapers')}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WALLPAPER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setWallpaperInput(preset.url)}
                      className={`relative h-20 overflow-hidden rounded-2xl border transition-all ${
                        wallpaperInput === preset.url
                          ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                        <span className="text-[10px] font-bold text-white truncate">{tr(preset.name, preset.nameEn)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              {wallpaperInput && (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1.5">
                    <span>{tr('ڕوونی باکگراوند (Opacity)', 'Wallpaper Opacity')}</span>
                    <span className="font-mono text-amber-400">{opacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>{tr('کەمڕوون (سێبەر)', 'Subtle (10%)')}</span>
                    <span>{tr('تۆخ (دیار)', 'Vivid (100%)')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-slate-900/60 p-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{tr('گەڕانەوە بۆ بنەڕەت', 'Reset')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
            >
              {tr('داخستن', 'Cancel')}
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/25 transition active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>{tr('جێبەجێکردن', 'Apply Theme')}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
