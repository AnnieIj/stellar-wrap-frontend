"use client";

import { motion } from "framer-motion";
import type { WrapPeriod } from "@/app/store/wrapStore";

const PERIOD_OPTIONS: WrapPeriod[] = ["weekly", "monthly", "yearly"];

interface PeriodSelectorProps {
  value: WrapPeriod;
  onChange: (period: WrapPeriod) => void;
  /** Optional layout id prefix to avoid conflicts when multiple selectors are mounted. */
  layoutId?: string;
}

export function PeriodSelector({
  value,
  onChange,
  layoutId = "period-bg",
}: PeriodSelectorProps) {
  return (
    <nav aria-label="Timeframe">
      <div
        className="flex items-center gap-1 backdrop-blur-xl rounded-xl p-1 border border-white/10"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        role="radiogroup"
        aria-label="Select wrap period"
      >
        {PERIOD_OPTIONS.map((option) => (
          <motion.button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(option);
              }
            }}
            className="relative px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-black tracking-tight text-sm sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            role="radio"
            aria-checked={value === option}
            aria-label={`${option} period`}
          >
            {value === option && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg"
                style={{ backgroundColor: "var(--color-theme-primary)" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 uppercase ${
                value === option ? "text-black" : "text-white/50"
              }`}
            >
              {option}
            </span>
          </motion.button>
        ))}
      </div>
    </nav>
  );
}
