"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useWrapStore } from "@/app/store/wrapStore";
import type { IndexingStep } from "@/app/types/indexing";
import {
  getFactsForStep,
  shuffleFacts,
  STELLAR_FACTS,
} from "@/src/data/stellarFacts";

const ROTATE_MS = 5000;
const MIN_DISPLAY_MS = 3000;

interface StellarFunFactsProps {
  isLoading: boolean;
}

export function StellarFunFacts({ isLoading }: StellarFunFactsProps) {
  const { currentStep } = useWrapStore();
  const [elapsedEnough, setElapsedEnough] = useState(false);
  const [index, setIndex] = useState(0);

  const shuffledFacts = useMemo(() => shuffleFacts(STELLAR_FACTS), []);

  const facts = useMemo(
    () => getFactsForStep(currentStep, shuffledFacts),
    [currentStep, shuffledFacts],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setElapsedEnough(true), MIN_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading || !elapsedEnough || facts.length === 0) return;

    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % facts.length);
    }, ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [isLoading, elapsedEnough, facts.length]);

  // Re-prioritize facts when step changes without resetting rotation abruptly
  useEffect(() => {
    setIndex(0);
  }, [currentStep]);

  if (!isLoading || !elapsedEnough) return null;

  const fact = facts[index];
  if (!fact) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      className="text-center px-4 py-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className="text-xs uppercase tracking-[0.25em] mb-2 font-semibold"
        style={{ color: "rgba(var(--color-theme-primary-rgb), 0.7)" }}
      >
        Did you know?
      </p>
      <div className="min-h-[3.5rem] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${currentStep}-${index}-${fact.text}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5 }}
            className="text-sm md:text-base italic text-white/60 max-w-lg leading-relaxed"
          >
            {fact.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
