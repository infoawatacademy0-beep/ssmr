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
  Headphones,
  MessageSquare,
  Smile,
  CreditCard,
  Award,
  Bell,
} from 'lucide-react';
import {
  VIP_LEVEL_THRESHOLDS,
  calculateVipLevelFromXp,
  type User,
  type ShopItem,
} from '../types';
import { useLanguage } from '../contexts';
import {
  SHOP_CATALOG,
  TOPTOP_COIN_PACKS,
  purchaseShopItem,
  rechargeTopTopCoinPack,
  type TopTopCoinPack,
} from '../services';

interface ArenaShopProps {
  currentUser: User;
  onClose: () => void;
  initialSection?: 'coins' | 'vip' | 'store';
}

const VIP_PRIVILEGES = [
  {
    id: 'priv_badge',
    kuTitle: 'نیشانی VIP',
    enTitle: 'VIP Badge',
    kuSub: 'دوای VIP1 بکرێتەوە',
    enSub: 'Unlocks at VIP1',
    minVip: 1,
    icon: Award,
  },
  {
    id: 'priv_frame',
    kuTitle: 'چوارچێوەی تایبەتی وێنەی پڕۆفایل',
    enTitle: 'Exclusive Avatar Frame',
    kuSub: 'دوای VIP1 بکرێتەوە',
    enSub: 'Unlocks at VIP1',
    minVip: 1,
    icon: Crown,
  },
  {
    id: 'priv_bubble',
    kuTitle: 'بڵقی تایبەتی چات',
    enTitle: 'Special Chat Bubble',
    kuSub: 'دوای VIP1 بکرێتەوە',
    enSub: 'Unlocks at VIP1',
    minVip: 1,
    icon: MessageSquare,
  },
  {
    id: 'priv_sticker',
    kuTitle: 'ستیکەری تایبەتی شوێنی مایک',
    enTitle: 'Exclusive Mic Seat Sticker',
    kuSub: 'دوای VIP1 بکرێتەوە',
    enSub: 'Unlocks at VIP1',
    minVip: 1,
    icon: Smile,
  },
  {
    id: 'priv_card_border',
    kuTitle: 'لێواری تایبەتی کارتی پڕۆفایل',
    enTitle: 'Profile Card Border',
    kuSub: 'دوای VIP2 بکرێتەوە',
    enSub: 'Unlocks at VIP2',
    minVip: 2,
    icon: CreditCard,
  },
  {
    id: 'priv_support',
    kuTitle: 'پشتگیری کڕیاری تایبەت',
    enTitle: 'Priority VIP Support',
    kuSub: 'دوای VIP3 بکرێتەوە',
    enSub: 'Unlocks at VIP3',
    minVip: 3,
    icon: Headphones,
  },
  {
    id: 'priv_entrance',
    kuTitle: 'کاریگەری هاتنەژوورەوەی شاهانە',
    enTitle: 'Royal Entrance Effect',
    kuSub: 'دوای VIP4 بکرێتەوە',
    enSub: 'Unlocks at VIP4',
    minVip: 4,
    icon: Flame,
  },
  {
    id: 'priv_voice',
    kuTitle: 'گۆڕینی دەنگی تایبەت لە ژوور',
    enTitle: 'VIP Live Voice Changer',
    kuSub: 'دوای VIP5 بکرێتەوە',
    enSub: 'Unlocks at VIP5',
    minVip: 5,
    icon: Sparkles,
  },
  {
    id: 'priv_emperor',
    kuTitle: 'نازناوی ئیمپراتۆری گۆڕەپان',
    enTitle: 'Arena Emperor Prestige',
    kuSub: 'دوای VIP6 بکرێتەوە',
    enSub: 'Unlocks at VIP6',
    minVip: 6,
    icon: Shield,
  },
];

