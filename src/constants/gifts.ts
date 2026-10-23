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
}

/**
 * Luxury Video-FX Animated Gift Collection
 * Ordered from 1 Coin (Teapot pouring tea into a glass) to 99,999 Coins.
 */
export const AVAILABLE_GIFTS: GiftItem[] = [
  {
    id: 'teapot',
    name: 'Rebaz',
    iconKey: 'teapot',
    cost: 1,
    color: 'text-amber-400',
    tier: 'common',
    description: 'قۆری چای گەرم کە چای تێدەکاتە ناو پیاڵەی چای',
    animClass: 'gift-anim-bloom',
  },
  {
    id: 'heart-me',
    name: 'Heart Me',
    iconKey: 'heart-me',
    cost: 5,
    color: 'text-pink-400',
    tier: 'common',
    description: 'A cute bouncing heart',
    animClass: 'gift-anim-heartbeat',
  },
  {
    id: 'neon-heart',
    name: 'Neon Heart',
    iconKey: 'neon-heart',
    cost: 50,
    color: 'text-pink-500',
    tier: 'common',
    description: 'A glowing neon heart pulsing with energy',
    animClass: 'gift-anim-neon-pulse',
  },
  {
    id: 'fire',
    name: 'Sacred Flame',
    iconKey: 'fire',
    cost: 100,
    color: 'text-orange-400',
    tier: 'rare',
    description: 'An eternal flame burning bright',
    animClass: 'gift-anim-flicker',
  },
  {
    id: 'diamond',
    name: 'Blue Diamond',
    iconKey: 'diamond',
    cost: 500,
    color: 'text-cyan-400',
    tier: 'rare',
    description: 'A radiant gemstone of prestige',
    animClass: 'gift-anim-sparkle',
  },
  {
    id: 'sports-car',
    name: 'Supercar Drift',
    iconKey: 'sports-car',
    cost: 7000,
    color: 'text-rose-500',
    tier: 'epic',
    description: 'Nitro supercar drifting across the stage with fire',
    animClass: 'gift-anim-drive',
  },
  {
    id: 'lion',
    name: 'TikTok Fire Lion',
    iconKey: 'lion',
    cost: 10000,
    color: 'text-amber-400',
    tier: 'legendary',
    description: 'شێری ئاگرین نەڕەی دێت و ئاگری لێ هەڵدەستێت',
    animClass: 'gift-anim-roar',
  },
  {
    id: 'rocket',
    name: 'Orbital Rocket',
    iconKey: 'rocket',
    cost: 15000,
    color: 'text-violet-400',
    tier: 'epic',
    description: 'Launches into the stratosphere with a sonic boom',
    animClass: 'gift-anim-launch',
  },
  {
    id: 'nebula',
    name: 'Rosa Nebula',
    iconKey: 'nebula',
    cost: 20000,
    color: 'text-fuchsia-400',
    tier: 'legendary',
    description: 'A cosmic rose nebula swirling in space',
    animClass: 'gift-anim-orbit',
  },
  {
    id: 'crown',
    name: 'Imperial Crown',
    iconKey: 'crown',
    cost: 25000,
    color: 'text-yellow-400',
    tier: 'legendary',
    description: 'The supreme symbol of venue royalty',
    animClass: 'gift-anim-crown-glow',
  },
  {
    id: 'interstellar',
    name: 'Interstellar',
    iconKey: 'interstellar',
    cost: 50000,
    color: 'text-indigo-400',
    tier: 'mythic',
    description: 'A voyage across the galaxy itself',
    animClass: 'gift-anim-warp',
  },
  {
    id: 'white-tiger',
    name: 'Thunder Tiger',
    iconKey: 'white-tiger',
    cost: 99999,
    color: 'text-sky-300',
    tier: 'mythic',
    description: 'The rarest mythical lightning beast descends on stage',
    animClass: 'gift-anim-lightning',
  },
];
