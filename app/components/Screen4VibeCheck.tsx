"use client";

import { motion } from 'framer-motion';
import { lazy, Suspense, useMemo } from 'react';
import { TrendingUp, Palette, Code } from 'lucide-react';
import { formatDappDisplayName } from '@/app/utils/formatDappLabel';
import type { DexTradingSummary as DexTradingSummaryType, SorobanBuilderSummary as SorobanBuilderSummaryType, PortfolioDiversitySummary, BiggestDaySummary, NftActivitySummary } from '@/app/utils/indexer';

const DappIcon = lazy(() =>
  import('@/app/components/DappIcon').then(m => ({ default: m.DappIcon }))
);

const DexTradingSummary = lazy(() =>
  import('./DexTradingSummary').then(m => ({ default: m.DexTradingSummary }))
);

const SorobanBuilderTimeline = lazy(() =>
  import('./SorobanBuilderTimeline').then(m => ({ default: m.SorobanBuilderTimeline }))
);

const PortfolioDiversityCard = lazy(() =>
  import('./PortfolioDiversityCard').then(m => ({ default: m.PortfolioDiversityCard }))
);

const BiggestDayCard = lazy(() =>
  import('./BiggestDayCard').then(m => ({ default: m.BiggestDayCard }))
);

const NftActivityCard = lazy(() =>
  import('./NftActivityCard').then(m => ({ default: m.NftActivityCard }))
);

type VibeIconKey = 'defi' | 'nft' | 'dev';

interface VibeData {
  type: VibeIconKey | string;
  percentage: number;
  color: string;
  label: string;
}

interface TopDappItem {
  name: string;
  interactions: number;
  icon?: string;
  logo?: string;
}

interface Screen4VibeCheckProps {
  vibes: VibeData[];
  dapps?: TopDappItem[];
  dexTradingSummary?: DexTradingSummaryType;
  sorobanBuilderSummary?: SorobanBuilderSummaryType;
  portfolioDiversitySummary?: PortfolioDiversitySummary;
  biggestDaySummary?: BiggestDaySummary;
  nftActivitySummary?: NftActivitySummary;
}

const TOP_DAPPS_LIMIT = 5;

const vibeIcons: Record<VibeIconKey, React.ComponentType<{ className?: string }>> = {
  defi: TrendingUp,
  nft: Palette,
  dev: Code,
};

