"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect, lazy, Suspense, KeyboardEvent } from "react";
import { useSound } from "../hooks/useSound";
import { SOUND_NAMES } from "../utils/soundManager";

const HomeIcon = lazy(() => import("lucide-react/icons/home"));

const ArrowRightIcon = lazy(() => import("lucide-react/icons/arrow-right"));

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onNext?: () => void;
  showNext?: boolean;
  routes?: string[]; // Optional array of routes for each step (1-indexed)
}

// Default route mapping based on the app flow
const DEFAULT_ROUTES = [
  "/", // Step 1: Landing
  "/connect", // Step 2: Connect
  "/loading", // Step 3: Loading
  "/vibe-check", // Step 4: Vibe Check
  "/persona", // Step 5: Persona
  "/share", // Step 6: Share
];

const STEP_LABELS = [
  "Landing",
  "Connect wallet",
  "Loading wrap",
  "Vibe check",
  "Persona reveal",
  "Share wrap",
];

export function ProgressIndicator({
  currentStep,
  totalSteps,
  onNext,
  showNext = false,
  routes,
}: ProgressIndicatorProps) {
  const router = useRouter();
  const routeMap = routes || DEFAULT_ROUTES;
  const [isMobile, setIsMobile] = useState(false);
  const { playSound } = useSound();
  const currentStepLabel = STEP_LABELS[currentStep - 1] ?? `Step ${currentStep}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>(
        '[data-story-heading="true"], h1, h2, h3',
      );
      if (!heading) return;
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }
      heading.focus({ preventScroll: true });
    }, 100);

    return () => window.clearTimeout(id);
  }, [currentStep]);

  const handleStepNavigation = (direction: "left" | "right") => {
    if (direction === "left" && currentStep > 1) {
      const prevRoute = routeMap[currentStep - 2];
      if (prevRoute) router.push(prevRoute);
    } else if (direction === "right" && currentStep < totalSteps) {
      const nextRoute = routeMap[currentStep];
      if (nextRoute) {
        playSound(SOUND_NAMES.SLIDE_WHOOSH);
        router.push(nextRoute);
      }
    }
  };

  const handleStepKeyDown = (
    event: KeyboardEvent,
    stepIndex: number,
    route?: string,
  ) => {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (route && stepIndex + 1 !== currentStep) {
          if (stepIndex + 1 > currentStep) {
            playSound(SOUND_NAMES.SLIDE_WHOOSH);
          }
          router.push(route);
        }
        break;
      case "ArrowLeft":
        event.preventDefault();
        handleStepNavigation("left");
        break;
      case "ArrowRight":
        event.preventDefault();
        if (route && stepIndex + 1 > currentStep) {
          playSound(SOUND_NAMES.SLIDE_WHOOSH);
        }
        handleStepNavigation("right");
        break;
      case "Home":
        event.preventDefault();
        router.push("/");
        break;
      case "End":
        event.preventDefault();
        const lastRoute = routeMap[routeMap.length - 1];
        if (lastRoute) router.push(lastRoute);
        break;
    }
  };

  const handleHomeKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push("/");
    }
  };

  const handleNextKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNext?.();
    }
  };

  return (
    <>
      {/* Home button */}
      <motion.button
        onClick={() => router.push("/")}
        onKeyDown={handleHomeKeyDown}
        className="absolute top-6 left-6 md:top-8 md:left-8 z-30 group focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded-xl"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        tabIndex={0}
        aria-label="Go to home page"
        role="button"
      >
        <div
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-xl backdrop-blur-xl border border-white/20"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <Suspense fallback={<div className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />}>
            <HomeIcon
              className="w-4 h-4 md:w-5 md:h-5 text-white/80 group-hover:text-white transition-colors"
              aria-hidden="true"
            />
          </Suspense>
          <span className="text-xs md:text-sm font-black text-white/80 group-hover:text-white transition-colors hidden sm:inline">
            HOME
          </span>
        </div>
      </motion.button>

      <div
        className="sr-only"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Story progress: ${currentStepLabel}, step ${currentStep} of ${totalSteps}`}
      />

      <div
        className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 md:gap-3"
        role="navigation"
        aria-label={`Story steps. Current step: ${currentStepLabel}, ${currentStep} of ${totalSteps}`}
      >
        {[...Array(totalSteps)].map((_, index) => {
          const stepNumber = index + 1;
          const route = routeMap[index];
          const isClickable = route && stepNumber !== currentStep;
          const stepLabel = STEP_LABELS[index] ?? `Step ${stepNumber}`;

          const handleClick = () => {
            if (isClickable && route) {
              // Play slide sound only when navigating forward
              if (stepNumber > currentStep) {
                playSound(SOUND_NAMES.SLIDE_WHOOSH);
              }
              router.push(route);
            }
          };

          return (
            <motion.button
              key={index}
              onClick={handleClick}
              onKeyDown={(e) => handleStepKeyDown(e, index, route)}
              disabled={!isClickable}
              className="relative focus:outline-none p-2 -m-2 focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded-full"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={isClickable ? { scale: 1.2 } : {}}
              whileTap={isClickable ? { scale: 0.9 } : {}}
              tabIndex={0}
              role="button"
              aria-label={
                route && isClickable
                  ? `Go to ${stepLabel}, step ${stepNumber}`
                  : stepNumber === currentStep
                    ? `Current step: ${stepLabel}, step ${stepNumber}`
                    : `${stepLabel}, step ${stepNumber}`
              }
              aria-current={stepNumber === currentStep ? "step" : undefined}
              aria-disabled={!isClickable}
            >
              {/* Active indicator */}
              {stepNumber === currentStep ? (
                <motion.div
                  className="h-1.5 md:h-2 rounded-full"
                  style={{
                    width: isMobile ? "40px" : "60px",
                    backgroundColor: "var(--color-theme-primary)",
                    boxShadow: `0 0 20px rgba(var(--color-theme-primary-rgb), 0.6)`,
                  }}
                  layoutId="active-indicator"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              ) : (
                /* Inactive indicator */
                <div
                  className="h-1.5 md:h-2 rounded-full transition-all"
                  style={{
                    width:
                      stepNumber < currentStep
                        ? isMobile
                          ? "30px"
                          : "40px"
                        : isMobile
                          ? "20px"
                          : "30px",
                    backgroundColor:
                      stepNumber < currentStep
                        ? `rgba(var(--color-theme-primary-rgb), 0.4)`
                        : "rgba(255, 255, 255, 0.2)",
                    opacity: isClickable ? 1 : 0.5,
                    cursor: isClickable ? "pointer" : "default",
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Next button */}
      {showNext && onNext && (
        <motion.button
          onClick={() => {
            playSound(SOUND_NAMES.SLIDE_WHOOSH);
            onNext();
          }}
          onKeyDown={handleNextKeyDown}
          className="absolute bottom-8 right-8 md:bottom-12 md:right-12 z-30 group focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          tabIndex={0}
          role="button"
          aria-label="Go to next step"
        >
          <div className="relative">
            <motion.div
              className="absolute -inset-2 rounded-full blur-lg"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
              animate={{
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
            <div
              className="relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 transition-all"
              style={{
                backgroundColor: "#000000",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <Suspense
                fallback={<div className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true" />}
              >
                <ArrowRightIcon
                  className="w-6 h-6 md:w-7 md:h-7 text-white"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </Suspense>
            </div>
          </div>
        </motion.button>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`${currentStepLabel}. Step ${currentStep} of ${totalSteps}.`}
      </div>
    </>
  );
}

export default ProgressIndicator;
