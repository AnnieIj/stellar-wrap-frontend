"use client";

import React from "react";
import { motion } from "framer-motion";

/** Mock archetype distribution — replaced by on-chain data when available. */
const MOCK_DISTRIBUTION: Record<string, number> = {
  "The Wizard": 3,
  "The DeFi Patron": 18,
  "The Diamond Hand": 22,
  "The Soroban Architect": 7,
  "The Network Pioneer": 14,
  "The NFT Collector": 11,
  "The Power Trader": 25,
};

interface PersonaRarityChartProps {
  /** The user's current archetype, e.g. "The Wizard" */
  userArchetype: string;
  /**
   * On-chain distribution data. Keys are archetype names, values are
   * percentages (0–100). When null the component shows a placeholder.
   */
  distribution?: Record<string, number> | null;
}

export function PersonaRarityChart({
  userArchetype,
  distribution = null,
}: PersonaRarityChartProps) {
  const data = distribution ?? MOCK_DISTRIBUTION;
  const userPct = data[userArchetype] ?? null;

  if (distribution === null && !MOCK_DISTRIBUTION[userArchetype]) {
    // Archetype not in mock — show placeholder
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-sm text-white/50">
        Comparison available after minting
      </div>
    );
  }

  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
  const maxPct = Math.max(...Object.values(data));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-5 sm:p-7"
    >
      <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-white/50">
        How rare is your persona?
      </h2>
      {userPct !== null && (
        <p className="mb-5 text-lg font-black text-white">
          You are one of{" "}
          <span style={{ color: "var(--color-theme-primary)" }}>
            {userPct}%
          </span>{" "}
          of users with this archetype
        </p>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map(([archetype, pct], i) => {
          const isUser = archetype === userArchetype;
          return (
            <div key={archetype}>
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span
                  className={isUser ? "text-white" : "text-white/50"}
                  aria-label={isUser ? `${archetype} (your archetype)` : archetype}
                >
                  {archetype}
                  {isUser && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                      style={{ background: "var(--color-theme-primary)", color: "#000" }}>
                      You
                    </span>
                  )}
                </span>
                <span className={isUser ? "text-white" : "text-white/40"}>
                  {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: isUser
                      ? "var(--color-theme-primary)"
                      : "rgba(255,255,255,0.2)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(pct / maxPct) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.4 + i * 0.06, ease: "easeOut" }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {distribution === null && (
        <p className="mt-4 text-center text-xs text-white/30">
          * Based on estimated community data. Live stats available after minting.
        </p>
      )}
    </motion.div>
  );
}
