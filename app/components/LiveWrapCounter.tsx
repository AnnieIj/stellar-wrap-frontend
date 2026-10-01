"use client";

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LiveWrapCounterProps {
  className?: string;
}

export function LiveWrapCounter({ className }: LiveWrapCounterProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [targetCount, setTargetCount] = useState(0);
  const [walletCount, setWalletCount] = useState(0);
  const count = useMotionValue(0);
  const [displayCount, setDisplayCount] = useState(0);

  // Format numbers with commas
  const formatNumber = (num: number) => num.toLocaleString();

  // Load from localStorage on initial mount
  useEffect(() => {
    const storedCount = localStorage.getItem('stellarWrap_totalWraps');
    if (storedCount) {
      setTargetCount(parseInt(storedCount, 10) || 12847);
    } else {
      setTargetCount(12847); // Default fallback value
    }
    setWalletCount(3241); // Default wallet count
  }, []);

  // Update displayCount as count animates
  useEffect(() => {
    const unsubscribe = count.onChange((latest) => {
      setDisplayCount(Math.round(latest));
    });
    return unsubscribe;
  }, [count]);

  // Animate count when target changes
  useEffect(() => {
    if (targetCount > 0) {
      const controls = animate(count, targetCount, {
        duration: 2,
        ease: 'easeOut',
        onComplete: () => setIsLoading(false),
      });
      return controls.stop;
    }
  }, [count, targetCount]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate fetching new count (increment by 1-3 for demo)
      const increment = Math.floor(Math.random() * 3) + 1;
      const newCount = targetCount + increment;
      setTargetCount(newCount);
      localStorage.setItem('stellarWrap_totalWraps', newCount.toString());
    }, 30000);

    return () => clearInterval(interval);
  }, [targetCount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className={`flex flex-col items-center gap-2 mt-4 md:mt-6 ${className}`}
    >
      <div className="flex items-center gap-2">
        <motion.div
          className="w-2 h-2 md:w-3 md:h-3 rounded-full"
          style={{ backgroundColor: 'var(--color-theme-primary)' }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        />
        <span className="text-xs md:text-sm font-black tracking-[0.2em] md:tracking-[0.3em] text-white/70">SOCIAL PROOF</span>
      </div>

      {isLoading ? (
        // Skeleton loading state
        <div className="flex flex-col items-center gap-1">
          <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
      ) : (
        // Actual counter
        <div className="flex flex-col items-center gap-1">
          <motion.div className="relative">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-white">
              <span>{formatNumber(displayCount)}</span>{" "}
              <span className="text-theme-primary">wraps</span> generated
            </h2>
          </motion.div>
          <p className="text-xs sm:text-sm font-medium text-white/40">
            across {formatNumber(walletCount)} unique wallets
          </p>
        </div>
      )}
    </motion.div>
  );
}