export function Screen4VibeCheck({
  vibes,
  dapps = [],
  dexTradingSummary,
  sorobanBuilderSummary,
  portfolioDiversitySummary,
  biggestDaySummary,
  nftActivitySummary,
}: Screen4VibeCheckProps) {
  const topDapps = useMemo(
    () => [...dapps].sort((a, b) => b.interactions - a.interactions).slice(0, TOP_DAPPS_LIMIT),
    [dapps],
  );

  const blobShapes = useMemo(
    () =>
      vibes.map((vibe, index) => {
        const baseSize = (vibe.percentage / 100) * 250 + 100;
        return {
          ...vibe,
          size: baseSize,
          x: (index - 1) * 200,
          y: 0,
          rotate: 30 * index,
        };
      }),
    [vibes]
  );

  const blobAnimationDurations = useMemo(
    () => blobShapes.map((_, index) => 4 + (index % 3)),
    [blobShapes]
  );

  return (
    <div className="relative w-full h-full overflow-hidden flex bg-theme-background">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-black opacity-60" />
      
      {/* Hexagon pattern */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="h-full w-full vibe-check-pattern"
        />
      </div>

      {/* Content container */}
      <div className="relative z-10 w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-16 w-full items-center">
          {/* Left: Title and Stats */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 sm:mb-12 md:mb-16"
            >
              <h1
                data-story-heading="true"
                tabIndex={-1}
                className="font-black tracking-tight leading-none focus:outline-none"
              >
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white/90 mb-2 md:mb-3">
                  VIBE
                </span>
                <span
                  className="block bg-gradient-to-r from-white to-[var(--color-theme-primary)] bg-clip-text text-5xl text-transparent sm:text-6xl md:text-7xl lg:text-8xl"
                >
                  CHECK
                </span>
              </h1>
            </motion.div>

            <div className="space-y-3 sm:space-y-4 md:space-y-6">
              {vibes.map((vibe, index) => {
                const Icon = vibeIcons[vibe.type as VibeIconKey] ?? TrendingUp;
                return (
                  <motion.div
                    key={vibe.type}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.15 }}
                    whileHover={{ x: 10, transition: { duration: 0.2 } }}
                    className="group"
                  >
                    <div className="relative">
                      <motion.div
                        className="absolute -inset-1 rounded-xl bg-[var(--color-theme-primary)] opacity-0 blur-md transition-opacity group-hover:opacity-50 sm:-inset-2 sm:rounded-2xl"
                      />
                      <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm sm:rounded-2xl sm:p-5 md:p-6"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                          <motion.div 
                            className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white/30 bg-[var(--color-theme-primary)] sm:h-12 sm:w-12 sm:rounded-xl"
                            animate={{
                              boxShadow: [
                                `0 0 10px rgba(var(--color-theme-primary-rgb), 0.3)`,
                                `0 0 20px rgba(var(--color-theme-primary-rgb), 0.5)`,
                                `0 0 10px rgba(var(--color-theme-primary-rgb), 0.3)`,
                              ],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: index * 0.3,
                            }}
                          >
                            <Icon
                              className="w-5 h-5 sm:w-6 sm:h-6 text-black"
                              aria-hidden="true"
                            />
                          </motion.div>
                          <span className="text-lg sm:text-xl md:text-2xl font-black text-white">
                            {vibe.label}
                          </span>
                        </div>
                        <motion.span 
                          className="text-3xl sm:text-4xl md:text-5xl font-black text-white"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ 
                            delay: 0.7 + index * 0.15,
                            type: "spring",
                            stiffness: 200
                          }}
                        >
                          {vibe.percentage}%
                        </motion.span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Loading summary data"
                  className="mt-8 h-80 rounded-xl border border-white/10 bg-white/5 animate-pulse"
                />
              }
            >
            {topDapps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
                className="mt-8 sm:mt-10 md:mt-12"
              >
                <h3 className="text-xs sm:text-sm font-black tracking-[0.25em] text-white/50 mb-3 sm:mb-4">
                  TOP DAPPS
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {topDapps.map((dapp, index) => (
                    <motion.div
                      key={dapp.name}
                      initial={{ opacity: 0, x: -40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.95 + index * 0.1,
                        type: 'spring',
                        stiffness: 120,
                        damping: 18,
                      }}
                      className="group"
                    >
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm sm:rounded-2xl sm:p-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <DappIcon
                            name={dapp.name}
                            icon={dapp.icon}
                            logo={dapp.logo}
                            size="sm"
                          />
                          <span
                            className="text-sm sm:text-base font-bold text-white truncate"
                            title={dapp.name}
                          >
                            {formatDappDisplayName(dapp.name)}
                          </span>
                        </div>
                        <span className="text-sm sm:text-base font-black text-white/70 shrink-0 tabular-nums">
                          {dapp.interactions.toLocaleString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {portfolioDiversitySummary && (
              <PortfolioDiversityCard summary={portfolioDiversitySummary} />
            )}
            <NftActivityCard summary={nftActivitySummary} />
            <BiggestDayCard summary={biggestDaySummary} />
            <DexTradingSummary summary={dexTradingSummary} />
            <SorobanBuilderTimeline summary={sorobanBuilderSummary} />
            </Suspense>
            </div>
          </div>

          {/* Right: Visualization */}
          <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] flex items-center justify-center mt-6 sm:mt-8 md:mt-10 lg:mt-0 mx-auto max-w-md sm:max-w-lg">
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-[rgba(var(--color-theme-primary-rgb),0.2)]"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 1 }}
            />
            <motion.div
              className="absolute inset-12 rounded-full border border-[rgba(var(--color-theme-primary-rgb),0.1)]"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
            />

            {/* Animated blobs with icons */}
            <div className="relative w-full h-full flex items-center justify-center">
              {blobShapes.map((blob, index) => {
                const Icon = vibeIcons[blob.type as VibeIconKey] ?? TrendingUp;
                return (
                  <motion.div
                    key={blob.type}
                    className={`absolute ${
                      ["-translate-x-full", "translate-x-0", "translate-x-full"][index] ?? "translate-x-0"
                    }`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                    }}
                    transition={{
                      delay: 0.5 + index * 0.2,
                      type: "spring",
                      stiffness: 50,
                    }}
                  >
                    <motion.div
                      className={`relative flex rounded-full items-center justify-center ${
                        blob.size >= 300 ? "size-80" : blob.size >= 250 ? "size-72" : blob.size >= 200 ? "size-64" : "size-52"
                      }`}
                      animate={{
                        y: [0, -30, 0],
                        x: [0, Math.sin(index) * 20, 0],
                        scale: [1, 1.1, 1],
                        rotate: [blob.rotate, blob.rotate + 15, blob.rotate],
                      }}
                      transition={{
                        duration: blobAnimationDurations[index] ?? 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.5,
                      }}
                    >
                      {/* Reduced blur background */}
                      <div 
                        className="absolute inset-0 rounded-full bg-[var(--color-theme-primary)] opacity-60 blur-[20px]"
                      />
                      
                      {/* Icon in center */}
                      <div
                        className={`relative z-10 flex items-center justify-center ${
                          blob.size >= 300 ? "size-24" : blob.size >= 250 ? "size-20" : blob.size >= 200 ? "size-16" : "size-14"
                        }`}
                      >
                        <Icon
                          className="text-white w-full h-full"
                          aria-hidden="true"
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}

              {/* Center glow - reduced blur */}
              <motion.div
                className="absolute h-32 w-32 rounded-full border border-white/30 bg-white/20 backdrop-blur-xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring", stiffness: 200 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-[var(--color-theme-primary)] opacity-50 blur-md"
                  animate={{
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Screen4VibeCheck;
