import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  X,
  Coins,
  Crown,
  Sparkles,
  Shield,
  Flame,
  Check,
  AlertCircle,
  Package,
  Gem,
} from 'lucide-react';
import type { User, ShopItem, ShopItemType } from '../types';
import { useLanguage } from '../contexts';
import { SHOP_CATALOG, purchaseShopItem } from '../services';

interface ArenaShopProps {
  currentUser: User;
  onClose: () => void;
}

const ITEM_TRANSLATIONS: Record<
  string,
  {
    kuName: string;
    kuDesc: string;
    gradient: string;
    border: string;
    glow: string;
    badgeBg: string;
    tagKu: string;
    tagEn: string;
  }
> = {
  coins_500: {
    kuName: '٥٠٠ دراوی زێڕین',
    kuDesc: 'پاکێجی دەستپێک بۆ ناردنی دیاری و بەشداریکردن لە یارییەکان.',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-slate-900',
    border: 'border-amber-500/30 hover:border-amber-400/60',
    glow: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    tagKu: 'پاکێجی دراو',
    tagEn: 'Coin Pack',
  },
  coins_2000: {
    kuName: '٢,٠٠٠ دراوی زێڕین',
    kuDesc: 'پاکێجی مامناوەند بۆ بەهێزکردنی هەژمارەکەت و دیارییە تایبەتەکان.',
    gradient: 'from-yellow-500/25 via-amber-500/10 to-slate-900',
    border: 'border-amber-400/40 hover:border-amber-300/70',
    glow: 'bg-amber-400/25 text-amber-200 border-amber-300/40',
    badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    tagKu: 'زۆرترین فرۆش',
    tagEn: 'Popular',
  },
  coins_10000: {
    kuName: '١٠,٠٠٠ دراوی شاهانە',
    kuDesc: 'گەورەترین خەزێنەی دراو بۆ پاڵەوانان و دیارییە گرانبەهاکان.',
    gradient: 'from-orange-500/25 via-amber-500/15 to-slate-900',
    border: 'border-orange-400/45 hover:border-amber-300',
    glow: 'bg-gradient-to-tr from-amber-500/30 to-orange-500/30 text-amber-200 border-amber-300/50',
    badgeBg: 'bg-orange-500/20 text-orange-200 border-orange-400/40',
    tagKu: 'پاکێجی شاهانە',
    tagEn: 'Royal Pack',
  },
  frame_golden: {
    kuName: 'چوارچێوەی تاجی زێڕین',
    kuDesc: 'چوارچێوەیەکی زێڕینی درەوشاوە و جوڵاو بۆ وێنەی پڕۆفایلەکەت.',
    gradient: 'from-purple-500/20 via-fuchsia-500/10 to-slate-900',
    border: 'border-purple-500/35 hover:border-purple-400/70',
    glow: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
    tagKu: 'چوارچێوە',
    tagEn: 'Avatar Frame',
  },
  frame_diamond: {
    kuName: 'چوارچێوەی ئەڵماسی درەوشاوە',
    kuDesc: 'دیزاینی کریستاڵ و ئەڵماسی سووڕاوە بۆ دەرکەوتنێکی شاهانە.',
    gradient: 'from-cyan-500/25 via-sky-500/10 to-slate-900',
    border: 'border-cyan-400/40 hover:border-cyan-300/80',
    glow: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
    badgeBg: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
    tagKu: 'ئەڵماس',
    tagEn: 'Diamond Frame',
  },
  badge_vip: {
    kuName: 'باجی فەرمی VIP',
    kuDesc: 'نیشانەی تایبەتی VIP لەسەر پڕۆفایل و ناو ژوورە دەنگییەکان.',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-slate-900',
    border: 'border-emerald-500/35 hover:border-emerald-400/70',
    glow: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    tagKu: 'باجی تایبەت',
    tagEn: 'VIP Badge',
  },
  badge_legend: {
    kuName: 'باجی ئەفسانەی گۆڕەپان',
    kuDesc: 'بەرزترین نیشانەی شکۆمەندی کە تەنها بۆ ئەفسانەکان دیاریکراوە.',
    gradient: 'from-rose-500/25 via-pink-500/10 to-slate-900',
    border: 'border-rose-500/40 hover:border-rose-400/80',
    glow: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
    tagKu: 'دەگمەن · دیاریکراو',
    tagEn: 'Limited Legend',
  },
  entrance_royal: {
    kuName: 'کاریگەری هاتنەژوورەوەی شاهانە',
    kuDesc: 'ئەنیمەیشنی سینەمایی و درەوشاوە کاتێک دەچیتە ناو هەر ژوورێک.',
    gradient: 'from-indigo-500/25 via-violet-500/15 to-slate-900',
    border: 'border-indigo-400/40 hover:border-indigo-300/80',
    glow: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
    badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
    tagKu: 'کاریگەری هاتنەژوورەوە',
    tagEn: 'Entrance FX',
  },
};

