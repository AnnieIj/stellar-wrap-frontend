"use client";

import { motion } from "framer-motion";
import { Calendar, Zap, Activity } from "lucide-react";
import type { BiggestDaySummary } from "@/app/utils/indexer";

interface BiggestDayCardProps {
  summary?: BiggestDaySummary;
}

export function BiggestDayCard({ summary }: BiggestDayCardProps) {
  if (!summary || !summary.date) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.0, type: "spring", stiffness: 100 }}
      className="mt-8 sm:mt-10 md:mt-12"
    >
      <h3 className="text-xs sm:text-sm font-black tracking-[0.25em] text-white/50 mb-3 sm:mb-4">
        YOUR BIGGEST DAY
      </h3>
      <div
        className="p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-white/10 backdrop-blur-md relative overflow-hidden group"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
      >
        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
          <Calendar className="w-24 h-24 text-white" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 shadow-lg"
              style={{ backgroundColor: "var(--color-theme-primary)" }}
            >
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-white">
                {summary.date}
              </h4>
              <p className="text-sm font-medium" style={{ color: "var(--color-theme-primary)" }}>
                {summary.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3 mb-6">
            <span className="text-4xl sm:text-5xl font-black text-white leading-none">
              {summary.transactionCount}
            </span>
            <span className="text-white/50 font-medium mb-1">transactions</span>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-white/40" />
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Top Activity
              </span>
            </div>
            <p className="text-sm sm:text-base text-white/90 font-medium">
              {summary.topActivity}
            </p>
          </div>

          <div className="text-sm text-white/50 italic">
            Insight: Your busiest days tend to be {summary.busiestDayOfWeek}.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
