"use client";

import { useEffect, useState } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Pure check for prefers-reduced-motion (safe for SSR — returns false when window is unavailable).
 */
export function getPrefersReducedMotion(
  mediaQueryList?: Pick<MediaQueryList, "matches"> | null,
): boolean {
  if (mediaQueryList) {
    return mediaQueryList.matches;
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * React hook that tracks `prefers-reduced-motion` and updates on change.
 * Use to disable or simplify non-essential continuous animations while
 * keeping progress/state changes visible.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return prefersReducedMotion;
}

/**
 * Returns a Framer Motion transition that is instant when reduced motion is on.
 * Core state/progress updates remain visible without decorative looping motion.
 */
export function reducedMotionTransition(
  prefersReducedMotion: boolean,
  transition: Record<string, unknown> = {},
): Record<string, unknown> {
  if (prefersReducedMotion) {
    return { ...transition, duration: 0, delay: 0, repeat: 0 };
  }
  return transition;
}
