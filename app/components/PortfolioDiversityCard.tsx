"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PieChart } from "lucide-react";
import type { PortfolioDiversitySummary } from "@/app/utils/indexer";

interface PortfolioDiversityCardProps {
  summary?: PortfolioDiversitySummary;
}

export function PortfolioDiversityCard({
  summary,
}: PortfolioDiversityCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView && summary) {
      const duration = 2000; // 2 seconds
      const steps = 60;
      const stepTime = duration / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        // Ease out quad
        const easeOut = 1 - (1 - progress) * (1 - progress);
        setDisplayScore(Math.round(easeOut * summary.score));

        if (currentStep >= steps) {
          clearInterval(timer);
          setDisplayScore(summary.score);
        }
      }, stepTime);

      return () => clearInterval(timer);
    }
  }, [isInView, summary]);

  if (!summary || summary.uniqueAssetsCount === 0) return null;

  // Calculate dash array for progress ring
  const circleRadius = 40;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, type: "spring", stiffness: 120 }}
      className="mt-8 sm:mt-10 md:mt-12"
    >
      <h3
        id="portfolio-diversity-heading"
        className="mb-3 text-xs font-black tracking-[0.25em] text-white/50 sm:mb-4 sm:text-sm"
      >
        PORTFOLIO DIVERSITY
      </h3>
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md sm:rounded-3xl sm:p-6 md:p-8"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          {/* Circular Gauge */}
          <div
            className="relative flex h-32 w-32 flex-shrink-0 items-center justify-center"
            role="progressbar"
            aria-labelledby="portfolio-diversity-heading"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayScore}
          >
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                fill="transparent"
                className="stroke-white/10"
                strokeWidth="8"
              />
              <motion.circle
                cx="50"
                cy="50"
                r={circleRadius}
                fill="transparent"
                className="stroke-[var(--color-theme-primary)]"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white">{displayScore}</span>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
              <PieChart className="w-5 h-5 text-white/70" />
              <h4 className="text-xl sm:text-2xl font-bold text-white">
                {summary.label}
              </h4>
            </div>
            <p className="text-white/60 text-sm sm:text-base mb-4 text-center sm:text-left">
              You interacted with {summary.uniqueAssetsCount} unique assets this period.
            </p>

            {summary.topAssets.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 text-center sm:text-left">
                  Top Assets
                </div>
                {summary.topAssets.map((asset, idx) => (
                  <div key={asset.assetCode} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full bg-[var(--color-theme-primary)] ${
                          ["opacity-100", "opacity-70", "opacity-40", "opacity-10"][idx] ?? "opacity-10"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-white/90">{asset.assetCode}</span>
                    </div>
                    <span className="text-sm font-bold text-white/70">{asset.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
