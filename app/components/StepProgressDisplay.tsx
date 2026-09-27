"use client";

import { lazy, Suspense } from "react";
import { useWrapStore } from "@/app/store/wrapStore";
import { INDEXING_STEPS, STEP_ORDER } from "@/app/types/indexing";

const AlertCircle = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.AlertCircle }))
);
const RotateCcw = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.RotateCcw }))
);
const X = lazy(() =>
  import("lucide-react").then((m) => ({ default: m.X }))
);

const motion = {
  div: lazy(() =>
    import("framer-motion").then((m) => ({ default: m.motion.div }))
  ),
  span: lazy(() =>
    import("framer-motion").then((m) => ({ default: m.motion.span }))
  ),
  button: lazy(() =>
    import("framer-motion").then((m) => ({ default: m.motion.button }))
  ),
};

const AnimatePresence = lazy(() =>
  import("framer-motion").then((m) => ({ default: m.AnimatePresence }))
);

interface StepProgressDisplayProps {
  onRetry?: () => void;
  onCancel?: () => void;
}

function StepProgressDisplayBase({
  onRetry,
  onCancel,
}: StepProgressDisplayProps) {
  const {
    currentStep,
    stepProgress,
    overallProgress,
    completedSteps,
    totalSteps,
    indexingError,
    estimatedTimeRemaining,
    isLoading,
    metrics,
    startTime,
  } = useWrapStore();

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  };

  // Calculate better ETA using transaction metrics if available
  const calculateETA = (): number | null => {
    if (
      metrics.totalTransactions &&
      metrics.transactionCount > 0 &&
      startTime
    ) {
      const elapsed = Date.now() - startTime;
      const transactionsProcessed = metrics.transactionCount;
      const transactionsRemaining =
        metrics.totalTransactions - transactionsProcessed;
      if (transactionsRemaining <= 0) return 0;

      const timePerTransaction = elapsed / transactionsProcessed;
      return transactionsRemaining * timePerTransaction;
    }
    return estimatedTimeRemaining;
  };

  const eta = calculateETA();

  if (!isLoading && !indexingError) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto px-4"
    >
      {/* Main Progress Container */}
      <div className="relative rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-transparent backdrop-blur-xl p-8 space-y-6">
        {/* Screen Reader Progress Announcer */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {!indexingError && (currentStep ? `Step ${completedSteps + 1} of ${totalSteps}: ${INDEXING_STEPS[currentStep].label}. ${Math.floor(overallProgress / 20) * 20}% complete.` : "Preparing your data...")}
        </div>

        {/* Header Section */}
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-white">
            {indexingError ? "Indexing Error" : "Indexing Your Wrapped"}
          </h2>
          <p className="text-neutral-400 text-sm md:text-base">
            {indexingError
              ? indexingError.message
              : currentStep
                ? INDEXING_STEPS[currentStep].description
                : "Preparing your data..."}
          </p>
        </div>

        {/* Current Step Info */}
        <AnimatePresence mode="wait">
          {currentStep && !indexingError && (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10"
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                  Current Step
                </p>
                <p className="text-lg md:text-xl font-bold text-white">
                  {INDEXING_STEPS[currentStep].label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                  Step Progress
                </p>
                <p className="text-lg md:text-xl font-bold text-white">
                  {stepProgress[currentStep]}%
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="step-progress"
              className="text-xs uppercase tracking-widest text-neutral-500"
            >
              Step Progress
            </label>
            <span className="text-xs font-mono text-neutral-400">
              {currentStep ? stepProgress[currentStep] : 0}%
            </span>
          </div>
          <motion.div
            id="step-progress"
            className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10"
            role="progressbar"
            aria-valuenow={currentStep ? stepProgress[currentStep] : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={
              currentStep
                ? `${INDEXING_STEPS[currentStep].label} progress`
                : "Step progress"
            }
          >
            <div
              className="h-full bg-linear-to-r from-(--color-theme-primary) to-(--color-theme-primary) rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${currentStep ? stepProgress[currentStep] : 0}%`,
                boxShadow: "var(--color-theme-primary) 0 0 10px",
              }}
            />
          </motion.div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="overall-progress"
              className="text-xs uppercase tracking-widest text-neutral-500"
            >
              Overall Progress
            </label>
            <span className="text-xs font-mono text-neutral-400">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
          <motion.div
            id="overall-progress"
            className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10"
            role="progressbar"
            aria-valuenow={overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall indexing progress"
          >
            <div
              className="h-full bg-linear-to-r from-(--color-theme-primary) to-(--color-theme-primary) transition-[width] duration-300 ease-out"
              style={{
                width: `${overallProgress}%`,
                boxShadow: "var(--color-theme-primary) 0 0 15px",
              }}
            />
          </motion.div>
        </div>

        {/* Step Timeline */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Steps
          </p>
          <div className="grid grid-cols-7 gap-2">
            {STEP_ORDER.map((step, index) => {
              const isCompleted = completedSteps > index;
              const isCurrentStep = currentStep === step;
              const isPending = completedSteps <= index;

              return (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                  title={INDEXING_STEPS[step].label}
                >
                  <div
                    className={`h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? "border-(--color-theme-primary) bg-(--color-theme-primary)/20 text-white"
                        : isCurrentStep
                          ? "border-(--color-theme-primary) bg-(--color-theme-primary)/40 text-white"
                          : isPending
                            ? "border-white/20 bg-white/5 text-neutral-500"
                            : "border-white/10 bg-white/5 text-neutral-400"
                    }`}
                  >
                    {isCompleted ? (
                      <span>✓</span>
                    ) : isCurrentStep ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block"
                      >
                        ◆
                      </motion.span>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Time Estimate */}
    {eta !== null && eta > 5000 && !indexingError && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-sm text-neutral-400"
      >
        Est. ~<span className="font-semibold text-white">{formatTime(eta)}</span> remaining
      </motion.div>
    )}

        {/* Error State */}
        <AnimatePresence>
          {indexingError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-300">
                    Error in {INDEXING_STEPS[indexingError.step].label}
                  </p>
                  <p className="text-sm text-red-200/80">{indexingError.message}</p>
                </div>
              </div>

              {/* Error Actions */}
              <div className="flex gap-3 pt-2">
                {indexingError.recoverable && onRetry && (
                  <motion.button
                    onClick={onRetry}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRetry();
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm font-medium text-red-300 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </motion.button>
                )}
                {onCancel && (
                  <motion.button
                    onClick={onCancel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onCancel();
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-500/20 hover:bg-neutral-500/30 border border-neutral-500/30 rounded-lg text-sm font-medium text-neutral-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function StepProgressDisplay(props: StepProgressDisplayProps) {
  return (
    <Suspense
      fallback={
        <div role="status" className="w-full max-w-2xl mx-auto px-4">
          <span className="sr-only">Loading progress display...</span>
          <div
            aria-hidden="true"
            className="relative rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-transparent backdrop-blur-xl p-8 space-y-6"
          >
            <div className="space-y-2">
              <div className="h-8 w-2/3 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-2 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>
      }
    >
      <StepProgressDisplayBase {...props} />
    </Suspense>
  );
}

export default StepProgressDisplay;
