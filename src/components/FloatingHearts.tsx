import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface FloatingHeart {
  id: number;
  x: number;
  color: string;
  size: number;
}

const HEART_COLORS = [
  '#ff4081', // pink
  '#f50057', // rose
  '#ff1744', // red
  '#e040fb', // purple
  '#00e5ff', // cyan
  '#ffd600', // gold
  '#00e676', // emerald
];

export default function FloatingHearts() {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const addHeart = useCallback(() => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: Math.random() * 60 - 30, // random drift -30 to +30px
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      size: 16 + Math.floor(Math.random() * 12), // 16 to 28px
    };

    setHearts((prev) => [...prev.slice(-25), newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2000);
  }, []);

  return (
    <>
      {/* Floating Hearts Container */}
      <div className="pointer-events-none fixed bottom-20 right-6 z-40 h-72 w-28 overflow-hidden">
        <AnimatePresence>
          {hearts.map((heart) => (
            <motion.div
              key={heart.id}
              initial={{ y: 220, x: heart.x, opacity: 1, scale: 0.6 }}
              animate={{
                y: -40,
                x: heart.x + (Math.random() * 40 - 20),
                opacity: [1, 1, 0.8, 0],
                scale: [0.6, 1.2, 1],
                rotate: [0, (Math.random() - 0.5) * 45],
              }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              className="absolute bottom-0 right-4"
              style={{ color: heart.color }}
            >
              <Heart
                size={heart.size}
                fill={heart.color}
                stroke={heart.color}
                className="drop-shadow-[0_0_8px_currentColor]"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Heart Tap Button (Bottom Right) */}
      <button
        type="button"
        onClick={addHeart}
        className="fixed bottom-16 right-3.5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-pink-500/40 bg-gradient-to-tr from-rose-500 to-pink-600 text-white shadow-lg shadow-pink-500/30 transition-transform active:scale-80 hover:scale-105"
        title="Tap to send hearts"
      >
        <Heart className="h-5 w-5 fill-white animate-pulse" />
      </button>
    </>
  );
}