export default function ArenaShop({ currentUser, onClose }: ArenaShopProps) {
  const { tr } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<ShopItemType | 'all' | 'owned'>('all');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inventory = currentUser.inventory || {};
  const ownedCount = SHOP_CATALOG.filter((i) => Boolean(inventory[i.id])).length;

  const filteredItems =
    activeCategory === 'all'
      ? SHOP_CATALOG
      : activeCategory === 'owned'
        ? SHOP_CATALOG.filter((i) => Boolean(inventory[i.id]))
        : SHOP_CATALOG.filter((i) => i.type === activeCategory);

  const handlePurchase = async (item: ShopItem) => {
    setErrorMsg(null);
    const meta = ITEM_TRANSLATIONS[item.id];
    const displayName = meta ? tr(meta.kuName, item.name) : item.name;

    if (item.type === 'coin_pack') {
      setErrorMsg(
        tr(
          `بۆ کڕینی پاکێجی (${displayName}) بە نرخی ${item.realPrice}، پەیوەندی بە بەڕێوەبەری سیستم بکە.`,
          `To purchase ${item.name} (${item.realPrice}), please contact an administrator.`,
        ),
      );
      return;
    }

    if ((currentUser.coins ?? 0) < item.price) {
      setErrorMsg(
        tr(
          `کۆینی پێویستت نییە! پێویستت بە ${item.price.toLocaleString()} کۆینە.`,
          `Insufficient coins! You need ${item.price.toLocaleString()} coins.`,
        ),
      );
      return;
    }

    setPurchasingId(item.id);
    try {
      await purchaseShopItem(currentUser.uid, item);
      setPurchaseSuccess(displayName);
      setTimeout(() => setPurchaseSuccess(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || tr('کڕینەکە سەرنەکەوت.', 'Failed to complete purchase.'));
    } finally {
      setPurchasingId(null);
    }
  };

  const getItemIcon = (item: ShopItem) => {
    if (item.id === 'frame_diamond') return <Gem className="h-7 w-7" />;
    switch (item.type) {
      case 'coin_pack':
        return <Coins className="h-7 w-7" />;
      case 'avatar_frame':
        return <Crown className="h-7 w-7" />;
      case 'vip_badge':
        return <Shield className="h-7 w-7" />;
      case 'entrance_effect':
        return <Flame className="h-7 w-7" />;
    }
  };

  const categories: { id: ShopItemType | 'all' | 'owned'; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'all', label: tr('هەمووی', 'All Items'), icon: Sparkles, count: SHOP_CATALOG.length },
    { id: 'avatar_frame', label: tr('چوارچێوەکان', 'Frames'), icon: Crown },
    { id: 'vip_badge', label: tr('باجەکان', 'Badges'), icon: Shield },
    { id: 'entrance_effect', label: tr('هاتنەژوورەوە', 'Entrances'), icon: Flame },
    { id: 'coin_pack', label: tr('پاکێجی دراو', 'Coin Packs'), icon: Coins },
    { id: 'owned', label: tr('کڕدراوەکانم', 'My Items'), icon: Package, count: ownedCount },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0b0e17] shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
      >
        {/* Top Hero Header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-900 p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black shadow-lg shadow-amber-500/25">
                <ShoppingBag className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base sm:text-lg font-black text-white">
                    {tr('فرۆشگا و خەزێنەی گۆڕەپان', 'Arena Store & Vault')}
                  </h2>
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
                    VIP
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {tr('چوارچێوەی پڕۆفایل، باجی تایبەت، کاریگەری هاتنەژوورەوە و دراو', 'Frames, VIP badges, entrance effects & coin packs')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 rounded-2xl border border-amber-400/35 bg-slate-950/80 px-3.5 py-2 shadow-inner">
                <Coins className="h-4 w-4 text-amber-400" />
                <div className="text-left">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {tr('باڵانسەکەت', 'Balance')}
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                    {(currentUser.coins ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="relative mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((tab) => {
              const Icon = tab.icon;
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/25'
                      : 'border border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-black' : 'text-amber-400'}`} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-black ${
                        active ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mx-5 mt-4 flex items-center justify-between gap-2 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}

          {purchaseSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mx-5 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                {tr('بە سەرکەوتوویی کڕدرا: ', 'Successfully purchased: ')}
                {purchaseSuccess}!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Store Items Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 py-14 text-center">
              <Package className="mb-2.5 h-10 w-10 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">
                {tr('هیچ کاڵایەک لەم بەشەدا نییە', 'No items found in this category')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {tr('کاتێک کاڵایەک دەکڕیت لێرەدا دەردەکەوێت.', 'Items you purchase will appear in your inventory.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {filteredItems.map((item) => {
                const isOwned = Boolean(inventory[item.id]);
                const isPurchasing = purchasingId === item.id;
                const meta = ITEM_TRANSLATIONS[item.id] || {
                  kuName: item.name,
                  kuDesc: item.description,
                  gradient: 'from-slate-800/50 to-slate-950',
                  border: 'border-slate-800 hover:border-slate-700',
                  glow: 'bg-slate-800 text-amber-400 border-slate-700',
                  badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
                  tagKu: 'کاڵا',
                  tagEn: 'Item',
                };
                const canAfford = item.type === 'coin_pack' || (currentUser.coins ?? 0) >= item.price;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    whileHover={{ y: -2 }}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br ${meta.gradient} ${meta.border} p-4 shadow-lg transition-all`}
                  >
                    <div>
                      {/* Top row: Visual Icon Showcase + Category/Limited Tag */}
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg transition-transform duration-300 group-hover:scale-105 ${meta.glow}`}
                        >
                          {getItemIcon(item)}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.badgeBg}`}>
                            {tr(meta.tagKu, meta.tagEn)}
                          </span>
                          {item.isLimited && (
                            <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-rose-300">
                              {tr('سنووردار', 'Limited')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="mt-3.5 font-display text-sm font-black text-white group-hover:text-amber-200 transition-colors">
                        {tr(meta.kuName, item.name)}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300/85">
                        {tr(meta.kuDesc, item.description)}
                      </p>
                    </div>

                    {/* Footer: Price & Action Button */}
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {tr('نرخ', 'Price')}
                        </span>
                        {item.type === 'coin_pack' ? (
                          <span className="font-mono text-sm font-black text-emerald-300">{item.realPrice}</span>
                        ) : (
                          <div className="flex items-center gap-1 font-mono text-sm font-black text-amber-300">
                            <Coins className="h-4 w-4 text-amber-400" />
                            <span>{item.price.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {isOwned ? (
                        <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-black text-emerald-300">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span>{tr('کڕدراوە', 'Owned')}</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePurchase(item)}
                          disabled={isPurchasing}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition active:scale-95 disabled:opacity-50 ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400'
                              : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>
                            {isPurchasing
                              ? tr('چاوەڕوانبە...', 'Buying...')
                              : item.type === 'coin_pack'
                                ? tr('داواکردن', 'Get Pack')
                                : tr('کڕین', 'Buy Now')}
                          </span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
