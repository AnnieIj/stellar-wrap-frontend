"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { soundManager } from "../utils/soundManager";
import { useSoundStore } from "../store/soundStore";
import { logger } from "@/app/utils/logger";

const log = logger.child("SoundManager");

export function SoundManager() {
  const pathname = usePathname();
  const isMuted = useSoundStore((state) => state.isMuted);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (isInitializingRef.current) return;
    
    const isStoryFlow = pathname !== "/";
    
    if (pathname === "/") {
      soundManager.stopBackgroundMusic();
      return;
    }
    
    if (isStoryFlow) {
      if (isMuted) {
        soundManager.pauseBackgroundMusic();
      } else {
        isInitializingRef.current = true;
        soundManager.startBackgroundMusic()
          .catch((error) => {
            log.warn("Failed to start background music:", error);
          })
          .finally(() => {
            isInitializingRef.current = false;
          });
      }
    }
  }, [pathname, isMuted]);

  return null;
}

