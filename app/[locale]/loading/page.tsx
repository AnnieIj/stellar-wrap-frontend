"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo } from "react";
import { Home, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProgressIndicator } from "../../components/ProgressIndicator";
import { StepProgressDisplay } from "../../components/StepProgressDisplay";
import { CacheStatusBadge } from "../../components/CacheStatusBadge";
import { MuteToggle } from "../../components/MuteToggle";
import { ProgressRecoveryBanner } from "../../components/ProgressRecoveryBanner";
import { useWrapStore, type WrapResult } from "../../store/wrapStore";

import { useSound } from "../../hooks/useSound";
import { useReducedMotion, reducedMotionTransition } from "../../hooks/useReducedMotion";
import { SOUND_NAMES } from "../../utils/soundManager";
import { indexAccount } from "../../services/indexerService";
import { IndexerEventEmitter } from "../../utils/indexerEventEmitter";
import { isZeroActivityResult } from "../../utils/zeroActivity";
import {
  beginIndexingAbortScope,
  abortIndexingRequests,
  clearIndexingAbortScope,
  isAbortError,
} from "../../utils/indexingAbort";
import { trackEvent } from "../../utils/plausible";
import { ZeroActivityEmptyState } from "../../components/ZeroActivityEmptyState";
import { DEMO_STELLAR_ADDRESS, isDemoMode } from "@/app/data/demoAccount";
import {
  getMostRecentCachedData,
  parseCachedDataKey,
} from "@/app/services/cacheService";
import { mapIndexerResultToWrapResult } from "@/app/utils/wrapResultMapper";
import { type IndexerResult } from "@/app/utils/indexer";

