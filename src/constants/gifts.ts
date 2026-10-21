export type GiftTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type GiftIconKey =
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
 * TikTok-Style Luxury Animated Gift Collection
 * Each gift uses a unique pure-CSS animation — no external images or GIFs.
 * Gifts are ordered from cheapest to most expensive (like TikTok).
 */
export const AVAILABLE_GIFTS: GiftItem[] = [
  {
    id: 'heart-me',
    name: 'Heart Me',
    iconKey: 'heart-me',
    cost: 1,
    color: 'text-pink-400',
    tier: 'common',
    description: 'A cute bouncing heart',
    animClass: 'gift-anim-heartbeat',
  },
  {
    id: 'rose',
    name: 'Velvet Rose',
    iconKey: 'rose',
    cost: 10,
    color: 'text-rose-400',
    tier: 'common',
    description: 'A delicate rose blooming with warmth',
    animClass: 'gift-anim-bloom',
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
    name: 'Sports Car',
    iconKey: 'sports-car',
    cost: 7000,
    color: 'text-rose-500',
    tier: 'epic',
    description: 'A pink supercar drifting across the stage',
    animClass: 'gift-anim-drive',
  },
  {
    id: 'lion',
    name: 'Golden Lion',
    iconKey: 'lion',
    cost: 10000,
    color: 'text-amber-400',
    tier: 'epic',
    description: 'The king of the arena roars to life',
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
    name: 'White Tiger',
    iconKey: 'white-tiger',
    cost: 99999,
    color: 'text-sky-300',
    tier: 'mythic',
    description: 'The rarest mythical beast descends on stage',
    animClass: 'gift-anim-lightning',
  },
];
