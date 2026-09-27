"use client";

import { Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import { useSoundStore } from "../store/soundStore";

interface MuteToggleProps {
  className?: string;
}

export function MuteToggle({ className }: MuteToggleProps) {
  const isMuted = useSoundStore((state) => state.isMuted);
  const toggleMute = useSoundStore((state) => state.toggleMute);

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={toggleMute}
      className={`p-3 rounded-full bg-black/50 border backdrop-blur-xl transition-all shadow-[0_0_20px_rgba(29,185,84,0.15)] ${
        isMuted
          ? "border-white/10 hover:bg-white/10 hover:border-white/20"
          : "border-[#1DB954]/30 hover:bg-[#1DB954]/10 hover:border-[#1DB954]/50"
      } ${className || ""}`}
      aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
      aria-pressed={isMuted}
    >
      {isMuted ? (
        <VolumeX className="w-5 h-5 text-white/70" aria-hidden="true" />
      ) : (
        <Volume2 className="w-5 h-5 text-[#1DB954]" aria-hidden="true" />
      )}
    </motion.button>
  );
}
