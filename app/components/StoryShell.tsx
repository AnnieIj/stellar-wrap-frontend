"use client";

import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Home, Share2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
const MuteToggle = lazy(() => import("./MuteToggle").then((m) => ({ default: m.MuteToggle })));
import { useReducedMotion, reducedMotionTransition } from "@/app/hooks/useReducedMotion";
import {
  STORY_SEGMENT_COUNT,
  getStorySegmentClassName,
  getStorySegmentLabel,
  getStorySegmentVisualState,
} from "./storyShellProgress";

const ThemeSelector = lazy(() =>
  import("./ThemeSelector").then((module) => ({ default: module.ThemeSelector }))
);

interface StoryShellProps {
  children: ReactNode;
  activeSegment?: number;
}

export function StoryShell({ children, activeSegment = 1 }: StoryShellProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const segmentLabel = getStorySegmentLabel(activeSegment);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(
      () => {
        const heading = document.querySelector<HTMLElement>(
          '[data-story-heading="true"], h1, h2, h3'
        );
        if (!heading) return;
        if (!heading.hasAttribute("tabindex")) {
          heading.setAttribute("tabindex", "-1");
        }
        heading.focus({ preventScroll: true });
      },
      prefersReducedMotion ? 0 : 100
    );

    return () => window.clearTimeout(id);
  }, [activeSegment, prefersReducedMotion]);

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] font-sans text-white"
      style={{ touchAction: "pan-y" }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40"
        aria-hidden="true"
      />

      <div className="absolute inset-0 opacity-[0.08]" aria-hidden="true">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <pattern id="hexagons" width="60" height="52" patternUnits="userSpaceOnUse">
              <path
                d="M30 0 L55.98 15 L55.98 45 L30 60 L4.02 45 L4.02 15 Z"
                fill="none"
                stroke="#1DB954"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexagons)" />
        </svg>
      </div>

      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(29,185,84,0.02) 2px, rgba(29,185,84,0.02) 4px)",
        }}
        animate={prefersReducedMotion ? undefined : { backgroundPosition: ["0px 0px", "0px 4px"] }}
        transition={reducedMotionTransition(prefersReducedMotion, {
          duration: 0.15,
          repeat: Infinity,
          ease: "linear",
        })}
      />

      <motion.div
        className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full blur-[200px]"
        aria-hidden="true"
        style={{ backgroundColor: "rgba(29, 185, 84, 0.08)" }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.1, scale: 1 }
            : {
                scale: [1, 1.15, 1],
                opacity: [0.08, 0.15, 0.08],
              }
        }
        transition={reducedMotionTransition(prefersReducedMotion, {
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        })}
      />

      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/4 h-[400px] w-[600px] rounded-full blur-[150px]"
        aria-hidden="true"
        style={{ backgroundColor: "rgba(29, 185, 84, 0.06)" }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.08, scale: 1 }
            : {
                scale: [1, 1.2, 1],
                opacity: [0.06, 0.12, 0.06],
              }
        }
        transition={reducedMotionTransition(prefersReducedMotion, {
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        })}
      />

      {/* Top Controls */}
      <div className="relative z-50 flex items-center justify-between gap-3 overflow-x-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-12">
        {/* Home Button */}
        <motion.button
          type="button"
          initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reducedMotionTransition(prefersReducedMotion, {
            delay: 0.2,
          })}
          onClick={() => router.push("/")}
          className="group flex shrink-0 items-center gap-2 rounded-xl border border-[#1DB954]/30 bg-black/50 px-3 py-2 backdrop-blur-xl"
          aria-label="Go to home page"
        >
          <Home className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
          <span>Home</span>
        </motion.button>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotionTransition(prefersReducedMotion, {
            delay: 0.3,
          })}
          className="flex shrink-0 items-center gap-1.5"
          role="progressbar"
          aria-valuenow={activeSegment + 1}
          aria-valuemin={1}
          aria-valuemax={STORY_SEGMENT_COUNT}
        >
          {[...Array(STORY_SEGMENT_COUNT)].map((_, i) => (
            <motion.div
              key={i}
              aria-hidden="true"
              initial={prefersReducedMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={reducedMotionTransition(prefersReducedMotion, {
                delay: 0.4 + i * 0.05,
              })}
              className={`h-1.5 origin-left rounded-full transition-all duration-500 ${
                i === activeSegment
                  ? "w-12 bg-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.8)] sm:w-16"
                  : i < activeSegment
                    ? "w-6 bg-[#1DB954]/50 sm:w-8"
                    : "w-6 bg-white/15 sm:w-8"
              }`}
            />
          ))}
        </motion.div>

        <div className="flex shrink-0 items-center gap-2">
          <Suspense fallback={null}>
            <MuteToggle />
          </Suspense>
          {/* Palette Button */}
          <motion.button
            type="button"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reducedMotionTransition(prefersReducedMotion, {
              delay: 0.35,
            })}
            className="rounded-full border border-[#1DB954]/30 bg-black/50 p-3 shadow-[0_0_20px_rgba(29,185,84,0.15)] backdrop-blur-xl transition-all hover:border-[#1DB954]/50 hover:bg-[#1DB954]/10"
            onClick={() => setIsThemeSelectorOpen((open) => !open)}
            aria-expanded={isThemeSelectorOpen}
            aria-label="Open color theme picker"
          >
            <ColorToggle />
          </motion.button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {segmentLabel}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <Suspense fallback={null}>{isThemeSelectorOpen && <ThemeSelector />}</Suspense>
        <Suspense fallback={null}>{children}</Suspense>
      </div>

      <div className="relative z-50 flex items-center justify-between gap-4 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-12">
        <motion.button
          type="button"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotionTransition(prefersReducedMotion, {
            delay: 0.5,
          })}
          aria-label="Share wrap"
        >
          <Share2 className="h-5 w-5 text-white/70" aria-hidden="true" />
        </motion.button>
        <motion.button
          type="button"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotionTransition(prefersReducedMotion, {
            delay: 0.5,
          })}
          aria-label="Next story segment"
        >
          <ChevronRight
            className="h-6 w-6 text-white/70 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </motion.button>
      </div>
    </div>
  );
}