export default function ArenaShop({
  currentUser,
  onClose,
  initialSection = 'coins',
}: ArenaShopProps) {
  const { tr } = useLanguage();
  const [mainSection, setMainSection] = useState<'coins' | 'vip' | 'store' | 'owned'>(initialSection);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inventory = currentUser.inventory || {};
  const studioItems = SHOP_CATALOG.filter((i) => i.type !== 'coin_pack');
  const ownedItems = studioItems.filter((i) => Boolean(inventory[i.id]));

  const currentVipXp = currentUser.vipXp ?? (currentUser.isVerified ? 99 : 0);
  const currentVipLevel = calculateVipLevelFromXp(currentVipXp, currentUser.isVerified, currentUser.vipLevel);
  const nextTierObj =
    VIP_LEVEL_THRESHOLDS.find((t) => t.level === Math.min(10, currentVipLevel + 1)) ||
    VIP_LEVEL_THRESHOLDS[VIP_LEVEL_THRESHOLDS.length - 1];
  const currentTierObj =
    VIP_LEVEL_THRESHOLDS.find((t) => t.level === currentVipLevel) || {
      level: 0,
      minXp: 0,
      nameKu: 'ڤایپ ٠',
      nameEn: 'VIP 0',
    };
  const remainingVipXp = Math.max(0, nextTierObj.minXp - currentVipXp);
  const vipProgressPct =
    currentVipLevel >= 10
      ? 100
      : Math.min(
          100,
          Math.max(
            6,
            Math.round(
              ((currentVipXp - currentTierObj.minXp) /
                Math.max(1, nextTierObj.minXp - currentTierObj.minXp)) *
                100,
            ),
          ),
        );

  const handleRechargeCoinPack = async (pack: TopTopCoinPack) => {
    setErrorMsg(null);
    setPurchasingId(pack.id);
    try {
      const res = await rechargeTopTopCoinPack(currentUser.uid, pack);
      setPurchaseSuccess(
        tr(
          `${pack.coins.toLocaleString()} دراو + ${pack.vipReward} خەڵاتی VIP زیادکرا! (ئێستا VIP ${res.newVipLevel} · Lv.${res.newLevel})`,
          `Added ${pack.coins.toLocaleString()} Coins + ${pack.vipReward} VIP Exp! (Now VIP ${res.newVipLevel} · Lv.${res.newLevel})`,
        ),
      );
      setTimeout(() => setPurchaseSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || tr('کڕینی پاکێجەکە سەرنەکەوت.', 'Failed to recharge coin pack.'));
    } finally {
      setPurchasingId(null);
    }
  };

  const handlePurchaseStoreItem = async (item: ShopItem) => {
    setErrorMsg(null);
    if ((currentUser.coins ?? 0) < item.price) {
      setErrorMsg(
        tr(
          `دراوی پێویستت نییە! پێویستت بە ${item.price.toLocaleString()} دراوە.`,
          `Insufficient coins! You need ${item.price.toLocaleString()} coins.`,
        ),
      );
      return;
    }

    setPurchasingId(item.id);
    try {
      await purchaseShopItem(currentUser.uid, item);
      setPurchaseSuccess(item.name);
      setTimeout(() => setPurchaseSuccess(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || tr('کڕینەکە سەرنەکەوت.', 'Failed to complete purchase.'));
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2.5 sm:p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 14 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0d1017] shadow-[0_25px_70px_rgba(0,0,0,0.9)]"
      >
        {/* ── TOP HEADER & NAVIGATION TABS ── */}
        <div className="border-b border-white/10 bg-gradient-to-b from-[#151a26] to-[#0d1017] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/20">
                <Coins className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-black text-white">
                    {mainSection === 'vip'
                      ? tr('VIP ـەکەم', 'My VIP Center')
                      : mainSection === 'coins'
                        ? tr('دراوەکانم', 'My Coins')
                        : tr('فرۆشگای گۆڕەپان', 'Arena Store')}
                  </h2>
                  <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black italic text-emerald-300">
                    VIP {currentVipLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {tr(
                    'ئاستی VIP و لێڤڵی هەژمارەکەت بە کڕینی پاکێجی دراو بەرز دەبێتەوە',
                    'Upgrade your VIP tier & account level by recharging coin packs',
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 4 Mode Switcher Buttons */}
          <div className="mt-3.5 grid grid-cols-4 gap-1.5 rounded-2xl bg-black/50 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setMainSection('coins')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                mainSection === 'coins'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>{tr('دراوەکانم', 'Coins')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMainSection('vip')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                mainSection === 'vip'
                  ? 'bg-gradient-to-r from-emerald-400 to-amber-400 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{tr('VIP ـەکەم', 'My VIP')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMainSection('store')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                mainSection === 'store'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{tr('فرۆشگا', 'Store')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMainSection('owned')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                mainSection === 'owned'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>{tr('کڕدراوەکانم', 'Owned')} ({ownedItems.length})</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-200"
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
              className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{purchaseSuccess}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SCROLLABLE CONTENT BODY ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ═══════════════════════════════════════════════════════════
              TAB 1: TOPTOP STYLE "دراوەکانم" (MY COINS STORE — SCREENSHOT 3)
              ═══════════════════════════════════════════════════════════ */}
          {mainSection === 'coins' && (
            <div className="space-y-4">
              {/* Top Balance & Region Bar (Matches Screenshot 3) */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">🇮🇶</span>
                  <span className="text-xs font-bold text-slate-300">IQD · عێراق</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black text-white">
                    {(currentUser.coins ?? 0).toLocaleString()}
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-black shadow-md shadow-amber-500/30 ring-2 ring-amber-300/50">
                    <Coins className="h-4 w-4 fill-amber-900 text-amber-950" />
                  </div>
                </div>
              </div>

              {/* 6-Pack Grid (2 rows x 3 columns, matching Screenshot 3) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TOPTOP_COIN_PACKS.map((pack) => {
                  const isBusy = purchasingId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => !isBusy && handleRechargeCoinPack(pack)}
                      className="group relative flex cursor-pointer flex-col items-center justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950 p-3.5 text-center shadow-lg transition-all hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-amber-500/10"
                    >
                      {/* Top-Right Red Discount Ribbon (5%OFF, 9%OFF, 11%OFF, 13%OFF, 17%OFF) */}
                      {pack.discount && (
                        <span className="absolute top-0 right-0 rounded-bl-2xl bg-gradient-to-r from-rose-500 to-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md">
                          {pack.discount}
                        </span>
                      )}

                      {/* Golden Coin Stack Visual */}
                      <div className="mt-3 mb-2 flex h-12 items-center justify-center">
                        {pack.stackSize === 'single' ? (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.45)] ring-2 ring-yellow-200/70">
                            <span className="text-lg font-black text-amber-950">★</span>
                          </div>
                        ) : pack.stackSize === 'double' ? (
                          <div className="relative flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-400 shadow-md ring-2 ring-yellow-200/70">
                              <span className="text-base font-black text-amber-950">★</span>
                            </div>
                            <div className="-ml-3 mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 shadow-lg ring-2 ring-yellow-200">
                              <span className="text-base font-black text-amber-950">★</span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative flex items-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-600 to-yellow-300 shadow ring-1 ring-yellow-200/70">
                              <span className="text-sm font-black text-amber-950">★</span>
                            </div>
                            <div className="-mx-2 -mt-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-white shadow-[0_4px_16px_rgba(245,158,11,0.6)] ring-2 ring-yellow-200">
                              <span className="text-base font-black text-amber-950">★</span>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-600 to-yellow-300 shadow ring-1 ring-yellow-200/70">
                              <span className="text-sm font-black text-amber-950">★</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coin Amount & VIP Reward Subtitle */}
                      <div>
                        <p className="font-mono text-base sm:text-lg font-black text-white">
                          {pack.coins.toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-[11px] font-bold text-amber-300/90">
                          {pack.vipReward} {tr('خەڵاتی VIP', 'VIP Exp')}
                        </p>
                        <p className="text-[9px] font-semibold text-purple-300">
                          +{pack.levelBoost} {tr('ئاست (Lv)', 'Level Boost')}
                        </p>
                      </div>

                      {/* Bottom IQD Price Pill Button */}
                      <button
                        type="button"
                        disabled={isBusy}
                        className="mt-3 w-full rounded-full border border-rose-500/40 bg-rose-500/15 py-1.5 font-mono text-xs font-black text-rose-300 transition group-hover:bg-rose-500 group-hover:text-white"
                      >
                        {isBusy ? tr('چاوەڕوانبە...', 'Processing...') : pack.iqdPrice}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Quick Switch to My VIP Card */}
              <div
                onClick={() => setMainSection('vip')}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-[#13281c] via-[#1c3b29] to-[#102017] p-3.5 transition hover:border-emerald-400/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-300">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">
                      {tr('بینینی مافیە تایبەتییەکانی VIP ـەکەم', 'View My Exclusive VIP Privileges')}
                    </h4>
                    <p className="text-[10px] text-emerald-300/80">
                      {tr(
                        `ئاستی ئێستات: VIP ${currentVipLevel} · کۆی خاڵی VIP: ${currentVipXp}`,
                        `Current Tier: VIP ${currentVipLevel} · Total VIP Exp: ${currentVipXp}`,
                      )}
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-black text-black">
                  VIP {currentVipLevel}
                </span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              TAB 2: TOPTOP STYLE "VIP ـەکەم" (MY VIP CENTER — SCREENSHOT 1)
              ═══════════════════════════════════════════════════════════ */}
          {mainSection === 'vip' && (
            <div className="space-y-5">
              {/* Top Metallic Emerald-Gold VIP Card (Matches Screenshot 1) */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-[#234730] via-[#162f20] to-[#0c1c13] p-5 shadow-2xl">
                <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

                <div className="relative flex items-center justify-between gap-4">
                  {/* Left: Metallic Shield Emblem */}
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-300/60 bg-gradient-to-b from-emerald-400/30 via-emerald-800/60 to-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                    <Shield className="h-11 w-11 text-emerald-300 fill-emerald-400/30 drop-shadow" />
                  </div>

                  {/* Right: Big Italic VIP Title & Validity */}
                  <div className="text-right">
                    <h3 className="font-display text-3xl sm:text-4xl font-black italic tracking-wider text-emerald-100 drop-shadow-[0_2px_10px_rgba(16,185,129,0.5)]">
                      VIP{currentVipLevel}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-200/80">
                      {tr('دروستە تا 23:59/17/01/2027', 'Valid until 17/01/2027 23:59')}
                    </p>
                  </div>
                </div>

                {/* Exp Counter & Remaining Notice */}
                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-emerald-200/85">
                    {currentVipLevel < 10
                      ? tr(
                          `(${remainingVipXp} خەڵاتی زیاتر بۆ بەرزکردنەوە بۆ ڤایپ ${nextTierObj.level})`,
                          `(${remainingVipXp} more VIP Exp to reach VIP ${nextTierObj.level})`,
                        )
                      : tr('(گەیشتوویتە بەرزترین ئاستی ڤایپ!)', '(Max VIP Tier Reached!)')}
                  </span>

                  <div className="font-mono text-xl sm:text-2xl font-black text-white">
                    <span className="text-xs font-bold text-emerald-300 mr-1.5">Exp</span>
                    {currentVipXp.toLocaleString()}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/50 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-white to-amber-300 transition-all duration-500"
                    style={{ width: `${vipProgressPct}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-emerald-100/90">
                  <span>
                    {nextTierObj.minXp.toLocaleString()} {tr(`ڤایپ ${nextTierObj.level}`, `VIP ${nextTierObj.level}`)}
                  </span>
                  <span>
                    {currentTierObj.minXp.toLocaleString()}{' '}
                    {tr(`ڤایپ ${currentVipLevel} بە سەرکەوتوویی پارێزرا`, `VIP ${currentVipLevel} Active`)}
                  </span>
                </div>
              </div>

              {/* Section Header: 🌾 مافیە تایبەتییەکانم 🌾 */}
              <div className="flex items-center justify-center gap-2.5 py-1">
                <span className="text-base text-amber-400">🌾</span>
                <h4 className="font-display text-sm sm:text-base font-black text-amber-200">
                  {tr('مافیە تایبەتییەکانم', 'My Exclusive VIP Privileges')}
                </h4>
                <span className="text-base text-amber-400">🌾</span>
              </div>

              {/* 3x3 Grid of Exclusive Privileges (Matches Screenshot 1) */}
              <div className="grid grid-cols-3 gap-2.5">
                {VIP_PRIVILEGES.map((priv) => {
                  const Icon = priv.icon;
                  const unlocked = currentVipLevel >= priv.minVip;
                  return (
                    <div
                      key={priv.id}
                      className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                        unlocked
                          ? 'border-amber-400/35 bg-[#161922] shadow-md'
                          : 'border-white/[0.06] bg-[#12141c]/80 opacity-75'
                      }`}
                    >
                      {/* Hexagonal Golden Icon Box */}
                      <div
                        className={`mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl border ${
                          unlocked
                            ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-amber-950/40 text-amber-300 shadow-inner'
                            : 'border-white/10 bg-[#1e212d] text-amber-200/70'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <p className="line-clamp-2 text-[11px] font-black text-white leading-snug">
                        {tr(priv.kuTitle, priv.enTitle)}
                      </p>
                      <p className="mt-1 text-[9.5px] font-medium text-slate-400">
                        {tr(priv.kuSub, priv.enSub)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Gold Notification & Action Bar (Matches Bottom of Screenshot 1) */}
              <div className="overflow-hidden rounded-3xl border border-amber-400/30 bg-[#171820] shadow-xl">
                <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-amber-200 via-amber-100 to-yellow-200 px-4 py-2 text-[11px] font-bold text-amber-950">
                  <span>
                    {tr(
                      `بە کڕینی پاکێجی دراو خاڵی VIP زیاد دەکات و ئاستی VIP و لێڤڵەکەت بەرز دەبێتەوە`,
                      `Recharging coin packs awards VIP Exp and upgrades both your VIP & Account Level`,
                    )}
                  </span>
                  <Bell className="h-4 w-4 shrink-0 text-amber-800" />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setMainSection('coins')}
                    className="w-full sm:w-auto rounded-full bg-gradient-to-r from-[#e5c99b] via-[#d4b075] to-[#c49a57] px-6 py-2.5 text-xs font-black text-slate-950 shadow-lg transition hover:brightness-110 active:scale-95"
                  >
                    {tr('ئێستا پارە زیاد بکە', 'Recharge Coins Now')}
                  </button>

                  <p className="text-right text-[11px] font-semibold text-slate-300 leading-relaxed">
                    {currentVipLevel < 10
                      ? tr(
                          `بەردەوام بە لە کڕینی کۆین بۆ بەدەستهێنانی ${remainingVipXp} خەڵاتی ڤایپ، بەرز بکەرەوە بۆ ڤایپ ${nextTierObj.level}`,
                          `Keep recharging to earn ${remainingVipXp} more VIP Exp and upgrade to VIP ${nextTierObj.level}`,
                        )
                      : tr('تۆ لە بەرزترین پلەی VIP دایت!', 'You have reached the highest VIP tier!')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              TAB 3 & 4: COSMETICS STORE & OWNED ITEMS
              ═══════════════════════════════════════════════════════════ */}
          {(mainSection === 'store' || mainSection === 'owned') && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(mainSection === 'owned' ? ownedItems : studioItems).map((item) => {
                const isOwned = Boolean(inventory[item.id]);
                const isBuying = purchasingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-300">
                        {item.id === 'frame_diamond' ? (
                          <Gem className="h-6 w-6" />
                        ) : item.type === 'avatar_frame' ? (
                          <Crown className="h-6 w-6" />
                        ) : item.type === 'vip_badge' ? (
                          <Shield className="h-6 w-6" />
                        ) : (
                          <Flame className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-display text-sm font-black text-white">
                          {item.name}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="flex items-center gap-1.5 font-mono text-sm font-black text-amber-300">
                        <Coins className="h-4 w-4 text-amber-400" />
                        <span>{item.price.toLocaleString()}</span>
                      </div>

                      {isOwned ? (
                        <span className="flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300">
                          <Check className="h-3.5 w-3.5" />
                          <span>{tr('کڕدراوە', 'Owned')}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isBuying}
                          onClick={() => handlePurchaseStoreItem(item)}
                          className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-1.5 text-xs font-black text-black shadow transition hover:brightness-110"
                        >
                          {isBuying ? tr('چاوەڕوانبە...', 'Buying...') : tr('کڕین', 'Buy')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