export default function LoadingScreen() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { address, period, network, status, result, setStatus, setResult, setError, setCacheMeta, startIndexing, cancelIndexing, completeIndexing, syncIndexingProgress, refreshToken, bumpRefreshToken, setRefreshing } =
    useWrapStore();

  const { playSound } = useSound();
  const showZeroActivity =
    Boolean(address) &&
    status === "ready" &&
    isZeroActivityResult(result);

  const handleComplete = useCallback(() => {
    playSound(SOUND_NAMES.SLIDE_WHOOSH);
    router.push("/persona");
  }, [router, playSound]);

  const handleCancel = useCallback(() => {
    abortIndexingRequests();
    cancelIndexing();
    toast.info("Indexing cancelled");
    router.push("/connect");
  }, [cancelIndexing, router]);

  const handleRetry = useCallback(() => {
    // Reset error state and re-run the loading flow by reloading the page
    // (useEffect cleanup + re-mount is the cleanest way without prop-drilling)
    window.location.reload();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      syncIndexingProgress();

      const state = useWrapStore.getState();
      if (state.status === "ready" && !isZeroActivityResult(state.result)) {
        handleComplete();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleComplete, syncIndexingProgress]);

  useEffect(() => {
    let isMounted = true;
    const abortSignal = beginIndexingAbortScope();

    IndexerEventEmitter.getInstance().connectToStore();
    startIndexing();
    trackEvent("wrap_started");

    // Helper to emit progress through all indexing steps (for fallback/demo mode)
    const emitProgressThroughSteps = async () => {
      const emitter = IndexerEventEmitter.getInstance();
      const steps = [
        "initializing",
        "fetching-transactions",
        "filtering-timeframes",
        "calculating-volume",
        "identifying-assets",
        "counting-contracts",
        "finalizing",
      ] as const;

      for (const step of steps) {
        emitter.emitStepChange(step);
        // Animate progress for this step
        for (let i = 0; i <= 100; i += 20) {
          emitter.emitStepProgress(step, i);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        emitter.emitStepComplete(step);
      }
    };

    const buildCachedWrapResult = async (cached: {
      key?: string;
      result: IndexerResult;
      timestamp: number;
    }): Promise<WrapResult> => {
      if (cached.key) {
        const parsed = parseCachedDataKey(cached.key);
        if (parsed) {
          useWrapStore.getState().setAddress(parsed.accountAddress);
          useWrapStore.getState().setNetwork(parsed.network);
          if (parsed.timeframe !== "biweekly") {
            useWrapStore.getState().setPeriod(parsed.timeframe);
          }
        }
      }

      setCacheMeta({
        fromCache: true,
        cacheTimestamp: cached.timestamp,
        offline: true,
      });
      await emitProgressThroughSteps();
      return mapIndexerResultToWrapResult(cached.result);
    };

    const loadWrap = async () => {
      try {
        setStatus("loading");
        setError(null);
        const { isRefreshing } = useWrapStore.getState();
        if (!isRefreshing) {
          setCacheMeta(null);
        }

        // NOTE: Do NOT call loadIndexingState() here - it will overwrite isLoading: true
        // The startIndexing() call above already set isLoading, which is what matters

        // Call real indexer service - will emit step progress events
        let result: WrapResult | null = null;

        if (isDemoMode() || address === DEMO_STELLAR_ADDRESS) {
          await emitProgressThroughSteps();
          result = mapIndexerResultToWrapResult({
            accountId: DEMO_ADDRESS,
            totalTransactions: 42,
            totalVolume: 0,
            mostActiveAsset: "XLM",
            contractCalls: 0,
            gasSpent: 0,
            dapps: [],
            vibes: [],
            largestTransaction: { amount: 1000, assetCode: "XLM" },
          });
        } else if (address) {
          if (!navigator.onLine) {
            const cached = await getMostRecentCachedData();
            if (cached) {
              result = await buildCachedWrapResult(cached);
            }
          } else {
            const indexerResult = await indexAccount(address, network, period);
            result = mapIndexerResultToWrapResult(indexerResult.result);
            setCacheMeta({
              fromCache: indexerResult.fromCache,
              cacheTimestamp: indexerResult.cacheTimestamp,
              refreshingInBackground: indexerResult.refreshingInBackground,
            });
          }
        } else {
          if (!navigator.onLine) {
            const cached = await getMostRecentCachedData();
            if (cached) {
              result = await buildCachedWrapResult(cached);
            }
          } else {
            throw new Error("No account selected. Return to connect and choose an account.");
          }
        }

        if (!isMounted || abortSignal.aborted || useWrapStore.getState().isCancelled) return;

        if (!result) {
          throw new Error("No wrap data available.");
        }

        setResult(result);
        setStatus("ready");
        completeIndexing();
        useWrapStore.getState().setRefreshing(false);
        playSound(SOUND_NAMES.MINT_SUCCESS);
        trackEvent("wrap_completed");

        // Honest empty state for valid accounts with no period activity
        if (address && isZeroActivityResult(result)) {
          return;
        }

        // Give progress display time to be visible (minimum 1.5 seconds)
        setTimeout(() => {
          if (isMounted) {
            handleComplete();
          }
        }, 1500);
      } catch (error: unknown) {
        if (isAbortError(error) || !isMounted) return;
        setStatus("error");
        useWrapStore.getState().setRefreshing(false);
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load wrap data");
        }
        if (!navigator.onLine) {
          return;
        }
        // Fallback: still navigate so user isn’t stuck
        // Keep the error visible; only explicit demo mode may use mock data.
      }
    };

    loadWrap();

    return () => {
      isMounted = false;
      abortIndexingRequests();
      clearIndexingAbortScope();
      IndexerEventEmitter.getInstance().reset();
    };
  }, [
    address,
    period,
    network,
    setError,
    setResult,
    setStatus,
    setCacheMeta,
    handleComplete,
    startIndexing,
    completeIndexing,
    refreshToken,
    bumpRefreshToken,
    setRefreshing,
  ]);

  const starConfigs = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        left: (i * 13) % 100,
        top: (i * 29) % 100,
        duration: 3 + (i % 5),
        delay: i % 6,
      })),
    [],
  );

  return (
    <div className="relative w-full min-h-screen h-screen overflow-hidden flex items-center justify-center bg-theme-background">
      <ProgressRecoveryBanner />
      <ProgressIndicator currentStep={3} totalSteps={6} showNext={false} />

      {showZeroActivity ? (
        <div className="relative z-40 w-full max-w-2xl px-4">
          <ZeroActivityEmptyState />
        </div>
      ) : (
      /* Container for centered layout with progress left and content right */
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-6xl px-4 pointer-events-auto">
        <div className="flex items-center justify-between gap-8">
          {/* StepProgressDisplay - Real-time indexing step progress with labels */}
          <div className="w-full md:w-full lg:max-w-3xl pointer-events-auto space-y-4">
            <StepProgressDisplay
              onCancel={handleCancel}
              onRetry={handleRetry}
            />
            <CacheStatusBadge />
          </div>

          {/* Content area - Right side will be filled by the main content below */}
        </div>
      </div>
      )}

      <div className="absolute inset-0 from-black via-black to-black opacity-60" />

      <motion.button
        onClick={() => router.push("/")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/");
          }
        }}
        className="absolute top-6 left-6 md:top-8 md:left-8 z-30 group"
        aria-label="Go to home page"
        initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reducedMotionTransition(prefersReducedMotion, { delay: 0.2 })}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-xl backdrop-blur-xl border border-white/20"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <Home
            className="w-4 h-4 md:w-5 md:h-5 text-white/80 group-hover:text-white transition-colors"
            aria-hidden="true"
          />
          <span className="text-xs md:text-sm font-black text-white/80 group-hover:text-white transition-colors hidden sm:inline">
            HOME
          </span>
        </div>
      </motion.button>

      <motion.div
        className="absolute top-6 right-6 md:top-8 md:right-8 z-30"
        initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reducedMotionTransition(prefersReducedMotion, { delay: 0.2 })}
      >
        <MuteToggle />
      </motion.div>

      {!showZeroActivity && (
      <motion.button
        onClick={() => {
          playSound(SOUND_NAMES.SLIDE_WHOOSH);
          handleComplete();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            playSound(SOUND_NAMES.SLIDE_WHOOSH);
            handleComplete();
          }
        }}
        className="absolute bottom-8 right-8 md:bottom-12 md:right-12 z-30 group"
        aria-label="Skip loading and go to persona step"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reducedMotionTransition(prefersReducedMotion, { delay: 1 })}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <motion.div
              className="absolute -inset-2 rounded-full blur-lg"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
              animate={
                prefersReducedMotion
                  ? { opacity: 0.5 }
                  : { opacity: [0.4, 0.7, 0.4] }
              }
              transition={reducedMotionTransition(prefersReducedMotion, {
                duration: 2,
                repeat: Infinity,
              })}
            />
            <div
              className="relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 transition-all"
              style={{
                backgroundColor: "#000000",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <ChevronRight
                className="w-6 h-6 md:w-7 md:h-7 text-white"
                aria-hidden="true"
              />
            </div>
          </div>
          <span className="text-xs font-black text-white/60 group-hover:text-white/80 transition-colors">
            SKIP
          </span>
        </div>
      </motion.button>
      )}

      <div className="absolute inset-0 opacity-20">
        <motion.div
          className="w-full h-full"
          style={{
            backgroundImage: `linear-gradient(rgba(var(--color-theme-primary-rgb), 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(var(--color-theme-primary-rgb), 0.3) 1px, transparent 1px)`,
            backgroundSize: "100px 100px",
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { backgroundPosition: ["0px 0px", "100px 100px"] }
          }
          transition={reducedMotionTransition(prefersReducedMotion, {
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          })}
        />
      </div>

      {!prefersReducedMotion &&
        starConfigs.map((cfg, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${cfg.left}%`,
            top: `${cfg.top}%`,
            backgroundColor: "var(--color-theme-primary)",
          }}
          animate={{
            y: [0, -100, -200],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: cfg.duration,
            repeat: Infinity,
            delay: cfg.delay,
          }}
        />
      ))}

      <motion.div
        className="absolute w-96 h-96 rounded-full blur-[120px]"
        style={{ backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.3)" }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.35, scale: 1 }
            : {
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [-50, 50, -50],
                y: [-50, 50, -50],
              }
        }
        transition={reducedMotionTransition(prefersReducedMotion, {
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        })}
      />

      <motion.div
        className="absolute w-80 h-80 rounded-full blur-[100px]"
        style={{ backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.2)" }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.25, scale: 1 }
            : {
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2],
                x: [50, -50, 50],
                y: [50, -50, 50],
              }
        }
        transition={reducedMotionTransition(prefersReducedMotion, {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        })}
      />

      {!showZeroActivity && (
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 px-4 w-full max-w-6xl">
        <div className="flex items-center justify-between gap-8">
          {/* Left side: reserved for progress (empty here, filled by overlay) */}
          <div className="w-80 md:w-96" />

          {/* Right side: WRAPPING YOUR JOURNEY content */}
          <div className="flex-1">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotionTransition(prefersReducedMotion, {
                delay: 0.3,
                type: "spring",
                stiffness: 100,
              })}
            >
              <motion.h1
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-4 md:mb-6 tracking-tighter leading-none"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        textShadow: [
                          `0 0 20px rgba(var(--color-theme-primary-rgb), 0.5)`,
                          `0 0 40px rgba(var(--color-theme-primary-rgb), 0.8)`,
                          `0 0 20px rgba(var(--color-theme-primary-rgb), 0.5)`,
                        ],
                      }
                }
                transition={reducedMotionTransition(prefersReducedMotion, {
                  duration: 2,
                  repeat: Infinity,
                })}
              >
                WRAPPING
              </motion.h1>
              <motion.h2
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white/80 mb-6 md:mb-10 tracking-tight leading-none"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reducedMotionTransition(prefersReducedMotion, {
                  delay: 0.6,
                })}
              >
                YOUR JOURNEY
              </motion.h2>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reducedMotionTransition(prefersReducedMotion, {
                  delay: 0.9,
                })}
                className="inline-block"
              >
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 blur-lg md:blur-xl rounded-xl md:rounded-2xl"
                    style={{
                      backgroundColor:
                        "rgba(var(--color-theme-primary-rgb), 0.4)",
                    }}
                    animate={
                      prefersReducedMotion
                        ? { opacity: 0.6 }
                        : { opacity: [0.5, 0.8, 0.5] }
                    }
                    transition={reducedMotionTransition(prefersReducedMotion, {
                      duration: 2,
                      repeat: Infinity,
                    })}
                  />
                  <div
                    className="relative backdrop-blur-sm px-6 py-3 sm:px-8 sm:py-4 md:px-12 md:py-6 rounded-xl md:rounded-2xl"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      borderColor: "rgba(var(--color-theme-primary-rgb), 0.5)",
                      borderWidth: "1px",
                    }}
                  >
                    <h3
                      className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black"
                      style={{
                        background: `linear-gradient(to right, #ffffff, var(--color-theme-primary))`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      STELLAR
                    </h3>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="mt-12 md:mt-16 w-48 sm:w-56 md:w-64 h-1 bg-white/10 rounded-full mx-auto overflow-hidden"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reducedMotionTransition(prefersReducedMotion, {
                delay: 1.2,
              })}
              aria-hidden={false}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Loading progress"
            >
              <motion.div
                className="h-full"
                style={{ backgroundColor: "var(--color-theme-primary)" }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.01 }
                    : { duration: 2.5, ease: "easeInOut" }
                }
              />
            </motion.div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
