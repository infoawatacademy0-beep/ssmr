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
} from 'lucide-react';
import type { User, ShopItem, ShopItemType } from '../types';
import { useLanguage } from '../contexts';
import { SHOP_CATALOG, purchaseShopItem } from '../services';

interface ArenaShopProps {
  currentUser: User;
  onClose: () => void;
}

export default function ArenaShop({ currentUser, onClose }: ArenaShopProps) {
  const { tr } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<ShopItemType | 'all'>('all');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inventory = currentUser.inventory || {};

  const filteredItems = activeCategory === 'all'
    ? SHOP_CATALOG
    : SHOP_CATALOG.filter((i) => i.type === activeCategory);

  const handlePurchase = async (item: ShopItem) => {
    setErrorMsg(null);

    if (item.type === 'coin_pack') {
      alert(`Simulated checkout: ${item.name} (${item.realPrice}) added to your vault!`);
      return;
    }

    if (currentUser.coins < item.price) {
      setErrorMsg(tr(`کۆینی پێویستت نییە! پێویستت بە ${item.price.toLocaleString()} کۆینە.`, `Insufficient coins! You need ${item.price.toLocaleString()} coins.`));
      return;
    }

    setPurchasingId(item.id);
    try {
      await purchaseShopItem(currentUser.uid, item);
      setPurchaseSuccess(item.name);
      setTimeout(() => setPurchaseSuccess(null), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete purchase.');
    } finally {
      setPurchasingId(null);
    }
  };

  const getItemIcon = (type: ShopItemType) => {
    switch (type) {
      case 'coin_pack':
        return <Coins className="h-6 w-6 text-amber-400" />;
      case 'avatar_frame':
        return <Crown className="h-6 w-6 text-purple-400" />;
      case 'vip_badge':
        return <Shield className="h-6 w-6 text-cyan-400" />;
      case 'entrance_effect':
        return <Flame className="h-6 w-6 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                {tr("فرۆشگا و خەزێنەی گۆڕەپان", "Arena Shop & Vault")}
              </h3>
              <p className="text-[10px] text-slate-400">{tr("باجەکان، چوارچێوە و کۆین", "Badges, Frames & Coins")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>{(currentUser.coins ?? 0).toLocaleString()}</span>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-3 border-b border-slate-800/80 bg-slate-950/40">
          {(
            [
              { id: 'all', label: tr('هەموو شتەکان', 'All Items') },
              { id: 'coin_pack', label: tr('کۆمەڵە کۆین', 'Coin Packs') },
              { id: 'avatar_frame', label: tr('چوارچێوەی پڕۆفایل', 'Avatar Frames') },
              { id: 'vip_badge', label: tr('باجی VIP', 'VIP Badges') },
              { id: 'entrance_effect', label: tr('کاریگەری هاتنەژوورەوە', 'Entrance Effects') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeCategory === tab.id
                  ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300'
                  : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {purchaseSuccess && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{tr("بە سەرکەوتوویی بەدەستهات: ", "Successfully purchased: ")}{purchaseSuccess}! {tr("بۆ کەرەستەکانت زیادکرا.", "Added to your inventory.")}</span>
          </div>
        )}

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const isOwned = Boolean(inventory[item.id]);
              const isPurchasing = purchasingId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 transition hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                        {getItemIcon(item.type)}
                      </div>
                      {item.isLimited && (
                        <span className="rounded-md bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-400 uppercase">
                          {tr('دیاریکراو', 'Limited')}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3 text-sm font-bold text-white">{item.name}</h4>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300">
                      {item.type === 'coin_pack' ? (
                        <span>{item.realPrice}</span>
                      ) : (
                        <>
                          <Coins className="h-3.5 w-3.5 text-amber-400" />
                          <span>{item.price.toLocaleString()}</span>
                        </>
                      )}
                    </div>

                    {isOwned ? (
                      <span className="flex items-center gap-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{tr("کڕدراوە", "Owned")}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={isPurchasing}
                        className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-black shadow-md transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
                      >
                        {isPurchasing ? tr('خەریکە...', 'Processing...') : tr('کڕین', 'Purchase')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
