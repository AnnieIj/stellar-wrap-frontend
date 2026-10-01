"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/app/context/ThemeContext";

export interface CardPreviewProps {
  username: string;
  transactions: number;
  persona: string;
  topVibe: string;
  vibePercentage: number;
}

/**
 * Renders the animated share-card preview panel (the left column on desktop).
 *
 * This is a pure presentational component: it receives all data as props and
 * has no side-effects or store reads of its own.
 */
export function CardPreview({
  username,
  transactions,
  persona,
  topVibe,
  vibePercentage,
}: CardPreviewProps) {
  const t = useTranslations("ShareCard");
  const { mode } = useTheme();

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Entrance animation wrapper — purely decorative */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, rotateY: -20 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Card surface */}
      <div
        className="relative aspect-square rounded-[40px] overflow-hidden border backdrop-blur-xl"
        style={{
          borderColor:
            mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
          background:
            mode === "dark"
              ? `linear-gradient(to bottom right, rgba(var(--color-theme-primary-rgb), 0.2), rgba(0, 0, 0, 0.8))`
              : `linear-gradient(to bottom right, rgba(var(--color-theme-primary-rgb), 0.1), rgba(255, 255, 255, 0.95))`,
        }}
      >
        {/* Card header */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "var(--color-theme-primary)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs sm:text-sm font-black text-white/70 tracking-[0.2em] truncate">
              {t("stellarWrapped")}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 truncate">
            @{username}
          </h2>
        </div>

        {/* Stats */}
        <div className="px-6 sm:px-8 space-y-4">
          {/* Transactions */}
          <motion.div
            className="backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/10"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs sm:text-sm font-bold text-white/60 mb-2">
              {t("totalTransactions")}
            </p>
            <p className="text-4xl sm:text-6xl font-black text-white break-words">
              {transactions}
            </p>
          </motion.div>

          {/* Persona */}
          <motion.div
            className="backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/10"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-xs sm:text-sm font-bold text-white/60 mb-2">
              {t("persona")}
            </p>
            <p
              className="text-2xl sm:text-3xl font-black truncate"
              style={{
                background: `linear-gradient(to right, #ffffff, var(--color-theme-primary))`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {persona}
            </p>
          </motion.div>

          {/* Top vibe */}
          <motion.div
            className="backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/10"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-xs sm:text-sm font-bold text-white/60 mb-2">
              {t("topVibe")}
            </p>
            <p className="text-xl sm:text-2xl font-black text-white break-words">
              {vibePercentage}% {topVibe}
            </p>
          </motion.div>
        </div>

        {/* Card footer */}
        <div className="absolute bottom-6 sm:bottom-8 left-4 sm:left-8 right-4 sm:right-8 flex items-center justify-between gap-2">
          <div className="text-xs font-black text-white/50 truncate">
            stellar.org/wrapped
          </div>
          <motion.div
            className="w-10 h-10 rounded-xl backdrop-blur-sm flex items-center justify-center border border-white/20 shrink-0"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
            animate={{
              boxShadow: [
                `0 0 20px rgba(var(--color-theme-primary-rgb), 0)`,
                `0 0 30px rgba(var(--color-theme-primary-rgb), 0.5)`,
                `0 0 20px rgba(var(--color-theme-primary-rgb), 0)`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div
              className="w-5 h-5 rounded-lg"
              style={{ backgroundColor: "var(--color-theme-primary)" }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
