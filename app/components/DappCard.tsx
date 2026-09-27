"use client";

import { motion } from "framer-motion";
import type { KeyboardEvent } from "react";
import { formatDappDisplayName } from "@/app/utils/formatDappLabel";
import { DappIcon } from "@/app/components/DappIcon";

interface DappCardProps {
  rank: number;
  name: string;
  interactions: number;
  icon?: string;
  logo?: string;
  delay?: number;
}

export function DappCard({
  rank,
  name,
  interactions,
  icon,
  logo,
  delay = 0,
}: DappCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();

    const cards = Array.from<HTMLElement>(
      document.querySelectorAll('[data-dapp-card="true"]'),
    );
    const currentIndex = cards.indexOf(event.currentTarget);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex =
      event.key === "ArrowRight"
        ? Math.min(currentIndex + 1, cards.length - 1)
        : Math.max(currentIndex - 1, 0);

    cards[nextIndex]?.focus();
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.23, 1, 0.32, 1],
      }}
      role="button"
      tabIndex={0}
      aria-label={`${formatDappDisplayName(name)}. ${interactions} transactions.`}
      data-dapp-card="true"
      onKeyDown={handleKeyDown}
      className="group relative aspect-square rounded-[24px] overflow-hidden flex flex-col justify-end p-4 sm:p-5 md:p-6 lg:p-8 cursor-pointer border border-[#1DB954]/20 hover:border-[#1DB954]/50 transition-all duration-300 hover:shadow-[0_0_50px_rgba(29,185,84,0.25)] will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      style={{
        background:
          "linear-gradient(145deg, rgba(29,185,84,0.08) 0%, rgba(10,20,10,0.95) 100%)",
        transform: "translateZ(0)",
      }}
    >
      <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.02] origin-center pointer-events-none" />

      <div className="absolute inset-0 bg-[#1DB954] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

      <div
        className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity duration-500"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #1DB954 10px, #1DB954 11px)`,
        }}
      />

      <div className="absolute inset-0 rounded-[24px] shadow-[inset_0_0_60px_rgba(29,185,84,0.05)] group-hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.05)] transition-all duration-500" />

      <div className="absolute top-3 sm:top-4 md:top-5 right-3 sm:right-4 md:right-5">
        <DappIcon name={name} icon={icon} logo={logo} size="sm" />
      </div>

      <div className="absolute top-3 sm:top-4 md:top-5 left-3 sm:left-4 md:left-5">
        <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-black/80 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg">
          <span className="text-base sm:text-lg font-black text-white">
            {rank}
          </span>
        </div>
      </div>

      <div className="relative z-10 space-y-1 sm:space-y-1.5">
        <h3
          className="text-xl sm:text-2xl md:text-[28px] lg:text-[32px] font-black tracking-tight leading-none text-white drop-shadow-lg group-hover:drop-shadow-xl transition-all truncate"
          title={name}
        >
          {formatDappDisplayName(name)}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-lg sm:text-xl md:text-[20px] lg:text-[22px] font-black text-[#1DB954] group-hover:text-white transition-colors duration-300 tabular-nums">
            {interactions}
          </span>
          <span className="text-xs sm:text-sm md:text-[13px] lg:text-[14px] font-semibold text-white/40 group-hover:text-white/60 transition-colors duration-300 truncate">
            transactions
          </span>
        </div>
      </div>

      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-[#1DB954]/20 blur-[40px] rounded-full pointer-events-none opacity-60 group-hover:opacity-0 transition-opacity duration-500" />
    </motion.div>
  );
}
