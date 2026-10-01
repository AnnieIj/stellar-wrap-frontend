"use client";

import { motion } from "framer-motion";
import { DexTradingSummary as DexTradingSummaryType } from "@/app/utils/indexer";

interface DexTradingSummaryProps {
  summary?: DexTradingSummaryType;
}

export function DexTradingSummary({ summary }: DexTradingSummaryProps) {
  const hasActivity = summary && summary.tradeCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
      className="mt-6 sm:mt-8"
    >
      <h3 className="mb-3 text-xs font-black tracking-[0.25em] text-white/50 sm:mb-4 sm:text-sm">
        DEY TRADING SUMMARY
      </h3>
      <div className="relative rounded-xl border border-white/10 p-4 backdrop-blur-sm sm:rounded-2xl sm:p-5 md:p-6">
        <motion.div
          className="absolute -inset-1 rounded-xl opacity-0 blur-md transition-opacity group-hover:opacity-50 sm:-inset-2 sm:rounded-2xl"
          style={{ backgroundColor: "var(--color-theme-primary)" }}
        />
        <div className="relative space-y-4">
          {hasActivity ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/70">Total Volume</span>
                <span className="text-lg font-black text-white sm:text-xl">
                  {summary.totalVolume.toFixed(2)} XLM
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/70">Total Trades</span>
                <span className="text-lg font-black text-white sm:text-xl">
                  {summary.tradeCount}
                </span>
              </div>
              {summary.mostTradedPair && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/70">Most Traded Pair</span>
                  <span className="text-right text-base font-bold text-white sm:text-lg">
                    {summary.mostTradedPair}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/70">Buy vs Sell</span>
                  <span className="text-sm font-medium text-white/70">
                    {summary.buyCount} Buy / {summary.sellCount} Sell
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        summary.tradeCount > 0 ? (summary.buyCount / summary.tradeCount) * 100 : 0
                      }%`,
                    }}
                    transition={{ delay: 0.9, duration: 0.6 }}
                    className="h-full bg-green-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        summary.tradeCount > 0 ? (summary.sellCount / summary.tradeCount) * 100 : 0
                      }%`,
                    }}
                    transition={{ delay: 0.9, duration: 0.6 }}
                    className="h-full bg-red-500"
                  />
                </div>
              </div>
              <div className="text-xs text-white/40 italic">P&L coming soon</div>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="mb-2 text-white/70">No DEX trades this period — try StellarX!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
