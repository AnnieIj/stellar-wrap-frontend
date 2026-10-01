"use client";

import Image from "next/image";
import { resolveDappVisual } from "@/app/services/assetResolver";

interface DappIconProps {
  name: string;
  icon?: string;
  logo?: string;
  className?: string;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 sm:w-10 sm:h-10 text-sm",
};

export function DappIcon({
  name,
  icon,
  logo,
  className = "",
  size = "md",
}: DappIconProps) {
  const visual = resolveDappVisual(name, { icon, logo });
  const box = `rounded-lg flex items-center justify-center shrink-0 border border-white/20 font-black text-white ${sizeClasses[size]} ${className}`;

  if (visual.type === "logo") {
    return (
      <div className={`relative overflow-hidden ${box}`}>
        <Image
          src={visual.logoUrl}
          alt=""
          fill
          className="object-cover"
          sizes="40px"
          unoptimized
        />
      </div>
    );
  }

  if (visual.type === "emoji") {
    return (
      <div className={`${box} bg-black/40`} aria-hidden>
        <span className="leading-none">{visual.emoji}</span>
      </div>
    );
  }

  return (
    <div
      className={box}
      style={{ backgroundColor: visual.backgroundColor }}
      aria-label={name}
    >
      {visual.initials}
    </div>
  );
}
