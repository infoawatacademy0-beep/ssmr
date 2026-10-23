export type GiftTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type GiftIconKey =
  | 'teapot'
  | 'heart-me'
  | 'rose'
  | 'neon-heart'
  | 'fire'
  | 'diamond'
  | 'sports-car'
  | 'lion'
  | 'rocket'
  | 'nebula'
  | 'crown'
  | 'interstellar'
  | 'white-tiger';

export interface GiftItem {
  id: string;
  name: string;
  iconKey: GiftIconKey;
  cost: number;
  color: string;
  tier: GiftTier;
  description: string;
  /** CSS animation class applied to the gift icon in the store grid */
  animClass: string;
  /** Optional video URL or local file path (e.g. '/videos/lion.mp4') */
  videoUrl?: string;
  /** Chroma-key background color to remove in real-time */
  videoKeyColor?: 'green' | 'blue' | 'white' | 'black' | 'none';
}

/**
 * Luxury Video-FX Animated Gift Collection
 * Ordered from 1 Coin (Teapot pouring tea into a glass) to 99,999 Coins.
 */
export const AVAILABLE_GIFTS: GiftItem[] = [
  {
    id: 'teapot',
    name: 'قۆری چای',
    iconKey: 'teapot',
    cost: 1,
    color: 'text-amber-400',
    tier: 'common',
    description: 'قۆری چای گەرم کە چای تێدەکاتە ناو پیاڵەی چای',
    animClass: 'gift-anim-bloom',
  },
  {
    id: 'heart-me',
    name: 'دڵی میهرەبان',
    iconKey: 'heart-me',
    cost: 5,
    color: 'text-pink-400',
    tier: 'common',
    description: 'دڵێکی جووڵاوی میهرەبان بۆ هاوڕێیان',
    animClass: 'gift-anim-heartbeat',
  },
  {
    id: 'neon-heart',
    name: 'دڵی نیۆن',
    iconKey: 'neon-heart',
    cost: 50,
    color: 'text-pink-500',
    tier: 'common',
    description: 'دڵێکی درەوشاوەی نیۆنی پڕ لە سۆز',
    animClass: 'gift-anim-neon-pulse',
  },
  {
    id: 'fire',
    name: 'بڵێسەی ئاگر',
    iconKey: 'fire',
    cost: 100,
    color: 'text-orange-400',
    tier: 'rare',
    description: 'بڵێسەی ئاگرێکی درەوشاوە',
    animClass: 'gift-anim-flicker',
  },
  {
    id: 'diamond',
    name: 'ئەڵماسی شین',
    iconKey: 'diamond',
    cost: 500,
    color: 'text-cyan-400',
    tier: 'rare',
    description: 'ئەڵماسێکی گرانبەها و بێوێنە',
    animClass: 'gift-anim-sparkle',
  },
  {
    id: 'sports-car',
    name: 'ئۆتۆمبێلی وەرزشی',
    iconKey: 'sports-car',
    cost: 7000,
    color: 'text-rose-500',
    tier: 'epic',
    description: 'سوپەرکاری خێرا کە بە ئاگرەوە لەسەر شاشە دەسوڕێتەوە',
    animClass: 'gift-anim-drive',
  },
  {
    id: 'lion',
    name: 'شێری ئاگرین',
    iconKey: 'lion',
    cost: 10000,
    color: 'text-amber-400',
    tier: 'legendary',
    description: 'شێری ئاگرین نەڕەی دێت و ئاگری لێ هەڵدەستێت',
    animClass: 'gift-anim-roar',
    videoUrl: '/videos/lion.mp4',
    videoKeyColor: 'green',
  },
  {
    id: 'rocket',
    name: 'ڕۆکێتی فەزایی',
    iconKey: 'rocket',
    cost: 15000,
    color: 'text-violet-400',
    tier: 'epic',
    description: 'ڕۆکێتێک بەرەو ئاسمان هەڵدەفڕێت بە هێزێکی زۆرەوە',
    animClass: 'gift-anim-launch',
  },
  {
    id: 'nebula',
    name: 'گوڵی کاکێشان',
    iconKey: 'nebula',
    cost: 20000,
    color: 'text-fuchsia-400',
    tier: 'legendary',
    description: 'گوڵێکی گەردوونی کە لە بۆشایی ئاسماندا دەدرەوشێتەوە',
    animClass: 'gift-anim-orbit',
  },
  {
    id: 'crown',
    name: 'تاجی پاشایەتی',
    iconKey: 'crown',
    cost: 25000,
    color: 'text-yellow-400',
    tier: 'legendary',
    description: 'هێمای شکۆمەندی و پاشایەتی ژوور',
    animClass: 'gift-anim-crown-glow',
  },
  {
    id: 'interstellar',
    name: 'گەشتی گەردوونی',
    iconKey: 'interstellar',
    cost: 50000,
    color: 'text-indigo-400',
    tier: 'mythic',
    description: 'گەشتێکی بێوێنە بەنێو ئەستێرە و گەردووندا',
    animClass: 'gift-anim-warp',
  },
  {
    id: 'white-tiger',
    name: 'پڵنگی هەورەبرووسکە',
    iconKey: 'white-tiger',
    cost: 99999,
    color: 'text-sky-300',
    tier: 'mythic',
    description: 'دەگمەنترین و بەهێزترین دڕندەی ئەفسانەیی لەسەر شاشە دەردەکەوێت',
    animClass: 'gift-anim-lightning',
  },
];
